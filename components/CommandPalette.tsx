"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Home,
  Building2,
  Users,
  DollarSign,
  Receipt,
  Wrench,
  FileText,
  Wallet,
  Repeat,
  Car,
  FolderOpen,
  Plus,
  Search,
} from "lucide-react";

type Command = {
  id: string;
  label: string;
  hint?: string;
  href: string;
  icon: any;
  group: "navigate" | "create";
};

const commands: Command[] = [
  { id: "nav-dash", label: "Dashboard", href: "/dashboard", icon: Home, group: "navigate" },
  { id: "nav-prop", label: "Properties", href: "/properties", icon: Building2, group: "navigate" },
  { id: "nav-ten", label: "Tenants", href: "/tenants", icon: Users, group: "navigate" },
  { id: "nav-pay", label: "Payments", href: "/payments", icon: DollarSign, group: "navigate" },
  { id: "nav-exp", label: "Expenses", href: "/expenses", icon: Receipt, group: "navigate" },
  { id: "nav-rec", label: "Recurring", href: "/recurring", icon: Repeat, group: "navigate" },
  { id: "nav-mil", label: "Mileage", href: "/mileage", icon: Car, group: "navigate" },
  { id: "nav-mnt", label: "Maintenance", href: "/maintenance", icon: Wrench, group: "navigate" },
  { id: "nav-dst", label: "Profit taken out", href: "/distributions", icon: Wallet, group: "navigate" },
  { id: "nav-doc", label: "Documents", href: "/documents", icon: FolderOpen, group: "navigate" },
  { id: "nav-rep", label: "Reports", href: "/reports", icon: FileText, group: "navigate" },
  { id: "new-prop", label: "Add property", hint: "Create new", href: "/properties/new", icon: Plus, group: "create" },
  { id: "new-ten", label: "Add tenant", hint: "Create new", href: "/tenants/new", icon: Plus, group: "create" },
  { id: "new-pay", label: "Record payment", hint: "Create new", href: "/payments/new", icon: Plus, group: "create" },
  { id: "new-exp", label: "Add expense", hint: "Create new", href: "/expenses/new", icon: Plus, group: "create" },
  { id: "new-mnt", label: "New maintenance", hint: "Create new", href: "/maintenance/new", icon: Plus, group: "create" },
  { id: "new-mil", label: "Log mileage", hint: "Create new", href: "/mileage/new", icon: Plus, group: "create" },
  { id: "new-rec", label: "New recurring expense", hint: "Create new", href: "/recurring/new", icon: Plus, group: "create" },
  { id: "new-dst", label: "Record profit taken out", hint: "Create new", href: "/distributions/new", icon: Plus, group: "create" },
];

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMac = /mac/i.test(navigator.platform);
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setHighlighted(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  const filtered = commands.filter((c) =>
    c.label.toLowerCase().includes(query.toLowerCase())
  );
  const groups: Record<string, Command[]> = { navigate: [], create: [] };
  filtered.forEach((c) => groups[c.group].push(c));

  function run(cmd: Command) {
    router.push(cmd.href);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[highlighted]) run(filtered[highlighted]);
    }
  }

  let runningIdx = 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-3 border-b border-stone-200">
          <Search className="w-4 h-4 text-stone-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlighted(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search or type a command..."
            className="flex-1 py-3 text-sm bg-transparent outline-none"
          />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded border border-stone-200 text-stone-500 bg-stone-50">
            esc
          </kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-stone-500">
              No matches for "{query}"
            </div>
          ) : (
            <>
              {(["navigate", "create"] as const).map((group) =>
                groups[group].length > 0 ? (
                  <div key={group} className="mb-2">
                    <div className="text-[10px] uppercase tracking-wider text-stone-400 px-2 py-1">
                      {group === "navigate" ? "Go to" : "Create"}
                    </div>
                    {groups[group].map((c) => {
                      const idx = runningIdx++;
                      const Icon = c.icon;
                      return (
                        <button
                          key={c.id}
                          onClick={() => run(c)}
                          onMouseEnter={() => setHighlighted(idx)}
                          className={`w-full flex items-center gap-2 px-2 py-2 rounded text-sm text-left ${
                            idx === highlighted
                              ? "bg-teal-50 text-teal-900"
                              : "text-stone-700"
                          }`}
                        >
                          <Icon className="w-4 h-4 text-stone-400" />
                          <span className="flex-1">{c.label}</span>
                          {c.hint && <span className="text-xs text-stone-400">{c.hint}</span>}
                        </button>
                      );
                    })}
                  </div>
                ) : null
              )}
            </>
          )}
        </div>
        <div className="px-3 py-2 border-t border-stone-200 flex items-center gap-3 text-[11px] text-stone-500">
          <span>
            <kbd className="px-1 border border-stone-200 rounded">↑↓</kbd> navigate
          </span>
          <span>
            <kbd className="px-1 border border-stone-200 rounded">↵</kbd> open
          </span>
          <span className="ml-auto">
            <kbd className="px-1 border border-stone-200 rounded">⌘</kbd>
            <kbd className="px-1 border border-stone-200 rounded">K</kbd>
          </span>
        </div>
      </div>
    </div>
  );
}
