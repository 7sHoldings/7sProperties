import { createClient } from "@/lib/supabase/server";
import { startOfYear, format } from "date-fns";

export default async function ReportsPage() {
  const supabase = await createClient();
  const yearStart = format(startOfYear(new Date()), "yyyy-MM-dd");

  const [propsRes, paymentsRes, expensesRes] = await Promise.all([
    supabase.from("properties").select("id, name"),
    supabase.from("payments").select("amount, leases(units(property_id))").gte("for_month", yearStart),
    supabase.from("expenses").select("property_id, amount, category").gte("expense_date", yearStart),
  ]);

  const properties = propsRes.data || [];
  const payments = paymentsRes.data || [];
  const expenses = expensesRes.data || [];

  const incomeByProp: Record<string, number> = {};
  payments.forEach((p: any) => {
    const pid = p.leases?.units?.property_id;
    if (pid) incomeByProp[pid] = (incomeByProp[pid] || 0) + Number(p.amount);
  });
  const expByProp: Record<string, number> = {};
  expenses.forEach((e: any) => {
    expByProp[e.property_id] = (expByProp[e.property_id] || 0) + Number(e.amount);
  });

  const totalIncome = Object.values(incomeByProp).reduce((s, v) => s + v, 0);
  const totalExp = Object.values(expByProp).reduce((s, v) => s + v, 0);

  // Expense categories
  const byCategory: Record<string, number> = {};
  expenses.forEach((e: any) => {
    byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount);
  });

  return (
    <div className="p-6 max-w-6xl">
      <h1 className="text-2xl font-medium mb-1">Reports</h1>
      <p className="text-sm text-stone-500 mb-6">{format(new Date(), "yyyy")} year-to-date</p>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white border border-stone-200 rounded-xl p-4">
          <div className="text-sm text-stone-500 mb-1">Total income</div>
          <div className="text-2xl font-medium text-green-700">${totalIncome.toLocaleString()}</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-xl p-4">
          <div className="text-sm text-stone-500 mb-1">Total expenses</div>
          <div className="text-2xl font-medium text-red-700">${totalExp.toLocaleString()}</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-xl p-4">
          <div className="text-sm text-stone-500 mb-1">Net profit</div>
          <div className="text-2xl font-medium">${(totalIncome - totalExp).toLocaleString()}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-stone-100">
            <h2 className="font-medium">Per property</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-stone-50">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Property</th>
                <th className="text-right px-4 py-2 font-medium">Income</th>
                <th className="text-right px-4 py-2 font-medium">Expenses</th>
                <th className="text-right px-4 py-2 font-medium">Net</th>
              </tr>
            </thead>
            <tbody>
              {properties.map((p: any) => {
                const inc = incomeByProp[p.id] || 0;
                const exp = expByProp[p.id] || 0;
                return (
                  <tr key={p.id} className="border-t border-stone-100">
                    <td className="px-4 py-2.5">{p.name}</td>
                    <td className="px-4 py-2.5 text-right text-green-700">${inc.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right text-red-700">${exp.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right font-medium">${(inc - exp).toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-stone-100">
            <h2 className="font-medium">Expenses by category</h2>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
                <tr key={cat} className="border-t border-stone-100 first:border-0">
                  <td className="px-4 py-2.5 capitalize">{cat.replace("_", " ")}</td>
                  <td className="px-4 py-2.5 text-right text-red-700">${amt.toLocaleString()}</td>
                </tr>
              ))}
              {Object.keys(byCategory).length === 0 && (
                <tr><td className="px-4 py-6 text-stone-500 text-center">No expenses logged</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
