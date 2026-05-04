"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Wallet } from "lucide-react";
import ListControls from "@/components/ui/ListControls";
import EmptyState from "@/components/ui/EmptyState";
import DeleteButton from "@/components/DeleteButton";

const SORTS = [
  { value: "date_desc", label: "Date (newest)" },
  { value: "date_asc", label: "Date (oldest)" },
  { value: "amount_high", label: "Amount (high)" },
  { value: "amount_low", label: "Amount (low)" },
];

const MONTHS = [
  { value: "0", label: "Jan" }, { value: "1", label: "Feb" }, { value: "2", label: "Mar" },
  { value: "3", label: "Apr" }, { value: "4", label: "May" }, { value: "5", label: "Jun" },
  { value: "6", label: "Jul" }, { value: "7", label: "Aug" }, { value: "8", label: "Sep" },
  { value: "9", label: "Oct" }, { value: "10", label: "Nov" }, { value: "11", label: "Dec" },
];

type Props = {
  distributions: any[];
  properties: { id: string; name: string }[];
};

export default function DistributionsList({ distributions, properties }: Props) {
  const [search, setSearch] = useState("");
  const [propertyId, setPropertyId] = useState("all");
  const [year, setYear] = useState("all");
  const [month, setMonth] = useState("all");
  const [sort, setSort] = useState("date_desc");

  const years = useMemo(() => {
    const set = new Set<string>();
    distributions.forEach((d) => set.add(new Date(d.distribution_date).getFullYear().toString()));
    const arr = Array.from(set).sort((a, b) => Number(b) - Number(a));
    return [{ value: "all", label: "All years" }, ...arr.map((y) => ({ value: y, label: y }))];
  }, [distributions]);

  const filtered = useMemo(() => {
    let list = distributions.slice();
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (d) =>
          d.destination?.toLowerCase().includes(q) ||
          d.notes?.toLowerCase().includes(q) ||
          d.properties?.name?.toLowerCase().includes(q)
      );
    }
    if (propertyId === "none") list = list.filter((d) => !d.property_id);
    else if (propertyId !== "all") list = list.filter((d) => d.property_id === propertyId);
    if (year !== "all")
      list = list.filter((d) => new Date(d.distribution_date).getFullYear().toString() === year);
    if (month !== "all")
      list = list.filter((d) => new Date(d.distribution_date).getMonth().toString() === month);

    list.sort((a, b) => {
      switch (sort) {
        case "date_asc":
          return new Date(a.distribution_date).getTime() - new Date(b.distribution_date).getTime();
        case "amount_high":
          return Number(b.amount) - Number(a.amount);
        case "amount_low":
          return Number(a.amount) - Number(b.amount);
        default:
          return new Date(b.distribution_date).getTime() - new Date(a.distribution_date).getTime();
      }
    });
    return list;
  }, [distributions, search, propertyId, year, month, sort]);

  const total = filtered.reduce((s, d) => s + Number(d.amount), 0);

  const propOptions = [
    { value: "all", label: "All sources" },
    { value: "none", label: "General (no property)" },
    ...properties.map((p) => ({ value: p.id, label: p.name })),
  ];

  return (
    <>
      <ListControls
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search destination, notes, or property..."
        filters={[
          { id: "property", label: "Source", value: propertyId, onChange: setPropertyId, options: propOptions },
          { id: "year", label: "Year", value: year, onChange: setYear, options: years },
          { id: "month", label: "Month", value: month, onChange: setMonth, options: [{ value: "all", label: "All" }, ...MONTHS] },
        ]}
        sort={{ value: sort, onChange: setSort, options: SORTS }}
        resultCount={filtered.length}
        totalCount={distributions.length}
      />

      {distributions.length === 0 ? (
        <EmptyState
          icon={<Wallet className="w-6 h-6" />}
          title="No distributions yet"
          description="Record money you take out of rentals — for personal use or to invest in other businesses."
          actionLabel="+ Record distribution"
          actionHref="/distributions/new"
        />
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-xl p-8 text-center text-stone-500">
          No distributions match your filters.
        </div>
      ) : (
        <>
          <div className="hidden md:block bg-white border border-stone-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-stone-50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Date</th>
                  <th className="text-left px-4 py-2 font-medium">Destination</th>
                  <th className="text-left px-4 py-2 font-medium">From property</th>
                  <th className="text-left px-4 py-2 font-medium">Method</th>
                  <th className="text-right px-4 py-2 font-medium">Amount</th>
                  <th className="text-right px-4 py-2 font-medium w-24"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d: any) => (
                  <tr key={d.id} className="border-t border-stone-100">
                    <td className="px-4 py-3 text-stone-600">
                      {format(new Date(d.distribution_date), "MMM d, yyyy")}
                    </td>
                    <td className="px-4 py-3 font-medium">{d.destination}</td>
                    <td className="px-4 py-3">
                      {d.properties?.name || (
                        <span className="text-stone-400 italic">General</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-stone-600 capitalize">
                      {(d.payment_method || "—").replace("_", " ")}
                    </td>
                    <td className="px-4 py-3 text-right text-purple-700 font-medium">
                      ${Number(d.amount).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          href={`/distributions/${d.id}/edit`}
                          className="text-xs text-teal-700 hover:underline"
                        >
                          Edit
                        </Link>
                        <DeleteButton table="distributions" id={d.id} variant="icon" />
                      </div>
                    </td>
                  </tr>
                ))}
                <tr className="bg-stone-50 border-t border-stone-200 font-medium">
                  <td className="px-4 py-2 text-stone-600" colSpan={4}>
                    Filtered total
                  </td>
                  <td className="px-4 py-2 text-right text-purple-700">
                    ${total.toLocaleString()}
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-2">
            {filtered.map((d: any) => (
              <div key={d.id} className="bg-white border border-stone-200 rounded-xl p-3">
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{d.destination}</div>
                    <div className="text-xs text-stone-500 truncate">
                      {d.properties?.name || "General"} ·{" "}
                      {(d.payment_method || "").replace("_", " ")}
                    </div>
                    <div className="text-xs text-stone-500 mt-1">
                      {format(new Date(d.distribution_date), "MMM d, yyyy")}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-purple-700 font-medium">
                      ${Number(d.amount).toLocaleString()}
                    </div>
                    <div className="flex gap-3 mt-2 justify-end">
                      <Link
                        href={`/distributions/${d.id}/edit`}
                        className="text-xs text-teal-700"
                      >
                        Edit
                      </Link>
                      <DeleteButton table="distributions" id={d.id} variant="icon" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <div className="bg-stone-100 rounded-xl px-3 py-2 text-sm flex justify-between font-medium">
              <span>Filtered total</span>
              <span className="text-purple-700">${total.toLocaleString()}</span>
            </div>
          </div>
        </>
      )}
    </>
  );
}
