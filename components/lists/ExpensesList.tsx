"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { Receipt } from "lucide-react";
import ListControls from "@/components/ui/ListControls";
import EmptyState from "@/components/ui/EmptyState";
import DeleteButton from "@/components/DeleteButton";
import { parseDbDate } from "@/lib/dates";

const SORTS = [
  { value: "date_desc", label: "Date (newest)" },
  { value: "date_asc", label: "Date (oldest)" },
  { value: "amount_high", label: "Amount (high)" },
  { value: "amount_low", label: "Amount (low)" },
];

const CATEGORIES = [
  "all",
  "repairs",
  "maintenance",
  "utilities",
  "insurance",
  "property_tax",
  "mortgage",
  "hoa",
  "management_fee",
  "supplies",
  "legal",
  "advertising",
  "other",
].map((c) => ({
  value: c,
  label: c === "all" ? "All categories" : c.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase()),
}));

const MONTHS = [
  { value: "0", label: "Jan" }, { value: "1", label: "Feb" }, { value: "2", label: "Mar" },
  { value: "3", label: "Apr" }, { value: "4", label: "May" }, { value: "5", label: "Jun" },
  { value: "6", label: "Jul" }, { value: "7", label: "Aug" }, { value: "8", label: "Sep" },
  { value: "9", label: "Oct" }, { value: "10", label: "Nov" }, { value: "11", label: "Dec" },
];

type Props = {
  expenses: any[];
  properties: { id: string; name: string }[];
};

export default function ExpensesList({ expenses, properties }: Props) {
  const params = useSearchParams();
  const initialYear = params?.get("year") || "all";
  const initialMonth = params?.get("month") || "all";
  const [search, setSearch] = useState("");
  const [propertyId, setPropertyId] = useState("all");
  const [category, setCategory] = useState("all");
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [sort, setSort] = useState("date_desc");

  const years = useMemo(() => {
    const set = new Set<string>();
    expenses.forEach((e) => set.add(parseDbDate(e.expense_date).getFullYear().toString()));
    const arr = Array.from(set).sort((a, b) => Number(b) - Number(a));
    return [{ value: "all", label: "All years" }, ...arr.map((y) => ({ value: y, label: y }))];
  }, [expenses]);

  const filtered = useMemo(() => {
    let list = expenses.slice();
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) =>
          e.description?.toLowerCase().includes(q) ||
          e.vendor?.toLowerCase().includes(q) ||
          e.properties?.name?.toLowerCase().includes(q)
      );
    }
    if (propertyId !== "all") list = list.filter((e) => e.property_id === propertyId);
    if (category !== "all") list = list.filter((e) => e.category === category);
    if (year !== "all") list = list.filter((e) => parseDbDate(e.expense_date).getFullYear().toString() === year);
    if (month !== "all") list = list.filter((e) => parseDbDate(e.expense_date).getMonth().toString() === month);

    list.sort((a, b) => {
      switch (sort) {
        case "date_asc":
          return parseDbDate(a.expense_date).getTime() - parseDbDate(b.expense_date).getTime();
        case "amount_high":
          return Number(b.amount) - Number(a.amount);
        case "amount_low":
          return Number(a.amount) - Number(b.amount);
        default:
          return parseDbDate(b.expense_date).getTime() - parseDbDate(a.expense_date).getTime();
      }
    });
    return list;
  }, [expenses, search, propertyId, category, year, month, sort]);

  const total = filtered.reduce((s, e) => s + Number(e.amount), 0);

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
          { id: "category", label: "Category", value: category, onChange: setCategory, options: CATEGORIES },
          { id: "year", label: "Year", value: year, onChange: setYear, options: years },
          { id: "month", label: "Month", value: month, onChange: setMonth, options: [{ value: "all", label: "All" }, ...MONTHS] },
        ]}
        sort={{ value: sort, onChange: setSort, options: SORTS }}
        resultCount={filtered.length}
        totalCount={expenses.length}
      />

      {expenses.length === 0 ? (
        <EmptyState
          icon={<Receipt className="w-6 h-6" />}
          title="No expenses yet"
          description="Track your property expenses by category, date, and vendor."
          actionLabel="+ Add expense"
          actionHref="/expenses/new"
        />
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-xl p-8 text-center text-stone-500">
          No expenses match your filters.
        </div>
      ) : (
        <>
          <div className="hidden md:block bg-white border border-stone-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-stone-50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Date</th>
                  <th className="text-left px-4 py-2 font-medium">Property</th>
                  <th className="text-left px-4 py-2 font-medium">Description</th>
                  <th className="text-left px-4 py-2 font-medium">Category</th>
                  <th className="text-right px-4 py-2 font-medium">Amount</th>
                  <th className="text-right px-4 py-2 font-medium w-24"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e: any) => (
                  <tr key={e.id} className="border-t border-stone-100">
                    <td className="px-4 py-3 text-stone-600">
                      {format(parseDbDate(e.expense_date), "MMM d, yyyy")}
                    </td>
                    <td className="px-4 py-3">{e.properties?.name}</td>
                    <td className="px-4 py-3">{e.description}</td>
                    <td className="px-4 py-3 text-stone-600 capitalize">
                      {e.category.replace("_", " ")}
                    </td>
                    <td className="px-4 py-3 text-right text-red-700 font-medium">
                      −${Number(e.amount).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          href={`/expenses/${e.id}/edit`}
                          className="text-xs text-teal-700 hover:underline"
                        >
                          Edit
                        </Link>
                        <DeleteButton table="expenses" id={e.id} variant="icon" />
                      </div>
                    </td>
                  </tr>
                ))}
                <tr className="bg-stone-50 border-t border-stone-200 font-medium">
                  <td className="px-4 py-2 text-stone-600" colSpan={4}>
                    Filtered total
                  </td>
                  <td className="px-4 py-2 text-right text-red-700">
                    −${total.toLocaleString()}
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-2">
            {filtered.map((e: any) => (
              <div key={e.id} className="bg-white border border-stone-200 rounded-xl p-3">
                <div className="flex justify-between items-start">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{e.description}</div>
                    <div className="text-xs text-stone-500 truncate">{e.properties?.name}</div>
                    <div className="text-xs text-stone-500 mt-1 capitalize">
                      {format(parseDbDate(e.expense_date), "MMM d, yyyy")} ·{" "}
                      {e.category.replace("_", " ")}
                    </div>
                  </div>
                  <div className="text-right ml-3">
                    <div className="text-red-700 font-medium">
                      −${Number(e.amount).toLocaleString()}
                    </div>
                    <div className="flex gap-3 mt-2 justify-end">
                      <Link href={`/expenses/${e.id}/edit`} className="text-xs text-teal-700">
                        Edit
                      </Link>
                      <DeleteButton table="expenses" id={e.id} variant="icon" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <div className="bg-stone-100 rounded-xl px-3 py-2 text-sm flex justify-between font-medium">
              <span>Filtered total</span>
              <span className="text-red-700">−${total.toLocaleString()}</span>
            </div>
          </div>
        </>
      )}
    </>
  );
}
