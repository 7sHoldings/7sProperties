"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Search, Building2 } from "lucide-react";
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

const STATUS_RANK: Record<string, number> = {
  in_progress: 0,
  planning: 1,
  on_hold: 2,
  completed: 3,
};

const STATUS_ORDER = ["in_progress", "planning", "on_hold", "completed"] as const;

const TYPE_OPTIONS = [
  { value: "all", label: "All types" },
  { value: "single_family", label: "Single family" },
  { value: "duplex", label: "Duplex" },
  { value: "triplex", label: "Triplex" },
  { value: "fourplex", label: "Fourplex" },
  { value: "condo", label: "Condo" },
  { value: "apartment", label: "Apartment" },
  { value: "townhouse", label: "Townhouse" },
  { value: "other", label: "Other" },
];

const SORT_OPTIONS = [
  { value: "recent", label: "Recently updated" },
  { value: "created_desc", label: "Newest first" },
  { value: "created_asc", label: "Oldest first" },
  { value: "name_asc", label: "Name (A–Z)" },
  { value: "spent_desc", label: "Most spent" },
  { value: "budget_desc", label: "Largest budget" },
  { value: "target", label: "Target date (soonest)" },
];

type Project = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  status: string;
  property_type: string | null;
  budget: number | string | null;
  expected_completion_date: string | null;
  created_at: string;
  updated_at: string | null;
  cover_url?: string | null;
  construction_expenses?: { amount: number | string }[];
};

type Props = { projects: Project[] };

