import Link from "next/link";
import ExpenseForm from "@/components/forms/ExpenseForm";

export default function NewExpensePage() {
  return (
    <div className="p-4 sm:p-6 max-w-xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-stone-500 mb-4">
        <Link href="/expenses" className="hover:underline">
          Expenses
        </Link>
        <span>›</span>
        <span className="text-stone-900">Add</span>
      </div>
      <h1 className="text-2xl font-medium mb-2">Add expense</h1>
      <p className="text-sm text-stone-500 mb-6">
        Save first, then you can upload receipt photos on the next page.
      </p>
      <ExpenseForm mode="create" />
    </div>
  );
}
