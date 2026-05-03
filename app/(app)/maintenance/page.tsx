import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { format } from "date-fns";

export default async function MaintenancePage() {
  const supabase = await createClient();
  const { data: requests } = await supabase
    .from("maintenance_requests")
    .select("*, properties(name)")
    .order("reported_date", { ascending: false });

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-medium">Maintenance</h1>
        <Link href="/maintenance/new" className="px-3 py-1.5 text-sm bg-teal-700 text-white rounded-md hover:bg-teal-800">
          + New request
        </Link>
      </div>

      {!requests || requests.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-xl p-8 text-center">
          <p className="text-stone-500 mb-4">No maintenance requests yet.</p>
          <Link href="/maintenance/new" className="text-teal-700 hover:underline">Log a maintenance request →</Link>
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-50">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Date</th>
                <th className="text-left px-4 py-2 font-medium">Property</th>
                <th className="text-left px-4 py-2 font-medium">Issue</th>
                <th className="text-center px-4 py-2 font-medium">Priority</th>
                <th className="text-center px-4 py-2 font-medium">Status</th>
                <th className="text-right px-4 py-2 font-medium">Cost</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r: any) => (
                <tr key={r.id} className="border-t border-stone-100">
                  <td className="px-4 py-3 text-stone-600">{format(new Date(r.reported_date), "MMM d")}</td>
                  <td className="px-4 py-3">{r.properties?.name}</td>
                  <td className="px-4 py-3">{r.title}</td>
                  <td className="px-4 py-3 text-center"><PriorityBadge p={r.priority} /></td>
                  <td className="px-4 py-3 text-center"><StatusBadge s={r.status} /></td>
                  <td className="px-4 py-3 text-right">{r.cost ? `$${Number(r.cost).toLocaleString()}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PriorityBadge({ p }: { p: string }) {
  const styles: any = {
    urgent: "bg-red-50 text-red-800",
    high: "bg-amber-50 text-amber-800",
    medium: "bg-stone-100 text-stone-700",
    low: "bg-stone-50 text-stone-600",
  };
  return <span className={`text-xs px-2 py-0.5 rounded ${styles[p]}`}>{p}</span>;
}

function StatusBadge({ s }: { s: string }) {
  const styles: any = {
    open: "bg-red-50 text-red-800",
    in_progress: "bg-amber-50 text-amber-800",
    completed: "bg-green-50 text-green-800",
    cancelled: "bg-stone-100 text-stone-600",
  };
  return <span className={`text-xs px-2 py-0.5 rounded ${styles[s]}`}>{s.replace("_", " ")}</span>;
}
