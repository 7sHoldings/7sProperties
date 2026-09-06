#!/usr/bin/env node
// Applies pending Supabase SQL migrations.
//
// Order and contents come from supabase/migrations.json. Applied files are
// recorded in the public.schema_migrations table, so every run only does what
// is still outstanding, and running it twice is a no-op.
//
// Usage:
//   npm run migrate            apply everything pending
//   npm run migrate:check      list what would run, change nothing
//
// Needs a Postgres connection string in SUPABASE_DB_URL (or DATABASE_URL).
// Supabase Dashboard → Project Settings → Database → Connection string → URI.
// Use the Session pooler URI in CI; GitHub runners can't reach the IPv6-only
// direct host.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SQL_DIR = join(ROOT, "supabase");
const MANIFEST = join(SQL_DIR, "migrations.json");

const DRY_RUN = process.argv.includes("--check") || process.argv.includes("--dry-run");
const ALLOW_DESTRUCTIVE = process.env.ALLOW_DESTRUCTIVE === "1";

// This database is the owner's system of record. A migration that can drop or
// erase rows never runs unnoticed — see CLAUDE.md.
const DESTRUCTIVE = [
  /\bDROP\s+TABLE\b/i,
  /\bDROP\s+SCHEMA\b/i,
  /\bDROP\s+DATABASE\b/i,
  /\bDROP\s+COLUMN\b/i,
  /\bTRUNCATE\b/i,
  /\bDELETE\s+FROM\b/i,
];

const log = (...a) => console.log(...a);
const fail = (msg) => {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
};

/** Strip SQL comments so prose in a header can't trip the safety scan. */
function stripComments(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ");
}

function checksum(text) {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

function loadManifest() {
  const raw = JSON.parse(readFileSync(MANIFEST, "utf8"));
  if (!Array.isArray(raw.migrations)) fail(`${MANIFEST} has no "migrations" array`);
  return raw.migrations.map((entry) => {
    const sql = readFileSync(join(SQL_DIR, entry.file), "utf8");
    return { ...entry, sql, checksum: checksum(sql) };
  });
}

async function main() {
  const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    fail(
      "SUPABASE_DB_URL is not set.\n" +
        "  Local:  add it to .env.local and run `npm run migrate`\n" +
        "  CI:     add it as the SUPABASE_DB_URL repository secret"
    );
  }

  const migrations = loadManifest();
  log(`\n${migrations.length} migration(s) in supabase/migrations.json\n`);

  const client = new pg.Client({
    connectionString,
    // Supabase terminates TLS with its own CA; verification is off for the
    // same reason psql uses sslmode=require against it.
    ssl: { rejectUnauthorized: false },
    application_name: "7sproperties-migrate",
  });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.schema_migrations (
        name        TEXT PRIMARY KEY,
        checksum    TEXT NOT NULL,
        applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        baselined   BOOLEAN NOT NULL DEFAULT FALSE
      )
    `);

    const { rows: applied } = await client.query(
      "SELECT name, checksum FROM public.schema_migrations"
    );
    const appliedByName = new Map(applied.map((r) => [r.name, r.checksum]));

    // First run against a database that already has the app's tables: the
    // baseline files were applied by hand, so record them instead of re-running.
    if (appliedByName.size === 0) {
      const { rows } = await client.query(
        "SELECT to_regclass('public.payments') IS NOT NULL AS existing"
      );
      if (rows[0].existing) {
        const baseline = migrations.filter((m) => m.baseline);
        log(`Existing database detected — recording ${baseline.length} baseline migration(s)`);
        log("as already applied (they were run by hand). Nothing is re-executed.\n");
        if (!DRY_RUN) {
          for (const m of baseline) {
            await client.query(
              `INSERT INTO public.schema_migrations (name, checksum, baselined)
               VALUES ($1, $2, TRUE) ON CONFLICT (name) DO NOTHING`,
              [m.file, m.checksum]
            );
            appliedByName.set(m.file, m.checksum);
          }
        } else {
          baseline.forEach((m) => appliedByName.set(m.file, m.checksum));
        }
      } else {
        log("Empty database detected — building the schema from scratch.\n");
      }
    }

    // Warn if a file changed after it was applied; the database still holds
    // whatever the old version did.
    for (const m of migrations) {
      const prior = appliedByName.get(m.file);
      if (prior && prior !== m.checksum) {
        log(`⚠ ${m.file} changed since it was applied — add a new migration instead of editing it.`);
      }
    }

    const pending = migrations.filter((m) => !appliedByName.has(m.file));

    if (pending.length === 0) {
      log("✓ Database is up to date — nothing to apply.\n");
      return;
    }

    log(`${pending.length} migration(s) pending:`);
    pending.forEach((m) => log(`   • ${m.file}`));
    log("");

    if (DRY_RUN) {
      log("--check: nothing was applied.\n");
      return;
    }

    for (const m of pending) {
      const body = stripComments(m.sql);
      const danger = DESTRUCTIVE.find((re) => re.test(body));
      if (danger && !ALLOW_DESTRUCTIVE) {
        fail(
          `${m.file} contains a destructive statement (${danger}).\n` +
            "  Migrations must be additive — this database holds the owner's only\n" +
            "  copy of their rental records. Re-run with ALLOW_DESTRUCTIVE=1 only if\n" +
            "  the data loss is intended and backed up."
        );
      }

      process.stdout.write(`→ ${m.file} ... `);
      // One transaction per migration: Postgres rolls back DDL, so a failure
      // can never leave the schema half-applied.
      await client.query("BEGIN");
      try {
        await client.query(m.sql);
        await client.query(
          `INSERT INTO public.schema_migrations (name, checksum) VALUES ($1, $2)`,
          [m.file, m.checksum]
        );
        await client.query("COMMIT");
        log("applied");
      } catch (err) {
        await client.query("ROLLBACK");
        log("failed");
        fail(`${m.file} failed and was rolled back:\n  ${err.message}`);
      }
    }

    log(`\n✓ Applied ${pending.length} migration(s).\n`);
  } finally {
    await client.end();
  }
}

main().catch((err) => fail(err.message));
