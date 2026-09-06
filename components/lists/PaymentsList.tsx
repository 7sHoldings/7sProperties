"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import ListControls from "@/components/ui/ListControls";
import DeleteButton from "@/components/DeleteButton";
import ProcessorStatusBadge from "@/components/ui/ProcessorStatusBadge";
import { parseDbDate } from "@/lib/dates";
import { paymentTypeOf } from "@/lib/payments";

const SORTS = [
  { value: "date_desc", label: "Date (newest)" },
  { value: "date_asc", label: "Date (oldest)" },
  { value: "amount_high", label: "Amount (high)" },
  { value: "amount_low", label: "Amount (low)" },
];

const TYPES = [
  { value: "all", label: "Rent + deposits" },
  { value: "rent", label: "Rent only" },
  { value: "deposit", label: "Deposits only" },
];

const METHODS = [
  { value: "all", label: "All methods" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "check", label: "Check" },
  { value: "cash", label: "Cash" },
  { value: "venmo", label: "Venmo" },
  { value: "zelle", label: "Zelle" },
  { value: "paypal", label: "PayPal" },
  { value: "other", label: "Other" },
];

const MONTHS = [
  { value: "0", label: "Jan" },
  { value: "1", label: "Feb" },
  { value: "2", label: "Mar" },
  { value: "3", label: "Apr" },
  { value: "4", label: "May" },
  { value: "5", label: "Jun" },
  { value: "6", label: "Jul" },
  { value: "7", label: "Aug" },
  { value: "8", label: "Sep" },
  { value: "9", label: "Oct" },
  { value: "10", label: "Nov" },
  { value: "11", label: "Dec" },
];

type Props = {
  payments: any[];
  properties: { id: string; name: string }[];
};

