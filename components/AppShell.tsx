"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Home,
  Building2,
  Users,
  DollarSign,
  Receipt,
  Wrench,
  FileText,
  LogOut,
  Menu,
  X,
  Bell,
  ChevronDown,
  Wallet,
  Repeat,
  Car,
  FolderOpen,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/properties", label: "Properties", icon: Building2 },
  { href: "/tenants", label: "Tenants", icon: Users },
  { href: "/payments", label: "Payments", icon: DollarSign },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/recurring", label: "Recurring", icon: Repeat },
  { href: "/mileage", label: "Mileage", icon: Car },
  { href: "/maintenance", label: "Maintenance", icon: Wrench },
  { href: "/distributions", label: "Profit taken out", icon: Wallet },
  { href: "/documents", label: "Documents", icon: FolderOpen },
  { href: "/reports", label: "Reports", icon: FileText },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname.startsWith(href);
}

function Logo({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`${size === "md" ? "w-8 h-8" : "w-7 h-7"} rounded-md bg-teal-700 text-white flex items-center justify-center font-bold tracking-tight`}
      >
        7s
      </div>
      <div className="leading-tight">
        <div className={`${size === "md" ? "text-base" : "text-sm"} font-semibold text-stone-900`}>
          7s Rental
        </div>
        <div className="text-[10px] uppercase tracking-wider text-stone-500">Property manager</div>
      </div>
    </div>
  );
}

export default function AppShell({ userEmail, children }: { userEmail: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  // Close user menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e: MouseEvent) {
      const t = e.target as HTMLElement;
      if (!t.closest?.("[data-user-menu]")) setMenuOpen(false);
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [menuOpen]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="min-h-screen flex flex-col bg-stone-50">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-stone-200">
        <div className="flex items-center h-14 px-3 sm:px-4 gap-3">
          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen(true)}
            className="md:hidden p-2 -ml-2 text-stone-700 hover:bg-stone-100 rounded-md"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <Link href="/dashboard" className="flex-shrink-0">
            <Logo />
          </Link>

          <div className="flex-1" />

          <button
            className="hidden sm:inline-flex p-2 text-stone-600 hover:bg-stone-100 rounded-md"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
          </button>

          {/* User menu */}
          <div className="relative" data-user-menu>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-stone-100"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <div className="w-7 h-7 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center text-xs font-semibold">
                {(userEmail || "?").charAt(0).toUpperCase()}
              </div>
              <span className="hidden sm:inline text-sm text-stone-700 max-w-[160px] truncate">
                {userEmail}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-stone-500" />
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-1 w-56 bg-white border border-stone-200 rounded-md shadow-lg py-1 text-sm"
              >
                <div className="px-3 py-2 border-b border-stone-100">
                  <div className="text-xs text-stone-500">Signed in as</div>
                  <div className="text-sm text-stone-800 truncate">{userEmail}</div>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-3 py-2 hover:bg-stone-50 text-stone-700 flex items-center gap-2"
                  role="menuitem"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar (desktop) */}
        <aside className="hidden md:block w-56 bg-white border-r border-stone-200 flex-shrink-0 sticky top-14 self-start h-[calc(100vh-3.5rem)] overflow-y-auto">
          <NavList pathname={pathname} />
        </aside>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="md:hidden fixed inset-0 z-40 flex">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setMobileOpen(false)}
              aria-hidden="true"
            />
            <aside className="relative w-64 max-w-[80%] bg-white shadow-xl flex flex-col">
              <div className="flex items-center justify-between p-3 border-b border-stone-200">
                <Logo size="sm" />
                <button
                  onClick={() => setMobileOpen(false)}
                  className="p-1.5 text-stone-600 hover:bg-stone-100 rounded-md"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <NavList pathname={pathname} />
            </aside>
          </div>
        )}

        {/* Main */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}

function NavList({ pathname }: { pathname: string }) {
  return (
    <nav className="p-2">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm mb-1 transition-colors ${
              active
                ? "bg-teal-50 text-teal-800 font-medium"
                : "text-stone-600 hover:bg-stone-50 hover:text-stone-900"
            }`}
          >
            <Icon className={`w-4 h-4 ${active ? "text-teal-700" : "text-stone-500"}`} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
