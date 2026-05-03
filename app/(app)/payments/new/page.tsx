"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { format, startOfMonth } from "date-fns";

export default function NewPaymentPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <NewPaymentForm />
    </Suspense>
  );
}

function NewPaymentForm() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();
  const [leases, setLeases] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const today = format(new Date(), "yyyy-MM-dd");
  const thisMonth = format(startOfMonth(new Date()), "yyyy-MM-dd");

  useEffect(() => {
    supabase
      .from("leases")
      .select("id, monthly_rent, tenants(full_name), units(unit_label, properties(name))")
      .eq("status", "active")
      .then(({ data }) => setLeases(data || []));
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Not authenticated"); setLoading(false); return; }

    const { error: pErr } = await supabase.from("payments").insert({
      owner_id: user.id,
      lease_id: fd.get("lease_id") as string,
      payment_date: fd.get("payment_date") as string,
      for_month: fd.get("for_month") as string,
      amount: Number(fd.get("amount")),
      payment_method: fd.get("payment_method") as string || null,
      reference_number: fd.get("reference_number") as string || null,
      notes: fd.get("notes") as string || null,
    });

    if (pErr) { setError(pErr.message); setLoading(false); return; }
    router.push("/payments");
    router.refresh();
  }

  return (
    <div className="p-6 max-w-xl">
      <div className="flex items-center gap-2 text-sm text-stone-500 mb-4">
        <Link href="/payments" className="hover:underline">Payments</Link>
        <span>›</span>
        <span className="text-stone-900">Record</span>
      </div>
      <h1 className="text-2xl font-medium mb-6">Record payment</h1>

      <form onSubmit={handleSubmit} className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-sm text-stone-600 mb-1">Lease</label>
          <select name="lease_id" required defaultValue={params.get("lease_id") || ""} className="w-full px-3 py-2 border border-stone-200 rounded-md">
            <option value="">Select tenant/property</option>
            {leases.map((l: any) => (
              <option key={l.id} value={l.id}>
                {l.tenants?.full_name} — {l.units?.properties?.name} (${Number(l.monthly_rent).toLocaleString()}/mo)
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Payment date" name="payment_date" type="date" required defaultValue={today} />
          <Field label="For month" name="for_month" type="date" required defaultValue={thisMonth} />
        </div>
        <Field label="Amount" name="amount" type="number" step="0.01" required />
        <div>
          <label className="block text-sm text-stone-600 mb-1">Method</label>
          <select name="payment_method" className="w-full px-3 py-2 border border-stone-200 rounded-md">
            <option value="bank_transfer">Bank transfer</option>
            <option value="check">Check</option>
            <option value="cash">Cash</option>
            <option value="venmo">Venmo</option>
            <option value="zelle">Zelle</option>
            <option value="paypal">PayPal</option>
            <option value="other">Other</option>
          </select>
        </div>
        <Field label="Reference / check #" name="reference_number" />
        <div>
          <label className="block text-sm text-stone-600 mb-1">Notes</label>
          <textarea name="notes" rows={2} className="w-full px-3 py-2 border border-stone-200 rounded-md" />
        </div>

        {error && <p className="text-sm text-red-700">{error}</p>}
        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={loading} className="px-4 py-2 bg-teal-700 text-white rounded-md hover:bg-teal-800 disabled:opacity-50">
            {loading ? "Saving..." : "Save payment"}
          </button>
          <Link href="/payments" className="px-4 py-2 border border-stone-200 rounded-md hover:bg-stone-50">Cancel</Link>
        </div>
      </form>
    </div>
  );
}

function Field({ label, name, type = "text", required = false, defaultValue, step }: any) {
  return (
    <div>
      <label className="block text-sm text-stone-600 mb-1">{label}</label>
      <input type={type} name={name} required={required} defaultValue={defaultValue} step={step}
        className="w-full px-3 py-2 border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-600" />
    </div>
  );
}
