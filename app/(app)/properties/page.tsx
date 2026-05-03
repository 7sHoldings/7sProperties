import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function PropertiesPage() {
  const supabase = await createClient();
  const { data: properties } = await supabase
    .from("properties")
    .select("*, units(id, status, leases(monthly_rent, status, tenants(full_name)))")
    .order("created_at", { ascending: false });

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-medium">Properties</h1>
        <Link href="/properties/new" className="px-3 py-1.5 text-sm bg-teal-700 text-white rounded-md hover:bg-teal-800">
          + Add property
        </Link>
      </div>

      {!properties || properties.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-xl p-8 text-center">
          <p className="text-stone-500 mb-4">No properties yet.</p>
          <Link href="/properties/new" className="text-teal-700 hover:underline">
            Add your first property →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {properties.map((p: any) => {
            const activeLease = p.units?.[0]?.leases?.find((l: any) => l.status === "active");
            const status = p.units?.[0]?.status || "vacant";
            return (
              <Link
                key={p.id}
                href={`/properties/${p.id}`}
                className="block bg-white border border-stone-200 rounded-xl p-4 hover:border-stone-300"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-medium">{p.name}</h3>
                    <p className="text-xs text-stone-500 mt-0.5">{p.address}</p>
                  </div>
                  <StatusBadge status={status} />
                </div>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-stone-500">Tenant</span>
                    <span>{activeLease?.tenants?.full_name || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">Rent</span>
                    <span>{activeLease ? `$${Number(activeLease.monthly_rent).toLocaleString()}/mo` : "—"}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    occupied: "bg-green-50 text-green-800",
    vacant: "bg-red-50 text-red-800",
    maintenance: "bg-amber-50 text-amber-800",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-md ${styles[status] || styles.vacant}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
