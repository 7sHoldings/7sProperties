"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Car } from "lucide-react";
import ListControls from "@/components/ui/ListControls";
import EmptyState from "@/components/ui/EmptyState";
import DeleteButton from "@/components/DeleteButton";
import { parseDbDate } from "@/lib/dates";

const SORTS = [
  { value: "date_desc", label: "Date (newest)" },
  { value: "date_asc", label: "Date (oldest)" },
  { value: "miles_high", label: "Miles (high)" },
];

const MONTHS = [
  { value: "0", label: "Jan" }, { value: "1", label: "Feb" }, { value: "2", label: "Mar" },
  { value: "3", label: "Apr" }, { value: "4", label: "May" }, { value: "5", label: "Jun" },
  { value: "6", label: "Jul" }, { value: "7", label: "Aug" }, { value: "8", label: "Sep" },
  { value: "9", label: "Oct" }, { value: "10", label: "Nov" }, { value: "11", label: "Dec" },
];

const RATE_PER_MILE = 0.67; // 2026 IRS standard mileage rate

type Props = { logs: any[]; properties: { id: string; name: string }[] };

export default function MileageList({ logs, properties }: Props) {
  const [search, setSearch] = useState("");
  const [propertyId, setPropertyId] = useState("all");
  const [year, setYear] = useState("all");
  const [month, setMonth] = useState("all");
  const [sort, setSort] = useState("date_desc");

  const years = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => set.add(parseDbDate(l.trip_date).getFullYear().toString()));
    return [
      { value: "all", label: "All years" },
      ...Array.from(set).sort((a, b) => Number(b) - Number(a)).map((y) => ({ value: y, label: y })),
    ];
  }, [logs]);

  const filtered = useMemo(() => {
    let list = logs.slice();
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (l) => l.purpose?.toLowerCase().includes(q) || l.properties?.name?.toLowerCase().includes(q)
      );
    }
    if (propertyId === "none") list = list.filter((l) => !l.property_id);
    else if (propertyId !== "all") list = list.filter((l) => l.property_id === propertyId);
    if (year !== "all") list = list.filter((l) => parseDbDate(l.trip_date).getFullYear().toString() === year);
    if (month !== "all") list = list.filter((l) => parseDbDate(l.trip_date).getMonth().toString() === month);

    list.sort((a, b) => {
      switch (sort) {
        case "date_asc":
          return parseDbDate(a.trip_date).getTime() - parseDbDate(b.trip_date).getTime();
        case "miles_high":
          return Number(b.miles) - Number(a.miles);
        default:
          return parseDbDate(b.trip_date).getTime() - parseDbDate(a.trip_date).getTime();
      }
    });
    return list;
  }, [logs, search, propertyId, year, month, sort]);

  const totalMiles = filtered.reduce((s, l) => s + Number(l.miles), 0);
  const deduction = totalMiles * RATE_PER_MILE;

  const propOptions = [
    { value: "all", label: "All" },
    { value: "none", label: "General" },
    ...properties.map((p) => ({ value: p.id, label: p.name })),
  ];

  return (
    <>
      <ListControls
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search purpose or property..."
        filters={[
          { id: "property", label: "Property", value: propertyId, onChange: setPropertyId, options: propOptions },
          { id: "year", label: "Year", value: year, onChange: setYear, options: years },
          { id: "month", label: "Month", value: month, onChange: setMonth, options: [{ value: "all", label: "All" }, ...MONTHS] },
        ]}
        sort={{ value: sort, onChange: setSort, options: SORTS }}
        resultCount={filtered.length}
        totalCount={logs.length}
      />

      {logs.length === 0 && (
        <EmptyState
          icon={<Car className="w-6 h-6" />}
          title="No mileage logged yet"
          description="Log every trip you take for property business — at $0.67/mile (2026 IRS rate), it adds up fast."
          actionLabel="+ Log a trip"
          actionHref="/mileage/new"
        />
      )}

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-white border border-stone-200 rounded-xl p-4">
          <div className="text-sm text-stone-500 mb-1">Filtered miles</div>
          <div className="text-2xl font-medium">{totalMiles.toLocaleString()}</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-xl p-4">
          <div className="text-sm text-stone-500 mb-1">Deductible</div>
          <div className="text-2xl font-medium text-green-700">
            ${deduction.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-stone-500 mt-1">@ ${RATE_PER_MILE}/mile (2026 IRS rate)</div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-xl p-8 text-center text-stone-500">
          No trips match your filters.
        </div>
      ) : (
        <>
          <div className="hidden md:block bg-white border border-stone-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-stone-50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Date</th>
                  <th className="text-left px-4 py-2 font-medium">Purpose</th>
                  <th className="text-left px-4 py-2 font-medium">Property</th>
                  <th className="text-right px-4 py-2 font-medium">Miles</th>
                  <th className="text-right px-4 py-2 font-medium">Deduction</th>
                  <th className="text-right px-4 py-2 font-medium w-24"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l: any) => (
                  <tr key={l.id} className="border-t border-stone-100">
                    <td className="px-4 py-3 text-stone-600">
                      {format(parseDbDate(l.trip_date), "MMM d, yyyy")}
                    </td>
                    <td className="px-4 py-3">{l.purpose}</td>
                    <td className="px-4 py-3 text-stone-600">{l.properties?.name || "—"}</td>
                    <td className="px-4 py-3 text-right">{Number(l.miles).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-green-700">
                      ${(Number(l.miles) * RATE_PER_MILE).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Link href={`/mileage/${l.id}/edit`} className="text-xs text-teal-700 hover:underline">
                          Edit
                        </Link>
                        <DeleteButton table="mileage_logs" id={l.id} variant="icon" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-2">
            {filtered.map((l: any) => (
              <div key={l.id} className="bg-white border border-stone-200 rounded-xl p-3">
                <div className="flex justify-between items-start">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{l.purpose}</div>
                    <div className="text-xs text-stone-500 truncate">
                      {l.properties?.name || "General"}
                    </div>
                    <div className="text-xs text-stone-500 mt-1">
                      {format(parseDbDate(l.trip_date), "MMM d, yyyy")}
                    </div>
                  </div>
                  <div className="text-right ml-3">
                    <div className="font-medium">{Number(l.miles)} mi</div>
                    <div className="text-xs text-green-700">
                      ${(Number(l.miles) * RATE_PER_MILE).toFixed(2)}
                    </div>
                    <div className="flex gap-3 mt-2 justify-end">
                      <Link href={`/mileage/${l.id}/edit`} className="text-xs text-teal-700">
                        Edit
                      </Link>
                      <DeleteButton table="mileage_logs" id={l.id} variant="icon" />
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
