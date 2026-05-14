"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Building2, DollarSign, Wrench, FolderOpen } from "lucide-react";

const items = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/properties", label: "Rentals", icon: Building2 },
  { href: "/payments", label: "Payments", icon: DollarSign },
  { href: "/maintenance", label: "Repairs", icon: Wrench },
  { href: "/documents", label: "Files", icon: FolderOpen },
];

export default function MobileBottomNav() {
  const pathname = usePathname();
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-stone-200">
      <div className="grid grid-cols-5">
        {items.map((it) => {
          const Icon = it.icon;
          const active =
            it.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] ${
                active ? "text-teal-700" : "text-stone-500"
              }`}
            >
              <Icon className={`w-5 h-5 ${active ? "text-teal-700" : "text-stone-400"}`} />
              {it.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
