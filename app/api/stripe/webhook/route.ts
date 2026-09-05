import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { getStripe, STRIPE_WEBHOOK_SECRET } from "@/lib/stripe/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// We use a service-role Supabase client because webhook requests come from
// Stripe (no user cookie), but they need to write across tenants/leases/
// payments owned by different users. RLS is bypassed only on this trusted
// path, and we verify the Stripe signature before touching the DB.
function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) {
    throw new Error(
      "Webhook needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

async function handlePaymentIntent(intent: Stripe.PaymentIntent) {
  const db = adminClient();
  const status = intent.status; // succeeded | processing | requires_action | canceled
  const ourStatus =
    status === "succeeded"
      ? "succeeded"
      : status === "processing"
        ? "processing"
        : status === "canceled"
          ? "failed"
          : "pending";

  // Stripe charges its fee on succeeded payments
  let fee: number | null = null;
  if (status === "succeeded" && intent.latest_charge) {
    try {
      const charge = await getStripe().charges.retrieve(intent.latest_charge as string, {
        expand: ["balance_transaction"],
      });
      const bt = (charge.balance_transaction as Stripe.BalanceTransaction) || null;
      if (bt) fee = bt.fee / 100;
    } catch (e) {
      console.warn("fee lookup failed", e);
    }
  }

  const update: Record<string, unknown> = { processor_status: ourStatus };
  if (fee !== null) update.processor_fee = fee;

  await db
    .from("payments")
    .update(update)
    .eq("stripe_payment_intent_id", intent.id);
}

async function handlePaymentIntentFailed(intent: Stripe.PaymentIntent) {
  const db = adminClient();
  await db
    .from("payments")
    .update({ processor_status: "failed" })
    .eq("stripe_payment_intent_id", intent.id);
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  // Autopay (subscription) charged successfully. Create the payment row if
  // it doesn't already exist (we may have already created it from another
  // event), keyed by the payment_intent on the invoice.
  const subId = (invoice as any).subscription as string | null;
  if (!subId) return;
  const intentId = (invoice as any).payment_intent as string | null;
  if (!intentId) return;

  const db = adminClient();
  const { data: lease } = await db
    .from("leases")
    .select("id, owner_id, tenant_id, monthly_rent")
    .eq("stripe_subscription_id", subId)
    .maybeSingle();
  if (!lease) return;

  // For_month derives from the invoice period start
  const periodStart = invoice.period_start || invoice.created;
  const forMonth = new Date(periodStart * 1000).toISOString().slice(0, 10);
  const amount = (invoice.amount_paid || 0) / 100;

  const { data: existing } = await db
    .from("payments")
    .select("id")
    .eq("stripe_payment_intent_id", intentId)
    .maybeSingle();

  if (existing) {
    await db
      .from("payments")
      .update({ processor_status: "succeeded", amount })
      .eq("id", existing.id);
  } else {
    await db.from("payments").insert({
      owner_id: lease.owner_id,
      lease_id: lease.id,
      payment_type: "rent",
      amount,
      payment_date: new Date().toISOString().slice(0, 10),
      for_month: forMonth.slice(0, 7) + "-01",
      payment_method: "ach",
      method_kind: "ach",
      processor: "stripe",
      processor_status: "succeeded",
      stripe_payment_intent_id: intentId,
      reference_number: intentId,
    });
  }
}

async function handleSetupIntentSucceeded(intent: Stripe.SetupIntent) {
  // A new payment method has been saved. Mark our local row as active and
  // populate brand/last4 in case the upsert from the client didn't run.
  if (!intent.payment_method) return;
  const pmId =
    typeof intent.payment_method === "string"
      ? intent.payment_method
      : intent.payment_method.id;
  const db = adminClient();
  await db
    .from("tenant_payment_methods")
    .update({ status: "active" })
    .eq("stripe_payment_method_id", pmId);
}

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  if (!sig || !STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "Webhook misconfigured" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;
  try {
    const body = await req.text();
    event = getStripe().webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    console.error("webhook signature verification failed", err.message);
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded":
      case "payment_intent.processing":
      case "payment_intent.canceled":
        await handlePaymentIntent(event.data.object as Stripe.PaymentIntent);
        break;
      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      case "invoice.paid":
      case "invoice.payment_succeeded":
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      case "invoice.payment_failed":
        // mark the related payment failed if we have one; otherwise log
        {
          const inv = event.data.object as Stripe.Invoice;
          const intentId = (inv as any).payment_intent as string | null;
          if (intentId) {
            await adminClient()
              .from("payments")
              .update({ processor_status: "failed" })
              .eq("stripe_payment_intent_id", intentId);
          }
        }
        break;
      case "setup_intent.succeeded":
        await handleSetupIntentSucceeded(event.data.object as Stripe.SetupIntent);
        break;
      default:
        // ignore everything else
        break;
    }
  } catch (err: any) {
    console.error("webhook handler error", err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
