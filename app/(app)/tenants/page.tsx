import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import TenantsList from "@/components/lists/TenantsList";

export default async function TenantsPage() {
  const supabase = await createClient();
  const { data: tenants } = await supabase
    .from("tenants")
    .select("*, leases(id, status, monthly_rent, units(unit_label, properties(name)))")
    .order("created_at", { ascending: false });

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-medium">Tenants</h1>
          <p className="text-sm text-stone-500">{(tenants || []).length} total</p>
        </div>
        <Link
          href="/tenants/new"
          className="px-3 py-1.5 text-sm bg-teal-700 text-white rounded-md hover:bg-teal-800"
        >
          + Add tenant
        </Link>
      </div>

      <TenantsList tenants={tenants || []} />
    </div>
  );
}
