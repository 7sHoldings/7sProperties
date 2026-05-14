"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Search, Plus, Pencil, FileText } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { parseDbDate } from "@/lib/dates";
import ConstructionExpenseForm, {
  CONSTRUCTION_CATEGORIES,
} from "@/components/forms/ConstructionExpenseForm";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Trash2 } from "lucide-react";

type Expense = {
  id: string;
  expense_date: string;
  amount: number | string;
  category: string;
  description: string;
  vendor: string | null;
  notes: string | null;
};

type Props = {
  projectId: string;
  expenses: Expense[];
  receiptCounts: Record<string, number>;
};

// Phases group categories so spend can be tracked across stages of a build.
const PHASES: { key: string; label: string; categories: string[] }[] = [
  { key: "pre", label: "Pre-construction", categories: ["land", "permits", "design", "inspection"] },
  { key: "structure", label: "Structure", categories: ["foundation", "framing", "roofing", "windows_doors", "insulation"] },
  { key: "mechanical", label: "Mechanical", categories: ["electrical", "plumbing", "hvac"] },
  { key: "finish", label: "Finish", categories: ["drywall", "flooring", "cabinets", "appliances", "paint", "landscaping"] },
  { key: "general", label: "General", categories: ["materials", "labor", "other"] },
];

function categoryLabel(cat: string) {
  return cat.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

const QUICK_FILTER_CATS = ["materials", "labor", "permits", "framing", "electrical", "plumbing"];

export default function ConstructionExpensesPanel({
  projectId,
  expenses,
  receiptCounts,
}: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [groupByPhase, setGroupByPhase] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const vendorSuggestions = useMemo(() => {
    const set = new Set<string>();
    expenses.forEach((e) => {
      if (e.vendor) set.add(e.vendor);
    });
    return Array.from(set).sort();
  }, [expenses]);

  const filtered = useMemo(() => {
    let list = expenses.slice();
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) =>
          e.description.toLowerCase().includes(q) ||
          (e.vendor || "").toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q)
      );
    }
    if (category !== "all") {
      list = list.filter((e) => e.category === category);
    }
    list.sort(
      (a, b) => parseDbDate(b.expense_date).getTime() - parseDbDate(a.expense_date).getTime()
    );
    return list;
  }, [expenses, search, category]);

  const filteredTotal = filtered.reduce((s, e) => s + Number(e.amount), 0);

  function openAdd() {
    setEditing(null);
    setDrawerOpen(true);
  }

  function openEdit(e: Expense) {
    setEditing(e);
    setDrawerOpen(true);
  }

  async function performDelete() {
    if (!deleteId) return;
    const { error } = await supabase
      .from("construction_expenses")
      .delete()
      .eq("id", deleteId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Expense deleted");
    setDeleteId(null);
    router.refresh();
  }

  return (
    <>
      <div className="bg-white border border-stone-200 rounded-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-stone-100">
          <div>
            <h2 className="font-medium">Build expenses</h2>
            <p className="text-xs text-stone-500 mt-0.5">
              {expenses.length} entries · ${filteredTotal.toLocaleString()} shown
            </p>
          </div>
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-teal-700 text-white rounded-md hover:bg-teal-800"
          >
            <Plus className="w-4 h-4" />
            Log expense
          </button>
        </div>

        {expenses.length > 0 && (
          <div className="p-4 border-b border-stone-100 space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search description, vendor, or category..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-stone-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <FilterChip
                label="All"
                active={category === "all"}
                onClick={() => setCategory("all")}
              />
              {QUICK_FILTER_CATS.map((c) => (
                <FilterChip
                  key={c}
                  label={categoryLabel(c)}
                  active={category === c}
                  onClick={() => setCategory(c)}
                />
              ))}
              <select
                value={QUICK_FILTER_CATS.includes(category) || category === "all" ? "" : category}
                onChange={(e) => e.target.value && setCategory(e.target.value)}
                className="text-xs border border-stone-200 rounded-full px-2.5 py-1 bg-white text-stone-700 focus:outline-none focus:ring-2 focus:ring-teal-600"
              >
                <option value="">More categories...</option>
                {CONSTRUCTION_CATEGORIES.filter((c) => !QUICK_FILTER_CATS.includes(c)).map((c) => (
                  <option key={c} value={c}>
                    {categoryLabel(c)}
                  </option>
                ))}
              </select>
              <label className="ml-auto inline-flex items-center gap-1.5 text-xs text-stone-600 select-none">
                <input
                  type="checkbox"
                  checked={groupByPhase}
                  onChange={(e) => setGroupByPhase(e.target.checked)}
                  className="rounded border-stone-300"
                />
                Group by phase
              </label>
            </div>
          </div>
        )}

        {expenses.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-stone-600 mb-3">
              No expenses logged yet. Track lumber, labor, permits, subcontractors — anything that
              costs money on this build.
            </p>
            <button
              type="button"
              onClick={openAdd}
              className="inline-flex items-center gap-1 px-4 py-2 text-sm bg-teal-700 text-white rounded-md hover:bg-teal-800"
            >
              <Plus className="w-4 h-4" />
              Log your first expense
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-stone-500">
            No expenses match the current filter.
          </div>
        ) : groupByPhase ? (
          <PhaseGroupedView
            expenses={filtered}
            receiptCounts={receiptCounts}
            onEdit={openEdit}
            onDelete={(id) => setDeleteId(id)}
          />
        ) : (
          <ExpensesTable
            expenses={filtered}
            receiptCounts={receiptCounts}
            total={filteredTotal}
            onEdit={openEdit}
            onDelete={(id) => setDeleteId(id)}
          />
        )}
      </div>

      <ConstructionExpenseForm
        projectId={projectId}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setEditing(null);
        }}
        mode={editing ? "edit" : "create"}
        initial={
          editing
            ? {
                id: editing.id,
                expense_date: editing.expense_date,
                amount: Number(editing.amount),
                category: editing.category,
                description: editing.description,
                vendor: editing.vendor || "",
                notes: editing.notes || "",
              }
            : undefined
        }
        vendorSuggestions={vendorSuggestions}
      />

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={performDelete}
        title="Delete this expense?"
        message="This will permanently remove the expense from the project."
        confirmLabel="Delete"
        variant="danger"
      />
    </>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
        active
          ? "bg-teal-700 text-white border-teal-700"
          : "bg-white border-stone-200 text-stone-700 hover:border-teal-400 hover:bg-stone-50"
      }`}
    >
      {label}
    </button>
  );
}

function ExpensesTable({
  expenses,
  receiptCounts,
  total,
  onEdit,
  onDelete,
}: {
  expenses: Expense[];
  receiptCounts: Record<string, number>;
  total: number;
  onEdit: (e: Expense) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <>
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-stone-600">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Date</th>
              <th className="text-left px-4 py-2 font-medium">Category</th>
              <th className="text-left px-4 py-2 font-medium">Description</th>
              <th className="text-left px-4 py-2 font-medium">Vendor</th>
              <th className="text-right px-4 py-2 font-medium">Amount</th>
              <th className="text-right px-4 py-2 font-medium w-24"></th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id} className="border-t border-stone-100 hover:bg-stone-50">
                <td className="px-4 py-2.5 text-stone-600 whitespace-nowrap">
                  {format(parseDbDate(e.expense_date), "MMM d, yyyy")}
                </td>
                <td className="px-4 py-2.5">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-stone-100 text-stone-700">
                    {categoryLabel(e.category)}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <span>{e.description}</span>
                    {receiptCounts[e.id] > 0 && (
                      <FileText
                        className="w-3.5 h-3.5 text-stone-400"
                        aria-label={`${receiptCounts[e.id]} receipt${receiptCounts[e.id] === 1 ? "" : "s"}`}
                      />
                    )}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-stone-600">{e.vendor || "—"}</td>
                <td className="px-4 py-2.5 text-right font-medium">
                  ${Number(e.amount).toLocaleString()}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onEdit(e)}
                      className="text-stone-400 hover:text-teal-700"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(e.id)}
                      className="text-stone-400 hover:text-red-600"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            <tr className="border-t border-stone-200 bg-stone-50 font-medium">
              <td className="px-4 py-2 text-stone-600" colSpan={4}>
                Filtered total
              </td>
              <td className="px-4 py-2 text-right">${total.toLocaleString()}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      <div className="md:hidden p-3 space-y-2">
        {expenses.map((e) => (
          <div key={e.id} className="border border-stone-200 rounded-lg p-3">
            <div className="flex justify-between items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{e.description}</div>
                <div className="text-xs text-stone-500 mt-0.5">
                  {format(parseDbDate(e.expense_date), "MMM d, yyyy")} ·{" "}
                  {categoryLabel(e.category)}
                  {e.vendor ? ` · ${e.vendor}` : ""}
                </div>
              </div>
              <div className="text-right whitespace-nowrap">
                <div className="font-medium">${Number(e.amount).toLocaleString()}</div>
                <div className="flex gap-3 mt-2 justify-end">
                  <button
                    type="button"
                    onClick={() => onEdit(e)}
                    className="text-xs text-teal-700"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(e.id)}
                    className="text-xs text-red-600"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
        <div className="bg-stone-50 rounded-lg px-3 py-2 text-sm flex justify-between font-medium">
          <span>Filtered total</span>
          <span>${total.toLocaleString()}</span>
        </div>
      </div>
    </>
  );
}

function PhaseGroupedView({
  expenses,
  receiptCounts,
  onEdit,
  onDelete,
}: {
  expenses: Expense[];
  receiptCounts: Record<string, number>;
  onEdit: (e: Expense) => void;
  onDelete: (id: string) => void;
}) {
  const grouped = PHASES.map((phase) => {
    const items = expenses.filter((e) => phase.categories.includes(e.category));
    const subtotal = items.reduce((s, e) => s + Number(e.amount), 0);
    return { phase, items, subtotal };
  }).filter((g) => g.items.length > 0);

  return (
    <div className="divide-y divide-stone-100">
      {grouped.map(({ phase, items, subtotal }) => (
        <div key={phase.key} className="p-3 sm:p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-stone-800">{phase.label}</h3>
            <div className="text-xs text-stone-500">
              {items.length} {items.length === 1 ? "entry" : "entries"} ·{" "}
              <span className="font-medium text-stone-700">${subtotal.toLocaleString()}</span>
            </div>
          </div>
          <ul className="text-sm divide-y divide-stone-100 border border-stone-100 rounded-lg overflow-hidden">
            {items.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 px-3 py-2 bg-white hover:bg-stone-50">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-medium truncate">{e.description}</span>
                    {receiptCounts[e.id] > 0 && (
                      <FileText className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                    )}
                  </div>
                  <div className="text-xs text-stone-500">
                    {format(parseDbDate(e.expense_date), "MMM d, yyyy")} ·{" "}
                    {categoryLabel(e.category)}
                    {e.vendor ? ` · ${e.vendor}` : ""}
                  </div>
                </div>
                <div className="text-right whitespace-nowrap flex items-center gap-2">
                  <span className="font-medium">${Number(e.amount).toLocaleString()}</span>
                  <button
                    type="button"
                    onClick={() => onEdit(e)}
                    className="text-stone-400 hover:text-teal-700"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(e.id)}
                    className="text-stone-400 hover:text-red-600"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
