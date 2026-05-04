import Link from "next/link";
import { format, startOfMonth, endOfMonth, differenceInCalendarDays } from "date-fns";
import { AlertTriangle, Building2, Calendar, DollarSign, Wrench } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import StatusBadge from "@/components/ui/StatusBadge";

export default async function TenantDashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, full_name, email, phone")
    .eq("auth_user_id", user!.id)
    .maybeSingle();

  if (!tenant) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <p className="text-stone-500">No tenant record linked to your account.</p>
      </div>
    );
  }

  const today = format(new Date(), "yyyy-MM-dd");
  const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");

  const [leasesRes, paymentsRes, maintRes] = await Promise.all([
    supabase
      .from("leases")
      .select("id, start_date, end_date, monthly_rent, status, rent_due_day, units(unit_label, properties(name, address, city, state, zip))")
      .eq("tenant_id", tenant.id)
      .order("start_date", { ascending: false }),
    supabase
      .from("payments")
      .select("id, amount, payment_date, for_month, payment_method")
      .gte("for_month", monthStart)
      .lte("for_month", monthEnd),
    supabase
      .from("maintenance_requests")
      .select("id, title, status, priority")
      .eq("tenant_id", tenant.id)
      .neq("status", "completed")
      .neq("status", "cancelled")
      .order("reported_date", { ascending: false }),
  ]);

  const leases = (leasesRes.data || []) as any[];
  const monthPayments = paymentsRes.data || [];
  const openMaint = maintRes.data || [];
  const activeLease = leases.find((l) => l.status === "active");

  const expectedRent = activeLease ? Number(activeLease.monthly_rent) : 0;
  const paidThisMonth = monthPayments.reduce((s, p) => s + Number(p.amount), 0);
  const outstanding = Math.max(0, expectedRent - paidThisMonth);
  const dueDay = activeLease?.rent_due_day ?? 1;
  const daysToLeaseEnd = activeLease
    ? differenceInCalendarDays(new Date(activeLease.end_date), new Date())
    : null;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-medium">Hi, {tenant.full_name.split(" ")[0]}</h1>
        <p className="text-sm text-stone-500">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
      </div>

      {!activeLease && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-amber-900">No active lease on file</h3>
            <p className="text-sm text-amber-800 mt-1">
              Contact your property owner if you believe this is incorrect.
            </p>
          </div>
        </div>
      )}

      {daysToLeaseEnd !== null && daysToLeaseEnd <= 60 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <Calendar className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-amber-900">
              {daysToLeaseEnd < 0
                ? `Lease expired ${Math.abs(daysToLeaseEnd)} day${Math.abs(daysToLeaseEnd) === 1 ? "" : "s"} ago`
                : daysToLeaseEnd === 0
                  ? "Lease expires today"
                  : `Lease expires in ${daysToLeaseEnd} day${daysToLeaseEnd === 1 ? "" : "s"}`}
            </h3>
            <p className="text-sm text-amber-800 mt-1">
              Reach out to your property owner about renewal.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-white border border-stone-200 rounded-xl p-4">
          <div className="text-sm text-stone-500 mb-1 flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5" />
            Monthly rent
          </div>
          <div className="text-2xl font-medium">${expectedRent.toLocaleString()}</div>
          {activeLease && (
            <div className="text-xs text-stone-500 mt-1">Due on the {ordinal(dueDay)} of each month</div>
          )}
        </div>
        <div className="bg-white border border-stone-200 rounded-xl p-4">
          <div className="text-sm text-stone-500 mb-1">Paid this month</div>
          <div className="text-2xl font-medium text-green-700">
            ${paidThisMonth.toLocaleString()}
          </div>
          <div className="text-xs text-stone-500 mt-1">{format(new Date(), "MMMM yyyy")}</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-xl p-4">
          <div className="text-sm text-stone-500 mb-1">Balance</div>
          <div className={`text-2xl font-medium ${outstanding > 0 ? "text-amber-700" : "text-green-700"}`}>
            ${outstanding.toLocaleString()}
          </div>
          <div className="text-xs text-stone-500 mt-1">
            {outstanding > 0 ? "Outstanding for this month" : "All caught up"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white border border-stone-200 rounded-xl p-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-medium flex items-center gap-2">
              <Building2 className="w-4 h-4 text-stone-400" />
              My lease
            </h2>
            {activeLease && <StatusBadge tone="green">Active</StatusBadge>}
          </div>
          {activeLease ? (
            <div className="text-sm space-y-2">
              <div>
                <div className="text-stone-500 text-xs">Property</div>
                <div className="font-medium">{activeLease.units?.properties?.name}</div>
                <div className="text-xs text-stone-500">
                  {activeLease.units?.properties?.address}
                  {activeLease.units?.properties?.city ? `, ${activeLease.units.properties.city}` : ""}
                  {activeLease.units?.properties?.state ? `, ${activeLease.units.properties.state}` : ""}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-stone-100">
                <div>
                  <div className="text-stone-500 text-xs">Start date</div>
                  <div>{format(new Date(activeLease.start_date), "MMM d, yyyy")}</div>
                </div>
                <div>
                  <div className="text-stone-500 text-xs">End date</div>
                  <div>{format(new Date(activeLease.end_date), "MMM d, yyyy")}</div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-stone-500 py-4">No active lease.</p>
          )}
        </div>

        <div className="bg-white border border-stone-200 rounded-xl p-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-medium flex items-center gap-2">
              <Wrench className="w-4 h-4 text-stone-400" />
              Open maintenance
            </h2>
            <Link href="/tenant/maintenance" className="text-xs text-teal-700">
              View all
            </Link>
          </div>
          {openMaint.length === 0 ? (
            <div className="py-4">
              <p className="text-sm text-stone-500 mb-2">No open requests.</p>
              <Link
                href="/tenant/maintenance/new"
                className="inline-flex text-sm text-teal-700 hover:underline"
              >
                Submit a maintenance request →
              </Link>
            </div>
          ) : (
            <ul className="text-sm divide-y divide-stone-100">
              {openMaint.slice(0, 5).map((m: any) => (
                <li key={m.id} className="py-2 flex justify-between items-center">
                  <span className="truncate">{m.title}</span>
                  <StatusBadge tone={m.status === "in_progress" ? "amber" : "red"}>
                    {m.status.replace("_", " ")}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
