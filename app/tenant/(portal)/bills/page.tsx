import Link from "next/link";
import { format, startOfMonth, addMonths, isBefore } from "date-fns";
import { Calendar, Check, AlertCircle, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import StatusBadge from "@/components/ui/StatusBadge";
import { parseDbDate } from "@/lib/dates";
import PayRentButton from "@/components/tenant/PayRentButton";

export default async function TenantBillsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("auth_user_id", user!.id)
    .maybeSingle();

  if (!tenant) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <p className="text-stone-500">No tenant record linked to your account.</p>
      </div>
    );
  }

  const [leasesRes, paymentsRes, methodsRes] = await Promise.all([
    supabase
      .from("leases")
      .select(
        "id, start_date, end_date, monthly_rent, rent_due_day, status, autopay_enabled"
      )
      .order("start_date", { ascending: false }),
    supabase
      .from("payments")
      .select("amount, payment_date, for_month, lease_id, processor_status"),
    supabase
      .from("tenant_payment_methods")
      .select("*")
      .eq("tenant_id", tenant.id)
      .neq("status", "detached")
      .order("created_at", { ascending: false }),
  ]);

  const leases = (leasesRes.data || []) as any[];
  const payments = (paymentsRes.data || []) as any[];
  const methods = (methodsRes.data || []) as any[];
  const hasActiveMethod = methods.some((m) => m.status === "active");

  // Build month-by-month timeline for the active lease, plus 3 future months
  const activeLease = leases.find((l) => l.status === "active");
  const today = new Date();

  type Row = {
    key: string;
    label: string;
    expected: number;
    paid: number;
    dueDate: Date;
    status: "paid" | "partial" | "due" | "upcoming" | "overdue";
  };
  const rows: Row[] = [];

  if (activeLease) {
    const start = startOfMonth(parseDbDate(activeLease.start_date));
    const stop = startOfMonth(addMonths(today, 3));
    const dueDay = activeLease.rent_due_day || 1;
    const rent = Number(activeLease.monthly_rent);
    let cursor = start;

    while (!isBefore(stop, cursor)) {
      const key = format(cursor, "yyyy-MM");
      const paidThis = payments
        .filter((p) => p.lease_id === activeLease.id && p.for_month?.startsWith(key))
        .reduce((s, p) => s + Number(p.amount), 0);
      const dueDate = new Date(cursor.getFullYear(), cursor.getMonth(), Math.min(dueDay, 28));
      let status: Row["status"];
      if (paidThis >= rent) status = "paid";
      else if (isBefore(today, dueDate)) status = paidThis > 0 ? "partial" : "upcoming";
      else if (paidThis > 0) status = "partial";
      else status = isBefore(dueDate, today) ? "overdue" : "due";

      rows.push({
        key,
        label: format(cursor, "MMMM yyyy"),
        expected: rent,
        paid: paidThis,
        dueDate,
        status,
      });
      cursor = addMonths(cursor, 1);
    }
  }

  // Most recent first
  rows.reverse();

  const totalExpected = rows.filter((r) => r.status !== "upcoming").reduce((s, r) => s + r.expected, 0);
  const totalPaid = rows.reduce((s, r) => s + r.paid, 0);
  const balance = Math.max(0, totalExpected - totalPaid);

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-medium">Bills timeline</h1>
        <p className="text-sm text-stone-500">Past, current, and upcoming rent</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-white border border-stone-200 rounded-xl p-4">
          <div className="text-sm text-stone-500 mb-1">Total expected</div>
          <div className="text-2xl font-medium">${totalExpected.toLocaleString()}</div>
          <div className="text-xs text-stone-500 mt-1">Lifetime to date</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-xl p-4">
          <div className="text-sm text-stone-500 mb-1">Total paid</div>
          <div className="text-2xl font-medium text-green-700">
            ${totalPaid.toLocaleString()}
          </div>
        </div>
        <div className="bg-white border border-stone-200 rounded-xl p-4">
          <div className="text-sm text-stone-500 mb-1">Outstanding</div>
          <div
            className={`text-2xl font-medium ${
              balance > 0 ? "text-amber-700" : "text-green-700"
            }`}
          >
            ${balance.toLocaleString()}
          </div>
        </div>
      </div>

      {activeLease && !hasActiveMethod && (
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-medium text-stone-900">Pay rent online</div>
            <p className="text-sm text-stone-600">
              Link a bank account or card to pay rent in one click.
            </p>
          </div>
          <Link
            href="/tenant/payments/methods"
            className="px-3 py-1.5 text-sm bg-teal-700 text-white rounded-md hover:bg-teal-800"
          >
            Add payment method
          </Link>
        </div>
      )}

      {!activeLease ? (
        <div className="bg-white border border-stone-200 rounded-xl p-8 text-center text-stone-500">
          No active lease. Bills will appear here once a lease is set up.
        </div>
      ) : (
        <ol className="relative border-l-2 border-stone-200 ml-3 space-y-3">
          {rows.map((r) => {
            const tone =
              r.status === "paid"
                ? "green"
                : r.status === "partial"
                  ? "amber"
                  : r.status === "overdue"
                    ? "red"
                    : r.status === "upcoming"
                      ? "stone"
                      : "amber";
            const Icon =
              r.status === "paid"
                ? Check
                : r.status === "overdue"
                  ? AlertCircle
                  : r.status === "upcoming"
                    ? Clock
                    : Calendar;
            const dotColor =
              r.status === "paid"
                ? "bg-green-500"
                : r.status === "overdue"
                  ? "bg-red-500"
                  : r.status === "partial"
                    ? "bg-amber-500"
                    : r.status === "upcoming"
                      ? "bg-stone-300"
                      : "bg-amber-500";
            return (
              <li key={r.key} className="ml-4">
                <div
                  className={`absolute -left-2 w-4 h-4 rounded-full border-2 border-white ${dotColor}`}
                />
                <div className="bg-white border border-stone-200 rounded-xl p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className="w-4 h-4 text-stone-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium">{r.label}</div>
                      <div className="text-xs text-stone-500">
                        Due {format(r.dueDate, "MMM d, yyyy")} · ${r.expected.toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    {r.paid > 0 && (
                      <div className="text-sm">
                        <span className="text-green-700 font-medium">
                          ${r.paid.toLocaleString()}
                        </span>
                        <span className="text-stone-400">
                          {" "}/ ${r.expected.toLocaleString()}
                        </span>
                      </div>
                    )}
                    <StatusBadge tone={tone}>
                      {r.status === "paid"
                        ? "Paid"
                        : r.status === "partial"
                          ? "Partial"
                          : r.status === "overdue"
                            ? "Overdue"
                            : r.status === "upcoming"
                              ? "Upcoming"
                              : "Due"}
                    </StatusBadge>
                    {activeLease &&
                      hasActiveMethod &&
                      (r.status === "due" ||
                        r.status === "overdue" ||
                        r.status === "partial") && (
                        <PayRentButton
                          leaseId={activeLease.id}
                          forMonth={`${r.key}-01`}
                          defaultAmount={Math.max(r.expected - r.paid, 0)}
                          methods={methods as any}
                        />
                      )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
