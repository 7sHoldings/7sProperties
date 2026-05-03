import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { startOfMonth, format } from "date-fns";
import PaymentsList from "@/components/lists/PaymentsList";
import StatusBadge from "@/components/ui/StatusBadge";

export default async function PaymentsPage() {
  const supabase = await createClient();
  const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");

  const [leasesRes, monthPaymentsRes, recentPaymentsRes, propsRes] = await Promise.all([
    supabase
      .from("leases")
      .select("*, tenants(full_name), units(unit_label, properties(id, name))")
      .eq("status", "active"),
    supabase.from("payments").select("lease_id, amount").eq("for_month", monthStart),
    supabase
      .from("payments")
      .select(
        "id, amount, payment_date, for_month, payment_method, reference_number, leases(tenants(full_name), units(unit_label, properties(id, name)))"
      )
      .order("payment_date", { ascending: false }),
    supabase.from("properties").select("id, name").order("name"),
  ]);

  const leases = leasesRes.data || [];
  const recentPayments = (recentPaymentsRes.data || []) as any[];
  const properties = (propsRes.data || []) as any[];
  const paymentsByLease = (monthPaymentsRes.data || []).reduce((acc: any, p: any) => {
    acc[p.lease_id] = (acc[p.lease_id] || 0) + Number(p.amount);
    return acc;
  }, {});

  const expected = leases.reduce((s, l) => s + Number(l.monthly_rent), 0);
  const collected = (Object.values(paymentsByLease) as number[]).reduce(
    (s: number, v: number) => s + v,
    0
  );

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-medium">Rent collection</h1>
          <p className="text-sm text-stone-500">{format(new Date(), "MMMM yyyy")}</p>
        </div>
        <Link
          href="/payments/new"
          className="px-3 py-1.5 text-sm bg-teal-700 text-white rounded-md hover:bg-teal-800"
        >
          + Record payment
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <KpiCard label="Expected" value={`$${expected.toLocaleString()}`} />
        <KpiCard label="Collected" value={`$${collected.toLocaleString()}`} tone="success" />
        <KpiCard
          label="Outstanding"
          value={`$${Math.max(0, expected - collected).toLocaleString()}`}
          tone="warning"
        />
      </div>

      {leases.length > 0 && (
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden mb-6">
          <div className="px-4 py-2.5 border-b border-stone-100 bg-stone-50 text-sm font-medium">
            This month status
          </div>
          <div className="hidden md:block">
            <table className="w-full text-sm">
              <thead className="bg-stone-50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Property</th>
                  <th className="text-left px-4 py-2 font-medium">Tenant</th>
                  <th className="text-right px-4 py-2 font-medium">Rent</th>
                  <th className="text-right px-4 py-2 font-medium">Paid</th>
                  <th className="text-center px-4 py-2 font-medium">Status</th>
                  <th className="text-center px-4 py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {leases.map((l: any) => {
                  const paid = paymentsByLease[l.id] || 0;
                  const rent = Number(l.monthly_rent);
                  const isPaid = paid >= rent;
                  const isPartial = paid > 0 && paid < rent;
                  return (
                    <tr key={l.id} className="border-t border-stone-100">
                      <td className="px-4 py-3">
                        {l.units?.properties?.name}
                        {l.units?.unit_label !== "Main" ? ` · ${l.units?.unit_label}` : ""}
                      </td>
                      <td className="px-4 py-3">{l.tenants?.full_name}</td>
                      <td className="px-4 py-3 text-right">${rent.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">${paid.toLocaleString()}</td>
                      <td className="px-4 py-3 text-center">
                        {isPaid ? (
                          <StatusBadge tone="green">Paid</StatusBadge>
                        ) : isPartial ? (
                          <StatusBadge tone="amber">Partial</StatusBadge>
                        ) : (
                          <StatusBadge tone="red">Pending</StatusBadge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Link
                          href={`/payments/new?lease_id=${l.id}`}
                          className="text-xs text-teal-700 hover:underline"
                        >
                          {isPaid ? "Add another" : "Mark paid"}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="md:hidden divide-y divide-stone-100">
            {leases.map((l: any) => {
              const paid = paymentsByLease[l.id] || 0;
              const rent = Number(l.monthly_rent);
              const isPaid = paid >= rent;
              const isPartial = paid > 0 && paid < rent;
              return (
                <div key={l.id} className="p-3">
                  <div className="flex justify-between items-start">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{l.tenants?.full_name}</div>
                      <div className="text-xs text-stone-500 truncate">
                        {l.units?.properties?.name}
                      </div>
                    </div>
                    {isPaid ? (
                      <StatusBadge tone="green">Paid</StatusBadge>
                    ) : isPartial ? (
                      <StatusBadge tone="amber">Partial</StatusBadge>
                    ) : (
                      <StatusBadge tone="red">Pending</StatusBadge>
                    )}
                  </div>
                  <div className="flex justify-between text-sm mt-2">
                    <span className="text-stone-500">
                      ${paid.toLocaleString()} / ${rent.toLocaleString()}
                    </span>
                    <Link
                      href={`/payments/new?lease_id=${l.id}`}
                      className="text-xs text-teal-700"
                    >
                      {isPaid ? "Add another" : "Mark paid"}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <h2 className="text-lg font-medium mb-3">Payment history</h2>
      <PaymentsList payments={recentPayments} properties={properties} />
    </div>
  );
}

function KpiCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "warning";
}) {
  const c = tone === "success" ? "text-green-700" : tone === "warning" ? "text-amber-700" : "";
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4">
      <div className="text-sm text-stone-500 mb-1">{label}</div>
      <div className={`text-2xl font-medium ${c}`}>{value}</div>
    </div>
  );
}
