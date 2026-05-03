import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function TenantsPage() {
  const supabase = await createClient();
  const { data: tenants } = await supabase
    .from("tenants")
    .select("*, leases(id, status, monthly_rent, units(unit_label, properties(name)))")
    .order("created_at", { ascending: false });

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-medium">Tenants</h1>
        <Link href="/tenants/new" className="px-3 py-1.5 text-sm bg-teal-700 text-white rounded-md hover:bg-teal-800">
          + Add tenant
        </Link>
      </div>

      {!tenants || tenants.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-xl p-8 text-center">
          <p className="text-stone-500 mb-4">No tenants yet.</p>
          <Link href="/tenants/new" className="text-teal-700 hover:underline">Add your first tenant →</Link>
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-50">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Name</th>
                <th className="text-left px-4 py-2 font-medium">Email</th>
                <th className="text-left px-4 py-2 font-medium">Phone</th>
                <th className="text-left px-4 py-2 font-medium">Property</th>
                <th className="text-right px-4 py-2 font-medium">Rent</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t: any) => {
                const activeLease = t.leases?.find((l: any) => l.status === "active");
                return (
                  <tr key={t.id} className="border-t border-stone-100 hover:bg-stone-50">
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/tenants/${t.id}`} className="hover:underline">{t.full_name}</Link>
                    </td>
                    <td className="px-4 py-3 text-stone-600">{t.email || "—"}</td>
                    <td className="px-4 py-3 text-stone-600">{t.phone || "—"}</td>
                    <td className="px-4 py-3">{activeLease?.units?.properties?.name || "—"}</td>
                    <td className="px-4 py-3 text-right">{activeLease ? `$${Number(activeLease.monthly_rent).toLocaleString()}` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
