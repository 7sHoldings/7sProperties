"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Building2 } from "lucide-react";
import ListControls from "@/components/ui/ListControls";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";

type Property = any;

const SORTS = [
  { value: "newest", label: "Newest added" },
  { value: "oldest", label: "Oldest added" },
  { value: "name_asc", label: "Name (A-Z)" },
  { value: "name_desc", label: "Name (Z-A)" },
  { value: "rent_high", label: "Rent (high to low)" },
  { value: "rent_low", label: "Rent (low to high)" },
  { value: "purchase_high", label: "Purchase price (high)" },
  { value: "purchase_low", label: "Purchase price (low)" },
  { value: "sqft_high", label: "Square feet (high)" },
];

const STATUS_FILTER = [
  { value: "all", label: "All" },
  { value: "occupied", label: "Occupied" },
  { value: "vacant", label: "Vacant" },
];

const TYPE_FILTER = [
  { value: "all", label: "All types" },
  { value: "single_family", label: "Single family" },
  { value: "duplex", label: "Duplex" },
  { value: "triplex", label: "Triplex" },
  { value: "fourplex", label: "Fourplex" },
  { value: "condo", label: "Condo" },
  { value: "apartment", label: "Apartment" },
  { value: "townhouse", label: "Townhouse" },
  { value: "other", label: "Other" },
];

export default function PropertiesList({ properties }: { properties: Property[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [sort, setSort] = useState("newest");

  const filtered = useMemo(() => {
    let list = properties.slice();

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name?.toLowerCase().includes(q) ||
          p.address?.toLowerCase().includes(q) ||
          p.city?.toLowerCase().includes(q)
      );
    }
    if (status !== "all") {
      list = list.filter((p) => (p.units?.[0]?.status || "vacant") === status);
    }
    if (type !== "all") {
      list = list.filter((p) => p.property_type === type);
    }

    list.sort((a, b) => {
      const rentA = Number(a.units?.[0]?.leases?.find((l: any) => l.status === "active")?.monthly_rent || 0);
      const rentB = Number(b.units?.[0]?.leases?.find((l: any) => l.status === "active")?.monthly_rent || 0);
      switch (sort) {
        case "name_asc":
          return (a.name || "").localeCompare(b.name || "");
        case "name_desc":
          return (b.name || "").localeCompare(a.name || "");
        case "oldest":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "rent_high":
          return rentB - rentA;
        case "rent_low":
          return rentA - rentB;
        case "purchase_high":
          return Number(b.purchase_price || 0) - Number(a.purchase_price || 0);
        case "purchase_low":
          return Number(a.purchase_price || 0) - Number(b.purchase_price || 0);
        case "sqft_high":
          return Number(b.square_feet || 0) - Number(a.square_feet || 0);
        case "newest":
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
    return list;
  }, [properties, search, status, type, sort]);

  return (
    <>
      <ListControls
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name, address, or city..."
        filters={[
          { id: "status", label: "Status", value: status, onChange: setStatus, options: STATUS_FILTER },
          { id: "type", label: "Type", value: type, onChange: setType, options: TYPE_FILTER },
        ]}
        sort={{ value: sort, onChange: setSort, options: SORTS }}
        resultCount={filtered.length}
        totalCount={properties.length}
      />

      {properties.length === 0 ? (
        <EmptyState
          icon={<Building2 className="w-6 h-6" />}
          title="No properties yet"
          description="Add your first property to start tracking rent, expenses, and maintenance."
          actionLabel="+ Add property"
          actionHref="/properties/new"
        />
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-xl p-8 text-center text-stone-500">
          No properties match your filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((p: any) => {
            const activeLease = p.units?.[0]?.leases?.find((l: any) => l.status === "active");
            const status = p.units?.[0]?.status || "vacant";
            const tone = status === "occupied" ? "green" : status === "maintenance" ? "amber" : "red";
            return (
              <Link
                key={p.id}
                href={`/properties/${p.id}`}
                className="block bg-white border border-stone-200 rounded-xl p-4 hover:border-teal-300 hover:shadow-sm transition"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="min-w-0">
                    <h3 className="font-medium truncate">{p.name}</h3>
                    <p className="text-xs text-stone-500 mt-0.5 truncate">{p.address}</p>
                  </div>
                  <StatusBadge tone={tone}>{status}</StatusBadge>
                </div>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-stone-500">Tenant</span>
                    <span className="truncate ml-2">{activeLease?.tenants?.full_name || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">Rent</span>
                    <span>
                      {activeLease ? `$${Number(activeLease.monthly_rent).toLocaleString()}/mo` : "—"}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
