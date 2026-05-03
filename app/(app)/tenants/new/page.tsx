"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function NewTenantPage() {
  const router = useRouter();
  const supabase = createClient();
  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase
      .from("units")
      .select("id, unit_label, properties(name)")
      .eq("status", "vacant")
      .then(({ data }) => setUnits(data || []));
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Not authenticated"); setLoading(false); return; }

    const { data: tenant, error: tErr } = await supabase.from("tenants").insert({
      owner_id: user.id,
      full_name: fd.get("full_name") as string,
      email: fd.get("email") as string || null,
      phone: fd.get("phone") as string || null,
      emergency_contact_name: fd.get("emergency_contact_name") as string || null,
      emergency_contact_phone: fd.get("emergency_contact_phone") as string || null,
    }).select().single();

    if (tErr || !tenant) { setError(tErr?.message || "Failed"); setLoading(false); return; }

    const unitId = fd.get("unit_id") as string;
    if (unitId) {
      await supabase.from("leases").insert({
        owner_id: user.id,
        unit_id: unitId,
        tenant_id: tenant.id,
        start_date: fd.get("start_date") as string,
        end_date: fd.get("end_date") as string,
        monthly_rent: Number(fd.get("monthly_rent")),
        security_deposit: Number(fd.get("security_deposit")) || null,
        rent_due_day: Number(fd.get("rent_due_day")) || 1,
      });
      await supabase.from("units").update({ status: "occupied" }).eq("id", unitId);
    }

    router.push("/tenants");
    router.refresh();
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-2 text-sm text-stone-500 mb-4">
        <Link href="/tenants" className="hover:underline">Tenants</Link>
        <span>›</span>
        <span className="text-stone-900">Add new</span>
      </div>
      <h1 className="text-2xl font-medium mb-6">Add tenant</h1>

      <form onSubmit={handleSubmit} className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-medium text-stone-500">Tenant info</h2>
        <Field label="Full name" name="full_name" required />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email" name="email" type="email" />
          <Field label="Phone" name="phone" type="tel" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Emergency contact name" name="emergency_contact_name" />
          <Field label="Emergency contact phone" name="emergency_contact_phone" type="tel" />
        </div>

        <h2 className="text-sm font-medium text-stone-500 pt-4 border-t border-stone-100">Lease (optional)</h2>
        <div>
          <label className="block text-sm text-stone-600 mb-1">Assign to vacant unit</label>
          <select name="unit_id" className="w-full px-3 py-2 border border-stone-200 rounded-md">
            <option value="">No lease yet</option>
            {units.map((u: any) => (
              <option key={u.id} value={u.id}>{u.properties?.name} — {u.unit_label}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date" name="start_date" type="date" />
          <Field label="End date" name="end_date" type="date" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Monthly rent" name="monthly_rent" type="number" step="0.01" />
          <Field label="Security deposit" name="security_deposit" type="number" step="0.01" />
          <Field label="Due day" name="rent_due_day" type="number" placeholder="1" />
        </div>

        {error && <p className="text-sm text-red-700">{error}</p>}
        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={loading} className="px-4 py-2 bg-teal-700 text-white rounded-md hover:bg-teal-800 disabled:opacity-50">
            {loading ? "Saving..." : "Save tenant"}
          </button>
          <Link href="/tenants" className="px-4 py-2 border border-stone-200 rounded-md hover:bg-stone-50">Cancel</Link>
        </div>
      </form>
    </div>
  );
}

function Field({ label, name, type = "text", required = false, placeholder, step }: any) {
  return (
    <div>
      <label className="block text-sm text-stone-600 mb-1">{label}</label>
      <input type={type} name={name} required={required} placeholder={placeholder} step={step}
        className="w-full px-3 py-2 border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-600" />
    </div>
  );
}
