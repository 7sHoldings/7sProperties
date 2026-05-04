"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";

function downloadCsv(filename: string, rows: any[][]) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => {
          const s = cell == null ? "" : String(cell);
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(",")
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CsvExportButtons({ year }: { year: number }) {
  const supabase = createClient();
  const [busy, setBusy] = useState<string | null>(null);

  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  async function exportPayments() {
    setBusy("payments");
    const { data } = await supabase
      .from("payments")
      .select(
        "payment_date, for_month, amount, payment_method, reference_number, leases(tenants(full_name), units(properties(name)))"
      )
      .gte("payment_date", yearStart)
      .lte("payment_date", yearEnd)
      .order("payment_date");
    setBusy(null);
    const rows: any[][] = [
      ["Date", "For month", "Tenant", "Property", "Method", "Reference", "Amount"],
    ];
    (data || []).forEach((p: any) => {
      rows.push([
        p.payment_date,
        p.for_month,
        p.leases?.tenants?.full_name || "",
        p.leases?.units?.properties?.name || "",
        p.payment_method || "",
        p.reference_number || "",
        Number(p.amount).toFixed(2),
      ]);
    });
    downloadCsv(`payments-${year}.csv`, rows);
    toast.success("Payments exported");
  }

  async function exportExpenses() {
    setBusy("expenses");
    const { data } = await supabase
      .from("expenses")
      .select("expense_date, properties(name), category, description, vendor, amount")
      .gte("expense_date", yearStart)
      .lte("expense_date", yearEnd)
      .order("expense_date");
    setBusy(null);
    const rows: any[][] = [
      ["Date", "Property", "Category", "Description", "Vendor", "Amount"],
    ];
    (data || []).forEach((e: any) => {
      rows.push([
        e.expense_date,
        e.properties?.name || "",
        e.category,
        e.description,
        e.vendor || "",
        Number(e.amount).toFixed(2),
      ]);
    });
    downloadCsv(`expenses-${year}.csv`, rows);
    toast.success("Expenses exported");
  }

  async function exportMileage() {
    setBusy("mileage");
    const { data } = await supabase
      .from("mileage_logs")
      .select("trip_date, properties(name), purpose, miles")
      .gte("trip_date", yearStart)
      .lte("trip_date", yearEnd)
      .order("trip_date");
    setBusy(null);
    const rows: any[][] = [
      ["Date", "Property", "Purpose", "Miles", "Deduction at $0.67/mi"],
    ];
    (data || []).forEach((m: any) => {
      rows.push([
        m.trip_date,
        m.properties?.name || "",
        m.purpose,
        Number(m.miles).toFixed(1),
        (Number(m.miles) * 0.67).toFixed(2),
      ]);
    });
    downloadCsv(`mileage-${year}.csv`, rows);
    toast.success("Mileage exported");
  }

  async function exportDistributions() {
    setBusy("distributions");
    const { data } = await supabase
      .from("distributions")
      .select("distribution_date, properties(name), destination, payment_method, type, amount")
      .gte("distribution_date", yearStart)
      .lte("distribution_date", yearEnd)
      .order("distribution_date");
    setBusy(null);
    const rows: any[][] = [
      ["Date", "Property", "Destination", "Type", "Method", "Amount"],
    ];
    (data || []).forEach((d: any) => {
      rows.push([
        d.distribution_date,
        d.properties?.name || "",
        d.destination,
        d.type || "distribution",
        d.payment_method || "",
        Number(d.amount).toFixed(2),
      ]);
    });
    downloadCsv(`distributions-${year}.csv`, rows);
    toast.success("Distributions exported");
  }

  const Btn = ({ id, label, onClick }: { id: string; label: string; onClick: () => void }) => (
    <button
      onClick={onClick}
      disabled={!!busy}
      className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 border border-stone-200 rounded-md hover:bg-stone-50 disabled:opacity-50"
    >
      <Download className="w-3.5 h-3.5" />
      {busy === id ? "Exporting..." : label}
    </button>
  );

  return (
    <div className="flex flex-wrap gap-2">
      <Btn id="payments" label="Payments CSV" onClick={exportPayments} />
      <Btn id="expenses" label="Expenses CSV" onClick={exportExpenses} />
      <Btn id="mileage" label="Mileage CSV" onClick={exportMileage} />
      <Btn id="distributions" label="Distributions CSV" onClick={exportDistributions} />
    </div>
  );
}
