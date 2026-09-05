import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  startOfYear,
  startOfMonth,
  endOfMonth,
  format,
  subMonths,
  parse,
  differenceInDays,
  subDays,
  isSameDay,
} from "date-fns";
import { TrendingUp, TrendingDown } from "lucide-react";
import CsvExportButtons from "@/components/CsvExportButtons";
import { computePnL } from "@/lib/pnl";

function parseISO(s: string | undefined): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = parse(s, "yyyy-MM-dd", new Date());
  return isNaN(d.getTime()) ? null : d;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; property?: string }>;
}) {
  const supabase = await createClient();
  const { from, to, property: propertyParam } = await searchParams;

  // Default to YTD if no range given (matches the old behaviour)
  const today = new Date();
  let rangeStart: Date = startOfYear(today);
  let rangeEnd: Date = endOfMonth(today);
  const parsedFrom = parseISO(from);
  const parsedTo = parseISO(to);
  if (parsedFrom && parsedTo && parsedFrom <= parsedTo) {
    rangeStart = parsedFrom;
    rangeEnd = parsedTo;
  }
  const propertyId = propertyParam && propertyParam !== "all" ? propertyParam : null;

  const rangeStartStr = format(rangeStart, "yyyy-MM-dd");
  const rangeEndStr = format(rangeEnd, "yyyy-MM-dd");

  // Previous period (same length) for the delta chip
  const rangeDays = differenceInDays(rangeEnd, rangeStart);
  const prevEnd = subDays(rangeStart, 1);
  const prevStart = subDays(prevEnd, rangeDays);
  const prevStartStr = format(prevStart, "yyyy-MM-dd");
  const prevEndStr = format(prevEnd, "yyyy-MM-dd");

  // For 1099-NEC and CSV export, keep the calendar-year scope
  const calendarYear = rangeStart.getFullYear();
  const calendarYearStart = format(startOfYear(rangeStart), "yyyy-MM-dd");

  // Period classification (same logic as dashboard)
  const isFullMonth =
    isSameDay(rangeStart, startOfMonth(rangeStart)) &&
    isSameDay(rangeEnd, endOfMonth(rangeStart));
  const isCurrentMonth =
    isFullMonth &&
    rangeStart.getFullYear() === today.getFullYear() &&
    rangeStart.getMonth() === today.getMonth();
  const isLastMonth =
    isFullMonth &&
    rangeStart.getFullYear() === subMonths(today, 1).getFullYear() &&
    rangeStart.getMonth() === subMonths(today, 1).getMonth();
  const isYTD =
    isSameDay(rangeStart, startOfYear(today)) &&
    isSameDay(rangeEnd, endOfMonth(today));

  const rangeLabel = isFullMonth
    ? format(rangeStart, "MMMM yyyy")
    : isYTD
      ? `${rangeStart.getFullYear()} YTD`
      : `${format(rangeStart, "MMM d, yyyy")} – ${format(rangeEnd, "MMM d, yyyy")}`;
  const [
    propsRes,
    paymentsRes,
    expensesRes,
    distributionsRes,
    mileageRes,
    expensesAllRes,
    prevPaymentsRes,
    prevExpensesRes,
  ] = await Promise.all([
    supabase.from("properties").select("id, name").order("name"),
    // Selected range
    // Rent income excludes security deposits — deposits are held for the
    // tenant, not earned revenue.
    supabase
      .from("payments")
      .select("amount, leases(units(property_id))")
      .neq("payment_type", "deposit")
      .gte("for_month", rangeStartStr)
      .lte("for_month", rangeEndStr),
    supabase
      .from("expenses")
      .select("property_id, amount, category, vendor, expense_date")
      .gte("expense_date", rangeStartStr)
      .lte("expense_date", rangeEndStr),
    supabase
      .from("distributions")
      .select("property_id, amount, type")
      .gte("distribution_date", rangeStartStr)
      .lte("distribution_date", rangeEndStr),
    supabase
      .from("mileage_logs")
      .select("miles")
      .gte("trip_date", rangeStartStr)
      .lte("trip_date", rangeEndStr),
    // Calendar year scope for the 1099-NEC roundup
    supabase
      .from("expenses")
      .select("vendor, amount")
      .gte("expense_date", calendarYearStart),
    // Previous period (same length) for the delta chip
    supabase
      .from("payments")
      .select("amount, leases(units(property_id))")
      .neq("payment_type", "deposit")
      .gte("for_month", prevStartStr)
      .lte("for_month", prevEndStr),
    supabase
      .from("expenses")
      .select("property_id, amount, category")
      .gte("expense_date", prevStartStr)
      .lte("expense_date", prevEndStr),
  ]);

  const properties = propsRes.data || [];

  // Property filter: narrow every dataset before computing the P&L
  const paymentMatchesProperty = (p: any) =>
    !propertyId || p.leases?.units?.property_id === propertyId;
  const rowMatchesProperty = (r: any) => !propertyId || r.property_id === propertyId;

  const payments = ((paymentsRes.data || []) as any[]).filter(paymentMatchesProperty);
  const expenses = ((expensesRes.data || []) as any[]).filter(rowMatchesProperty);
  const distributions = ((distributionsRes.data || []) as any[]).filter(rowMatchesProperty);
  const mileage = mileageRes.data || [];
  const prevPayments = ((prevPaymentsRes.data || []) as any[]).filter(paymentMatchesProperty);
  const prevExpenses = ((prevExpensesRes.data || []) as any[]).filter(rowMatchesProperty);

  // Same P&L formula as the dashboard, using the shared helper
  const totals = computePnL({
    payments,
    expenses,
    distributions,
  });
  const prevTotals = computePnL({
    payments: prevPayments,
    expenses: prevExpenses,
  });
  const totalContributions = distributions
    .filter((d) => d.type === "contribution")
    .reduce((s, d) => s + Number(d.amount), 0);

  // Per-property breakdown
  const incomeByProp: Record<string, number> = {};
  payments.forEach((p: any) => {
    const pid = p.leases?.units?.property_id;
    if (pid) incomeByProp[pid] = (incomeByProp[pid] || 0) + Number(p.amount);
  });
  const opExByProp: Record<string, number> = {};
  const debtServiceByProp: Record<string, number> = {};
  let generalOpEx = 0;
  expenses.forEach((e: any) => {
    if (!e.property_id) {
      // Custom/other expenses (no property) — counted in totals above,
      // surfaced as their own row under the per-property table.
      generalOpEx += Number(e.amount);
      return;
    }
    if (e.category === "mortgage") {
      debtServiceByProp[e.property_id] =
        (debtServiceByProp[e.property_id] || 0) + Number(e.amount);
    } else {
      opExByProp[e.property_id] = (opExByProp[e.property_id] || 0) + Number(e.amount);
    }
  });
  const distByProp: Record<string, number> = {};
  let generalDist = 0;
  distributions.forEach((d: any) => {
    if (d.type === "contribution") return;
    if (d.property_id) {
      distByProp[d.property_id] = (distByProp[d.property_id] || 0) + Number(d.amount);
    } else {
      generalDist += Number(d.amount);
    }
  });

  const totalIncome = totals.rentIncome;
  const totalOpEx = totals.opEx;
  const totalDebtService = totals.debtService;
  const totalNOI = totals.noi;
  const totalActualProfit = totals.actualProfit;
  const totalDist = totals.profitTakenOut;
  const totalAvailable = totals.availableToDistribute;
  const totalMargin = totals.margin;
  const totalMiles = mileage.reduce((s: number, m: any) => s + Number(m.miles), 0);
  const mileageDeduction = totalMiles * 0.67;

  const byCategory: Record<string, number> = {};
  expenses.forEach((e: any) => {
    byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount);
  });

  // 1099-NEC candidates: vendors paid >= $600 for the year
  const byVendor: Record<string, number> = {};
  (expensesAllRes.data || []).forEach((e: any) => {
    if (e.vendor) byVendor[e.vendor] = (byVendor[e.vendor] || 0) + Number(e.amount);
  });
  const vendors1099 = Object.entries(byVendor)
    .filter(([, amt]) => amt >= 600)
    .sort((a, b) => b[1] - a[1]);

  // Delta vs previous period for the hero chip
  const profitDelta =
    prevTotals.actualProfit !== 0
      ? Math.round(
          ((totals.actualProfit - prevTotals.actualProfit) /
            Math.abs(prevTotals.actualProfit)) *
            100
        )
      : null;

  // Period chips — preserve property filter when switching
  const propQ = propertyId ? `&property=${propertyId}` : "";
  const chips: { label: string; from: Date; to: Date; active: boolean }[] = [
    {
      label: "This Month",
      from: startOfMonth(today),
      to: endOfMonth(today),
      active: isCurrentMonth,
    },
    {
      label: "Last Month",
      from: startOfMonth(subMonths(today, 1)),
      to: endOfMonth(subMonths(today, 1)),
      active: isLastMonth,
    },
    {
      label: "YTD",
      from: startOfYear(today),
      to: endOfMonth(today),
      active: isYTD,
    },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <h1 className="text-2xl font-medium">P&amp;L Report</h1>
          <p className="text-sm text-stone-500">{rangeLabel}</p>
        </div>
        <CsvExportButtons year={calendarYear} />
      </div>

      {/* Period chips + property filter (mirrors the dashboard) */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 bg-white border border-stone-200 rounded-xl p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((c) => (
            <Link
              key={c.label}
              href={`/reports?from=${format(c.from, "yyyy-MM-dd")}&to=${format(c.to, "yyyy-MM-dd")}${propQ}`}
              className={`px-3 py-1 text-xs rounded-full border ${
                c.active
                  ? "bg-teal-700 text-white border-teal-700"
                  : "bg-white border-stone-200 text-stone-700 hover:border-teal-400 hover:bg-stone-50"
              }`}
            >
              {c.label}
            </Link>
          ))}
          <form
            action="/reports"
            method="GET"
            className="inline-flex items-center gap-1 ml-1"
          >
            <input
              type="date"
              name="from"
              defaultValue={rangeStartStr}
              className="text-xs border border-stone-200 rounded-md px-1.5 py-1 bg-white"
              aria-label="From date"
            />
            <span className="text-xs text-stone-400">→</span>
            <input
              type="date"
              name="to"
              defaultValue={rangeEndStr}
              className="text-xs border border-stone-200 rounded-md px-1.5 py-1 bg-white"
              aria-label="To date"
            />
            {propertyId && (
              <input type="hidden" name="property" value={propertyId} />
            )}
            <button
              type="submit"
              className="text-xs text-teal-700 hover:text-teal-800 px-2 py-1"
            >
              Go
            </button>
          </form>
        </div>
        <form action="/reports" method="GET" className="flex items-center gap-2">
          <input type="hidden" name="from" value={rangeStartStr} />
          <input type="hidden" name="to" value={rangeEndStr} />
          <select
            name="property"
            defaultValue={propertyId || "all"}
            className="text-sm border border-stone-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-teal-600"
          >
            <option value="all">All rental homes</option>
            {properties.map((p: any) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="text-xs text-teal-700 hover:text-teal-800 px-2 py-1"
          >
            Apply
          </button>
        </form>
      </div>

      {/* Hero "Actual Profit" card — mirrors the dashboard so numbers obviously line up */}
      <div className="relative bg-gradient-to-br from-emerald-900 via-stone-900 to-stone-900 text-white rounded-2xl p-5 sm:p-6 mb-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent pointer-events-none" />
        <div className="relative">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="text-[11px] uppercase tracking-wider text-emerald-300/80">
              Actual profit · {rangeLabel}
            </div>
            {profitDelta !== null && (
              <span
                className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                  profitDelta >= 0
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-rose-500/20 text-rose-300"
                }`}
              >
                {profitDelta >= 0 ? (
                  <TrendingUp className="w-3.5 h-3.5" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5" />
                )}
                {profitDelta >= 0 ? "+" : ""}
                {profitDelta}% vs previous
              </span>
            )}
          </div>
          <div
            className={`text-3xl sm:text-5xl font-semibold tracking-tight ${
              totals.actualProfit >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            ${totals.actualProfit.toLocaleString()}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 text-sm">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-stone-400 mb-0.5">
                Rent income
              </div>
              <div className="text-emerald-300 font-semibold">
                ${totals.rentIncome.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-stone-400 mb-0.5">
                Operating exp
              </div>
              <div className="font-semibold">
                ${totals.opEx.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-stone-400 mb-0.5">
                Debt service
              </div>
              <div className="font-semibold">
                ${totals.debtService.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-stone-400 mb-0.5">
                Margin
              </div>
              <div className="font-semibold">{totals.margin}%</div>
            </div>
          </div>
          <div className="mt-4 text-[11px] text-stone-400">
            Open the dashboard with the same period to verify —{" "}
            <Link
              href={`/dashboard?from=${rangeStartStr}&to=${rangeEndStr}${propQ}`}
              className="underline text-emerald-300 hover:text-emerald-200"
            >
              View dashboard with these filters →
            </Link>
          </div>
        </div>
      </div>

      {/* P&L statement — same formula as the dashboard */}
      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden mb-6">
        <div className="flex items-baseline justify-between px-4 py-3 border-b border-stone-100">
          <h2 className="font-medium">Profit &amp; Loss · {rangeLabel}</h2>
          <span className="text-xs text-stone-500">Operating margin {totalMargin}%</span>
        </div>
        <div className="px-4 py-3 grid grid-cols-[1fr_auto] gap-x-6 text-sm">
          <PnlRow label="Rent income" value={totalIncome} />
          <PnlRow label="Operating expenses" value={-totalOpEx} />
          <PnlSubtotalRow label="Net Operating Income (NOI)" value={totalNOI} />
          <PnlRow label="Debt service (mortgage)" value={-totalDebtService} dimWhenZero />
          <PnlSubtotalRow label="Actual profit" value={totalActualProfit} emphasis />
          <PnlRow label="Profit taken out" value={-totalDist} dimWhenZero />
          <PnlSubtotalRow label="Available to distribute" value={totalAvailable} />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Stat label="Rent income" value={`$${totalIncome.toLocaleString()}`} tone="green" />
        <Stat
          label="Operating expenses"
          value={`$${totalOpEx.toLocaleString()}`}
          tone="red"
        />
        <Stat
          label="NOI"
          value={`$${totalNOI.toLocaleString()}`}
          tone={totalNOI >= 0 ? "green" : "red"}
        />
        <Stat
          label="Actual profit"
          value={`$${totalActualProfit.toLocaleString()}`}
          tone={totalActualProfit >= 0 ? "default" : "red"}
        />
      </div>

      {(totalMiles > 0 || totalContributions > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {totalMiles > 0 && (
            <div className="bg-white border border-stone-200 rounded-xl p-4">
              <div className="text-sm text-stone-500 mb-1">Mileage deduction</div>
              <div className="text-xl font-medium text-green-700">
                ${mileageDeduction.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-stone-500 mt-1">
                {totalMiles.toLocaleString()} miles @ $0.67/mile
              </div>
            </div>
          )}
          {totalContributions > 0 && (
            <div className="bg-white border border-stone-200 rounded-xl p-4">
              <div className="text-sm text-stone-500 mb-1">Owner contributions</div>
              <div className="text-xl font-medium">${totalContributions.toLocaleString()}</div>
              <div className="text-xs text-stone-500 mt-1">Cash you put in this year</div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-stone-100">
            <h2 className="font-medium">Per property</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Property</th>
                  <th className="text-right px-4 py-2 font-medium">Income</th>
                  <th className="text-right px-4 py-2 font-medium">OpEx</th>
                  <th className="text-right px-4 py-2 font-medium">NOI</th>
                  <th className="text-right px-4 py-2 font-medium">Debt</th>
                  <th className="text-right px-4 py-2 font-medium">Profit</th>
                </tr>
              </thead>
              <tbody>
                {properties.map((p: any) => {
                  const inc = incomeByProp[p.id] || 0;
                  const opex = opExByProp[p.id] || 0;
                  const debt = debtServiceByProp[p.id] || 0;
                  const noi = inc - opex;
                  const profit = noi - debt;
                  return (
                    <tr key={p.id} className="border-t border-stone-100">
                      <td className="px-4 py-2.5">{p.name}</td>
                      <td className="px-4 py-2.5 text-right text-green-700">
                        ${inc.toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-right text-red-700">
                        ${opex.toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium">
                        ${noi.toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-right text-stone-600">
                        ${debt.toLocaleString()}
                      </td>
                      <td
                        className={`px-4 py-2.5 text-right font-medium ${
                          profit >= 0 ? "text-green-700" : "text-red-700"
                        }`}
                      >
                        ${profit.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
                {generalOpEx > 0 && (
                  <tr className="border-t border-stone-100 text-stone-500 italic">
                    <td className="px-4 py-2.5" colSpan={2}>
                      Custom / other expenses (no property)
                    </td>
                    <td className="px-4 py-2.5 text-right text-red-700 not-italic">
                      ${generalOpEx.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5" colSpan={3} />
                  </tr>
                )}
                {generalDist > 0 && (
                  <tr className="border-t border-stone-100 text-stone-500 italic">
                    <td className="px-4 py-2.5" colSpan={5}>
                      General distributions (unassigned to a property)
                    </td>
                    <td className="px-4 py-2.5 text-right text-purple-700 not-italic">
                      ${generalDist.toLocaleString()}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-stone-100">
            <h2 className="font-medium">Expenses by category</h2>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {Object.entries(byCategory)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, amt]) => (
                  <tr key={cat} className="border-t border-stone-100 first:border-0">
                    <td className="px-4 py-2.5 capitalize">{cat.replace("_", " ")}</td>
                    <td className="px-4 py-2.5 text-right text-red-700">
                      ${amt.toLocaleString()}
                    </td>
                  </tr>
                ))}
              {Object.keys(byCategory).length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-stone-500 text-center" colSpan={2}>
                    No expenses logged
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden mt-3">
        <div className="px-4 py-3 border-b border-stone-100">
          <h2 className="font-medium">Contractors paid &ge; $600 (1099-NEC candidates)</h2>
          <p className="text-xs text-stone-500 mt-0.5">
            You may need to issue a 1099-NEC to anyone listed below for {calendarYear}.
          </p>
        </div>
        {vendors1099.length === 0 ? (
          <p className="px-4 py-6 text-sm text-stone-500 text-center">
            No vendors over $600 yet.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-stone-50">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Vendor</th>
                <th className="text-right px-4 py-2 font-medium">Total paid</th>
              </tr>
            </thead>
            <tbody>
              {vendors1099.map(([vendor, amt]) => (
                <tr key={vendor} className="border-t border-stone-100">
                  <td className="px-4 py-2.5">{vendor}</td>
                  <td className="px-4 py-2.5 text-right">${amt.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function fmtSigned(n: number) {
  if (n < 0) return `-$${Math.abs(n).toLocaleString()}`;
  return `$${n.toLocaleString()}`;
}

function PnlRow({
  label,
  value,
  dimWhenZero,
}: {
  label: string;
  value: number;
  dimWhenZero?: boolean;
}) {
  const dim = dimWhenZero && value === 0;
  return (
    <>
      <div className={`py-1.5 ${dim ? "text-stone-400" : "text-stone-600"}`}>{label}</div>
      <div
        className={`py-1.5 text-right tabular-nums ${
          dim ? "text-stone-400" : value < 0 ? "text-red-700" : "text-stone-900"
        }`}
      >
        {fmtSigned(value)}
      </div>
    </>
  );
}

function PnlSubtotalRow({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: number;
  emphasis?: boolean;
}) {
  const cls = emphasis ? "font-semibold text-stone-900" : "font-medium text-stone-800";
  const tone =
    value > 0 ? "text-green-700" : value < 0 ? "text-amber-700" : "text-stone-700";
  return (
    <>
      <div className={`py-1.5 border-t border-stone-200 ${cls}`}>{label}</div>
      <div
        className={`py-1.5 text-right tabular-nums border-t border-stone-200 ${cls} ${tone}`}
      >
        {fmtSigned(value)}
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "green" | "red" | "purple";
}) {
  const colors = {
    default: "",
    green: "text-green-700",
    red: "text-red-700",
    purple: "text-purple-700",
  };
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4">
      <div className="text-sm text-stone-500 mb-1">{label}</div>
      <div className={`text-2xl font-medium ${colors[tone]}`}>{value}</div>
    </div>
  );
}
