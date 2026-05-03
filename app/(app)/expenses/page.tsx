import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { format } from "date-fns";

export default async function ExpensesPage() {
  const supabase = await createClient();
  const { data: expenses } = await supabase
    .from("expenses")
    .select("*, properties(name)")
    .order("expense_date", { ascending: false });

  const total = (expenses || []).reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-medium">Expenses</h1>
          <p className="text-sm text-stone-500">Total: ${total.toLocaleString()}</p>
        </div>
        <Link href="/expenses/new" className="px-3 py-1.5 text-sm bg-teal-700 text-white rounded-md hover:bg-teal-800">
          + Add expense
        </Link>
      </div>

      {!expenses || expenses.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-xl p-8 text-center">
          <p className="text-stone-500 mb-4">No expenses yet.</p>
          <Link href="/expenses/new" className="text-teal-700 hover:underline">Add your first expense →</Link>
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-50">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Date</th>
                <th className="text-left px-4 py-2 font-medium">Property</th>
                <th className="text-left px-4 py-2 font-medium">Description</th>
                <th className="text-left px-4 py-2 font-medium">Category</th>
                <th className="text-right px-4 py-2 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e: any) => (
                <tr key={e.id} className="border-t border-stone-100">
                  <td className="px-4 py-3 text-stone-600">{format(new Date(e.expense_date), "MMM d, yyyy")}</td>
                  <td className="px-4 py-3">{e.properties?.name}</td>
                  <td className="px-4 py-3">{e.description}</td>
                  <td className="px-4 py-3 text-stone-600 capitalize">{e.category.replace("_", " ")}</td>
                  <td className="px-4 py-3 text-right text-red-700 font-medium">−${Number(e.amount).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
