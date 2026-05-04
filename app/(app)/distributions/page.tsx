import Link from "next/link";
import { startOfYear, format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import DistributionsList from "@/components/lists/DistributionsList";

export default async function DistributionsPage() {
  const supabase = await createClient();
  const yearStart = format(startOfYear(new Date()), "yyyy-MM-dd");

  const [distRes, propsRes] = await Promise.all([
    supabase
      .from("distributions")
      .select("*, properties(name)")
      .order("distribution_date", { ascending: false }),
    supabase.from("properties").select("id, name").order("name"),
  ]);

  const distributions = distRes.data || [];
  const properties = (propsRes.data || []) as any[];

  const total = distributions.reduce((s, d) => s + Number(d.amount), 0);
  const ytd = distributions
    .filter((d: any) => d.distribution_date >= yearStart)
    .reduce((s: number, d: any) => s + Number(d.amount), 0);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-medium">Profit taken out</h1>
          <p className="text-sm text-stone-500">
            Lifetime: ${total.toLocaleString()} · This year: ${ytd.toLocaleString()}
          </p>
        </div>
        <Link
          href="/distributions/new"
          className="px-3 py-1.5 text-sm bg-teal-700 text-white rounded-md hover:bg-teal-800"
        >
          + Record distribution
        </Link>
      </div>

      <DistributionsList distributions={distributions} properties={properties} />
    </div>
  );
}
