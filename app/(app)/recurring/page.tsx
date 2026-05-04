import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import GenerateRecurringButton from "@/components/GenerateRecurringButton";
import RecurringList from "@/components/lists/RecurringList";

export default async function RecurringExpensesPage() {
  const supabase = await createClient();
  const [tplRes, propsRes] = await Promise.all([
    supabase
      .from("recurring_expenses")
      .select("*, properties(name)")
      .order("active", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("properties").select("id, name").order("name"),
  ]);

  const list = (tplRes.data || []) as any[];
  const properties = (propsRes.data || []) as any[];
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
            ~${activeTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}/month from{" "}
            {list.filter((t) => t.active).length} active template
            {list.filter((t) => t.active).length === 1 ? "" : "s"}
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

      <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 mb-3 text-sm text-stone-700">
        <strong className="block mb-1">How this works</strong>
        Set up templates for fixed costs (mortgage, insurance, taxes, HOA). Click{" "}
        <strong>Generate due expenses</strong> at the start of each month — the system creates
        expense entries for any template that's due, and won't double-create.
      </div>

      <RecurringList templates={list} properties={properties} />
    </div>
  );
}
