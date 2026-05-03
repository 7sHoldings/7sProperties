"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const METHODS = ["bank_transfer", "check", "cash", "venmo", "zelle", "paypal", "other"];

export default function EditPaymentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = createClient();
  const [payment, setPayment] = useState<any | null>(null);
  const [leases, setLeases] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      supabase.from("payments").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("leases")
        .select("id, monthly_rent, tenants(full_name), units(unit_label, properties(name))"),
    ]).then(([p, l]) => {
      setPayment(p.data);
      setLeases(l.data || []);
    });
  }, [id]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);

    const { error: updErr } = await supabase
      .from("payments")
      .update({
        lease_id: fd.get("lease_id") as string,
        payment_date: fd.get("payment_date") as string,
        for_month: fd.get("for_month") as string,
        amount: Number(fd.get("amount")),
        payment_method: (fd.get("payment_method") as string) || null,
        reference_number: (fd.get("reference_number") as string) || null,
        notes: (fd.get("notes") as string) || null,
      })
      .eq("id", id);

    if (updErr) {
      setError(updErr.message);
      setLoading(false);
      return;
    }
    router.push("/payments");
    router.refresh();
  }

  if (!payment) return <div className="p-6 text-stone-500">Loading...</div>;

  return (
    <div className="p-6 max-w-xl">
      <div className="flex items-center gap-2 text-sm text-stone-500 mb-4">
        <Link href="/payments" className="hover:underline">Payments</Link>
        <span>›</span>
        <span className="text-stone-900">Edit</span>
      </div>
      <h1 className="text-2xl font-medium mb-6">Edit payment</h1>

      <form onSubmit={handleSubmit} className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-sm text-stone-600 mb-1">Lease</label>
          <select
            name="lease_id"
            required
            defaultValue={payment.lease_id}
            className="w-full px-3 py-2 border border-stone-200 rounded-md"
          >
            {leases.map((l: any) => (
              <option key={l.id} value={l.id}>
                {l.tenants?.full_name} — {l.units?.properties?.name} (${Number(l.monthly_rent).toLocaleString()}/mo)
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Payment date" name="payment_date" type="date" required defaultValue={payment.payment_date} />
          <Field label="For month" name="for_month" type="date" required defaultValue={payment.for_month} />
        </div>
        <Field label="Amount" name="amount" type="number" step="0.01" required defaultValue={payment.amount} />
        <div>
          <label className="block text-sm text-stone-600 mb-1">Method</label>
          <select
            name="payment_method"
            defaultValue={payment.payment_method || "bank_transfer"}
            className="w-full px-3 py-2 border border-stone-200 rounded-md"
          >
            {METHODS.map((m) => (
              <option key={m} value={m}>{m.replace("_", " ")}</option>
            ))}
          </select>
        </div>
        <Field label="Reference / check #" name="reference_number" defaultValue={payment.reference_number || ""} />
        <div>
          <label className="block text-sm text-stone-600 mb-1">Notes</label>
          <textarea
            name="notes"
            rows={2}
            defaultValue={payment.notes || ""}
            className="w-full px-3 py-2 border border-stone-200 rounded-md"
          />
        </div>

        {error && <p className="text-sm text-red-700">{error}</p>}
        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={loading} className="px-4 py-2 bg-teal-700 text-white rounded-md hover:bg-teal-800 disabled:opacity-50">
            {loading ? "Saving..." : "Save changes"}
          </button>
          <Link href="/payments" className="px-4 py-2 border border-stone-200 rounded-md hover:bg-stone-50">Cancel</Link>
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
