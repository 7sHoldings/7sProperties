"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const CATEGORIES = [
  "repairs",
  "maintenance",
  "utilities",
  "insurance",
  "property_tax",
  "mortgage",
  "hoa",
  "management_fee",
  "supplies",
  "legal",
  "advertising",
  "other",
];

export default function EditExpensePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = createClient();
  const [expense, setExpense] = useState<any | null>(null);
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      supabase.from("expenses").select("*").eq("id", id).maybeSingle(),
      supabase.from("properties").select("id, name"),
    ]).then(([e, p]) => {
      setExpense(e.data);
      setProperties(p.data || []);
    });
  }, [id]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);

    const { error: updErr } = await supabase
      .from("expenses")
      .update({
        property_id: fd.get("property_id") as string,
        expense_date: fd.get("expense_date") as string,
        amount: Number(fd.get("amount")),
        category: fd.get("category") as string,
        description: fd.get("description") as string,
        vendor: (fd.get("vendor") as string) || null,
        notes: (fd.get("notes") as string) || null,
      })
      .eq("id", id);

    if (updErr) {
      setError(updErr.message);
      setLoading(false);
      return;
    }
    router.push("/expenses");
    router.refresh();
  }

  if (!expense) return <div className="p-6 text-stone-500">Loading...</div>;

  return (
    <div className="p-6 max-w-xl">
      <div className="flex items-center gap-2 text-sm text-stone-500 mb-4">
        <Link href="/expenses" className="hover:underline">Expenses</Link>
        <span>›</span>
        <span className="text-stone-900">Edit</span>
      </div>
      <h1 className="text-2xl font-medium mb-6">Edit expense</h1>

      <form onSubmit={handleSubmit} className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-sm text-stone-600 mb-1">Property</label>
          <select
            name="property_id"
            required
            defaultValue={expense.property_id}
            className="w-full px-3 py-2 border border-stone-200 rounded-md"
          >
            {properties.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" name="expense_date" type="date" required defaultValue={expense.expense_date} />
          <Field label="Amount" name="amount" type="number" step="0.01" required defaultValue={expense.amount} />
        </div>
        <div>
          <label className="block text-sm text-stone-600 mb-1">Category</label>
          <select
            name="category"
            required
            defaultValue={expense.category}
            className="w-full px-3 py-2 border border-stone-200 rounded-md"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
              </option>
            ))}
          </select>
        </div>
        <Field label="Description" name="description" required defaultValue={expense.description} />
        <Field label="Vendor (optional)" name="vendor" defaultValue={expense.vendor || ""} />
        <div>
          <label className="block text-sm text-stone-600 mb-1">Notes</label>
          <textarea
            name="notes"
            rows={2}
            defaultValue={expense.notes || ""}
            className="w-full px-3 py-2 border border-stone-200 rounded-md"
          />
        </div>

        {error && <p className="text-sm text-red-700">{error}</p>}
        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={loading} className="px-4 py-2 bg-teal-700 text-white rounded-md hover:bg-teal-800 disabled:opacity-50">
            {loading ? "Saving..." : "Save changes"}
          </button>
          <Link href="/expenses" className="px-4 py-2 border border-stone-200 rounded-md hover:bg-stone-50">Cancel</Link>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
  defaultValue,
  step,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string | number;
  step?: string;
}) {
  return (
    <div>
      <label className="block text-sm text-stone-600 mb-1">{label}</label>
      <input
        type={type}
        name={name}
        required={required}
        defaultValue={defaultValue}
        step={step}
        className="w-full px-3 py-2 border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-600"
      />
    </div>
  );
}
