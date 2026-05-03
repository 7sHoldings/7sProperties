import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { startOfMonth, endOfMonth, format } from "date-fns";
import LeaseAlerts from "@/components/LeaseAlerts";

export default async function DashboardPage() {
  const supabase = await createClient();
  const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");

  // Fetch all data in parallel
  const [propsRes, unitsRes, leasesRes, paymentsRes, expensesRes] = await Promise.all([
    supabase.from("properties").select("id, name"),
    supabase.from("units").select("id, status"),
    supabase.from("leases").select("id, monthly_rent, status, tenant_id, tenants(full_name)").eq("status", "active"),
    supabase.from("payments").select("id, amount, payment_date, lease_id, leases(tenants(full_name))").gte("for_month", monthStart).lte("for_month", monthEnd).order("payment_date", { ascending: false }),
    supabase.from("expenses").select("id, amount, description, expense_date, properties(name)").order("expense_date", { ascending: false }).limit(5),
  ]);

  const properties = propsRes.data || [];
  const units = unitsRes.data || [];
  const activeLeases = leasesRes.data || [];
  const monthPayments = paymentsRes.data || [];
  const recentExpenses = expensesRes.data || [];

  const totalUnits = units.length;
  const occupiedUnits = units.filter((u) => u.status === "occupied").length;
  const expectedRent = activeLeases.reduce((sum, l) => sum + Number(l.monthly_rent), 0);
  const collectedRent = monthPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const outstanding = Math.max(0, expectedRent - collectedRent);

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-medium">Dashboard</h1>
          <p className="text-sm text-stone-500">{format(new Date(), "MMMM yyyy")}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/properties/new" className="px-3 py-1.5 text-sm bg-white border border-stone-200 rounded-md hover:bg-stone-50">
            + Add property
          </Link>
          <Link href="/payments/new" className="px-3 py-1.5 text-sm bg-teal-700 text-white rounded-md hover:bg-teal-800">
            Record payment
          </Link>
        </div>
      </div>

      <LeaseAlerts />

      <div className="grid grid-cols-4 gap-3 mb-6">
        <KpiCard label="Total properties" value={properties.length.toString()} sub={`${occupiedUnits}/${totalUnits} units occupied`} />
        <KpiCard label="Expected rent" value={`$${expectedRent.toLocaleString()}`} sub="This month" />
        <KpiCard label="Collected" value={`$${collectedRent.toLocaleString()}`} sub={outstanding > 0 ? `$${outstanding.toLocaleString()} outstanding` : "All collected"} tone={outstanding > 0 ? "warning" : "success"} />
        <KpiCard label="Active leases" value={activeLeases.length.toString()} sub="Currently active" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border border-stone-200 rounded-xl p-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-medium">Recent payments</h2>
            <Link href="/payments" className="text-xs text-teal-700">View all</Link>
          </div>
          {monthPayments.length === 0 ? (
            <p className="text-sm text-stone-500 py-4">No payments this month yet.</p>
          ) : (
            <ul className="text-sm">
              {monthPayments.slice(0, 5).map((p: any) => (
                <li key={p.id} className="flex justify-between py-2 border-b border-stone-100 last:border-0">
                  <span>{p.leases?.tenants?.full_name || "—"}</span>
                  <span className="text-green-700 font-medium">${Number(p.amount).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white border border-stone-200 rounded-xl p-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-medium">Recent expenses</h2>
            <Link href="/expenses" className="text-xs text-teal-700">View all</Link>
          </div>
          {recentExpenses.length === 0 ? (
            <p className="text-sm text-stone-500 py-4">No expenses yet.</p>
          ) : (
            <ul className="text-sm">
              {recentExpenses.map((e: any) => (
                <li key={e.id} className="flex justify-between py-2 border-b border-stone-100 last:border-0">
                  <div>
                    <div>{e.description}</div>
                    <div className="text-xs text-stone-500">{e.properties?.name}</div>
                  </div>
                  <span className="text-red-700 font-medium">−${Number(e.amount).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "success" | "warning" }) {
  const subColor = tone === "success" ? "text-green-700" : tone === "warning" ? "text-amber-700" : "text-stone-500";
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4">
      <div className="text-sm text-stone-500 mb-1">{label}</div>
      <div className="text-2xl font-medium">{value}</div>
      {sub && <div className={`text-xs mt-1 ${subColor}`}>{sub}</div>}
    </div>
  );
}
