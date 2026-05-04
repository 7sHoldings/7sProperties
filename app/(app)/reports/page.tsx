import { createClient } from "@/lib/supabase/server";
import { startOfYear, format } from "date-fns";

export default async function ReportsPage() {
  const supabase = await createClient();
  const yearStart = format(startOfYear(new Date()), "yyyy-MM-dd");

  const [propsRes, paymentsRes, expensesRes, distributionsRes] = await Promise.all([
    supabase.from("properties").select("id, name"),
    supabase
      .from("payments")
      .select("amount, leases(units(property_id))")
      .gte("for_month", yearStart),
    supabase.from("expenses").select("property_id, amount, category").gte("expense_date", yearStart),
    supabase
      .from("distributions")
      .select("property_id, amount")
      .gte("distribution_date", yearStart),
  ]);

  const properties = propsRes.data || [];
  const payments = paymentsRes.data || [];
  const expenses = expensesRes.data || [];
  const distributions = distributionsRes.data || [];

  const incomeByProp: Record<string, number> = {};
  payments.forEach((p: any) => {
    const pid = p.leases?.units?.property_id;
    if (pid) incomeByProp[pid] = (incomeByProp[pid] || 0) + Number(p.amount);
  });
  const expByProp: Record<string, number> = {};
  expenses.forEach((e: any) => {
    expByProp[e.property_id] = (expByProp[e.property_id] || 0) + Number(e.amount);
  });
  const distByProp: Record<string, number> = {};
  let generalDist = 0;
  distributions.forEach((d: any) => {
    if (d.property_id) {
      distByProp[d.property_id] = (distByProp[d.property_id] || 0) + Number(d.amount);
    } else {
      generalDist += Number(d.amount);
    }
  });

  const totalIncome = Object.values(incomeByProp).reduce((s, v) => s + v, 0);
  const totalExp = Object.values(expByProp).reduce((s, v) => s + v, 0);
  const totalDist = distributions.reduce((s, d: any) => s + Number(d.amount), 0);
  const net = totalIncome - totalExp;
  const retained = net - totalDist;

  const byCategory: Record<string, number> = {};
  expenses.forEach((e: any) => {
    byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount);
  });

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-medium mb-1">Reports</h1>
      <p className="text-sm text-stone-500 mb-6">{format(new Date(), "yyyy")} year-to-date</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Stat label="Income" value={`$${totalIncome.toLocaleString()}`} tone="green" />
        <Stat label="Expenses" value={`$${totalExp.toLocaleString()}`} tone="red" />
        <Stat label="Profit taken out" value={`$${totalDist.toLocaleString()}`} tone="purple" />
        <Stat
          label="Retained"
          value={`$${retained.toLocaleString()}`}
          tone={retained >= 0 ? "default" : "red"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-stone-100">
            <h2 className="font-medium">Per property</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Property</th>
                  <th className="text-right px-4 py-2 font-medium">Income</th>
                  <th className="text-right px-4 py-2 font-medium">Expenses</th>
                  <th className="text-right px-4 py-2 font-medium">Net</th>
                  <th className="text-right px-4 py-2 font-medium">Drawn</th>
                  <th className="text-right px-4 py-2 font-medium">Retained</th>
                </tr>
              </thead>
              <tbody>
                {properties.map((p: any) => {
                  const inc = incomeByProp[p.id] || 0;
                  const exp = expByProp[p.id] || 0;
                  const dist = distByProp[p.id] || 0;
                  const n = inc - exp;
                  return (
                    <tr key={p.id} className="border-t border-stone-100">
                      <td className="px-4 py-2.5">{p.name}</td>
                      <td className="px-4 py-2.5 text-right text-green-700">
                        ${inc.toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-right text-red-700">
                        ${exp.toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium">
                        ${n.toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-right text-purple-700">
                        ${dist.toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium">
                        ${(n - dist).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
                {generalDist > 0 && (
                  <tr className="border-t border-stone-100 text-stone-500 italic">
                    <td className="px-4 py-2.5">General (unassigned)</td>
                    <td className="px-4 py-2.5 text-right">—</td>
                    <td className="px-4 py-2.5 text-right">—</td>
                    <td className="px-4 py-2.5 text-right">—</td>
                    <td className="px-4 py-2.5 text-right text-purple-700 not-italic">
                      ${generalDist.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right">—</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-stone-100">
            <h2 className="font-medium">Expenses by category</h2>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {Object.entries(byCategory)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, amt]) => (
                  <tr key={cat} className="border-t border-stone-100 first:border-0">
                    <td className="px-4 py-2.5 capitalize">{cat.replace("_", " ")}</td>
                    <td className="px-4 py-2.5 text-right text-red-700">
                      ${amt.toLocaleString()}
                    </td>
                  </tr>
                ))}
              {Object.keys(byCategory).length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-stone-500 text-center" colSpan={2}>
                    No expenses logged
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "green" | "red" | "purple";
}) {
  const colors = {
    default: "",
    green: "text-green-700",
    red: "text-red-700",
    purple: "text-purple-700",
  };
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4">
      <div className="text-sm text-stone-500 mb-1">{label}</div>
      <div className={`text-2xl font-medium ${colors[tone]}`}>{value}</div>
    </div>
  );
}
