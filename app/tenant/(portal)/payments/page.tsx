import Link from "next/link";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import EmptyState from "@/components/ui/EmptyState";
import { DollarSign, Settings } from "lucide-react";
import { parseDbDate } from "@/lib/dates";
import ProcessorStatusBadge from "@/components/ui/ProcessorStatusBadge";

export default async function TenantPaymentsPage() {
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

  const { data: payments } = await supabase
    .from("payments")
    .select(
      "id, amount, payment_date, for_month, payment_method, reference_number, lease_id, processor_status, leases(units(properties(name)))"
    )
    .order("payment_date", { ascending: false });

  const list = (payments || []) as any[];
  // Successful + still-pending ACH count toward the total
  const total = list
    .filter((p) => p.processor_status !== "failed")
    .reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-medium">Payments</h1>
          <p className="text-sm text-stone-500">
            {list.length} payment{list.length === 1 ? "" : "s"} · $
            {total.toLocaleString()} total
          </p>
        </div>
        <Link
          href="/tenant/payments/methods"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-stone-200 rounded-md hover:bg-stone-50"
        >
          <Settings className="w-4 h-4" />
          Payment methods
        </Link>
      </div>

      <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 mb-6 text-sm">
        <div className="font-medium text-stone-900 mb-1">Pay rent online</div>
        <p className="text-stone-700">
          Go to{" "}
          <Link href="/tenant/bills" className="underline font-medium">
            Bills
          </Link>{" "}
          to see your monthly timeline and click <strong>Pay now</strong> on any
          unpaid month. Bank transfers (ACH) take 3–5 business days to clear;
          cards are instant.
        </p>
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={<DollarSign className="w-6 h-6" />}
          title="No payments recorded yet"
          description="Once your property owner records a payment, it'll appear here."
        />
      ) : (
        <>
          <div className="hidden md:block bg-white border border-stone-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-stone-50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Date</th>
                  <th className="text-left px-4 py-2 font-medium">For month</th>
                  <th className="text-left px-4 py-2 font-medium">Property</th>
                  <th className="text-left px-4 py-2 font-medium">Method</th>
                  <th className="text-left px-4 py-2 font-medium">Status</th>
                  <th className="text-right px-4 py-2 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p: any) => (
                  <tr key={p.id} className="border-t border-stone-100">
                    <td className="px-4 py-3 text-stone-600">
                      {format(parseDbDate(p.payment_date), "MMM d, yyyy")}
                    </td>
                    <td className="px-4 py-3 text-stone-600">
                      {format(parseDbDate(p.for_month), "MMM yyyy")}
                    </td>
                    <td className="px-4 py-3">{p.leases?.units?.properties?.name || "—"}</td>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-2">
            {list.map((p: any) => (
              <div key={p.id} className="bg-white border border-stone-200 rounded-xl p-3">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <div className="font-medium">
                      {format(parseDbDate(p.payment_date), "MMM d, yyyy")}
                    </div>
                    <div className="text-xs text-stone-500">
                      For {format(parseDbDate(p.for_month), "MMM yyyy")} ·{" "}
                      {(p.payment_method || "—").replace("_", " ")}
                    </div>
                    <div className="mt-1">
                      <ProcessorStatusBadge status={p.processor_status} />
                    </div>
                  </div>
                  <div
                    className={`font-medium whitespace-nowrap ${
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
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
