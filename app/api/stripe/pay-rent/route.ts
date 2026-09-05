import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dollarsToCents, getStripe } from "@/lib/stripe/server";
import { getCurrentTenant } from "@/lib/stripe/tenantCustomer";

// Charge rent for a specific lease + for_month using a saved payment method.
// ACH payments come back as "processing" and finalize via webhook 3-5 days
// later. Card payments succeed (or fail) inline.
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const tenant = await getCurrentTenant(supabase);
    if (!tenant) {
      return NextResponse.json({ error: "Not a tenant" }, { status: 401 });
    }
    const body = await req.json();
    const { leaseId, paymentMethodId, amount, forMonth } = body as {
      leaseId: string;
      paymentMethodId: string;
      amount: number;
      forMonth: string; // YYYY-MM-01
    };
    if (!leaseId || !paymentMethodId || !amount || !forMonth) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Authorize: this lease must belong to the tenant
    const { data: lease } = await supabase
      .from("leases")
      .select("id, owner_id, tenant_id, monthly_rent")
      .eq("id", leaseId)
      .maybeSingle();
    if (!lease || lease.tenant_id !== tenant.id) {
      return NextResponse.json({ error: "Lease not found" }, { status: 404 });
    }

    // Verify the payment method belongs to this tenant
    const { data: pm } = await supabase
      .from("tenant_payment_methods")
      .select("*")
      .eq("stripe_payment_method_id", paymentMethodId)
      .eq("tenant_id", tenant.id)
      .neq("status", "detached")
      .maybeSingle();
    if (!pm) {
      return NextResponse.json({ error: "Payment method not found" }, { status: 404 });
    }
    if (!tenant.stripe_customer_id) {
      return NextResponse.json({ error: "No customer on file" }, { status: 400 });
    }

    const stripe = getStripe();
    const intent = await stripe.paymentIntents.create({
      amount: dollarsToCents(amount),
      currency: "usd",
      customer: tenant.stripe_customer_id,
      payment_method: paymentMethodId,
      payment_method_types: pm.type === "us_bank_account" ? ["us_bank_account"] : ["card"],
      confirm: true,
      off_session: false, // tenant is on-session via the portal
      description: `Rent for ${forMonth} (lease ${lease.id})`,
      metadata: {
        lease_id: lease.id,
        tenant_id: tenant.id,
        owner_id: lease.owner_id,
        for_month: forMonth,
      },
      mandate_data:
        pm.type === "us_bank_account"
          ? {
              customer_acceptance: {
                type: "online",
                online: {
                  ip_address: req.headers.get("x-forwarded-for") || "0.0.0.0",
                  user_agent: req.headers.get("user-agent") || "unknown",
                },
              },
            }
          : undefined,
    });

    // Record a payments row immediately so the tenant sees their attempt.
    // Final status flows in via webhook.
    const processorStatus = intent.status; // 'processing' for ACH, 'succeeded' for cards
    const ourStatus =
      processorStatus === "succeeded"
        ? "succeeded"
        : processorStatus === "requires_action"
          ? "pending"
          : "processing";

    await supabase.from("payments").insert({
      owner_id: lease.owner_id,
      lease_id: lease.id,
      payment_type: "rent",
      amount,
      payment_date: new Date().toISOString().slice(0, 10),
      for_month: forMonth,
      payment_method: pm.type === "us_bank_account" ? "ach" : "card",
      method_kind: pm.type === "us_bank_account" ? "ach" : "card",
      processor: "stripe",
      processor_status: ourStatus,
      stripe_payment_intent_id: intent.id,
      reference_number: intent.id,
    });

    return NextResponse.json({
      payment_intent_id: intent.id,
      status: intent.status,
      client_secret: intent.client_secret,
    });
  } catch (err: any) {
    console.error("pay-rent error", err);
    return NextResponse.json(
      { error: err.message || "Charge failed" },
      { status: 500 }
    );
  }
}
