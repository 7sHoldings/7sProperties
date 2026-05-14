"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Wrench } from "lucide-react";
import ListControls from "@/components/ui/ListControls";
import EmptyState from "@/components/ui/EmptyState";
import StatusBadge from "@/components/ui/StatusBadge";
import DeleteButton from "@/components/DeleteButton";
import { parseDbDate } from "@/lib/dates";

const SORTS = [
  { value: "date_desc", label: "Date (newest)" },
  { value: "date_asc", label: "Date (oldest)" },
  { value: "priority", label: "Priority (high first)" },
  { value: "cost_high", label: "Cost (high)" },
];

const STATUSES = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const PRIORITIES = [
  { value: "all", label: "All" },
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const PRIORITY_RANK: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };

const priorityTone: Record<string, "red" | "amber" | "stone"> = {
  urgent: "red",
  high: "amber",
  medium: "stone",
  low: "stone",
};
const statusTone: Record<string, "red" | "amber" | "green" | "stone"> = {
  open: "red",
  in_progress: "amber",
  completed: "green",
  cancelled: "stone",
};

type Props = {
  requests: any[];
  properties: { id: string; name: string }[];
};

export default function MaintenanceList({ requests, properties }: Props) {
  const [search, setSearch] = useState("");
  const [propertyId, setPropertyId] = useState("all");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [sort, setSort] = useState("date_desc");

  const filtered = useMemo(() => {
    let list = requests.slice();
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.title?.toLowerCase().includes(q) ||
          r.description?.toLowerCase().includes(q) ||
          r.contractor?.toLowerCase().includes(q) ||
          r.properties?.name?.toLowerCase().includes(q)
      );
    }
    if (propertyId !== "all") list = list.filter((r) => r.property_id === propertyId);
    if (status !== "all") list = list.filter((r) => r.status === status);
    if (priority !== "all") list = list.filter((r) => r.priority === priority);

    list.sort((a, b) => {
      switch (sort) {
        case "date_asc":
          return parseDbDate(a.reported_date).getTime() - parseDbDate(b.reported_date).getTime();
        case "priority":
          return (PRIORITY_RANK[b.priority] || 0) - (PRIORITY_RANK[a.priority] || 0);
        case "cost_high":
          return Number(b.cost || 0) - Number(a.cost || 0);
        default:
          return parseDbDate(b.reported_date).getTime() - parseDbDate(a.reported_date).getTime();
      }
    });
    return list;
  }, [requests, search, propertyId, status, priority, sort]);

  const propOptions = [
    { value: "all", label: "All rental homes" },
    ...properties.map((p) => ({ value: p.id, label: p.name })),
  ];

  return (
    <>
      <ListControls
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search title, description, or contractor..."
        filters={[
          { id: "property", label: "Property", value: propertyId, onChange: setPropertyId, options: propOptions },
          { id: "status", label: "Status", value: status, onChange: setStatus, options: STATUSES },
          { id: "priority", label: "Priority", value: priority, onChange: setPriority, options: PRIORITIES },
        ]}
        sort={{ value: sort, onChange: setSort, options: SORTS }}
        resultCount={filtered.length}
        totalCount={requests.length}
      />

      {requests.length === 0 ? (
        <EmptyState
          icon={<Wrench className="w-6 h-6" />}
          title="No maintenance requests"
          description="Log issues, assign contractors, and track repair costs per property."
          actionLabel="+ New request"
          actionHref="/maintenance/new"
        />
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-xl p-8 text-center text-stone-500">
          No maintenance requests match your filters.
        </div>
      ) : (
        <>
          <div className="hidden md:block bg-white border border-stone-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-stone-50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Date</th>
                  <th className="text-left px-4 py-2 font-medium">Property</th>
                  <th className="text-left px-4 py-2 font-medium">Issue</th>
                  <th className="text-center px-4 py-2 font-medium">Priority</th>
                  <th className="text-center px-4 py-2 font-medium">Status</th>
                  <th className="text-right px-4 py-2 font-medium">Cost</th>
                  <th className="text-right px-4 py-2 font-medium w-24"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r: any) => (
                  <tr key={r.id} className="border-t border-stone-100">
                    <td className="px-4 py-3 text-stone-600">
                      {format(parseDbDate(r.reported_date), "MMM d, yyyy")}
                    </td>
                    <td className="px-4 py-3">{r.properties?.name}</td>
                    <td className="px-4 py-3">
                      {r.title}
                      {r.submitted_by_tenant && (
                        <span className="ml-2 inline-block text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
                          From tenant
                        </span>
                      )}
                      {r.tenants?.full_name && (
                        <div className="text-xs text-stone-500">{r.tenants.full_name}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge tone={priorityTone[r.priority] || "stone"}>
                        {r.priority}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge tone={statusTone[r.status] || "stone"}>
                        {r.status.replace("_", " ")}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.cost ? `$${Number(r.cost).toLocaleString()}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          href={`/maintenance/${r.id}/edit`}
                          className="text-xs text-teal-700 hover:underline"
                        >
                          Edit
                        </Link>
                        <DeleteButton table="maintenance_requests" id={r.id} variant="icon" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-2">
            {filtered.map((r: any) => (
              <div key={r.id} className="bg-white border border-stone-200 rounded-xl p-3">
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">
                      {r.title}
                      {r.submitted_by_tenant && (
                        <span className="ml-2 inline-block text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
                          Tenant
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-stone-500 truncate">
                      {r.properties?.name}
                      {r.tenants?.full_name ? ` · ${r.tenants.full_name}` : ""}
                    </div>
                    <div className="flex gap-1.5 mt-2">
                      <StatusBadge tone={priorityTone[r.priority] || "stone"}>
                        {r.priority}
                      </StatusBadge>
                      <StatusBadge tone={statusTone[r.status] || "stone"}>
                        {r.status.replace("_", " ")}
                      </StatusBadge>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm">
                      {r.cost ? `$${Number(r.cost).toLocaleString()}` : "—"}
                    </div>
                    <div className="text-xs text-stone-500">
                      {format(parseDbDate(r.reported_date), "MMM d")}
                    </div>
                    <div className="flex gap-3 mt-2 justify-end">
                      <Link
                        href={`/maintenance/${r.id}/edit`}
                        className="text-xs text-teal-700"
                      >
                        Edit
                      </Link>
                      <DeleteButton table="maintenance_requests" id={r.id} variant="icon" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
