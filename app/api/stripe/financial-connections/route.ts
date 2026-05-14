import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/server";
import { ensureStripeCustomer, getCurrentTenant } from "@/lib/stripe/tenantCustomer";

// Creates a Stripe Financial Connections session so the tenant can link a
// bank account directly (Plaid-style). On the client we use
// stripe.collectBankAccountForSetup or open the FC modal with the returned
// client_secret.
export async function POST() {
  try {
    const supabase = await createClient();
    const tenant = await getCurrentTenant(supabase);
    if (!tenant) {
      return NextResponse.json({ error: "Not a tenant" }, { status: 401 });
    }
    const customerId = await ensureStripeCustomer(supabase, tenant);

    const stripe = getStripe();
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ["us_bank_account"],
      payment_method_options: {
        us_bank_account: {
          financial_connections: { permissions: ["payment_method", "balances"] },
          verification_method: "automatic",
        },
      },
      usage: "off_session",
    });

    return NextResponse.json({
      client_secret: setupIntent.client_secret,
      customer_id: customerId,
    });
  } catch (err: any) {
    console.error("financial-connections error", err);
    return NextResponse.json(
      { error: err.message || "Failed to start bank link" },
      { status: 500 }
    );
  }
}
