import { createClient } from "@/lib/supabase/server";
import { startOfYear, format } from "date-fns";
import CsvExportButtons from "@/components/CsvExportButtons";

export default async function ReportsPage() {
  const supabase = await createClient();
  const year = new Date().getFullYear();
  const yearStart = format(startOfYear(new Date()), "yyyy-MM-dd");

  const [propsRes, paymentsRes, expensesRes, distributionsRes, mileageRes, expensesAllRes] = await Promise.all([
    supabase.from("properties").select("id, name"),
    supabase
      .from("payments")
      .select("amount, leases(units(property_id))")
      .gte("for_month", yearStart),
    supabase
      .from("expenses")
      .select("property_id, amount, category, vendor")
      .gte("expense_date", yearStart),
    supabase
      .from("distributions")
      .select("property_id, amount, type")
      .gte("distribution_date", yearStart),
    supabase.from("mileage_logs").select("miles").gte("trip_date", yearStart),
    supabase.from("expenses").select("vendor, amount").gte("expense_date", yearStart),
  ]);

  const properties = propsRes.data || [];
  const payments = paymentsRes.data || [];
  const expenses = expensesRes.data || [];
  const distributions = distributionsRes.data || [];
  const mileage = mileageRes.data || [];

  const incomeByProp: Record<string, number> = {};
  payments.forEach((p: any) => {
    const pid = p.leases?.units?.property_id;
    if (pid) incomeByProp[pid] = (incomeByProp[pid] || 0) + Number(p.amount);
  });
  const expByProp: Record<string, number> = {};
  expenses.forEach((e: any) => {
    expByProp[e.property_id] = (expByProp[e.property_id] || 0) + Number(e.amount);
  });
  const distByProp: Record<string, number> = {};
  let generalDist = 0;
  let totalContributions = 0;
  distributions.forEach((d: any) => {
    if (d.type === "contribution") {
      totalContributions += Number(d.amount);
      return;
    }
    if (d.property_id) {
      distByProp[d.property_id] = (distByProp[d.property_id] || 0) + Number(d.amount);
    } else {
      generalDist += Number(d.amount);
    }
  });

  const totalIncome = Object.values(incomeByProp).reduce((s, v) => s + v, 0);
  const totalExp = Object.values(expByProp).reduce((s, v) => s + v, 0);
  const totalDist = distributions
    .filter((d: any) => d.type !== "contribution")
    .reduce((s, d: any) => s + Number(d.amount), 0);
  const net = totalIncome - totalExp;
  const retained = net - totalDist;
  const totalMiles = mileage.reduce((s: number, m: any) => s + Number(m.miles), 0);
  const mileageDeduction = totalMiles * 0.67;

  const byCategory: Record<string, number> = {};
  expenses.forEach((e: any) => {
    byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount);
  });

  // 1099-NEC candidates: vendors paid >= $600 for the year
  const byVendor: Record<string, number> = {};
  (expensesAllRes.data || []).forEach((e: any) => {
    if (e.vendor) byVendor[e.vendor] = (byVendor[e.vendor] || 0) + Number(e.amount);
  });
  const vendors1099 = Object.entries(byVendor)
    .filter(([, amt]) => amt >= 600)
    .sort((a, b) => b[1] - a[1]);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-medium">Reports</h1>
          <p className="text-sm text-stone-500">{year} year-to-date</p>
        </div>
        <CsvExportButtons year={year} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Stat label="Income" value={`$${totalIncome.toLocaleString()}`} tone="green" />
        <Stat label="Expenses" value={`$${totalExp.toLocaleString()}`} tone="red" />
        <Stat label="Profit taken out" value={`$${totalDist.toLocaleString()}`} tone="purple" />
        <Stat
          label="Retained"
          value={`$${retained.toLocaleString()}`}
          tone={retained >= 0 ? "default" : "red"}
        />
      </div>

      {(totalMiles > 0 || totalContributions > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {totalMiles > 0 && (
            <div className="bg-white border border-stone-200 rounded-xl p-4">
              <div className="text-sm text-stone-500 mb-1">Mileage deduction</div>
              <div className="text-xl font-medium text-green-700">
                ${mileageDeduction.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-stone-500 mt-1">
                {totalMiles.toLocaleString()} miles @ $0.67/mile
              </div>
            </div>
          )}
          {totalContributions > 0 && (
            <div className="bg-white border border-stone-200 rounded-xl p-4">
              <div className="text-sm text-stone-500 mb-1">Owner contributions</div>
              <div className="text-xl font-medium">${totalContributions.toLocaleString()}</div>
              <div className="text-xs text-stone-500 mt-1">Cash you put in this year</div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-stone-100">
            <h2 className="font-medium">Per property</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Property</th>
                  <th className="text-right px-4 py-2 font-medium">Income</th>
                  <th className="text-right px-4 py-2 font-medium">Expenses</th>
                  <th className="text-right px-4 py-2 font-medium">Net</th>
                  <th className="text-right px-4 py-2 font-medium">Drawn</th>
                  <th className="text-right px-4 py-2 font-medium">Retained</th>
                </tr>
              </thead>
              <tbody>
                {properties.map((p: any) => {
                  const inc = incomeByProp[p.id] || 0;
                  const exp = expByProp[p.id] || 0;
                  const dist = distByProp[p.id] || 0;
                  const n = inc - exp;
                  return (
                    <tr key={p.id} className="border-t border-stone-100">
                      <td className="px-4 py-2.5">{p.name}</td>
                      <td className="px-4 py-2.5 text-right text-green-700">
                        ${inc.toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-right text-red-700">
                        ${exp.toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium">
                        ${n.toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-right text-purple-700">
                        ${dist.toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium">
                        ${(n - dist).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
                {generalDist > 0 && (
                  <tr className="border-t border-stone-100 text-stone-500 italic">
                    <td className="px-4 py-2.5">General (unassigned)</td>
                    <td className="px-4 py-2.5 text-right">—</td>
                    <td className="px-4 py-2.5 text-right">—</td>
                    <td className="px-4 py-2.5 text-right">—</td>
                    <td className="px-4 py-2.5 text-right text-purple-700 not-italic">
                      ${generalDist.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right">—</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-stone-100">
            <h2 className="font-medium">Expenses by category</h2>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {Object.entries(byCategory)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, amt]) => (
                  <tr key={cat} className="border-t border-stone-100 first:border-0">
                    <td className="px-4 py-2.5 capitalize">{cat.replace("_", " ")}</td>
                    <td className="px-4 py-2.5 text-right text-red-700">
                      ${amt.toLocaleString()}
                    </td>
                  </tr>
                ))}
              {Object.keys(byCategory).length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-stone-500 text-center" colSpan={2}>
                    No expenses logged
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden mt-3">
        <div className="px-4 py-3 border-b border-stone-100">
          <h2 className="font-medium">Contractors paid &ge; $600 (1099-NEC candidates)</h2>
          <p className="text-xs text-stone-500 mt-0.5">
            You may need to issue a 1099-NEC to anyone listed below for {year}.
          </p>
        </div>
        {vendors1099.length === 0 ? (
          <p className="px-4 py-6 text-sm text-stone-500 text-center">
            No vendors over $600 yet.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-stone-50">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Vendor</th>
                <th className="text-right px-4 py-2 font-medium">Total paid</th>
              </tr>
            </thead>
            <tbody>
              {vendors1099.map(([vendor, amt]) => (
                <tr key={vendor} className="border-t border-stone-100">
                  <td className="px-4 py-2.5">{vendor}</td>
                  <td className="px-4 py-2.5 text-right">${amt.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "green" | "red" | "purple";
}) {
  const colors = {
    default: "",
    green: "text-green-700",
    red: "text-red-700",
    purple: "text-purple-700",
  };
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4">
      <div className="text-sm text-stone-500 mb-1">{label}</div>
      <div className={`text-2xl font-medium ${colors[tone]}`}>{value}</div>
    </div>
  );
}
