import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AddPaymentMethodButton from "@/components/tenant/AddPaymentMethodButton";
import PaymentMethodRow from "@/components/tenant/PaymentMethodRow";
import AutopayToggle from "@/components/tenant/AutopayToggle";

export default async function TenantPaymentMethodsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, stripe_customer_id")
    .eq("auth_user_id", user!.id)
    .maybeSingle();

  if (!tenant) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <p className="text-stone-500">No tenant record linked to your account.</p>
      </div>
    );
  }

  const [methodsRes, leasesRes] = await Promise.all([
    supabase
      .from("tenant_payment_methods")
      .select("*")
      .eq("tenant_id", tenant.id)
      .neq("status", "detached")
      .order("created_at", { ascending: false }),
    supabase
      .from("leases")
      .select(
        "id, monthly_rent, rent_due_day, autopay_enabled, autopay_payment_method_id, status, units(unit_label, properties(name))"
      )
      .eq("tenant_id", tenant.id)
      .eq("status", "active"),
  ]);

  const methods = (methodsRes.data || []) as any[];
  const leases = (leasesRes.data || []) as any[];

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-stone-500 mb-4">
        <Link href="/tenant/payments" className="hover:underline">
          Payments
        </Link>
        <span>›</span>
        <span className="text-stone-900">Payment methods</span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-medium">Payment methods</h1>
          <p className="text-sm text-stone-500">
            Link a bank account for low-fee ACH, or a card for instant payment.
          </p>
        </div>
        <AddPaymentMethodButton />
      </div>

      {methods.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-xl p-8 text-center">
          <p className="text-sm text-stone-600 mb-3">
            No payment methods yet. Add a bank account or card to pay rent
            directly from this portal.
          </p>
          <AddPaymentMethodButton />
        </div>
      ) : (
        <div className="space-y-2 mb-6">
          {methods.map((m) => (
            <PaymentMethodRow key={m.id} method={m} />
          ))}
        </div>
      )}

      {leases.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-stone-500 uppercase tracking-wider">
            Autopay
          </h2>
          {leases.map((lease) => (
            <AutopayToggle key={lease.id} lease={lease} methods={methods} />
          ))}
        </div>
      )}
    </div>
  );
}
