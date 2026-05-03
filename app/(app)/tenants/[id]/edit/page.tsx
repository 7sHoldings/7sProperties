"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function EditTenantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = createClient();
  const [tenant, setTenant] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.from("tenants").select("*").eq("id", id).maybeSingle().then(({ data }) => setTenant(data));
  }, [id]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);

    const { error: updErr } = await supabase
      .from("tenants")
      .update({
        full_name: fd.get("full_name") as string,
        email: (fd.get("email") as string) || null,
        phone: (fd.get("phone") as string) || null,
        emergency_contact_name: (fd.get("emergency_contact_name") as string) || null,
        emergency_contact_phone: (fd.get("emergency_contact_phone") as string) || null,
        notes: (fd.get("notes") as string) || null,
      })
      .eq("id", id);

    if (updErr) {
      setError(updErr.message);
      setLoading(false);
      return;
    }
    router.push(`/tenants/${id}`);
    router.refresh();
  }

  if (!tenant) return <div className="p-6 text-stone-500">Loading...</div>;

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-2 text-sm text-stone-500 mb-4">
        <Link href="/tenants" className="hover:underline">Tenants</Link>
        <span>›</span>
        <Link href={`/tenants/${id}`} className="hover:underline">{tenant.full_name}</Link>
        <span>›</span>
        <span className="text-stone-900">Edit</span>
      </div>

      <h1 className="text-2xl font-medium mb-6">Edit tenant</h1>

      <form onSubmit={handleSubmit} className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
        <Field label="Full name" name="full_name" required defaultValue={tenant.full_name} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email" name="email" type="email" defaultValue={tenant.email || ""} />
          <Field label="Phone" name="phone" type="tel" defaultValue={tenant.phone || ""} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Emergency contact name" name="emergency_contact_name" defaultValue={tenant.emergency_contact_name || ""} />
          <Field label="Emergency contact phone" name="emergency_contact_phone" type="tel" defaultValue={tenant.emergency_contact_phone || ""} />
        </div>
        <div>
          <label className="block text-sm text-stone-600 mb-1">Notes</label>
          <textarea
            name="notes"
            rows={3}
            defaultValue={tenant.notes || ""}
            className="w-full px-3 py-2 border border-stone-200 rounded-md"
          />
        </div>

        {error && <p className="text-sm text-red-700">{error}</p>}
        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={loading} className="px-4 py-2 bg-teal-700 text-white rounded-md hover:bg-teal-800 disabled:opacity-50">
            {loading ? "Saving..." : "Save changes"}
          </button>
          <Link href={`/tenants/${id}`} className="px-4 py-2 border border-stone-200 rounded-md hover:bg-stone-50">
            Cancel
          </Link>
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
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <div>
      <label className="block text-sm text-stone-600 mb-1">{label}</label>
      <input
        type={type}
        name={name}
        required={required}
        defaultValue={defaultValue}
        className="w-full px-3 py-2 border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-600"
      />
    </div>
  );
}
