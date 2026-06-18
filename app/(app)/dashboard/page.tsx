import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import {
  startOfMonth,
  endOfMonth,
  format,
  subMonths,
  startOfYear,
  differenceInCalendarDays,
  differenceInDays,
  subDays,
  isSameDay,
  parse,
} from "date-fns";
import { parseDbDate } from "@/lib/dates";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  HardHat,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import LeaseAlerts from "@/components/LeaseAlerts";
import ActivityFeed from "@/components/ActivityFeed";
import { CashflowChart, CategoryPieChart } from "@/components/DashboardCharts";
import { computePnL } from "@/lib/pnl";

function parseISO(s: string | undefined): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = parse(s, "yyyy-MM-dd", new Date());
  return isNaN(d.getTime()) ? null : d;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    property?: string;
    month?: string;
  }>;
}) {
  const supabase = await createClient();

  // Lazy-tick expired leases (no-op if RPC doesn't exist or none past end_date)
  await supabase.rpc("expire_overdue_leases").throwOnError().then(() => {}, () => {});

  const { from, to, property: propertyParam, month: monthParam } = await searchParams;

  // Date range: ?from=YYYY-MM-DD&to=YYYY-MM-DD. Falls back to ?month= for
  // backward compat, and defaults to current calendar month.
  const today = new Date();
  let rangeStart: Date = startOfMonth(today);
  let rangeEnd: Date = endOfMonth(today);
  const parsedFrom = parseISO(from);
  const parsedTo = parseISO(to);
  if (parsedFrom && parsedTo && parsedFrom <= parsedTo) {
    rangeStart = parsedFrom;
    rangeEnd = parsedTo;
  } else if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const parsed = parse(`${monthParam}-01`, "yyyy-MM-dd", new Date());
    if (!isNaN(parsed.getTime())) {
      rangeStart = startOfMonth(parsed);
      rangeEnd = endOfMonth(parsed);
    }
  }

  const propertyId = propertyParam && propertyParam !== "all" ? propertyParam : null;

  // Previous period of equal length, immediately preceding the current range
  const rangeDays = differenceInDays(rangeEnd, rangeStart);
  const prevEnd = subDays(rangeStart, 1);
  const prevStart = subDays(prevEnd, rangeDays);

  // Stringified range bounds for queries
  const rangeStartStr = format(rangeStart, "yyyy-MM-dd");
  const rangeEndStr = format(rangeEnd, "yyyy-MM-dd");
  const prevStartStr = format(prevStart, "yyyy-MM-dd");
  const prevEndStr = format(prevEnd, "yyyy-MM-dd");
  const yearStart = format(startOfYear(rangeStart), "yyyy-MM-dd");
  const cashflowSince = format(startOfMonth(subMonths(rangeEnd, 11)), "yyyy-MM-dd");

  // Period classification: are we looking at a full calendar month / year?
  const isFullMonth =
    isSameDay(rangeStart, startOfMonth(rangeStart)) &&
    isSameDay(rangeEnd, endOfMonth(rangeStart));
  const isCurrentMonth =
    isFullMonth &&
    rangeStart.getFullYear() === today.getFullYear() &&
    rangeStart.getMonth() === today.getMonth();
  const isYTD =
    isSameDay(rangeStart, startOfYear(rangeStart)) &&
    isSameDay(rangeEnd, endOfMonth(today)) &&
    rangeStart.getFullYear() === today.getFullYear();
  const isLastMonth =
    isFullMonth &&
    rangeStart.getFullYear() === subMonths(today, 1).getFullYear() &&
    rangeStart.getMonth() === subMonths(today, 1).getMonth();

  // For drilldown links into PaymentsList / ExpensesList
  const selYearParam = String(rangeStart.getFullYear());
  const selMonthParam = String(rangeStart.getMonth());

  const [
    propsRes,
    unitsRes,
    leasesRes,
    paymentsRes,
    expensesRes,
    ytdPaymentsRes,
    ytdExpensesRes,
    ytdDistRes,
    cashflowPaymentsRes,
    cashflowExpensesRes,
    categoryExpensesRes,
    tenantsRes,
    openMaintRes,
    constructionProjectsRes,
    constructionExpensesYtdRes,
    monthExpensesRes,
    prevMonthPaymentsRes,
    prevMonthExpensesRes,
  ] = await Promise.all([
    supabase.from("properties").select("id, name").order("name"),
    supabase.from("units").select("id, status, property_id"),
    supabase
      .from("leases")
      .select(
        "id, monthly_rent, end_date, status, tenant_id, unit_id, units(property_id), tenants(full_name)"
      )
      .eq("status", "active"),
    // Selected-range payments — include lease/unit so we can filter by property
    supabase
      .from("payments")
      .select(
        "id, amount, payment_date, lease_id, leases(units(property_id), tenants(full_name))"
      )
      .gte("for_month", rangeStartStr)
      .lte("for_month", rangeEndStr)
      .order("payment_date", { ascending: false }),
    // Recent expenses (kept at 5 most recent across all time)
    supabase
      .from("expenses")
      .select("id, amount, property_id, description, expense_date, properties(name)")
      .order("expense_date", { ascending: false })
      .limit(propertyId ? 50 : 5),
    // YTD aggregates
    supabase
      .from("payments")
      .select("amount, for_month, leases(units(property_id))")
      .gte("for_month", yearStart),
    supabase
      .from("expenses")
      .select("amount, category, property_id, expense_date")
      .gte("expense_date", yearStart),
    supabase
      .from("distributions")
      .select("amount, type, property_id")
      .gte("distribution_date", yearStart),
    // Cashflow chart (last 12 months) — filtered in JS by property if set
    supabase
      .from("payments")
      .select("amount, for_month, leases(units(property_id))")
      .gte("for_month", cashflowSince),
    supabase
      .from("expenses")
      .select("amount, property_id, expense_date")
      .gte("expense_date", cashflowSince),
    supabase
      .from("expenses")
      .select("category, amount, property_id")
      .gte("expense_date", yearStart),
    supabase.from("tenants").select("id"),
    supabase
      .from("maintenance_requests")
      .select("id, title, status, priority, property_id")
      .in("status", ["open", "in_progress"]),
    supabase
      .from("construction_projects")
      .select("id, name, status, budget, construction_expenses(amount)"),
    supabase
      .from("construction_expenses")
      .select("amount, expense_date")
      .gte("expense_date", yearStart),
    // Range expenses (with category so we can split mortgage vs OpEx)
    supabase
      .from("expenses")
      .select("amount, category, property_id, expense_date")
      .gte("expense_date", rangeStartStr)
      .lte("expense_date", rangeEndStr),
    // Previous-period payments + expenses for the delta chip
    supabase
      .from("payments")
      .select("amount, for_month, leases(units(property_id))")
      .gte("for_month", prevStartStr)
      .lte("for_month", prevEndStr),
    supabase
      .from("expenses")
      .select("amount, category, property_id, expense_date")
      .gte("expense_date", prevStartStr)
      .lte("expense_date", prevEndStr),
  ]);

  const properties = propsRes.data || [];
  const units = (unitsRes.data || []) as any[];
  const activeLeasesRaw = (leasesRes.data || []) as any[];
  const tenants = tenantsRes.data || [];

  // Optionally narrow everything to one property
  const matchesProperty = <T extends { property_id?: string | null }>(row: T) =>
    !propertyId || row.property_id === propertyId;
  const paymentMatchesProperty = (p: any) =>
    !propertyId || p.leases?.units?.property_id === propertyId;

  const activeLeases = activeLeasesRaw.filter(
    (l) => !propertyId || l.units?.property_id === propertyId
  );
  const filteredUnits = units.filter((u) => !propertyId || u.property_id === propertyId);
  const monthPayments = (paymentsRes.data || []).filter(paymentMatchesProperty);
  const recentExpenses = ((expensesRes.data || []) as any[])
    .filter((e) => !propertyId || e.property_id === propertyId)
    .slice(0, 5);
  const monthExpensesRows = ((monthExpensesRes.data || []) as any[]).filter(matchesProperty);
  const prevMonthPayments = (prevMonthPaymentsRes.data || []).filter(paymentMatchesProperty);
  const prevMonthExpenses = ((prevMonthExpensesRes.data || []) as any[]).filter(matchesProperty);
  const ytdPayments = (ytdPaymentsRes.data || []).filter(paymentMatchesProperty);
  const ytdExpensesRows = ((ytdExpensesRes.data || []) as any[]).filter(matchesProperty);
  const ytdDist = ((ytdDistRes.data || []) as any[]).filter(matchesProperty);
  const openMaint = ((openMaintRes.data || []) as any[]).filter(matchesProperty);

  const totalUnits = filteredUnits.length;
  const occupiedUnits = filteredUnits.filter((u) => u.status === "occupied").length;
  const expectedRent = activeLeases.reduce((sum, l) => sum + Number(l.monthly_rent), 0);

  // ── P&L using the shared helper ──
  const pnl = computePnL({
    payments: monthPayments,
    expenses: monthExpensesRows,
    distributions: ((ytdDistRes.data || []) as any[]).filter(
      (d) => matchesProperty(d) && d.distribution_date >= rangeStartStr && d.distribution_date <= rangeEndStr
    ),
  });
  const collectedRent = pnl.rentIncome;
  const outstanding = Math.max(0, expectedRent - collectedRent);
  const monthOpEx = pnl.opEx;
  const monthDebtService = pnl.debtService;
  const monthNOI = pnl.noi;
  const monthActualProfit = pnl.actualProfit;
  const monthMargin = pnl.margin;
  const collectedPct =
    expectedRent > 0 ? Math.min(100, Math.round((collectedRent / expectedRent) * 100)) : 0;

  const prevPnl = computePnL({
    payments: prevMonthPayments,
    expenses: prevMonthExpenses,
  });
  const prevMonthCollected = prevPnl.rentIncome;
  const prevMonthOpEx = prevPnl.opEx;
  const prevMonthDebtService = prevPnl.debtService;
  const prevMonthNOI = prevPnl.noi;
  const prevMonthActualProfit = prevPnl.actualProfit;

  // Pace + days-left for the hero card. Only meaningful when we're looking at
  // the current calendar month — projects the run-rate to month end.
  const daysInRange = differenceInDays(rangeEnd, rangeStart) + 1;
  const daysElapsed = isCurrentMonth
    ? Math.max(1, differenceInDays(today, rangeStart) + 1)
    : daysInRange;
  const daysLeft = isCurrentMonth
    ? Math.max(0, differenceInDays(rangeEnd, today))
    : 0;
  const periodProgress = Math.min(100, Math.round((daysElapsed / daysInRange) * 100));
  const pacedActualProfit =
    isCurrentMonth && daysElapsed > 0
      ? Math.round((monthActualProfit / daysElapsed) * daysInRange)
      : null;

  const profitDelta = prevMonthActualProfit !== 0
    ? Math.round(((monthActualProfit - prevMonthActualProfit) / Math.abs(prevMonthActualProfit)) * 100)
    : null;

  // Labels
  const rangeLabel = isFullMonth
    ? format(rangeStart, "MMMM yyyy")
    : isYTD
      ? `${rangeStart.getFullYear()} YTD`
      : `${format(rangeStart, "MMM d")} – ${format(rangeEnd, "MMM d, yyyy")}`;
  const prevMonthLabel = isFullMonth
    ? format(prevStart, "MMM yyyy")
    : `prev ${daysInRange} days`;
  const ytdLabel = `${rangeStart.getFullYear()} YTD`;

  // ── Construction KPIs ──
  const constructionProjects = (constructionProjectsRes.data || []) as any[];
  const constructionYtdExpenses = (constructionExpensesYtdRes.data || []) as any[];
  const activeBuilds = constructionProjects.filter((p) => p.status === "in_progress").length;
  const planningBuilds = constructionProjects.filter((p) => p.status === "planning").length;
  const totalBudget = constructionProjects.reduce(
    (s, p) => s + (Number(p.budget) || 0),
    0
  );
  const totalSpentBuild = constructionProjects.reduce(
    (s, p) =>
      s + (p.construction_expenses || []).reduce((a: number, e: any) => a + Number(e.amount), 0),
    0
  );
  const ytdBuildSpent = constructionYtdExpenses.reduce(
    (s, e: any) => s + Number(e.amount),
    0
  );
  const overBudgetProjects = constructionProjects.filter((p) => {
    const b = Number(p.budget) || 0;
    if (b <= 0) return false;
    const spent = (p.construction_expenses || []).reduce(
      (a: number, e: any) => a + Number(e.amount),
      0
    );
    return spent > b;
  });
  const nearBudgetProjects = constructionProjects.filter((p) => {
    const b = Number(p.budget) || 0;
    if (b <= 0) return false;
    const spent = (p.construction_expenses || []).reduce(
      (a: number, e: any) => a + Number(e.amount),
      0
    );
    const pct = spent / b;
    return pct >= 0.8 && pct <= 1;
  });

  // YTD P&L (respects property filter)
  const ytdPnl = computePnL({
    payments: ytdPayments,
    expenses: ytdExpensesRows,
    distributions: ytdDist,
  });
  const ytdIncome = ytdPnl.rentIncome;
  const ytdExpenses = ytdPnl.opEx + ytdPnl.debtService;
  const ytdOpEx = ytdPnl.opEx;
  const ytdDebtService = ytdPnl.debtService;
  const ytdNOI = ytdPnl.noi;
  const ytdActualProfit = ytdPnl.actualProfit;
  const ytdDistributions = ytdPnl.profitTakenOut;
  const ytdMargin = ytdPnl.margin;

  // Cashflow chart data: last 12 months (respects property filter)
  const cashflowMap: Record<string, { income: number; expenses: number }> = {};
  for (let i = 11; i >= 0; i--) {
    const m = format(startOfMonth(subMonths(new Date(), i)), "yyyy-MM");
    cashflowMap[m] = { income: 0, expenses: 0 };
  }
  ((cashflowPaymentsRes.data || []) as any[])
    .filter(paymentMatchesProperty)
    .forEach((p) => {
      const k = String(p.for_month).slice(0, 7);
      if (cashflowMap[k]) cashflowMap[k].income += Number(p.amount);
    });
  ((cashflowExpensesRes.data || []) as any[])
    .filter(matchesProperty)
    .forEach((e) => {
      const k = String(e.expense_date).slice(0, 7);
      if (cashflowMap[k]) cashflowMap[k].expenses += Number(e.amount);
    });
  const cashflowData = Object.entries(cashflowMap).map(([k, v]) => ({
    month: format(new Date(k + "-01"), "MMM"),
    income: v.income,
    expenses: v.expenses,
    net: v.income - v.expenses,
  }));

  // Category pie data (respects property filter)
  const catMap: Record<string, number> = {};
  ((categoryExpensesRes.data || []) as any[])
    .filter(matchesProperty)
    .forEach((e: any) => {
      catMap[e.category] = (catMap[e.category] || 0) + Number(e.amount);
    });
  const categoryData = Object.entries(catMap)
    .map(([name, value]) => ({
      name: name.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase()),
      value,
    }))
    .sort((a, b) => b.value - a.value);

  // Smart alerts
  const alerts: { type: "warn" | "info"; text: string; href: string }[] = [];

  if (outstanding > 0 && isCurrentMonth) {
    alerts.push({
      type: "warn",
      text: `$${outstanding.toLocaleString()} in rent still outstanding for ${format(new Date(), "MMMM")}.`,
      href: "/payments",
    });
  }

  activeLeases.forEach((l: any) => {
    const days = differenceInCalendarDays(parseDbDate(l.end_date), today);
    if (days >= 0 && days <= 60) {
      alerts.push({
        type: "warn",
        text: `${l.tenants?.full_name || "Tenant"}'s lease ends in ${days} day${days === 1 ? "" : "s"}.`,
        href: `/tenants/${l.tenant_id}`,
      });
    }
  });

  const highPriOpen = openMaint.filter(
    (m: any) => m.priority === "urgent" || m.priority === "high"
  );
  if (highPriOpen.length > 0) {
    alerts.push({
      type: "warn",
      text: `${highPriOpen.length} high-priority maintenance request${highPriOpen.length === 1 ? "" : "s"} pending.`,
      href: "/maintenance",
    });
  }

  if (overBudgetProjects.length > 0) {
    alerts.push({
      type: "warn",
      text: `${overBudgetProjects.length} construction project${overBudgetProjects.length === 1 ? " is" : "s are"} over budget.`,
      href: "/construction",
    });
  }
  if (nearBudgetProjects.length > 0) {
    alerts.push({
      type: "warn",
      text: `${nearBudgetProjects.length} construction project${nearBudgetProjects.length === 1 ? " is" : "s are"} within 20% of budget.`,
      href: "/construction",
    });
  }

  // Onboarding state
  const onboarding = [
    { id: "property", label: "Add your first rental home", done: properties.length > 0, href: "/properties/new" },
    { id: "tenant", label: "Add a tenant", done: tenants.length > 0, href: "/tenants/new" },
    { id: "lease", label: "Assign tenant to a unit", done: activeLeases.length > 0, href: "/tenants/new" },
    { id: "payment", label: "Record your first rent payment", done: ytdIncome > 0, href: "/payments/new" },
    { id: "expense", label: "Log an expense", done: ytdExpenses > 0, href: "/expenses/new" },
  ];
  const onboardingComplete = onboarding.every((o) => o.done);
  const completedSteps = onboarding.filter((o) => o.done).length;

  // Period chips — preserve property filter when switching periods
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
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <h1 className="text-2xl font-medium">Dashboard</h1>
          <div className="text-sm text-stone-500 mt-0.5">{rangeLabel}</div>
        </div>
        <div className="flex gap-2">
          <Link
            href="/properties/new"
            className="px-3 py-1.5 text-sm bg-white border border-stone-200 rounded-md hover:bg-stone-50"
          >
            + Add rental home
          </Link>
          <Link
            href="/payments/new"
            className="px-3 py-1.5 text-sm bg-teal-700 text-white rounded-md hover:bg-teal-800"
          >
            Record payment
          </Link>
        </div>
      </div>

      {/* Period chips + property filter */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 bg-white border border-stone-200 rounded-xl p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((c) => (
            <Link
              key={c.label}
              href={`/dashboard?from=${format(c.from, "yyyy-MM-dd")}&to=${format(c.to, "yyyy-MM-dd")}${propQ}`}
              className={`px-3 py-1 text-xs rounded-full border ${
                c.active
                  ? "bg-teal-700 text-white border-teal-700"
                  : "bg-white border-stone-200 text-stone-700 hover:border-teal-400 hover:bg-stone-50"
              }`}
            >
              {c.label}
            </Link>
          ))}
          <CustomRangePicker
            propertyId={propertyId}
            initialFrom={rangeStartStr}
            initialTo={rangeEndStr}
          />
        </div>
        <PropertyFilter
          properties={properties as any}
          selected={propertyId}
          rangeFrom={rangeStartStr}
          rangeTo={rangeEndStr}
        />
      </div>

      {/* Hero: actual profit for the selected range */}
      <ActualProfitHero
        rangeLabel={rangeLabel}
        actualProfit={monthActualProfit}
        deltaPct={profitDelta}
        margin={monthMargin}
        pace={pacedActualProfit}
        daysLeft={daysLeft}
        progressPct={periodProgress}
        isCurrentMonth={isCurrentMonth}
        rangeStart={rangeStart}
      />

      {/* Onboarding checklist */}
      {!onboardingComplete && (
        <div className="bg-gradient-to-br from-teal-50 to-emerald-50 border border-teal-200 rounded-xl p-5 mb-6">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h2 className="font-medium text-stone-900">Get started</h2>
              <p className="text-xs text-stone-600">
                {completedSteps} of {onboarding.length} steps complete
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs text-stone-600">
                {Math.round((completedSteps / onboarding.length) * 100)}% done
              </div>
              <div className="w-32 h-1.5 bg-white rounded-full mt-1">
                <div
                  className="h-full bg-teal-600 rounded-full transition-all"
                  style={{ width: `${(completedSteps / onboarding.length) * 100}%` }}
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {onboarding.map((step) => (
              <Link
                key={step.id}
                href={step.href}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm bg-white border ${
                  step.done
                    ? "border-green-200 text-stone-500"
                    : "border-stone-200 hover:border-teal-400 hover:bg-stone-50"
                }`}
              >
                {step.done ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-stone-300 flex-shrink-0" />
                )}
                <span className={step.done ? "line-through" : ""}>{step.label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <LeaseAlerts />

      {/* Smart alerts */}
      {alerts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-700" />
            <h3 className="font-medium text-amber-900">Things needing attention</h3>
          </div>
          <ul className="text-sm space-y-1">
            {alerts.map((a, i) => (
              <li key={i}>
                <Link href={a.href} className="text-amber-900 hover:underline">
                  · {a.text}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* RENTALS section */}
      <SectionHeader title="Rentals" href="/properties" />

      {/* Combined "Selected month" panel: expected vs collected, plus monthly review */}
      <div className="bg-white border border-stone-200 rounded-xl p-4 sm:p-5 mb-3">
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <div className="text-sm font-medium text-stone-900">
              {isCurrentMonth ? "This month" : "Selected month"}
            </div>
            <div className="text-xs text-stone-500">{format(rangeStart, "MMMM yyyy")}</div>
          </div>
          {outstanding > 0 ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
              ${outstanding.toLocaleString()} outstanding
            </span>
          ) : expectedRent > 0 && isCurrentMonth ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-800 border border-green-200">
              All rent collected
            </span>
          ) : null}
        </div>

        <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-3">
          <MiniStat label="Expected rent" value={`$${expectedRent.toLocaleString()}`} />
          <MiniStat
            label="Collected"
            value={`$${collectedRent.toLocaleString()}`}
            tone={outstanding > 0 ? "warning" : "success"}
            delta={diffFrom(collectedRent, prevMonthCollected)}
            href={`/payments?year=${selYearParam}&month=${selMonthParam}`}
          />
          <MiniStat
            label="Outstanding"
            value={`$${outstanding.toLocaleString()}`}
            tone={outstanding > 0 ? "warning" : undefined}
          />
        </div>

        {expectedRent > 0 && (
          <div className="mb-4">
            <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
              <div
                className={`h-full ${collectedPct >= 100 ? "bg-green-500" : "bg-teal-600"}`}
                style={{ width: `${collectedPct}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-stone-500 mt-1">
              <span>{collectedPct}% collected</span>
              <span>Goal ${expectedRent.toLocaleString()}</span>
            </div>
          </div>
        )}

        {/* P&L statement for the selected month + YTD column */}
        <div className="border-t border-stone-100 pt-4">
          <div className="flex items-baseline justify-between mb-2">
            <h3 className="text-xs font-semibold text-stone-600 uppercase tracking-wider">
              Profit &amp; Loss
            </h3>
            <span className="text-[11px] text-stone-500">
              Margin {monthMargin}% · YTD {ytdMargin}%
            </span>
          </div>
          <div className="grid grid-cols-[1fr_auto_auto] sm:grid-cols-[1fr_auto_auto] gap-x-3 sm:gap-x-6 text-sm">
            <div className="hidden sm:block" />
            <div className="hidden sm:block text-[11px] text-stone-500 uppercase tracking-wider text-right">
              {format(rangeStart, "MMM yyyy")}
            </div>
            <div className="hidden sm:block text-[11px] text-stone-500 uppercase tracking-wider text-right">
              {ytdLabel}
            </div>

            <PnlLine
              label="Rent income"
              monthValue={collectedRent}
              ytdValue={ytdIncome}
              monthHref={`/payments?year=${selYearParam}&month=${selMonthParam}`}
              ytdHref={`/payments?year=${selYearParam}`}
            />
            <PnlLine
              label="Operating expenses"
              monthValue={-monthOpEx}
              ytdValue={-ytdOpEx}
              monthHref={`/expenses?year=${selYearParam}&month=${selMonthParam}`}
              ytdHref={`/expenses?year=${selYearParam}`}
            />

            <PnlSubtotal label="Net Operating Income (NOI)" monthValue={monthNOI} ytdValue={ytdNOI} />

            <PnlLine
              label="Debt service (mortgage)"
              monthValue={-monthDebtService}
              ytdValue={-ytdDebtService}
              dimWhenZero
            />

            <PnlSubtotal
              label="Actual profit"
              monthValue={monthActualProfit}
              ytdValue={ytdActualProfit}
              emphasis
            />

            <PnlLine
              label="Profit taken out"
              monthValue={0}
              ytdValue={-ytdDistributions}
              dimWhenZero
              ytdHref="/distributions"
            />

            <PnlSubtotal
              label="Available to distribute"
              monthValue={monthActualProfit}
              ytdValue={ytdActualProfit - ytdDistributions}
            />
          </div>

          <div className="mt-3 text-[11px] text-stone-500 flex flex-wrap gap-x-4 gap-y-1">
            <span>
              vs {prevMonthLabel}: Rent ${prevMonthCollected.toLocaleString()}, OpEx $
              {prevMonthOpEx.toLocaleString()}, NOI ${prevMonthNOI.toLocaleString()}, Actual
              profit ${prevMonthActualProfit.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <KpiCard
          label="Rental homes"
          value={properties.length.toString()}
          sub={`${occupiedUnits}/${totalUnits} units occupied`}
        />
        <KpiCard
          label="Active leases"
          value={activeLeases.length.toString()}
          sub="Currently active"
        />
      </div>

      {/* YTD P&L KPIs (rentals) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <KpiCard
          label="YTD rent income"
          value={`$${ytdIncome.toLocaleString()}`}
          sub={`${rangeStart.getFullYear()} year-to-date`}
          tone="success"
          href={`/payments?year=${selYearParam}`}
        />
        <KpiCard
          label="YTD operating expenses"
          value={`$${ytdOpEx.toLocaleString()}`}
          sub="Excludes mortgage"
          href={`/expenses?year=${selYearParam}`}
        />
        <KpiCard
          label="YTD NOI"
          value={`$${ytdNOI.toLocaleString()}`}
          sub={ytdIncome > 0 ? `${ytdMargin}% operating margin` : "Income − OpEx"}
          tone={ytdNOI > 0 ? "success" : ytdNOI < 0 ? "warning" : undefined}
        />
        <KpiCard
          label="YTD actual profit"
          value={`$${ytdActualProfit.toLocaleString()}`}
          sub={ytdDebtService > 0 ? `After $${ytdDebtService.toLocaleString()} debt service` : "Cash flow (NOI − debt)"}
          tone={ytdActualProfit > 0 ? "success" : ytdActualProfit < 0 ? "warning" : undefined}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <KpiCard
          label="Profit taken out"
          value={`$${ytdDistributions.toLocaleString()}`}
          sub="YTD distributions"
          href="/distributions"
        />
        <KpiCard
          label="Available to distribute"
          value={`$${Math.max(0, ytdActualProfit - ytdDistributions).toLocaleString()}`}
          sub={
            ytdActualProfit - ytdDistributions < 0
              ? "Negative — pulled more than earned"
              : "Actual profit − distributions"
          }
          tone={
            ytdActualProfit - ytdDistributions > 0
              ? "success"
              : ytdActualProfit - ytdDistributions < 0
                ? "warning"
                : undefined
          }
        />
      </div>

      {/* CONSTRUCTION section */}
      <SectionHeader title="Construction" href="/construction" icon={<HardHat className="w-4 h-4" />} />
      {constructionProjects.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-xl p-5 text-sm text-stone-600 mb-6 flex flex-wrap items-center justify-between gap-3">
          <span>No construction projects yet — track new builds before they become rentals.</span>
          <Link
            href="/construction/new"
            className="px-3 py-1.5 text-sm bg-teal-700 text-white rounded-md hover:bg-teal-800"
          >
            + New project
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <KpiCard
            label="Active builds"
            value={activeBuilds.toString()}
            sub={
              planningBuilds > 0
                ? `${planningBuilds} more in planning`
                : `${constructionProjects.length} total`
            }
          />
          <KpiCard
            label="Total budget"
            value={totalBudget > 0 ? `$${totalBudget.toLocaleString()}` : "—"}
            sub="Across all projects"
          />
          <KpiCard
            label="Total spent"
            value={`$${totalSpentBuild.toLocaleString()}`}
            sub={
              totalBudget > 0
                ? `${Math.round((totalSpentBuild / totalBudget) * 100)}% of budget`
                : `$${ytdBuildSpent.toLocaleString()} YTD`
            }
            tone={
              totalBudget > 0 && totalSpentBuild > totalBudget
                ? "warning"
                : undefined
            }
          />
          <KpiCard
            label="Over budget"
            value={overBudgetProjects.length.toString()}
            sub={
              overBudgetProjects.length > 0
                ? "Needs attention"
                : nearBudgetProjects.length > 0
                  ? `${nearBudgetProjects.length} near limit`
                  : "All on track"
            }
            tone={
              overBudgetProjects.length > 0
                ? "warning"
                : nearBudgetProjects.length > 0
                  ? "warning"
                  : "success"
            }
          />
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
        <CashflowChart data={cashflowData} />
        <CategoryPieChart data={categoryData} />
      </div>

      {/* Activity + recent expenses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <ActivityFeed />

        <div className="bg-white border border-stone-200 rounded-xl p-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-medium">Recent expenses</h2>
            <Link href="/expenses" className="text-xs text-teal-700">
              View all
            </Link>
          </div>
          {recentExpenses.length === 0 ? (
            <p className="text-sm text-stone-500 py-4">No expenses yet.</p>
          ) : (
            <ul className="text-sm">
              {recentExpenses.map((e: any) => (
                <li
                  key={e.id}
                  className="flex justify-between py-2 border-b border-stone-100 last:border-0 gap-2"
                >
                  <div className="min-w-0">
                    <div className="truncate">{e.description}</div>
                    <div className="text-xs text-stone-500 truncate">{e.properties?.name}</div>
                  </div>
                  <span className="text-red-700 font-medium whitespace-nowrap">
                    −${Number(e.amount).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// Difference between two amounts as a signed display + tone hint. For
// "expense-like" metrics (lower is better), invert the tone.
function ActualProfitHero({
  rangeLabel,
  actualProfit,
  deltaPct,
  margin,
  pace,
  daysLeft,
  progressPct,
  isCurrentMonth,
  rangeStart,
}: {
  rangeLabel: string;
  actualProfit: number;
  deltaPct: number | null;
  margin: number;
  pace: number | null;
  daysLeft: number;
  progressPct: number;
  isCurrentMonth: boolean;
  rangeStart: Date;
}) {
  const positive = actualProfit >= 0;
  const deltaPositive = (deltaPct ?? 0) >= 0;
  const captionMonthName = format(rangeStart, "MMMM");
  return (
    <div className="relative bg-gradient-to-br from-emerald-900 via-stone-900 to-stone-900 text-white rounded-2xl p-5 sm:p-6 mb-4 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent pointer-events-none" />
      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="text-[11px] uppercase tracking-wider text-emerald-300/80">
            Actual profit · {rangeLabel}
          </div>
          {deltaPct !== null && (
            <span
              className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                deltaPositive
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "bg-rose-500/20 text-rose-300"
              }`}
            >
              {deltaPositive ? (
                <TrendingUp className="w-3.5 h-3.5" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5" />
              )}
              {deltaPositive ? "+" : ""}
              {deltaPct}% vs previous
            </span>
          )}
        </div>
        <div
          className={`text-3xl sm:text-5xl font-semibold tracking-tight ${
            positive ? "text-emerald-400" : "text-rose-400"
          }`}
        >
          ${actualProfit.toLocaleString()}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-5">
          {pace !== null && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-stone-400 mb-0.5">
                Pace
              </div>
              <div className="text-emerald-300 font-semibold">
                ${pace.toLocaleString()}/mo
              </div>
            </div>
          )}
          {isCurrentMonth && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-stone-400 mb-0.5">
                Days left
              </div>
              <div className="font-semibold">
                {daysLeft} day{daysLeft === 1 ? "" : "s"}
              </div>
            </div>
          )}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-stone-400 mb-0.5">
              Margin
            </div>
            <div className="font-semibold">{margin}%</div>
          </div>
        </div>

        {isCurrentMonth && (
          <div className="mt-4">
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-stone-400 mt-1">
              <span>{progressPct}% through {captionMonthName}</span>
              <span>
                {daysLeft} day{daysLeft === 1 ? "" : "s"} left
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PropertyFilter({
  properties,
  selected,
  rangeFrom,
  rangeTo,
}: {
  properties: { id: string; name: string }[];
  selected: string | null;
  rangeFrom: string;
  rangeTo: string;
}) {
  // Server-rendered select that posts via a hidden form. Submits navigate to a
  // new URL preserving from/to.
  return (
    <form action="/dashboard" method="GET" className="flex items-center gap-2">
      <input type="hidden" name="from" value={rangeFrom} />
      <input type="hidden" name="to" value={rangeTo} />
      <select
        name="property"
        defaultValue={selected || "all"}
        className="text-sm border border-stone-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-teal-600"
      >
        <option value="all">All rental homes</option>
        {properties.map((p) => (
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
  );
}

function CustomRangePicker({
  propertyId,
  initialFrom,
  initialTo,
}: {
  propertyId: string | null;
  initialFrom: string;
  initialTo: string;
}) {
  return (
    <form
      action="/dashboard"
      method="GET"
      className="inline-flex items-center gap-1 ml-1"
    >
      <input
        type="date"
        name="from"
        defaultValue={initialFrom}
        className="text-xs border border-stone-200 rounded-md px-1.5 py-1 bg-white"
        aria-label="From date"
      />
      <span className="text-xs text-stone-400">→</span>
      <input
        type="date"
        name="to"
        defaultValue={initialTo}
        className="text-xs border border-stone-200 rounded-md px-1.5 py-1 bg-white"
        aria-label="To date"
      />
      {propertyId && <input type="hidden" name="property" value={propertyId} />}
      <button
        type="submit"
        className="text-xs text-teal-700 hover:text-teal-800 px-2 py-1"
      >
        Go
      </button>
    </form>
  );
}

function diffFrom(
  curr: number,
  prev: number,
  expenseLike = false
): { delta: number; pct: number | null; tone: "good" | "bad" | "neutral" } | null {
  if (prev === 0 && curr === 0) return null;
  const delta = curr - prev;
  const pct = prev === 0 ? null : Math.round((delta / Math.abs(prev)) * 100);
  let tone: "good" | "bad" | "neutral" = "neutral";
  if (delta !== 0) {
    const up = delta > 0;
    tone = (expenseLike ? !up : up) ? "good" : "bad";
  }
  return { delta, pct, tone };
}

function MiniStat({
  label,
  value,
  tone,
  delta,
  href,
}: {
  label: string;
  value: string;
  tone?: "success" | "warning";
  delta?: ReturnType<typeof diffFrom> | null;
  href?: string;
}) {
  const valueColor =
    tone === "success"
      ? "text-green-700"
      : tone === "warning"
        ? "text-amber-700"
        : "text-stone-900";
  const body = (
    <>
      <div className="text-[11px] sm:text-xs text-stone-500 uppercase tracking-wider mb-0.5">
        {label}
      </div>
      <div className={`text-lg sm:text-xl font-medium ${valueColor}`}>{value}</div>
      {delta && delta.delta !== 0 && (
        <div
          className={`mt-1 inline-flex items-center gap-0.5 text-[10px] ${
            delta.tone === "good"
              ? "text-green-700"
              : delta.tone === "bad"
                ? "text-amber-700"
                : "text-stone-500"
          }`}
          title={`vs previous month`}
        >
          {delta.delta > 0 ? (
            <TrendingUp className="w-3 h-3" />
          ) : (
            <TrendingDown className="w-3 h-3" />
          )}
          {delta.delta > 0 ? "+" : ""}${Math.abs(delta.delta).toLocaleString()}
          {delta.pct !== null && (
            <span className="text-stone-400 ml-0.5">
              ({delta.pct > 0 ? "+" : ""}
              {delta.pct}%)
            </span>
          )}
        </div>
      )}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block -m-1 p-1 rounded-md hover:bg-stone-50 transition-colors"
      >
        {body}
      </Link>
    );
  }
  return <div>{body}</div>;
}

function fmtSigned(n: number) {
  if (n < 0) return `-$${Math.abs(n).toLocaleString()}`;
  return `$${n.toLocaleString()}`;
}

function PnlLine({
  label,
  monthValue,
  ytdValue,
  monthHref,
  ytdHref,
  dimWhenZero,
}: {
  label: string;
  monthValue: number;
  ytdValue: number;
  monthHref?: string;
  ytdHref?: string;
  dimWhenZero?: boolean;
}) {
  const isNegative = monthValue < 0 || ytdValue < 0;
  const dim = dimWhenZero && monthValue === 0 && ytdValue === 0;
  const valueColor = dim
    ? "text-stone-400"
    : isNegative
      ? "text-red-700"
      : "text-stone-900";
  const monthBody = <span className={valueColor}>{fmtSigned(monthValue)}</span>;
  const ytdBody = <span className={valueColor}>{fmtSigned(ytdValue)}</span>;
  return (
    <>
      <div className={`py-1.5 text-stone-600 ${dim ? "text-stone-400" : ""}`}>{label}</div>
      <div className="py-1.5 text-right tabular-nums">
        {monthHref && monthValue !== 0 ? (
          <Link href={monthHref} className="hover:underline">
            {monthBody}
          </Link>
        ) : (
          monthBody
        )}
      </div>
      <div className="py-1.5 text-right tabular-nums">
        {ytdHref && ytdValue !== 0 ? (
          <Link href={ytdHref} className="hover:underline">
            {ytdBody}
          </Link>
        ) : (
          ytdBody
        )}
      </div>
    </>
  );
}

function PnlSubtotal({
  label,
  monthValue,
  ytdValue,
  emphasis,
}: {
  label: string;
  monthValue: number;
  ytdValue: number;
  emphasis?: boolean;
}) {
  const cls = emphasis ? "font-semibold text-stone-900" : "font-medium text-stone-800";
  const tone = (v: number) =>
    v > 0
      ? "text-green-700"
      : v < 0
        ? "text-amber-700"
        : "text-stone-700";
  return (
    <>
      <div className={`py-1.5 border-t border-stone-200 ${cls}`}>{label}</div>
      <div className={`py-1.5 text-right tabular-nums border-t border-stone-200 ${cls} ${tone(monthValue)}`}>
        {fmtSigned(monthValue)}
      </div>
      <div className={`py-1.5 text-right tabular-nums border-t border-stone-200 ${cls} ${tone(ytdValue)}`}>
        {fmtSigned(ytdValue)}
      </div>
    </>
  );
}

function SectionHeader({
  title,
  href,
  icon,
}: {
  title: string;
  href: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between mb-2">
      <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
        {icon}
        {title}
      </h2>
      <Link href={href} className="text-xs text-teal-700 hover:text-teal-800">
        View all →
      </Link>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  tone,
  href,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "success" | "warning";
  href?: string;
}) {
  const subColor =
    tone === "success" ? "text-green-700" : tone === "warning" ? "text-amber-700" : "text-stone-500";
  const body = (
    <>
      <div className="text-sm text-stone-500 mb-1">{label}</div>
      <div className="text-2xl font-medium">{value}</div>
      {sub && <div className={`text-xs mt-1 ${subColor}`}>{sub}</div>}
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="block bg-white border border-stone-200 rounded-xl p-4 hover:border-teal-300 hover:shadow-sm transition"
      >
        {body}
      </Link>
    );
  }
  return <div className="bg-white border border-stone-200 rounded-xl p-4">{body}</div>;
}
