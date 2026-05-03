"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Home, Building2, Users, DollarSign, Receipt, Wrench, FileText, LogOut } from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/properties", label: "Properties", icon: Building2 },
  { href: "/tenants", label: "Tenants", icon: Users },
  { href: "/payments", label: "Payments", icon: DollarSign },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/maintenance", label: "Maintenance", icon: Wrench },
  { href: "/reports", label: "Reports", icon: FileText },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <aside className="w-56 bg-white border-r border-stone-200 min-h-screen flex flex-col">
      <div className="p-4 border-b border-stone-200">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-teal-700" />
          <span className="font-medium">Rental Manager</span>
        </div>
      </div>

      <nav className="flex-1 p-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm mb-1 ${
                active ? "bg-stone-100 text-stone-900" : "text-stone-600 hover:bg-stone-50"
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={handleLogout}
        className="m-2 flex items-center gap-2 px-3 py-2 rounded-md text-sm text-stone-600 hover:bg-stone-50"
      >
        <LogOut className="w-4 h-4" />
        Sign out
      </button>
    </aside>
  );
}
