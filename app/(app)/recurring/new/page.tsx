import Link from "next/link";
import RecurringExpenseForm from "@/components/forms/RecurringExpenseForm";

export default function NewRecurringPage() {
  return (
    <div className="p-4 sm:p-6 max-w-xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-stone-500 mb-4">
        <Link href="/recurring" className="hover:underline">
          Recurring expenses
        </Link>
        <span>›</span>
        <span className="text-stone-900">New template</span>
      </div>
      <h1 className="text-2xl font-medium mb-6">New recurring expense</h1>
      <RecurringExpenseForm mode="create" />
    </div>
  );
}
