"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import RecurringExpenseForm from "@/components/forms/RecurringExpenseForm";
import { Skeleton } from "@/components/ui/Skeleton";

export default function EditRecurringPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const supabase = createClient();
  const [t, setT] = useState<any | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    supabase
      .from("recurring_expenses")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) setNotFound(true);
        else setT(data);
      });
  }, [id]);

  return (
    <div className="p-4 sm:p-6 max-w-xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-stone-500 mb-4">
        <Link href="/recurring" className="hover:underline">
          Recurring expenses
        </Link>
        <span>›</span>
        <span className="text-stone-900">Edit</span>
      </div>
      <h1 className="text-2xl font-medium mb-6">Edit template</h1>
      {notFound ? (
        <p className="text-stone-500">Not found.</p>
      ) : !t ? (
        <div className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : (
        <RecurringExpenseForm
          mode="edit"
          recurringId={id}
          initial={{
            property_id: t.property_id,
            category: t.category,
            description: t.description,
            vendor: t.vendor || "",
            amount: t.amount,
            frequency: t.frequency,
            start_date: t.start_date,
            end_date: t.end_date || "",
            day_of_month: t.day_of_month,
            active: t.active,
            notes: t.notes || "",
          }}
        />
      )}
    </div>
  );
}
