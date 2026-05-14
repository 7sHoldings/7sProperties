import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/server";
import { getCurrentTenant } from "@/lib/stripe/tenantCustomer";

// List saved payment methods for the current tenant. We read from our local
// table (kept in sync via webhook + the setup-intent finalize callback).
export async function GET() {
  try {
    const supabase = await createClient();
    const tenant = await getCurrentTenant(supabase);
    if (!tenant) {
      return NextResponse.json({ error: "Not a tenant" }, { status: 401 });
    }
    const { data } = await supabase
      .from("tenant_payment_methods")
      .select("*")
      .eq("tenant_id", tenant.id)
      .neq("status", "detached")
      .order("created_at", { ascending: false });
    return NextResponse.json({ methods: data || [] });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to load payment methods" },
      { status: 500 }
    );
  }
}

// Detach a payment method (revoke + mark detached locally).
export async function DELETE(req: Request) {
  try {
    const supabase = await createClient();
    const tenant = await getCurrentTenant(supabase);
    if (!tenant) {
      return NextResponse.json({ error: "Not a tenant" }, { status: 401 });
    }
    const { id } = await req.json();
    const { data: row } = await supabase
      .from("tenant_payment_methods")
      .select("*")
      .eq("id", id)
      .eq("tenant_id", tenant.id)
      .maybeSingle();
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    try {
      await getStripe().paymentMethods.detach(row.stripe_payment_method_id);
    } catch (e) {
      // already detached on Stripe side — still mark locally
      console.warn("detach failed", e);
    }
    await supabase
      .from("tenant_payment_methods")
      .update({ status: "detached", is_default: false })
      .eq("id", row.id);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to remove method" },
      { status: 500 }
    );
  }
}

// Save a newly-attached payment method (called by the client after a Stripe
// SetupIntent succeeds, since we don't always get a webhook quickly).
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const tenant = await getCurrentTenant(supabase);
    if (!tenant) {
      return NextResponse.json({ error: "Not a tenant" }, { status: 401 });
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { paymentMethodId, makeDefault } = await req.json();
    if (!paymentMethodId) {
      return NextResponse.json({ error: "paymentMethodId required" }, { status: 400 });
    }

    const stripe = getStripe();
    const pm = await stripe.paymentMethods.retrieve(paymentMethodId);

    let type: "us_bank_account" | "card";
    let brand: string | null = null;
    let last4: string | null = null;
    let status: "active" | "unverified" = "active";

    if (pm.type === "us_bank_account") {
      type = "us_bank_account";
      brand = pm.us_bank_account?.bank_name || null;
      last4 = pm.us_bank_account?.last4 || null;
      // If pending micro-deposit verification, mark unverified
      const verifications = (pm as any).us_bank_account?.financial_connections_account
        ? "active"
        : "unverified";
      status = verifications === "active" ? "active" : "unverified";
    } else if (pm.type === "card") {
      type = "card";
      brand = pm.card?.brand || null;
      last4 = pm.card?.last4 || null;
    } else {
      return NextResponse.json(
        { error: `Unsupported payment method type: ${pm.type}` },
        { status: 400 }
      );
    }

    // Make sure it's attached to our customer
    if (!pm.customer && tenant.stripe_customer_id) {
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: tenant.stripe_customer_id,
      });
    }

    if (makeDefault) {
      await supabase
        .from("tenant_payment_methods")
        .update({ is_default: false })
        .eq("tenant_id", tenant.id);
    }

    const { data: row, error } = await supabase
      .from("tenant_payment_methods")
      .upsert(
        {
          owner_id: user!.id, // tenant's auth user; satisfies RLS on owner_id
          tenant_id: tenant.id,
          stripe_payment_method_id: paymentMethodId,
          type,
          brand,
          last4,
          is_default: !!makeDefault,
          status,
        },
        { onConflict: "stripe_payment_method_id" }
      )
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ method: row });
  } catch (err: any) {
    console.error("save payment-method error", err);
    return NextResponse.json(
      { error: err.message || "Failed to save method" },
      { status: 500 }
    );
  }
}