export default function ConstructionProjectsList({ projects }: Props) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [type, setType] = useState<string>("all");
  const [budgetFilter, setBudgetFilter] = useState<string>("all");
  const [sort, setSort] = useState<string>("recent");

  const filtered = useMemo(() => {
    let list = projects.slice();
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.address || "").toLowerCase().includes(q) ||
          (p.city || "").toLowerCase().includes(q) ||
          (p.state || "").toLowerCase().includes(q)
      );
    }
    if (status !== "all") list = list.filter((p) => p.status === status);
    if (type !== "all") list = list.filter((p) => p.property_type === type);
    if (budgetFilter !== "all") {
      list = list.filter((p) => {
        const budget = Number(p.budget) || 0;
        const spent = (p.construction_expenses || []).reduce(
          (s, e) => s + Number(e.amount),
          0
        );
        if (budgetFilter === "has_budget") return budget > 0;
        if (budgetFilter === "no_budget") return budget <= 0;
        if (budgetFilter === "over") return budget > 0 && spent > budget;
        if (budgetFilter === "near") {
          if (budget <= 0) return false;
          const pct = spent / budget;
          return pct >= 0.8 && pct <= 1;
        }
        return true;
      });
    }

    list.sort((a, b) => {
      switch (sort) {
        case "created_desc":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "created_asc":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "name_asc":
          return a.name.localeCompare(b.name);
        case "spent_desc": {
          const aSpent = (a.construction_expenses || []).reduce(
            (s, e) => s + Number(e.amount),
            0
          );
          const bSpent = (b.construction_expenses || []).reduce(
            (s, e) => s + Number(e.amount),
            0
          );
          return bSpent - aSpent;
        }
        case "budget_desc":
          return (Number(b.budget) || 0) - (Number(a.budget) || 0);
        case "target": {
          const aT = a.expected_completion_date
            ? parseDbDate(a.expected_completion_date).getTime()
            : Number.POSITIVE_INFINITY;
          const bT = b.expected_completion_date
            ? parseDbDate(b.expected_completion_date).getTime()
            : Number.POSITIVE_INFINITY;
          return aT - bT;
        }
        case "recent":
        default: {
          const rankDiff =
            (STATUS_RANK[a.status] ?? 99) - (STATUS_RANK[b.status] ?? 99);
          if (rankDiff !== 0) return rankDiff;
          const aTime = new Date(a.updated_at || a.created_at).getTime();
          const bTime = new Date(b.updated_at || b.created_at).getTime();
          return bTime - aTime;
        }
      }
    });
    return list;
  }, [projects, search, status, type, budgetFilter, sort]);

  const grouped = status === "all" && sort === "recent";

  function resetFilters() {
    setSearch("");
    setStatus("all");
    setType("all");
    setBudgetFilter("all");
    setSort("recent");
  }

  const hasActiveFilters =
    search !== "" ||
    status !== "all" ||
    type !== "all" ||
    budgetFilter !== "all" ||
    sort !== "recent";

  return (
    <div>
      <div className="bg-white border border-stone-200 rounded-xl p-3 mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or address..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-stone-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="text-sm border border-stone-200 rounded-md px-2 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-teal-600"
            aria-label="Property type"
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            value={budgetFilter}
            onChange={(e) => setBudgetFilter(e.target.value)}
            className="text-sm border border-stone-200 rounded-md px-2 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-teal-600"
            aria-label="Budget filter"
          >
            <option value="all">Any budget</option>
            <option value="has_budget">Has budget</option>
            <option value="no_budget">No budget set</option>
            <option value="near">Near limit (80%+)</option>
            <option value="over">Over budget</option>
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="text-sm border border-stone-200 rounded-md px-2 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-teal-600"
            aria-label="Sort"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                Sort: {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusChip
            label="All statuses"
            count={projects.length}
            active={status === "all"}
            onClick={() => setStatus("all")}
          />
          {STATUS_ORDER.map((s) => {
            const count = projects.filter((p) => p.status === s).length;
            if (count === 0) return null;
            return (
              <StatusChip
                key={s}
                label={STATUS_LABEL[s]}
                count={count}
                active={status === s}
                onClick={() => setStatus(s)}
              />
            );
          })}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="ml-auto text-xs text-stone-500 hover:text-stone-900 underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-xl p-8 text-center text-sm text-stone-500">
          No projects match the current filters.
        </div>
      ) : grouped ? (
        <div className="space-y-6">
          {STATUS_ORDER.map((s) => {
            const items = filtered.filter((p) => p.status === s);
            if (items.length === 0) return null;
            return (
              <section key={s}>
                <div className="flex items-baseline justify-between mb-2">
                  <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wider">
                    {STATUS_LABEL[s]}
                  </h2>
                  <span className="text-xs text-stone-500">
                    {items.length} {items.length === 1 ? "project" : "projects"}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {items.map((p) => (
                    <ProjectCard key={p.id} project={p} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatusChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 text-xs rounded-full border transition-colors inline-flex items-center gap-1.5 ${
        active
          ? "bg-teal-700 text-white border-teal-700"
          : "bg-white border-stone-200 text-stone-700 hover:border-teal-400 hover:bg-stone-50"
      }`}
    >
      {label}
      <span
        className={`text-[10px] px-1.5 rounded-full ${
          active ? "bg-teal-800 text-white" : "bg-stone-100 text-stone-600"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function ProjectCard({ project: p }: { project: Project }) {
  const spent = (p.construction_expenses || []).reduce(
    (s, e) => s + Number(e.amount),
    0
  );
  const budget = Number(p.budget) || 0;
  const pct = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
  return (
    <div className="bg-white border border-stone-200 rounded-xl overflow-hidden hover:border-stone-300 flex flex-col">
      <Link href={`/construction/${p.id}`} className="block flex-1">
        <div className="relative aspect-[16/9] bg-gradient-to-br from-stone-100 via-teal-50 to-stone-200">
          {p.cover_url ? (
            <img
              src={p.cover_url}
              alt={p.name}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-stone-400">
              <Building2 className="w-10 h-10" />
            </div>
          )}
          <span
            className={`absolute top-2 right-2 text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap shadow-sm ${
              STATUS_COLOR[p.status] || "bg-stone-100"
            }`}
          >
            {STATUS_LABEL[p.status] || p.status}
          </span>
        </div>
        <div className="p-4">
          <h3 className="font-medium truncate">{p.name}</h3>
          {p.address && (
            <p className="text-xs text-stone-500 mt-0.5 mb-3 truncate">{p.address}</p>
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
        </div>
      </Link>
      <div className="px-4 pb-3 pt-3 border-t border-stone-100 flex items-center justify-between">
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
}
