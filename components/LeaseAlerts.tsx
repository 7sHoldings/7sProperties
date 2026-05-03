import Link from "next/link";
import { differenceInCalendarDays, format } from "date-fns";
import { AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export default async function LeaseAlerts() {
  const supabase = await createClient();
  const today = new Date();
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 90);

  const { data } = await supabase
    .from("leases")
    .select("id, end_date, tenants(full_name), units(unit_label, properties(id, name))")
    .eq("status", "active")
    .lte("end_date", format(horizon, "yyyy-MM-dd"))
    .order("end_date", { ascending: true });

  const leases = (data || []) as any[];
  if (leases.length === 0) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="w-4 h-4 text-amber-700" />
        <h3 className="font-medium text-amber-900">
          Lease{leases.length > 1 ? "s" : ""} expiring soon
        </h3>
      </div>
      <ul className="text-sm space-y-1">
        {leases.map((l) => {
          const days = differenceInCalendarDays(new Date(l.end_date), today);
          const tone = days < 0 ? "text-red-700" : days <= 30 ? "text-red-700" : days <= 60 ? "text-amber-800" : "text-stone-700";
          const propertyId = l.units?.properties?.id;
          return (
            <li key={l.id} className="flex justify-between">
              <span>
                {l.tenants?.full_name} · {l.units?.properties?.name}
                {l.units?.unit_label && l.units.unit_label !== "Main" ? ` (${l.units.unit_label})` : ""}
              </span>
              <span className={tone}>
                {days < 0
                  ? `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`
                  : days === 0
                    ? "Expires today"
                    : `${days} day${days === 1 ? "" : "s"} left`}
                {propertyId && (
                  <Link href={`/properties/${propertyId}`} className="ml-2 text-teal-700 hover:underline">
                    View
                  </Link>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
