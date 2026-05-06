import Link from "next/link";
import { format } from "date-fns";
import { Wrench } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import { parseDbDate } from "@/lib/dates";

const priorityTone: Record<string, "red" | "amber" | "stone"> = {
  urgent: "red",
  high: "amber",
  medium: "stone",
  low: "stone",
};
const statusTone: Record<string, "red" | "amber" | "green" | "stone"> = {
  open: "red",
  in_progress: "amber",
  completed: "green",
  cancelled: "stone",
};

export default async function TenantMaintenancePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("auth_user_id", user!.id)
    .maybeSingle();

  if (!tenant) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <p className="text-stone-500">No tenant record linked to your account.</p>
      </div>
    );
  }

  const { data: requests } = await supabase
    .from("maintenance_requests")
    .select("id, title, description, status, priority, reported_date, completed_date, properties(name)")
    .order("reported_date", { ascending: false });

  const list = (requests || []) as any[];

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-medium">Maintenance</h1>
          <p className="text-sm text-stone-500">{list.length} request{list.length === 1 ? "" : "s"}</p>
        </div>
        <Link
          href="/tenant/maintenance/new"
          className="px-3 py-1.5 text-sm bg-teal-700 text-white rounded-md hover:bg-teal-800"
        >
          + Submit request
        </Link>
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={<Wrench className="w-6 h-6" />}
          title="No maintenance requests yet"
          description="Need something fixed? Submit a request and your property owner will get notified."
          actionLabel="+ Submit request"
          actionHref="/tenant/maintenance/new"
        />
      ) : (
        <div className="space-y-2">
          {list.map((r: any) => (
            <div key={r.id} className="bg-white border border-stone-200 rounded-xl p-4">
              <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
                <h3 className="font-medium">{r.title}</h3>
                <div className="flex gap-1.5">
                  <StatusBadge tone={priorityTone[r.priority] || "stone"}>
                    {r.priority}
                  </StatusBadge>
                  <StatusBadge tone={statusTone[r.status] || "stone"}>
                    {r.status.replace("_", " ")}
                  </StatusBadge>
                </div>
              </div>
              {r.description && (
                <p className="text-sm text-stone-600 mb-2">{r.description}</p>
              )}
              <div className="text-xs text-stone-500">
                Submitted {format(parseDbDate(r.reported_date), "MMM d, yyyy")}
                {r.completed_date && ` · Completed ${format(parseDbDate(r.completed_date), "MMM d, yyyy")}`}
                {r.properties?.name && ` · ${r.properties.name}`}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
