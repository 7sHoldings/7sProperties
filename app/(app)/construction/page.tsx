import Link from "next/link";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { parseDbDate } from "@/lib/dates";

const STATUS_LABEL: Record<string, string> = {
  planning: "Planning",
  in_progress: "In progress",
  on_hold: "On hold",
  completed: "Completed",
};

const STATUS_COLOR: Record<string, string> = {
  planning: "bg-stone-100 text-stone-700",
  in_progress: "bg-amber-100 text-amber-800",
  on_hold: "bg-stone-200 text-stone-700",
  completed: "bg-emerald-100 text-emerald-800",
};

export default async function ConstructionPage() {
  const supabase = await createClient();

  const { data: projects } = await supabase
    .from("construction_projects")
    .select("*, construction_expenses(amount)")
    .order("created_at", { ascending: false });

  const list = (projects || []) as any[];

  const totalBudget = list.reduce(
    (s: number, p: any) => s + (Number(p.budget) || 0),
    0
  );
  const totalSpent = list.reduce(
    (s: number, p: any) =>
      s + (p.construction_expenses || []).reduce((a: number, e: any) => a + Number(e.amount), 0),
    0
  );
  const inProgress = list.filter((p: any) => p.status === "in_progress").length;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-medium">Construction</h1>
          <p className="text-sm text-stone-500">
            {list.length} project{list.length === 1 ? "" : "s"} · track new builds before they
            become rentals
          </p>
        </div>
        <Link
          href="/construction/new"
          className="px-3 py-1.5 text-sm bg-teal-700 text-white rounded-md hover:bg-teal-800"
        >
          + New project
        </Link>
      </div>

      {list.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <Stat label="Active builds" value={String(inProgress)} />
          <Stat label="Total budget" value={`$${totalBudget.toLocaleString()}`} />
          <Stat
            label="Total spent"
            value={`$${totalSpent.toLocaleString()}`}
            sub={
              totalBudget > 0
                ? `${Math.round((totalSpent / totalBudget) * 100)}% of budget`
                : undefined
            }
          />
        </div>
      )}

      {list.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-xl p-10 text-center">
          <h2 className="text-lg font-medium mb-2">No construction projects yet</h2>
          <p className="text-sm text-stone-600 mb-4">
            Track build costs (lumber, labor, permits, etc.) for homes you&apos;re building. When
            the home is finished, convert it into a rental property in one click.
          </p>
          <Link
            href="/construction/new"
            className="px-4 py-2 text-sm bg-teal-700 text-white rounded-md hover:bg-teal-800"
          >
            + Start a project
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {list.map((p: any) => {
            const spent = (p.construction_expenses || []).reduce(
              (s: number, e: any) => s + Number(e.amount),
              0
            );
            const budget = Number(p.budget) || 0;
            const pct = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
            return (
              <div
                key={p.id}
                className="bg-white border border-stone-200 rounded-xl p-4 hover:border-stone-300 flex flex-col"
              >
                <Link href={`/construction/${p.id}`} className="block flex-1">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-medium truncate">{p.name}</h3>
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap ${
                        STATUS_COLOR[p.status] || "bg-stone-100"
                      }`}
                    >
                      {STATUS_LABEL[p.status] || p.status}
                    </span>
                  </div>
                  {p.address && (
                    <p className="text-xs text-stone-500 mb-3 truncate">{p.address}</p>
                  )}
                  <div className="text-sm flex justify-between mb-1">
                    <span className="text-stone-500">Spent</span>
                    <span className="font-medium">${spent.toLocaleString()}</span>
                  </div>
                  <div className="text-sm flex justify-between mb-2">
                    <span className="text-stone-500">Budget</span>
                    <span>{budget > 0 ? `$${budget.toLocaleString()}` : "—"}</span>
                  </div>
                  {budget > 0 && (
                    <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${
                          pct >= 100 ? "bg-rose-500" : pct >= 80 ? "bg-amber-500" : "bg-teal-600"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                  {p.expected_completion_date && (
                    <p className="text-[11px] text-stone-500 mt-3">
                      Target: {format(parseDbDate(p.expected_completion_date), "MMM d, yyyy")}
                    </p>
                  )}
                </Link>
                <div className="mt-3 pt-3 border-t border-stone-100 flex items-center justify-between">
                  <Link
                    href={`/construction/${p.id}#add-expense`}
                    className="text-xs text-teal-700 hover:text-teal-800 font-medium"
                  >
                    + Log expense
                  </Link>
                  <Link
                    href={`/construction/${p.id}`}
                    className="text-xs text-stone-500 hover:text-stone-700"
                  >
                    View details →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4">
      <div className="text-xs text-stone-500 mb-1">{label}</div>
      <div className="text-lg font-medium">{value}</div>
      {sub && <div className="text-xs text-stone-500 mt-0.5">{sub}</div>}
    </div>
  );
}
