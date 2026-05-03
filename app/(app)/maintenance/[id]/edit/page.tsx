"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function EditMaintenancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = createClient();
  const [request, setRequest] = useState<any | null>(null);
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      supabase.from("maintenance_requests").select("*").eq("id", id).maybeSingle(),
      supabase.from("properties").select("id, name"),
    ]).then(([m, p]) => {
      setRequest(m.data);
      setProperties(p.data || []);
    });
  }, [id]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    const status = fd.get("status") as string;

    const { error: updErr } = await supabase
      .from("maintenance_requests")
      .update({
        property_id: fd.get("property_id") as string,
        title: fd.get("title") as string,
        description: (fd.get("description") as string) || null,
        priority: fd.get("priority") as string,
        status,
        reported_date: fd.get("reported_date") as string,
        completed_date:
          status === "completed"
            ? ((fd.get("completed_date") as string) || new Date().toISOString().slice(0, 10))
            : null,
        cost: Number(fd.get("cost")) || null,
        contractor: (fd.get("contractor") as string) || null,
        notes: (fd.get("notes") as string) || null,
      })
      .eq("id", id);

    if (updErr) {
      setError(updErr.message);
      setLoading(false);
      return;
    }
    router.push("/maintenance");
    router.refresh();
  }

  if (!request) return <div className="p-6 text-stone-500">Loading...</div>;

  return (
    <div className="p-6 max-w-xl">
      <div className="flex items-center gap-2 text-sm text-stone-500 mb-4">
        <Link href="/maintenance" className="hover:underline">Maintenance</Link>
        <span>›</span>
        <span className="text-stone-900">Edit</span>
      </div>
      <h1 className="text-2xl font-medium mb-6">Edit maintenance request</h1>

      <form onSubmit={handleSubmit} className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-sm text-stone-600 mb-1">Property</label>
          <select
            name="property_id"
            required
            defaultValue={request.property_id}
            className="w-full px-3 py-2 border border-stone-200 rounded-md"
          >
            {properties.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <Field label="Issue title" name="title" required defaultValue={request.title} />
        <div>
          <label className="block text-sm text-stone-600 mb-1">Description</label>
          <textarea
            name="description"
            rows={3}
            defaultValue={request.description || ""}
            className="w-full px-3 py-2 border border-stone-200 rounded-md"
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm text-stone-600 mb-1">Priority</label>
            <select
              name="priority"
              defaultValue={request.priority}
              className="w-full px-3 py-2 border border-stone-200 rounded-md"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-stone-600 mb-1">Status</label>
            <select
              name="status"
              defaultValue={request.status}
              className="w-full px-3 py-2 border border-stone-200 rounded-md"
            >
              <option value="open">Open</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <Field label="Reported" name="reported_date" type="date" required defaultValue={request.reported_date} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Contractor" name="contractor" defaultValue={request.contractor || ""} />
          <Field label="Cost" name="cost" type="number" step="0.01" defaultValue={request.cost ?? ""} />
          <Field label="Completed" name="completed_date" type="date" defaultValue={request.completed_date || ""} />
        </div>
        <div>
          <label className="block text-sm text-stone-600 mb-1">Notes</label>
          <textarea
            name="notes"
            rows={2}
            defaultValue={request.notes || ""}
            className="w-full px-3 py-2 border border-stone-200 rounded-md"
          />
        </div>

        {error && <p className="text-sm text-red-700">{error}</p>}
        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={loading} className="px-4 py-2 bg-teal-700 text-white rounded-md hover:bg-teal-800 disabled:opacity-50">
            {loading ? "Saving..." : "Save changes"}
          </button>
          <Link href="/maintenance" className="px-4 py-2 border border-stone-200 rounded-md hover:bg-stone-50">Cancel</Link>
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
