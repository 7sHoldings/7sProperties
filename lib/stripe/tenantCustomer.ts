import type { SupabaseClient } from "@supabase/supabase-js";
import { getStripe } from "./server";

export type TenantRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  stripe_customer_id: string | null;
};

/**
 * Look up the tenant row tied to the currently authenticated user (tenant
 * portal). Returns null when the auth user isn't a tenant.
 */
export async function getCurrentTenant(supabase: SupabaseClient): Promise<TenantRow | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("tenants")
    .select("id, full_name, email, phone, stripe_customer_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  return (data as TenantRow) || null;
}

/**
 * Ensure the tenant has a Stripe customer. Creates one on demand and stores
 * the id back on the tenant row. Idempotent.
 */
export async function ensureStripeCustomer(
  supabase: SupabaseClient,
  tenant: TenantRow
): Promise<string> {
  if (tenant.stripe_customer_id) return tenant.stripe_customer_id;
  const stripe = getStripe();
  const customer = await stripe.customers.create({
    name: tenant.full_name,
    email: tenant.email || undefined,
    phone: tenant.phone || undefined,
    metadata: { tenant_id: tenant.id },
  });
  await supabase
    .from("tenants")
    .update({ stripe_customer_id: customer.id })
    .eq("id", tenant.id);
  return customer.id;
}
