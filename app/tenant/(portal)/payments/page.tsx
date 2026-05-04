import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import EmptyState from "@/components/ui/EmptyState";
import { DollarSign } from "lucide-react";

export default async function TenantPaymentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("auth_user_id", user!.id)
    .maybeSingle();

  if (!tenant) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <p className="text-stone-500">No tenant record linked to your account.</p>
      </div>
    );
  }

  const { data: payments } = await supabase
    .from("payments")
    .select("id, amount, payment_date, for_month, payment_method, reference_number, lease_id, leases(units(properties(name)))")
    .order("payment_date", { ascending: false });

  const list = (payments || []) as any[];
  const total = list.reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-medium">Payments</h1>
        <p className="text-sm text-stone-500">
          {list.length} payment{list.length === 1 ? "" : "s"} · ${total.toLocaleString()} total
        </p>
      </div>

      <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 mb-6 text-sm text-stone-700">
        <div className="font-medium mb-1">How to pay rent</div>
        <p className="text-stone-600">
          Send your rent through the channel agreed with your property owner (bank
          transfer, Zelle, check, etc.). Once received, your owner will record the
          payment here.
        </p>
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={<DollarSign className="w-6 h-6" />}
          title="No payments recorded yet"
          description="Once your property owner records a payment, it'll appear here."
        />
      ) : (
        <>
          <div className="hidden md:block bg-white border border-stone-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-stone-50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Date</th>
                  <th className="text-left px-4 py-2 font-medium">For month</th>
                  <th className="text-left px-4 py-2 font-medium">Property</th>
                  <th className="text-left px-4 py-2 font-medium">Method</th>
                  <th className="text-left px-4 py-2 font-medium">Reference</th>
                  <th className="text-right px-4 py-2 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p: any) => (
                  <tr key={p.id} className="border-t border-stone-100">
                    <td className="px-4 py-3 text-stone-600">
                      {format(new Date(p.payment_date), "MMM d, yyyy")}
                    </td>
                    <td className="px-4 py-3 text-stone-600">
                      {format(new Date(p.for_month), "MMM yyyy")}
                    </td>
                    <td className="px-4 py-3">{p.leases?.units?.properties?.name || "—"}</td>
                    <td className="px-4 py-3 text-stone-600 capitalize">
                      {(p.payment_method || "—").replace("_", " ")}
                    </td>
                    <td className="px-4 py-3 text-stone-600">{p.reference_number || "—"}</td>
                    <td className="px-4 py-3 text-right text-green-700 font-medium">
                      ${Number(p.amount).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-2">
            {list.map((p: any) => (
              <div key={p.id} className="bg-white border border-stone-200 rounded-xl p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium">
                      {format(new Date(p.payment_date), "MMM d, yyyy")}
                    </div>
                    <div className="text-xs text-stone-500">
                      For {format(new Date(p.for_month), "MMM yyyy")} · {(p.payment_method || "—").replace("_", " ")}
                    </div>
                  </div>
                  <div className="text-green-700 font-medium">
                    ${Number(p.amount).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
