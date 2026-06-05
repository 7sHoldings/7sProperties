import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import ExpensesList from "@/components/lists/ExpensesList";

export default async function ExpensesPage() {
  const supabase = await createClient();
  const [expensesRes, propsRes] = await Promise.all([
    supabase
      .from("expenses")
      .select("*, properties(name)")
      .order("expense_date", { ascending: false }),
    supabase.from("properties").select("id, name").order("name"),
  ]);

  const expenses = expensesRes.data || [];
  const properties = (propsRes.data || []) as any[];
  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-medium">Expenses</h1>
          <p className="text-sm text-stone-500">
            Total: ${total.toLocaleString()} · {expenses.length} entries
          </p>
        </div>
        <Link
          href="/expenses/new"
          className="px-3 py-1.5 text-sm bg-teal-700 text-white rounded-md hover:bg-teal-800"
        >
          + Add expense
        </Link>
      </div>

      <Suspense fallback={null}>
        <ExpensesList expenses={expenses} properties={properties} />
      </Suspense>
    </div>
  );
}
