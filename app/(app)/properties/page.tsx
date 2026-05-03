import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import PropertiesList from "@/components/lists/PropertiesList";

export default async function PropertiesPage() {
  const supabase = await createClient();
  const { data: properties } = await supabase
    .from("properties")
    .select("*, units(id, status, leases(monthly_rent, status, tenants(full_name)))")
    .order("created_at", { ascending: false });

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-medium">Properties</h1>
          <p className="text-sm text-stone-500">{(properties || []).length} total</p>
        </div>
        <Link
          href="/properties/new"
          className="px-3 py-1.5 text-sm bg-teal-700 text-white rounded-md hover:bg-teal-800 inline-flex items-center"
        >
          + Add property
        </Link>
      </div>

      <PropertiesList properties={properties || []} />
    </div>
  );
}
