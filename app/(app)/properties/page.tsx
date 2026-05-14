import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import PropertiesList from "@/components/lists/PropertiesList";

export default async function PropertiesPage() {
  const supabase = await createClient();
  const { data: properties } = await supabase
    .from("properties")
    .select("*, units(id, status, leases(monthly_rent, status, tenants(full_name)))")
    .order("created_at", { ascending: false });

  const list = (properties || []) as any[];

  // Latest photo per property → signed URL for the card cover
  const ids = list.map((p) => p.id);
  if (ids.length > 0) {
    const { data: photos } = await supabase
      .from("documents")
      .select("property_id, file_path, created_at")
      .in("property_id", ids)
      .eq("document_type", "photo")
      .order("created_at", { ascending: false });
    const seen = new Set<string>();
    for (const p of (photos || []) as any[]) {
      if (!p.property_id || seen.has(p.property_id)) continue;
      seen.add(p.property_id);
      const { data: signed } = await supabase.storage
        .from("documents")
        .createSignedUrl(p.file_path, 3600);
      const target = list.find((pr) => pr.id === p.property_id);
      if (target && signed?.signedUrl) target.cover_url = signed.signedUrl;
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-medium">Rental Homes</h1>
          <p className="text-sm text-stone-500">{(properties || []).length} total</p>
        </div>
        <Link
          href="/properties/new"
          className="px-3 py-1.5 text-sm bg-teal-700 text-white rounded-md hover:bg-teal-800 inline-flex items-center"
        >
          + Add rental home
        </Link>
      </div>

      <PropertiesList properties={list} />
    </div>
  );
}
