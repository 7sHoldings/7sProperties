import { format, formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { DollarSign, Receipt, Wrench, Users, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { parseDbDate } from "@/lib/dates";

type Activity = {
  id: string;
  type: "payment" | "expense" | "maintenance" | "tenant" | "distribution";
  date: string;
  title: string;
  subtitle?: string;
  href: string;
  amount?: number;
};

const ICONS = {
  payment: DollarSign,
  expense: Receipt,
  maintenance: Wrench,
  tenant: Users,
  distribution: Wallet,
};

const TONES: Record<string, string> = {
  payment: "bg-green-100 text-green-700",
  expense: "bg-red-100 text-red-700",
  maintenance: "bg-amber-100 text-amber-700",
  tenant: "bg-blue-100 text-blue-700",
  distribution: "bg-purple-100 text-purple-700",
};

export default async function ActivityFeed() {
  const supabase = await createClient();

  const [paymentsRes, expensesRes, maintRes, tenantsRes, distRes] = await Promise.all([
    supabase
      .from("payments")
      .select("id, amount, payment_date, created_at, leases(tenants(full_name))")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("expenses")
      .select("id, amount, description, created_at, properties(name)")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("maintenance_requests")
      .select("id, title, status, created_at, submitted_by_tenant, properties(name)")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("tenants")
      .select("id, full_name, created_at")
      .order("created_at", { ascending: false })
      .limit(3),
    supabase
      .from("distributions")
      .select("id, amount, destination, created_at")
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  const activities: Activity[] = [];

  (paymentsRes.data || []).forEach((p: any) => {
    activities.push({
      id: `pay-${p.id}`,
      type: "payment",
      date: p.created_at,
      title: `Payment from ${p.leases?.tenants?.full_name || "tenant"}`,
      subtitle: format(parseDbDate(p.payment_date), "MMM d, yyyy"),
      href: `/payments/${p.id}/edit`,
      amount: Number(p.amount),
    });
  });

  (expensesRes.data || []).forEach((e: any) => {
    activities.push({
      id: `exp-${e.id}`,
      type: "expense",
      date: e.created_at,
      title: e.description,
      subtitle: e.properties?.name,
      href: `/expenses/${e.id}/edit`,
      amount: -Number(e.amount),
    });
  });

  (maintRes.data || []).forEach((m: any) => {
    activities.push({
      id: `mnt-${m.id}`,
      type: "maintenance",
      date: m.created_at,
      title: `${m.submitted_by_tenant ? "Tenant submitted" : "Maintenance"}: ${m.title}`,
      subtitle: `${m.properties?.name || ""} · ${m.status.replace("_", " ")}`,
      href: `/maintenance/${m.id}/edit`,
    });
  });

  (tenantsRes.data || []).forEach((t: any) => {
    activities.push({
      id: `ten-${t.id}`,
      type: "tenant",
      date: t.created_at,
      title: `New tenant: ${t.full_name}`,
      href: `/tenants/${t.id}`,
    });
  });

  (distRes.data || []).forEach((d: any) => {
    activities.push({
      id: `dst-${d.id}`,
      type: "distribution",
      date: d.created_at,
      title: `Distribution to ${d.destination}`,
      href: `/distributions/${d.id}/edit`,
      amount: -Number(d.amount),
    });
  });

  activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const top = activities.slice(0, 8);

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-medium">Recent activity</h2>
        <span className="text-xs text-stone-500">{top.length} updates</span>
      </div>
      {top.length === 0 ? (
        <p className="text-sm text-stone-500 py-4">No activity yet.</p>
      ) : (
        <ul className="space-y-2">
          {top.map((a) => {
            const Icon = ICONS[a.type];
            return (
              <li key={a.id}>
                <Link
                  href={a.href}
                  className="flex items-start gap-3 p-2 -mx-2 rounded-md hover:bg-stone-50 transition"
                >
                  <span className={`rounded-md p-1.5 flex-shrink-0 ${TONES[a.type]}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-stone-900 truncate">{a.title}</div>
                    {a.subtitle && (
                      <div className="text-xs text-stone-500 truncate">{a.subtitle}</div>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    {a.amount !== undefined && (
                      <div
                        className={`text-sm font-medium ${
                          a.amount > 0 ? "text-green-700" : "text-red-700"
                        }`}
                      >
                        {a.amount > 0 ? "+" : ""}${Math.abs(a.amount).toLocaleString()}
                      </div>
                    )}
                    <div className="text-xs text-stone-400">
                      {formatDistanceToNow(new Date(a.date), { addSuffix: true })}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
