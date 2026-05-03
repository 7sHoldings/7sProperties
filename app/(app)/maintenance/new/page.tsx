"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { format } from "date-fns";

export default function NewMaintenancePage() {
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

    const { error: mErr } = await supabase.from("maintenance_requests").insert({
      owner_id: user.id,
      property_id: fd.get("property_id") as string,
      title: fd.get("title") as string,
      description: fd.get("description") as string || null,
      priority: fd.get("priority") as string,
      status: fd.get("status") as string,
      reported_date: fd.get("reported_date") as string,
      cost: Number(fd.get("cost")) || null,
      contractor: fd.get("contractor") as string || null,
    });

    if (mErr) { setError(mErr.message); setLoading(false); return; }
    router.push("/maintenance");
    router.refresh();
  }

  return (
    <div className="p-6 max-w-xl">
      <div className="flex items-center gap-2 text-sm text-stone-500 mb-4">
        <Link href="/maintenance" className="hover:underline">Maintenance</Link>
        <span>›</span>
        <span className="text-stone-900">New</span>
      </div>
      <h1 className="text-2xl font-medium mb-6">New maintenance request</h1>

      <form onSubmit={handleSubmit} className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-sm text-stone-600 mb-1">Property</label>
          <select name="property_id" required className="w-full px-3 py-2 border border-stone-200 rounded-md">
            <option value="">Select property</option>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <Field label="Issue title" name="title" required placeholder="Leaky faucet in kitchen" />
        <div>
          <label className="block text-sm text-stone-600 mb-1">Description</label>
          <textarea name="description" rows={3} className="w-full px-3 py-2 border border-stone-200 rounded-md" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm text-stone-600 mb-1">Priority</label>
            <select name="priority" defaultValue="medium" className="w-full px-3 py-2 border border-stone-200 rounded-md">
              <option value="low">Low</option><option value="medium">Medium</option>
              <option value="high">High</option><option value="urgent">Urgent</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-stone-600 mb-1">Status</label>
            <select name="status" defaultValue="open" className="w-full px-3 py-2 border border-stone-200 rounded-md">
              <option value="open">Open</option><option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <Field label="Date" name="reported_date" type="date" required defaultValue={format(new Date(), "yyyy-MM-dd")} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Contractor (optional)" name="contractor" />
          <Field label="Cost (optional)" name="cost" type="number" step="0.01" />
        </div>

        {error && <p className="text-sm text-red-700">{error}</p>}
        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={loading} className="px-4 py-2 bg-teal-700 text-white rounded-md hover:bg-teal-800 disabled:opacity-50">
            {loading ? "Saving..." : "Save"}
          </button>
          <Link href="/maintenance" className="px-4 py-2 border border-stone-200 rounded-md hover:bg-stone-50">Cancel</Link>
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
