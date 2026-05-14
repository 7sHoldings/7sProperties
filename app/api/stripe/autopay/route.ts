import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dollarsToCents, getStripe } from "@/lib/stripe/server";
import { getCurrentTenant } from "@/lib/stripe/tenantCustomer";

// Enable autopay: create a Stripe subscription that charges the saved payment
// method on rent_due_day each month. Disable: cancel the subscription.
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const tenant = await getCurrentTenant(supabase);
    if (!tenant) {
      return NextResponse.json({ error: "Not a tenant" }, { status: 401 });
    }
    const { leaseId, paymentMethodId, enable } = (await req.json()) as {
      leaseId: string;
      paymentMethodId?: string;
      enable: boolean;
    };
    if (!leaseId) {
      return NextResponse.json({ error: "leaseId required" }, { status: 400 });
    }

    const { data: lease } = await supabase
      .from("leases")
      .select("id, owner_id, tenant_id, monthly_rent, rent_due_day, stripe_subscription_id")
      .eq("id", leaseId)
      .maybeSingle();
    if (!lease || lease.tenant_id !== tenant.id) {
      return NextResponse.json({ error: "Lease not found" }, { status: 404 });
    }

    const stripe = getStripe();

    if (!enable) {
      // Cancel existing subscription
      if (lease.stripe_subscription_id) {
        try {
          await stripe.subscriptions.cancel(lease.stripe_subscription_id);
        } catch (e) {
          console.warn("cancel subscription failed", e);
        }
      }
      await supabase
        .from("leases")
        .update({
          autopay_enabled: false,
          autopay_payment_method_id: null,
          stripe_subscription_id: null,
        })
        .eq("id", lease.id);
      return NextResponse.json({ ok: true });
    }

    // Enabling
    if (!paymentMethodId) {
      return NextResponse.json(
        { error: "paymentMethodId required to enable autopay" },
        { status: 400 }
      );
    }
    if (!tenant.stripe_customer_id) {
      return NextResponse.json({ error: "No customer on file" }, { status: 400 });
    }

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

    // If a subscription already exists, update its payment method instead of
    // creating a duplicate.
    if (lease.stripe_subscription_id) {
      try {
        await stripe.subscriptions.update(lease.stripe_subscription_id, {
          default_payment_method: paymentMethodId,
        });
        await supabase
          .from("leases")
          .update({
            autopay_enabled: true,
            autopay_payment_method_id: paymentMethodId,
          })
          .eq("id", lease.id);
        return NextResponse.json({ ok: true, updated: true });
      } catch (e) {
        console.warn("update subscription failed, recreating", e);
      }
    }

    // Find or create a single shared "Rent" product. Stripe requires
    // subscription price_data to reference an existing Product (not inline
    // product_data), so we look up by metadata.kind = "rent".
    const search = await stripe.products.search({
      query: "metadata['kind']:'rent' AND active:'true'",
      limit: 1,
    });
    const rentProductId =
      search.data[0]?.id ||
      (
        await stripe.products.create({
          name: "Rent",
          metadata: { kind: "rent" },
        })
      ).id;

    // Anchor billing to rent_due_day. Capped at 28 to avoid Stripe collapsing
    // 29/30/31 to month-end in shorter months.
    const dueDay = Math.min(Math.max(Number(lease.rent_due_day) || 1, 1), 28);
    const today = new Date();
    const anchor = new Date(
      today.getFullYear(),
      today.getMonth() + (today.getDate() > dueDay ? 1 : 0),
      dueDay
    );

    const subscription = await stripe.subscriptions.create({
      customer: tenant.stripe_customer_id,
      items: [
        {
          price_data: {
            currency: "usd",
            product: rentProductId,
            unit_amount: dollarsToCents(Number(lease.monthly_rent)),
            recurring: { interval: "month" },
          },
        },
      ],
      default_payment_method: paymentMethodId,
      payment_settings: {
        payment_method_types:
          pm.type === "us_bank_account" ? ["us_bank_account"] : ["card"],
        save_default_payment_method: "on_subscription",
      },
      billing_cycle_anchor: Math.floor(anchor.getTime() / 1000),
      proration_behavior: "none",
      collection_method: "charge_automatically",
      metadata: {
        lease_id: lease.id,
        tenant_id: tenant.id,
        owner_id: lease.owner_id,
      },
    });

    await supabase
      .from("leases")
      .update({
        autopay_enabled: true,
        autopay_payment_method_id: paymentMethodId,
        stripe_subscription_id: subscription.id,
      })
      .eq("id", lease.id);

    return NextResponse.json({ ok: true, subscription_id: subscription.id });
  } catch (err: any) {
    console.error("autopay error", err);
    return NextResponse.json(
      { error: err.message || "Failed to update autopay" },
      { status: 500 }
    );
  }
}
