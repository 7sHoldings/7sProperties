import { format, startOfMonth, subMonths } from "date-fns";

type Props = {
  monthsBack?: number;
  payments: { amount: number; for_month: string }[];
  expenses: { amount: number; expense_date: string }[];
  distributions: { amount: number; distribution_date: string }[];
};

export default function PropertyCashflow({
  monthsBack = 12,
  payments,
  expenses,
  distributions,
}: Props) {
  const today = new Date();
  const months: { key: string; label: string }[] = [];
  for (let i = 0; i < monthsBack; i++) {
    const d = startOfMonth(subMonths(today, i));
    months.push({ key: format(d, "yyyy-MM"), label: format(d, "MMM yyyy") });
  }

  function sumFor(rows: { amount: number; date: string }[], key: string) {
    return rows
      .filter((r) => r.date.startsWith(key))
      .reduce((s, r) => s + Number(r.amount), 0);
  }

  const incomeRows = payments.map((p) => ({ amount: Number(p.amount), date: p.for_month }));
  const expenseRows = expenses.map((e) => ({ amount: Number(e.amount), date: e.expense_date }));
  const distRows = distributions.map((d) => ({
    amount: Number(d.amount),
    date: d.distribution_date,
  }));

  const rows = months.map((m) => {
    const income = sumFor(incomeRows, m.key);
    const exp = sumFor(expenseRows, m.key);
    const dist = sumFor(distRows, m.key);
    const net = income - exp;
    const retained = net - dist;
    return { ...m, income, exp, dist, net, retained };
  });

  const totals = rows.reduce(
    (acc, r) => ({
      income: acc.income + r.income,
      exp: acc.exp + r.exp,
      dist: acc.dist + r.dist,
      net: acc.net + r.net,
      retained: acc.retained + r.retained,
    }),
    { income: 0, exp: 0, dist: 0, net: 0, retained: 0 }
  );

  return (
    <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
        <h2 className="font-medium">Monthly cashflow</h2>
        <span className="text-xs text-stone-500">Last {monthsBack} months</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-stone-50">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Month</th>
              <th className="text-right px-4 py-2 font-medium">Rent collected</th>
              <th className="text-right px-4 py-2 font-medium">Expenses</th>
              <th className="text-right px-4 py-2 font-medium">Net</th>
              <th className="text-right px-4 py-2 font-medium">Taken out</th>
              <th className="text-right px-4 py-2 font-medium">Retained</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-stone-100">
                <td className="px-4 py-2.5">{r.label}</td>
                <td className="px-4 py-2.5 text-right text-green-700">
                  {r.income ? `$${r.income.toLocaleString()}` : "—"}
                </td>
                <td className="px-4 py-2.5 text-right text-red-700">
                  {r.exp ? `−$${r.exp.toLocaleString()}` : "—"}
                </td>
                <td
                  className={`px-4 py-2.5 text-right font-medium ${
                    r.net > 0 ? "text-stone-900" : r.net < 0 ? "text-red-700" : "text-stone-400"
                  }`}
                >
                  {r.income || r.exp ? `$${r.net.toLocaleString()}` : "—"}
                </td>
                <td className="px-4 py-2.5 text-right text-purple-700">
                  {r.dist ? `−$${r.dist.toLocaleString()}` : "—"}
                </td>
                <td
                  className={`px-4 py-2.5 text-right font-medium ${
                    r.retained > 0
                      ? "text-stone-900"
                      : r.retained < 0
                        ? "text-red-700"
                        : "text-stone-400"
                  }`}
                >
                  {r.income || r.exp || r.dist ? `$${r.retained.toLocaleString()}` : "—"}
                </td>
              </tr>
            ))}
            <tr className="bg-stone-50 border-t border-stone-200 font-medium">
              <td className="px-4 py-2.5">{monthsBack}-month total</td>
              <td className="px-4 py-2.5 text-right text-green-700">
                ${totals.income.toLocaleString()}
              </td>
              <td className="px-4 py-2.5 text-right text-red-700">
                −${totals.exp.toLocaleString()}
              </td>
              <td className="px-4 py-2.5 text-right">${totals.net.toLocaleString()}</td>
              <td className="px-4 py-2.5 text-right text-purple-700">
                −${totals.dist.toLocaleString()}
              </td>
              <td className="px-4 py-2.5 text-right">${totals.retained.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
