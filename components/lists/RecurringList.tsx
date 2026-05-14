"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Repeat } from "lucide-react";
import ListControls from "@/components/ui/ListControls";
import EmptyState from "@/components/ui/EmptyState";
import StatusBadge from "@/components/ui/StatusBadge";
import DeleteButton from "@/components/DeleteButton";

const SORTS = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "amount_high", label: "Amount (high)" },
  { value: "amount_low", label: "Amount (low)" },
  { value: "active_first", label: "Active first" },
];

const STATUS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
];

const FREQUENCY = [
  { value: "all", label: "All" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
];

type Props = {
  templates: any[];
  properties: { id: string; name: string }[];
};

export default function RecurringList({ templates, properties }: Props) {
  const [search, setSearch] = useState("");
  const [propertyId, setPropertyId] = useState("all");
  const [status, setStatus] = useState("all");
  const [frequency, setFrequency] = useState("all");
  const [sort, setSort] = useState("active_first");

  const filtered = useMemo(() => {
    let list = templates.slice();
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.description?.toLowerCase().includes(q) ||
          t.vendor?.toLowerCase().includes(q) ||
          t.properties?.name?.toLowerCase().includes(q)
      );
    }
    if (propertyId !== "all") list = list.filter((t) => t.property_id === propertyId);
    if (status === "active") list = list.filter((t) => t.active);
    if (status === "paused") list = list.filter((t) => !t.active);
    if (frequency !== "all") list = list.filter((t) => t.frequency === frequency);

    list.sort((a, b) => {
      switch (sort) {
        case "oldest":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "amount_high":
          return Number(b.amount) - Number(a.amount);
        case "amount_low":
          return Number(a.amount) - Number(b.amount);
        case "active_first":
          if (a.active === b.active) {
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          }
          return a.active ? -1 : 1;
        case "newest":
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
    return list;
  }, [templates, search, propertyId, status, frequency, sort]);

  const propOptions = [
    { value: "all", label: "All rental homes" },
    ...properties.map((p) => ({ value: p.id, label: p.name })),
  ];

  return (
    <>
      <ListControls
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search description, vendor, or property..."
        filters={[
          { id: "property", label: "Property", value: propertyId, onChange: setPropertyId, options: propOptions },
          { id: "status", label: "Status", value: status, onChange: setStatus, options: STATUS },
          { id: "frequency", label: "Frequency", value: frequency, onChange: setFrequency, options: FREQUENCY },
        ]}
        sort={{ value: sort, onChange: setSort, options: SORTS }}
        resultCount={filtered.length}
        totalCount={templates.length}
      />

      {templates.length === 0 ? (
        <EmptyState
          icon={<Repeat className="w-6 h-6" />}
          title="No recurring expenses"
          description="Set up monthly mortgage, insurance, HOA, and other fixed costs once, then generate them automatically each month."
          actionLabel="+ Add template"
          actionHref="/recurring/new"
        />
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-xl p-8 text-center text-stone-500">
          No templates match your filters.
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
          <div className="hidden md:block">
            <table className="w-full text-sm">
              <thead className="bg-stone-50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Description</th>
                  <th className="text-left px-4 py-2 font-medium">Property</th>
                  <th className="text-left px-4 py-2 font-medium">Frequency</th>
                  <th className="text-right px-4 py-2 font-medium">Amount</th>
                  <th className="text-left px-4 py-2 font-medium">Last generated</th>
                  <th className="text-center px-4 py-2 font-medium">Status</th>
                  <th className="text-right px-4 py-2 font-medium w-24"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t: any) => (
                  <tr key={t.id} className="border-t border-stone-100">
                    <td className="px-4 py-3">
                      <div className="font-medium">{t.description}</div>
                      <div className="text-xs text-stone-500 capitalize">
                        {t.category.replace("_", " ")}
                      </div>
                    </td>
                    <td className="px-4 py-3">{t.properties?.name || "—"}</td>
                    <td className="px-4 py-3 capitalize">
                      {t.frequency} · day {t.day_of_month}
                    </td>
                    <td className="px-4 py-3 text-right">
                      ${Number(t.amount).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-stone-600">
                      {t.last_generated_for
                        ? format(new Date(t.last_generated_for), "MMM yyyy")
                        : "Never"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge tone={t.active ? "green" : "stone"}>
                        {t.active ? "Active" : "Paused"}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          href={`/recurring/${t.id}/edit`}
                          className="text-xs text-teal-700 hover:underline"
                        >
                          Edit
                        </Link>
                        <DeleteButton table="recurring_expenses" id={t.id} variant="icon" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden divide-y divide-stone-100">
            {filtered.map((t: any) => (
              <div key={t.id} className="p-3">
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{t.description}</div>
                    <div className="text-xs text-stone-500 truncate">
                      {t.properties?.name} · {t.frequency}
                    </div>
                    <div className="mt-1">
                      <StatusBadge tone={t.active ? "green" : "stone"}>
                        {t.active ? "Active" : "Paused"}
                      </StatusBadge>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">${Number(t.amount).toLocaleString()}</div>
                    <div className="flex gap-3 mt-2 justify-end">
                      <Link href={`/recurring/${t.id}/edit`} className="text-xs text-teal-700">
                        Edit
                      </Link>
                      <DeleteButton table="recurring_expenses" id={t.id} variant="icon" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
