import Link from "next/link";
import { format } from "date-fns";
import { Repeat } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import EmptyState from "@/components/ui/EmptyState";
import StatusBadge from "@/components/ui/StatusBadge";
import DeleteButton from "@/components/DeleteButton";
import GenerateRecurringButton from "@/components/GenerateRecurringButton";

export default async function RecurringExpensesPage() {
  const supabase = await createClient();
  const { data: templates } = await supabase
    .from("recurring_expenses")
    .select("*, properties(name)")
    .order("active", { ascending: false })
    .order("created_at", { ascending: false });

  const list = (templates || []) as any[];
  const activeTotal = list
    .filter((t) => t.active)
    .reduce((s, t) => {
      const monthly =
        t.frequency === "monthly"
          ? Number(t.amount)
          : t.frequency === "quarterly"
            ? Number(t.amount) / 3
            : Number(t.amount) / 12;
      return s + monthly;
    }, 0);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-medium">Recurring expenses</h1>
          <p className="text-sm text-stone-500">
            ~${activeTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}/month from {list.filter((t) => t.active).length} active template{list.filter((t) => t.active).length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <GenerateRecurringButton />
          <Link
            href="/recurring/new"
            className="px-3 py-1.5 text-sm bg-white border border-stone-200 rounded-md hover:bg-stone-50"
          >
            + Add template
          </Link>
        </div>
      </div>

      <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 mb-6 text-sm text-stone-700">
        <strong className="block mb-1">How this works</strong>
        Set up templates for fixed costs (mortgage, insurance, taxes, HOA). Click{" "}
        <strong>Generate due expenses</strong> at the start of each month — the system creates
        expense entries for any template that's due, and won't double-create.
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={<Repeat className="w-6 h-6" />}
          title="No recurring expenses"
          description="Set up monthly mortgage, insurance, HOA, and other fixed costs once, then generate them automatically each month."
          actionLabel="+ Add template"
          actionHref="/recurring/new"
        />
      ) : (
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
          <div className="hidden md:block">
            <table className="w-full text-sm">
              <thead className="bg-stone-50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Description</th>
                  <th className="text-left px-4 py-2 font-medium">Property</th>
                  <th className="text-left px-4 py-2 font-medium">Frequency</th>
                  <th className="text-right px-4 py-2 font-medium">Amount</th>
                  <th className="text-left px-4 py-2 font-medium">Last generated</th>
                  <th className="text-center px-4 py-2 font-medium">Status</th>
                  <th className="text-right px-4 py-2 font-medium w-24"></th>
                </tr>
              </thead>
              <tbody>
                {list.map((t: any) => (
                  <tr key={t.id} className="border-t border-stone-100">
                    <td className="px-4 py-3">
                      <div className="font-medium">{t.description}</div>
                      <div className="text-xs text-stone-500 capitalize">
                        {t.category.replace("_", " ")}
                      </div>
                    </td>
                    <td className="px-4 py-3">{t.properties?.name || "—"}</td>
                    <td className="px-4 py-3 capitalize">
                      {t.frequency} · day {t.day_of_month}
                    </td>
                    <td className="px-4 py-3 text-right">${Number(t.amount).toLocaleString()}</td>
                    <td className="px-4 py-3 text-stone-600">
                      {t.last_generated_for
                        ? format(new Date(t.last_generated_for), "MMM yyyy")
                        : "Never"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge tone={t.active ? "green" : "stone"}>
                        {t.active ? "Active" : "Paused"}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          href={`/recurring/${t.id}/edit`}
                          className="text-xs text-teal-700 hover:underline"
                        >
                          Edit
                        </Link>
                        <DeleteButton table="recurring_expenses" id={t.id} variant="icon" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden divide-y divide-stone-100">
            {list.map((t: any) => (
              <div key={t.id} className="p-3">
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{t.description}</div>
                    <div className="text-xs text-stone-500 truncate">
                      {t.properties?.name} · {t.frequency}
                    </div>
                    <div className="mt-1">
                      <StatusBadge tone={t.active ? "green" : "stone"}>
                        {t.active ? "Active" : "Paused"}
                      </StatusBadge>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">${Number(t.amount).toLocaleString()}</div>
                    <div className="flex gap-3 mt-2 justify-end">
                      <Link
                        href={`/recurring/${t.id}/edit`}
                        className="text-xs text-teal-700"
                      >
                        Edit
                      </Link>
                      <DeleteButton table="recurring_expenses" id={t.id} variant="icon" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
