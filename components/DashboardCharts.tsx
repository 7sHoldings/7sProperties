"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const COLORS = ["#0f766e", "#0ea5e9", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#84cc16", "#f97316", "#6366f1"];

type CashflowPoint = { month: string; income: number; expenses: number; net: number };

export function CashflowChart({ data }: { data: CashflowPoint[] }) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="font-medium">Monthly cashflow</h2>
        <span className="text-xs text-stone-500">Last 12 months</span>
      </div>
      <div style={{ width: "100%", height: 240 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: "#78716c" }}
              axisLine={{ stroke: "#e7e5e4" }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#78716c" }}
              axisLine={{ stroke: "#e7e5e4" }}
              tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
            />
            <Tooltip
              contentStyle={{
                background: "white",
                border: "1px solid #e7e5e4",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(v: any) => `$${Number(v).toLocaleString()}`}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="income" stroke="#15803d" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="expenses" stroke="#b91c1c" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="net" stroke="#0f766e" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

type CategorySlice = { name: string; value: number };

export function CategoryPieChart({ data }: { data: CategorySlice[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="font-medium">Expenses by category</h2>
        <span className="text-xs text-stone-500">YTD</span>
      </div>
      {data.length === 0 || total === 0 ? (
        <div className="h-[240px] flex items-center justify-center text-sm text-stone-400">
          No expense data yet
        </div>
      ) : (
        <div style={{ width: "100%", height: 240 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                innerRadius={45}
                paddingAngle={2}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "white",
                  border: "1px solid #e7e5e4",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: any) => `$${Number(v).toLocaleString()}`}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