export default function PaymentsList({ payments, properties }: Props) {
  const params = useSearchParams();
  const initialYear = params?.get("year") || "all";
  const initialMonth = params?.get("month") || "all";
  const [search, setSearch] = useState("");
  const [propertyId, setPropertyId] = useState("all");
  const [method, setMethod] = useState("all");
  const [type, setType] = useState("all");
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [sort, setSort] = useState("date_desc");

  const years = useMemo(() => {
    const set = new Set<string>();
    payments.forEach((p) => set.add(parseDbDate(p.payment_date).getFullYear().toString()));
    const arr = Array.from(set).sort((a, b) => Number(b) - Number(a));
    return [{ value: "all", label: "All years" }, ...arr.map((y) => ({ value: y, label: y }))];
  }, [payments]);

  const filtered = useMemo(() => {
    let list = payments.slice();
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.leases?.tenants?.full_name?.toLowerCase().includes(q) ||
          p.leases?.units?.properties?.name?.toLowerCase().includes(q) ||
          p.reference_number?.toLowerCase().includes(q)
      );
    }
    if (propertyId !== "all") {
      list = list.filter((p) => p.leases?.units?.properties?.id === propertyId);
    }
    if (method !== "all") {
      list = list.filter((p) => p.payment_method === method);
    }
    if (type !== "all") {
      list = list.filter((p) => paymentTypeOf(p) === type);
    }
    if (year !== "all") {
      list = list.filter((p) => parseDbDate(p.payment_date).getFullYear().toString() === year);
    }
    if (month !== "all") {
      list = list.filter((p) => parseDbDate(p.payment_date).getMonth().toString() === month);
    }

    list.sort((a, b) => {
      switch (sort) {
        case "date_asc":
          return parseDbDate(a.payment_date).getTime() - parseDbDate(b.payment_date).getTime();
        case "amount_high":
          return Number(b.amount) - Number(a.amount);
        case "amount_low":
          return Number(a.amount) - Number(b.amount);
        case "date_desc":
        default:
          return parseDbDate(b.payment_date).getTime() - parseDbDate(a.payment_date).getTime();
      }
    });
    return list;
  }, [payments, search, propertyId, method, type, year, month, sort]);

  const propOptions = useMemo(
    () => [{ value: "all", label: "All rental homes" }, ...properties.map((p) => ({ value: p.id, label: p.name }))],
    [properties]
  );

  const counted = filtered.filter((p) => p.processor_status !== "failed");
  const totalAmount = counted.reduce((s, p) => s + Number(p.amount), 0);
  const depositTotal = counted
    .filter((p) => paymentTypeOf(p) === "deposit")
    .reduce((s, p) => s + Number(p.amount), 0);
  const rentTotal = totalAmount - depositTotal;

  return (
    <>
      <ListControls
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search tenant, property, or reference..."
        filters={[
          { id: "property", label: "Property", value: propertyId, onChange: setPropertyId, options: propOptions },
          { id: "type", label: "Type", value: type, onChange: setType, options: TYPES },
          { id: "method", label: "Method", value: method, onChange: setMethod, options: METHODS },
          { id: "year", label: "Year", value: year, onChange: setYear, options: years },
          { id: "month", label: "Month", value: month, onChange: setMonth, options: [{ value: "all", label: "All" }, ...MONTHS] },
        ]}
        sort={{ value: sort, onChange: setSort, options: SORTS }}
        resultCount={filtered.length}
        totalCount={payments.length}
      />

      {filtered.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-xl p-8 text-center text-stone-500">
          No payments match your filters.
        </div>
      ) : (
        <>
          <div className="hidden md:block bg-white border border-stone-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-stone-50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Date</th>
                  <th className="text-left px-4 py-2 font-medium">Tenant</th>
                  <th className="text-left px-4 py-2 font-medium">Property</th>
                  <th className="text-left px-4 py-2 font-medium">For</th>
                  <th className="text-left px-4 py-2 font-medium">Type</th>
                  <th className="text-left px-4 py-2 font-medium">Method</th>
                  <th className="text-left px-4 py-2 font-medium">Status</th>
                  <th className="text-right px-4 py-2 font-medium">Amount</th>
                  <th className="text-right px-4 py-2 font-medium w-24"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p: any) => (
                  <tr key={p.id} className="border-t border-stone-100">
                    <td className="px-4 py-3 text-stone-600">
                      {format(parseDbDate(p.payment_date), "MMM d, yyyy")}
                    </td>
                    <td className="px-4 py-3">{p.leases?.tenants?.full_name || "—"}</td>
                    <td className="px-4 py-3">{p.leases?.units?.properties?.name || "—"}</td>
                    <td className="px-4 py-3 text-stone-600">
                      {format(parseDbDate(p.for_month), "MMM yyyy")}
                    </td>
                    <td className="px-4 py-3">
                      <TypeBadge type={paymentTypeOf(p)} />
                    </td>
                    <td className="px-4 py-3 text-stone-600 capitalize">
                      {(p.payment_method || "—").replace("_", " ")}
                    </td>
                    <td className="px-4 py-3">
                      <ProcessorStatusBadge status={p.processor_status} />
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-medium ${
                        p.processor_status === "failed"
                          ? "text-red-600 line-through"
                          : p.processor_status === "processing" ||
                              p.processor_status === "pending"
                            ? "text-stone-500"
                            : "text-green-700"
                      }`}
                    >
                      ${Number(p.amount).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          href={`/payments/${p.id}/edit`}
                          className="text-xs text-teal-700 hover:underline"
                        >
                          Edit
                        </Link>
                        <DeleteButton table="payments" id={p.id} variant="icon" />
                      </div>
                    </td>
                  </tr>
                ))}
                <tr className="bg-stone-50 border-t border-stone-200 font-medium">
                  <td className="px-4 py-2 text-stone-600" colSpan={7}>
                    Filtered total
                    {depositTotal > 0 && (
                      <span className="ml-2 font-normal text-xs text-stone-500">
                        (rent ${rentTotal.toLocaleString()} · deposits $
                        {depositTotal.toLocaleString()})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right text-green-700">
                    ${totalAmount.toLocaleString()}
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {filtered.map((p: any) => (
              <div key={p.id} className="bg-white border border-stone-200 rounded-xl p-3">
                <div className="flex justify-between items-start">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{p.leases?.tenants?.full_name}</div>
                    <div className="text-xs text-stone-500 truncate">
                      {p.leases?.units?.properties?.name}
                    </div>
                    <div className="text-xs text-stone-500 mt-1">
                      {format(parseDbDate(p.payment_date), "MMM d, yyyy")} · for{" "}
                      {format(parseDbDate(p.for_month), "MMM yyyy")}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <TypeBadge type={paymentTypeOf(p)} />
                      <ProcessorStatusBadge status={p.processor_status} />
                    </div>
                  </div>
                  <div className="text-right ml-3">
                    <div
                      className={`font-medium ${
                        p.processor_status === "failed"
                          ? "text-red-600 line-through"
                          : p.processor_status === "processing" ||
                              p.processor_status === "pending"
                            ? "text-stone-500"
                            : "text-green-700"
                      }`}
                    >
                      ${Number(p.amount).toLocaleString()}
                    </div>
                    <div className="flex gap-3 mt-2 justify-end">
                      <Link
                        href={`/payments/${p.id}/edit`}
                        className="text-xs text-teal-700"
                      >
                        Edit
                      </Link>
                      <DeleteButton table="payments" id={p.id} variant="icon" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <div className="bg-stone-100 rounded-xl px-3 py-2 text-sm font-medium">
              <div className="flex justify-between">
                <span>Filtered total</span>
                <span className="text-green-700">${totalAmount.toLocaleString()}</span>
              </div>
              {depositTotal > 0 && (
                <div className="text-xs font-normal text-stone-500 mt-0.5">
                  rent ${rentTotal.toLocaleString()} · deposits ${depositTotal.toLocaleString()}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

function TypeBadge({ type }: { type: "rent" | "deposit" }) {
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded whitespace-nowrap ${
        type === "deposit" ? "bg-indigo-50 text-indigo-800" : "bg-stone-100 text-stone-700"
      }`}
    >
      {type === "deposit" ? "Deposit" : "Rent"}
    </span>
  );
}
