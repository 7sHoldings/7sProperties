import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ConstructionProjectsList from "@/components/ConstructionProjectsList";

export default async function ConstructionPage() {
  const supabase = await createClient();

  const { data: projects } = await supabase
    .from("construction_projects")
    .select("*, construction_expenses(amount)");

  const list = (projects || []) as any[];

  // Fetch latest project photo per project + sign URLs (1hr) for the cards
  const ids = list.map((p) => p.id);
  const coverByProject: Record<string, string> = {};
  if (ids.length > 0) {
    const { data: photos } = await supabase
      .from("documents")
      .select("construction_project_id, file_path, created_at")
      .in("construction_project_id", ids)
      .eq("document_type", "photo")
      .order("created_at", { ascending: false });
    const seen = new Set<string>();
    for (const p of (photos || []) as any[]) {
      if (!p.construction_project_id || seen.has(p.construction_project_id)) continue;
      seen.add(p.construction_project_id);
      const { data: signed } = await supabase.storage
        .from("documents")
        .createSignedUrl(p.file_path, 3600);
      if (signed?.signedUrl) coverByProject[p.construction_project_id] = signed.signedUrl;
    }
  }
  list.forEach((p) => {
    p.cover_url = coverByProject[p.id] || null;
  });

  const totalBudget = list.reduce(
    (s: number, p: any) => s + (Number(p.budget) || 0),
    0
  );
  const totalSpent = list.reduce(
    (s: number, p: any) =>
      s + (p.construction_expenses || []).reduce((a: number, e: any) => a + Number(e.amount), 0),
    0
  );
  const inProgress = list.filter((p: any) => p.status === "in_progress").length;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-medium">Construction</h1>
          <p className="text-sm text-stone-500">
            {list.length} project{list.length === 1 ? "" : "s"} · track new builds before they
            become rentals
          </p>
        </div>
        <Link
          href="/construction/new"
          className="px-3 py-1.5 text-sm bg-teal-700 text-white rounded-md hover:bg-teal-800"
        >
          + New project
        </Link>
      </div>

      {list.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <Stat label="Active builds" value={String(inProgress)} />
          <Stat label="Total budget" value={`$${totalBudget.toLocaleString()}`} />
          <Stat
            label="Total spent"
            value={`$${totalSpent.toLocaleString()}`}
            sub={
              totalBudget > 0
                ? `${Math.round((totalSpent / totalBudget) * 100)}% of budget`
                : undefined
            }
          />
        </div>
      )}

      {list.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-xl p-10 text-center">
          <h2 className="text-lg font-medium mb-2">No construction projects yet</h2>
          <p className="text-sm text-stone-600 mb-4">
            Track build costs (lumber, labor, permits, etc.) for homes you&apos;re building. When
            the home is finished, convert it into a rental property in one click.
          </p>
          <Link
            href="/construction/new"
            className="px-4 py-2 text-sm bg-teal-700 text-white rounded-md hover:bg-teal-800"
          >
            + Start a project
          </Link>
        </div>
      ) : (
        <ConstructionProjectsList projects={list} />
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4">
      <div className="text-xs text-stone-500 mb-1">{label}</div>
      <div className="text-lg font-medium">{value}</div>
      {sub && <div className="text-xs text-stone-500 mt-0.5">{sub}</div>}
    </div>
  );
}
