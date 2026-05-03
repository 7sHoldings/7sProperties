"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import ExpenseForm from "@/components/forms/ExpenseForm";
import { Skeleton } from "@/components/ui/Skeleton";

export default function EditExpensePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const supabase = createClient();
  const [expense, setExpense] = useState<any | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    supabase
      .from("expenses")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) setNotFound(true);
        else setExpense(data);
      });
  }, [id]);

  return (
    <div className="p-4 sm:p-6 max-w-xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-stone-500 mb-4">
        <Link href="/expenses" className="hover:underline">
          Expenses
        </Link>
        <span>›</span>
        <span className="text-stone-900">Edit</span>
      </div>
      <h1 className="text-2xl font-medium mb-6">Edit expense</h1>

      {notFound ? (
        <p className="text-stone-500">Expense not found.</p>
      ) : !expense ? (
        <div className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
          <Skeleton className="h-9 w-full" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
          </div>
        </div>
      ) : (
        <ExpenseForm
          mode="edit"
          expenseId={id}
          initial={{
            property_id: expense.property_id,
            expense_date: expense.expense_date,
            amount: expense.amount,
            category: expense.category,
            description: expense.description,
            vendor: expense.vendor || "",
            notes: expense.notes || "",
          }}
        />
      )}
    </div>
  );
}
