import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/server";
import { ensureStripeCustomer, getCurrentTenant } from "@/lib/stripe/tenantCustomer";

// Setup intent for manually entered ACH (routing + account number with
// micro-deposit verification). The client confirms with
// confirmUsBankAccountSetup; verification happens later when the tenant
// returns to verify the two test amounts.
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
        us_bank_account: { verification_method: "microdeposits" },
      },
      usage: "off_session",
    });

    return NextResponse.json({
      client_secret: setupIntent.client_secret,
      customer_id: customerId,
    });
  } catch (err: any) {
    console.error("setup-intent-manual error", err);
    return NextResponse.json(
      { error: err.message || "Failed to create setup intent" },
      { status: 500 }
    );
  }
}
