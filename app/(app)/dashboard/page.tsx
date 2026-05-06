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
import { AlertTriangle, CheckCircle2, Circle } from "lucide-react";
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

  // Onboarding state
  const onboarding = [
    { id: "property", label: "Add your first property", done: properties.length > 0, href: "/properties/new" },
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
            + Add property
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

      {/* This-month KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <KpiCard
          label="Total properties"
          value={properties.length.toString()}
          sub={`${occupiedUnits}/${totalUnits} units occupied`}
        />
        <KpiCard label="Expected rent" value={`$${expectedRent.toLocaleString()}`} sub="This month" />
        <KpiCard
          label="Collected"
          value={`$${collectedRent.toLocaleString()}`}
          sub={outstanding > 0 ? `$${outstanding.toLocaleString()} outstanding` : "All collected"}
          tone={outstanding > 0 ? "warning" : "success"}
        />
        <KpiCard label="Active leases" value={activeLeases.length.toString()} sub="Currently active" />
      </div>

      {/* YTD KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard
          label="YTD income"
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
