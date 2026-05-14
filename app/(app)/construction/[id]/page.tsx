import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import DeleteButton from "@/components/DeleteButton";
import ConstructionExpensesPanel from "@/components/ConstructionExpensesPanel";
import ConvertToPropertyButton from "@/components/ConvertToPropertyButton";
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

export default async function ConstructionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("construction_projects")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!project) notFound();

  const { data: expenses } = await supabase
    .from("construction_expenses")
    .select("*")
    .eq("project_id", id)
    .order("expense_date", { ascending: false });

  const list = (expenses || []) as any[];
  const spent = list.reduce((s: number, e: any) => s + Number(e.amount), 0);
  const budget = Number(project.budget) || 0;
  const remaining = budget > 0 ? budget - spent : 0;
  const pct = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;

  // Receipt counts per expense
  const expenseIds = list.map((e) => e.id);
  let receiptCounts: Record<string, number> = {};
  if (expenseIds.length > 0) {
    const { data: docs } = await supabase
      .from("documents")
      .select("construction_expense_id")
      .in("construction_expense_id", expenseIds);
    (docs || []).forEach((d: any) => {
      const key = d.construction_expense_id;
      if (key) receiptCounts[key] = (receiptCounts[key] || 0) + 1;
    });
  }

  // Spend by category
  const byCategory = list.reduce<Record<string, number>>((acc, e: any) => {
    const k = e.category || "other";
    acc[k] = (acc[k] || 0) + Number(e.amount);
    return acc;
  }, {});
  const categories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-stone-500 mb-4">
        <Link href="/construction" className="hover:underline">
          Construction
        </Link>
        <span>›</span>
        <span className="text-stone-900">{project.name}</span>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-medium">{project.name}</h1>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                STATUS_COLOR[project.status] || "bg-stone-100"
              }`}
            >
              {STATUS_LABEL[project.status] || project.status}
            </span>
          </div>
          <p className="text-sm text-stone-500 mt-1">
            {project.address || "—"}
            {project.city ? ` · ${project.city}` : ""}
            {project.state ? `, ${project.state}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ConvertToPropertyButton
            projectId={project.id}
            alreadyLinkedPropertyId={project.property_id}
          />
          <Link
            href={`/construction/${project.id}/edit`}
            className="px-3 py-1.5 text-sm bg-white border border-stone-200 rounded-md hover:bg-stone-50"
          >
            Edit
          </Link>
          <DeleteButton
            table="construction_projects"
            id={project.id}
            redirectTo="/construction"
            confirmMessage="Delete this project and all its expenses?"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Stat label="Budget" value={budget > 0 ? `$${budget.toLocaleString()}` : "—"} />
        <Stat label="Spent" value={`$${spent.toLocaleString()}`} />
        <Stat
          label="Remaining"
          value={budget > 0 ? `$${remaining.toLocaleString()}` : "—"}
          tone={budget > 0 && remaining < 0 ? "rose" : undefined}
        />
        <Stat label="Expenses" value={String(list.length)} />
      </div>

      {budget > 0 && (
        <div className="bg-white border border-stone-200 rounded-xl p-4 mb-5">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-stone-600">Budget used</span>
            <span className="font-medium">
              {pct}%{spent > budget ? " — over budget" : ""}
            </span>
          </div>
          <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
            <div
              className={`h-full ${
                pct >= 100 ? "bg-rose-500" : pct >= 80 ? "bg-amber-500" : "bg-teal-600"
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-3">
        <div id="add-expense" className="lg:col-span-2 scroll-mt-20">
          <ConstructionExpensesPanel
            projectId={project.id}
            expenses={list}
            receiptCounts={receiptCounts}
          />
        </div>

        <div className="bg-white border border-stone-200 rounded-xl p-4 h-fit">
          <h2 className="font-medium mb-3">By category</h2>
          {categories.length === 0 ? (
            <p className="text-sm text-stone-500">No spend yet.</p>
          ) : (
            <ul className="text-sm space-y-2">
              {categories.map(([cat, amt]) => {
                const catPct = spent > 0 ? Math.round((amt / spent) * 100) : 0;
                return (
                  <li key={cat}>
                    <div className="flex justify-between mb-1">
                      <span className="capitalize">{cat.replace(/_/g, " ")}</span>
                      <span className="font-medium">${amt.toLocaleString()}</span>
                    </div>
                    <div className="w-full h-1 bg-stone-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-teal-600"
                        style={{ width: `${catPct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-white border border-stone-200 rounded-xl p-4">
          <h2 className="font-medium mb-3">Project info</h2>
          <Field label="Type" value={(project.property_type || "—").replace(/_/g, " ")} />
          <Field
            label="Bedrooms / Bathrooms"
            value={`${project.bedrooms ?? "—"} bd · ${project.bathrooms ?? "—"} ba`}
          />
          <Field label="Square feet" value={project.square_feet?.toLocaleString() || "—"} />
          <Field
            label="Started"
            value={project.start_date ? format(parseDbDate(project.start_date), "MMM d, yyyy") : "—"}
          />
          <Field
            label="Expected completion"
            value={
              project.expected_completion_date
                ? format(parseDbDate(project.expected_completion_date), "MMM d, yyyy")
                : "—"
            }
          />
          <Field
            label="Actual completion"
            value={
              project.actual_completion_date
                ? format(parseDbDate(project.actual_completion_date), "MMM d, yyyy")
                : "—"
            }
          />
        </div>

        <div className="bg-white border border-stone-200 rounded-xl p-4">
          <h2 className="font-medium mb-3">Notes</h2>
          {project.notes ? (
            <p className="text-sm whitespace-pre-wrap text-stone-700">{project.notes}</p>
          ) : (
            <p className="text-sm text-stone-500">No notes.</p>
          )}
          {project.property_id && (
            <p className="text-xs text-stone-500 mt-4">
              This build has been converted to a rental property.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "rose";
}) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-3 sm:p-4">
      <div className="text-xs text-stone-500 mb-1">{label}</div>
      <div className={`text-lg font-medium ${tone === "rose" ? "text-rose-600" : ""}`}>
        {value}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between text-sm py-1.5 border-b border-stone-100 last:border-0">
      <span className="text-stone-500">{label}</span>
      <span className="capitalize">{value || "—"}</span>
    </div>
  );
}
