"use client";

import { Search, ChevronDown } from "lucide-react";
import { ReactNode } from "react";

type SelectOpt = { value: string; label: string };

type Props = {
  search: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder?: string;
  filters?: { id: string; value: string; onChange: (v: string) => void; options: SelectOpt[]; label: string }[];
  sort?: { value: string; onChange: (v: string) => void; options: SelectOpt[] };
  rightSlot?: ReactNode;
  resultCount?: number;
  totalCount?: number;
};

export default function ListControls({
  search,
  onSearchChange,
  searchPlaceholder = "Search...",
  filters,
  sort,
  rightSlot,
  resultCount,
  totalCount,
}: Props) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-3 mb-3 flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full pl-8 pr-3 py-1.5 text-sm border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-600"
        />
      </div>

      {filters?.map((f) => (
        <SelectChip key={f.id} label={f.label} value={f.value} onChange={f.onChange} options={f.options} />
      ))}

      {sort && (
        <SelectChip label="Sort" value={sort.value} onChange={sort.onChange} options={sort.options} />
      )}

      {rightSlot}

      {typeof resultCount === "number" && typeof totalCount === "number" && resultCount !== totalCount && (
        <span className="text-xs text-stone-500 ml-auto">
          {resultCount} of {totalCount}
        </span>
      )}
    </div>
  );
}

function SelectChip({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: SelectOpt[];
}) {
  return (
    <div className="relative">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none pl-3 pr-8 py-1.5 text-sm border border-stone-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-teal-600"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {label}: {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
    </div>
  );
}
