import Stripe from "stripe";

let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Add it to your environment (see .env.example)."
    );
  }
  cached = new Stripe(key, {
    apiVersion: "2026-04-22.dahlia",
    typescript: true,
    appInfo: { name: "7s Properties", version: "0.1.0" },
  });
  return cached;
}

export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";

export function dollarsToCents(amount: number | string): number {
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(n)) throw new Error("Invalid amount");
  return Math.round(n * 100);
}

export function centsToDollars(cents: number): number {
  return Math.round(cents) / 100;
}
