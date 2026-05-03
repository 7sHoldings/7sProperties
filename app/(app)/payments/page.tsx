import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { startOfMonth, format } from "date-fns";

export default async function PaymentsPage() {
  const supabase = await createClient();
  const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");

  const [leasesRes, paymentsRes] = await Promise.all([
    supabase.from("leases").select("*, tenants(full_name), units(unit_label, properties(name))").eq("status", "active"),
    supabase.from("payments").select("lease_id, amount").eq("for_month", monthStart),
  ]);

  const leases = leasesRes.data || [];
  const paymentsByLease = (paymentsRes.data || []).reduce((acc: any, p: any) => {
    acc[p.lease_id] = (acc[p.lease_id] || 0) + Number(p.amount);
    return acc;
  }, {});

  const expected = leases.reduce((s, l) => s + Number(l.monthly_rent), 0);
  const collected = Object.values(paymentsByLease).reduce((s: number, v: any) => s + v, 0) as number;

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-medium">Rent collection</h1>
          <p className="text-sm text-stone-500">{format(new Date(), "MMMM yyyy")}</p>
        </div>
        <Link href="/payments/new" className="px-3 py-1.5 text-sm bg-teal-700 text-white rounded-md hover:bg-teal-800">
          + Record payment
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <KpiCard label="Expected" value={`$${expected.toLocaleString()}`} />
        <KpiCard label="Collected" value={`$${collected.toLocaleString()}`} tone="success" />
        <KpiCard label="Outstanding" value={`$${Math.max(0, expected - collected).toLocaleString()}`} tone="warning" />
      </div>

      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
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
                  <td className="px-4 py-3">{l.units?.properties?.name} {l.units?.unit_label !== "Main" ? `· ${l.units?.unit_label}` : ""}</td>
                  <td className="px-4 py-3">{l.tenants?.full_name}</td>
                  <td className="px-4 py-3 text-right">${rent.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">${paid.toLocaleString()}</td>
                  <td className="px-4 py-3 text-center">
                    {isPaid ? <span className="bg-green-50 text-green-800 text-xs px-2 py-0.5 rounded">Paid</span>
                     : isPartial ? <span className="bg-amber-50 text-amber-800 text-xs px-2 py-0.5 rounded">Partial</span>
                     : <span className="bg-red-50 text-red-800 text-xs px-2 py-0.5 rounded">Pending</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Link href={`/payments/new?lease_id=${l.id}`} className="text-xs text-teal-700 hover:underline">
                      {isPaid ? "Add another" : "Mark paid"}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KpiCard({ label, value, tone }: { label: string; value: string; tone?: "success" | "warning" }) {
  const c = tone === "success" ? "text-green-700" : tone === "warning" ? "text-amber-700" : "";
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4">
      <div className="text-sm text-stone-500 mb-1">{label}</div>
      <div className={`text-2xl font-medium ${c}`}>{value}</div>
    </div>
  );
}
