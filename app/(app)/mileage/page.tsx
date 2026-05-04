import Link from "next/link";
import { startOfYear, format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import MileageList from "@/components/lists/MileageList";

export default async function MileagePage() {
  const supabase = await createClient();
  const yearStart = format(startOfYear(new Date()), "yyyy-MM-dd");

  const [logsRes, propsRes] = await Promise.all([
    supabase
      .from("mileage_logs")
      .select("*, properties(name)")
      .order("trip_date", { ascending: false }),
    supabase.from("properties").select("id, name").order("name"),
  ]);

  const logs = logsRes.data || [];
  const properties = (propsRes.data || []) as any[];
  const ytdMiles = logs
    .filter((l: any) => l.trip_date >= yearStart)
    .reduce((s: number, l: any) => s + Number(l.miles), 0);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-medium">Mileage</h1>
          <p className="text-sm text-stone-500">
            YTD: {ytdMiles.toLocaleString()} miles · {logs.length} trip
            {logs.length === 1 ? "" : "s"} total
          </p>
        </div>
        <Link
          href="/mileage/new"
          className="px-3 py-1.5 text-sm bg-teal-700 text-white rounded-md hover:bg-teal-800"
        >
          + Log trip
        </Link>
      </div>

      <MileageList logs={logs} properties={properties} />
    </div>
  );
}
