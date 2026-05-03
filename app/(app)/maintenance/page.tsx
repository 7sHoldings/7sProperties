import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import MaintenanceList from "@/components/lists/MaintenanceList";

export default async function MaintenancePage() {
  const supabase = await createClient();
  const [reqRes, propsRes] = await Promise.all([
    supabase
      .from("maintenance_requests")
      .select("*, properties(name)")
      .order("reported_date", { ascending: false }),
    supabase.from("properties").select("id, name").order("name"),
  ]);

  const requests = reqRes.data || [];
  const properties = (propsRes.data || []) as any[];

  const open = requests.filter((r: any) => r.status === "open").length;
  const inProgress = requests.filter((r: any) => r.status === "in_progress").length;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-medium">Maintenance</h1>
          <p className="text-sm text-stone-500">
            {open} open · {inProgress} in progress · {requests.length} total
          </p>
        </div>
        <Link
          href="/maintenance/new"
          className="px-3 py-1.5 text-sm bg-teal-700 text-white rounded-md hover:bg-teal-800"
        >
          + New request
        </Link>
      </div>

      <MaintenanceList requests={requests} properties={properties} />
    </div>
  );
}
