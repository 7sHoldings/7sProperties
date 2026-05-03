"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { format } from "date-fns";

const CATEGORIES = ["repairs","maintenance","utilities","insurance","property_tax","mortgage","hoa","management_fee","supplies","legal","advertising","other"];

export default function NewExpensePage() {
  const router = useRouter();
  const supabase = createClient();
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.from("properties").select("id, name").then(({ data }) => setProperties(data || []));
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Not authenticated"); setLoading(false); return; }

    const { error: eErr } = await supabase.from("expenses").insert({
      owner_id: user.id,
      property_id: fd.get("property_id") as string,
      expense_date: fd.get("expense_date") as string,
      amount: Number(fd.get("amount")),
      category: fd.get("category") as string,
      description: fd.get("description") as string,
      vendor: fd.get("vendor") as string || null,
      notes: fd.get("notes") as string || null,
    });

    if (eErr) { setError(eErr.message); setLoading(false); return; }
    router.push("/expenses");
    router.refresh();
  }

  return (
    <div className="p-6 max-w-xl">
      <div className="flex items-center gap-2 text-sm text-stone-500 mb-4">
        <Link href="/expenses" className="hover:underline">Expenses</Link>
        <span>›</span>
        <span className="text-stone-900">Add</span>
      </div>
      <h1 className="text-2xl font-medium mb-6">Add expense</h1>

      <form onSubmit={handleSubmit} className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-sm text-stone-600 mb-1">Property</label>
          <select name="property_id" required className="w-full px-3 py-2 border border-stone-200 rounded-md">
            <option value="">Select property</option>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" name="expense_date" type="date" required defaultValue={format(new Date(), "yyyy-MM-dd")} />
          <Field label="Amount" name="amount" type="number" step="0.01" required />
        </div>
        <div>
          <label className="block text-sm text-stone-600 mb-1">Category</label>
          <select name="category" required className="w-full px-3 py-2 border border-stone-200 rounded-md">
            {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace("_"," ").replace(/\b\w/g, l => l.toUpperCase())}</option>)}
          </select>
        </div>
        <Field label="Description" name="description" required placeholder="e.g. Plumbing repair" />
        <Field label="Vendor (optional)" name="vendor" />
        <div>
          <label className="block text-sm text-stone-600 mb-1">Notes</label>
          <textarea name="notes" rows={2} className="w-full px-3 py-2 border border-stone-200 rounded-md" />
        </div>

        {error && <p className="text-sm text-red-700">{error}</p>}
        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={loading} className="px-4 py-2 bg-teal-700 text-white rounded-md hover:bg-teal-800 disabled:opacity-50">
            {loading ? "Saving..." : "Save expense"}
          </button>
          <Link href="/expenses" className="px-4 py-2 border border-stone-200 rounded-md hover:bg-stone-50">Cancel</Link>
        </div>
      </form>
    </div>
  );
}

function Field({ label, name, type = "text", required = false, defaultValue, placeholder, step }: any) {
  return (
    <div>
      <label className="block text-sm text-stone-600 mb-1">{label}</label>
      <input type={type} name={name} required={required} defaultValue={defaultValue} placeholder={placeholder} step={step}
        className="w-full px-3 py-2 border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-600" />
    </div>
  );
}
