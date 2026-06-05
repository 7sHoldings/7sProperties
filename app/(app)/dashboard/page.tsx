import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import {
  startOfMonth,
  endOfMonth,
  format,
  subMonths,
  startOfYear,
  differenceInCalendarDays,
} from "date-fns";
import { parseDbDate } from "@/lib/dates";
import { AlertTriangle, CheckCircle2, Circle, HardHat } from "lucide-react";
import LeaseAlerts from "@/components/LeaseAlerts";
import ActivityFeed from "@/components/ActivityFeed";
import { CashflowChart, CategoryPieChart } from "@/components/DashboardCharts";

export default async function DashboardPage() {
  const supabase = await createClient();

  // Lazy-tick expired leases (no-op if RPC doesn't exist or none past end_date)
  await supabase.rpc("expire_overdue_leases").throwOnError().then(() => {}, () => {});

  const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");
  const yearStart = format(startOfYear(new Date()), "yyyy-MM-dd");
  const cashflowSince = format(startOfMonth(subMonths(new Date(), 11)), "yyyy-MM-dd");

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
  ] = await Promise.all([
    supabase.from("properties").select("id, name"),
    supabase.from("units").select("id, status"),
    supabase
      .from("leases")
      .select("id, monthly_rent, end_date, status, tenant_id, tenants(full_name)")
      .eq("status", "active"),
    supabase
      .from("payments")
      .select("id, amount, payment_date, lease_id, leases(tenants(full_name))")
      .gte("for_month", monthStart)
      .lte("for_month", monthEnd)
      .order("payment_date", { ascending: false }),
    supabase
      .from("expenses")
      .select("id, amount, description, expense_date, properties(name)")
      .order("expense_date", { ascending: false })
      .limit(5),
    supabase.from("payments").select("amount, for_month").gte("for_month", yearStart),
    supabase.from("expenses").select("amount, expense_date").gte("expense_date", yearStart),
    supabase.from("distributions").select("amount, type").gte("distribution_date", yearStart),
    supabase.from("payments").select("amount, for_month").gte("for_month", cashflowSince),
    supabase.from("expenses").select("amount, expense_date").gte("expense_date", cashflowSince),
    supabase.from("expenses").select("category, amount").gte("expense_date", yearStart),
    supabase.from("tenants").select("id"),
    supabase
      .from("maintenance_requests")
      .select("id, title, status, priority")
      .in("status", ["open", "in_progress"]),
    supabase
      .from("construction_projects")
      .select("id, name, status, budget, construction_expenses(amount)"),
    supabase
      .from("construction_expenses")
      .select("amount, expense_date")
      .gte("expense_date", yearStart),
    supabase
      .from("expenses")
      .select("amount, expense_date")
      .gte("expense_date", monthStart)
      .lte("expense_date", monthEnd),
  ]);

  const properties = propsRes.data || [];
  const units = unitsRes.data || [];
  const activeLeases = leasesRes.data || [];
  const monthPayments = paymentsRes.data || [];
  const recentExpenses = expensesRes.data || [];
  const tenants = tenantsRes.data || [];
  const openMaint = (openMaintRes.data || []) as any[];

  const totalUnits = units.length;
  const occupiedUnits = units.filter((u) => u.status === "occupied").length;
  const expectedRent = activeLeases.reduce((sum, l) => sum + Number(l.monthly_rent), 0);
  const collectedRent = monthPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const outstanding = Math.max(0, expectedRent - collectedRent);
  const monthExpenses = (monthExpensesRes.data || []).reduce(
    (s: number, e: any) => s + Number(e.amount),
    0
  );
  const monthNet = collectedRent - monthExpenses;
  const collectedPct =
    expectedRent > 0 ? Math.min(100, Math.round((collectedRent / expectedRent) * 100)) : 0;

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

  const ytdIncome = (ytdPaymentsRes.data || []).reduce((s, p: any) => s + Number(p.amount), 0);
  const ytdExpenses = (ytdExpensesRes.data || []).reduce((s, e: any) => s + Number(e.amount), 0);
  const ytdDistributions = (ytdDistRes.data || [])
    .filter((d: any) => d.type !== "contribution")
    .reduce((s, d: any) => s + Number(d.amount), 0);
  const ytdNet = ytdIncome - ytdExpenses;
  const available = ytdNet - ytdDistributions;

  // Cashflow chart data: last 12 months
  const cashflowMap: Record<string, { income: number; expenses: number }> = {};
  for (let i = 11; i >= 0; i--) {
    const m = format(startOfMonth(subMonths(new Date(), i)), "yyyy-MM");
    cashflowMap[m] = { income: 0, expenses: 0 };
  }
  (cashflowPaymentsRes.data || []).forEach((p: any) => {
    const k = String(p.for_month).slice(0, 7);
    if (cashflowMap[k]) cashflowMap[k].income += Number(p.amount);
  });
  (cashflowExpensesRes.data || []).forEach((e: any) => {
    const k = String(e.expense_date).slice(0, 7);
    if (cashflowMap[k]) cashflowMap[k].expenses += Number(e.amount);
  });
  const cashflowData = Object.entries(cashflowMap).map(([k, v]) => ({
    month: format(new Date(k + "-01"), "MMM"),
    income: v.income,
    expenses: v.expenses,
    net: v.income - v.expenses,
  }));

  // Category pie data
  const catMap: Record<string, number> = {};
  (categoryExpensesRes.data || []).forEach((e: any) => {
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

  if (outstanding > 0) {
    alerts.push({
      type: "warn",
      text: `$${outstanding.toLocaleString()} in rent still outstanding for ${format(new Date(), "MMMM")}.`,
      href: "/payments",
    });
  }

  const today = new Date();
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

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-medium">Dashboard</h1>
          <p className="text-sm text-stone-500">{format(new Date(), "MMMM yyyy")}</p>
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

      {/* Combined "This month" panel: expected vs collected, plus monthly review */}
      <div className="bg-white border border-stone-200 rounded-xl p-4 sm:p-5 mb-3">
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <div className="text-sm font-medium text-stone-900">This month</div>
            <div className="text-xs text-stone-500">{format(new Date(), "MMMM yyyy")}</div>
          </div>
          {outstanding > 0 ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
              ${outstanding.toLocaleString()} outstanding
            </span>
          ) : expectedRent > 0 ? (
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

        <div className="border-t border-stone-100 pt-3 grid grid-cols-3 gap-3 sm:gap-4">
          <MiniStat
            label="Total rent recorded"
            value={`$${collectedRent.toLocaleString()}`}
          />
          <MiniStat
            label="Total expenses recorded"
            value={`$${monthExpenses.toLocaleString()}`}
          />
          <MiniStat
            label="Net this month"
            value={`$${monthNet.toLocaleString()}`}
            tone={monthNet > 0 ? "success" : monthNet < 0 ? "warning" : undefined}
          />
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

      {/* YTD financial KPIs (rentals) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard
          label="YTD rent income"
          value={`$${ytdIncome.toLocaleString()}`}
          sub={`${new Date().getFullYear()} year-to-date`}
          tone="success"
        />
        <KpiCard
          label="YTD expenses"
          value={`$${ytdExpenses.toLocaleString()}`}
          sub="Including maintenance"
        />
        <KpiCard
          label="Profit taken out"
          value={`$${ytdDistributions.toLocaleString()}`}
          sub="YTD distributions"
        />
        <KpiCard
          label="Available to distribute"
          value={`$${Math.max(0, available).toLocaleString()}`}
          sub={available < 0 ? "Negative — pulled more than earned" : "Net YTD − distributions"}
          tone={available > 0 ? "success" : available < 0 ? "warning" : undefined}
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

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "warning";
}) {
  const valueColor =
    tone === "success"
      ? "text-green-700"
      : tone === "warning"
        ? "text-amber-700"
        : "text-stone-900";
  return (
    <div>
      <div className="text-[11px] sm:text-xs text-stone-500 uppercase tracking-wider mb-0.5">
        {label}
      </div>
      <div className={`text-lg sm:text-xl font-medium ${valueColor}`}>{value}</div>
    </div>
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
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "success" | "warning";
}) {
  const subColor =
    tone === "success" ? "text-green-700" : tone === "warning" ? "text-amber-700" : "text-stone-500";
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4">
      <div className="text-sm text-stone-500 mb-1">{label}</div>
      <div className="text-2xl font-medium">{value}</div>
      {sub && <div className={`text-xs mt-1 ${subColor}`}>{sub}</div>}
    </div>
  );
}
