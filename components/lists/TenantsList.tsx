"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Users } from "lucide-react";
import ListControls from "@/components/ui/ListControls";
import EmptyState from "@/components/ui/EmptyState";

const SORTS = [
  { value: "newest", label: "Newest" },
  { value: "name", label: "Name (A-Z)" },
  { value: "rent_high", label: "Rent (high to low)" },
  { value: "rent_low", label: "Rent (low to high)" },
];

const STATUS = [
  { value: "all", label: "All" },
  { value: "active", label: "Has active lease" },
  { value: "none", label: "No active lease" },
];

export default function TenantsList({ tenants }: { tenants: any[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("newest");

  const filtered = useMemo(() => {
    let list = tenants.slice();

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.full_name?.toLowerCase().includes(q) ||
          t.email?.toLowerCase().includes(q) ||
          t.phone?.toLowerCase().includes(q)
      );
    }
    if (status === "active") {
      list = list.filter((t) => t.leases?.some((l: any) => l.status === "active"));
    } else if (status === "none") {
      list = list.filter((t) => !t.leases?.some((l: any) => l.status === "active"));
    }

    list.sort((a, b) => {
      const rentA = Number(a.leases?.find((l: any) => l.status === "active")?.monthly_rent || 0);
      const rentB = Number(b.leases?.find((l: any) => l.status === "active")?.monthly_rent || 0);
      switch (sort) {
        case "name":
          return (a.full_name || "").localeCompare(b.full_name || "");
        case "rent_high":
          return rentB - rentA;
        case "rent_low":
          return rentA - rentB;
        case "newest":
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
    return list;
  }, [tenants, search, status, sort]);

  if (tenants.length === 0) {
    return (
      <EmptyState
        icon={<Users className="w-6 h-6" />}
        title="No tenants yet"
        description="Add tenants and assign them to a vacant unit."
        actionLabel="+ Add tenant"
        actionHref="/tenants/new"
      />
    );
  }

  return (
    <>
      <ListControls
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name, email, or phone..."
        filters={[{ id: "status", label: "Lease", value: status, onChange: setStatus, options: STATUS }]}
        sort={{ value: sort, onChange: setSort, options: SORTS }}
        resultCount={filtered.length}
        totalCount={tenants.length}
      />

      {filtered.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-xl p-8 text-center text-stone-500">
          No tenants match your filters.
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white border border-stone-200 rounded-xl overflow-hidden">
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
                {filtered.map((t: any) => {
                  const active = t.leases?.find((l: any) => l.status === "active");
                  return (
                    <tr key={t.id} className="border-t border-stone-100 hover:bg-stone-50">
                      <td className="px-4 py-3 font-medium">
                        <Link href={`/tenants/${t.id}`} className="hover:underline">
                          {t.full_name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-stone-600">{t.email || "—"}</td>
                      <td className="px-4 py-3 text-stone-600">{t.phone || "—"}</td>
                      <td className="px-4 py-3">{active?.units?.properties?.name || "—"}</td>
                      <td className="px-4 py-3 text-right">
                        {active ? `$${Number(active.monthly_rent).toLocaleString()}` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {filtered.map((t: any) => {
              const active = t.leases?.find((l: any) => l.status === "active");
              return (
                <Link
                  key={t.id}
                  href={`/tenants/${t.id}`}
                  className="block bg-white border border-stone-200 rounded-xl p-3"
                >
                  <div className="flex justify-between items-start">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{t.full_name}</div>
                      <div className="text-xs text-stone-500 truncate">{t.email || t.phone || "—"}</div>
                      {active && (
                        <div className="text-xs text-stone-500 mt-1 truncate">
                          {active.units?.properties?.name}
                        </div>
                      )}
                    </div>
                    <div className="text-sm text-right ml-3">
                      {active ? `$${Number(active.monthly_rent).toLocaleString()}` : "—"}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
