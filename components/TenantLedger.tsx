"use client";

import { useEffect, useMemo, useState } from "react";
import { format, startOfMonth, addMonths, isBefore } from "date-fns";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import { lateFeeSchema, type LateFeeInput, type LateFeeValues } from "@/lib/schemas";
import { Input } from "@/components/ui/FormField";
import Button from "@/components/ui/Button";
import StatusBadge from "@/components/ui/StatusBadge";

type Lease = {
  id: string;
  start_date: string;
  end_date: string;
  monthly_rent: number;
  rent_due_day: number;
  status: string;
};

type Props = {
  lease: Lease;
};

export default function TenantLedger({ lease }: Props) {
  const supabase = createClient();
  const router = useRouter();
  const [payments, setPayments] = useState<any[]>([]);
  const [charges, setCharges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLateFee, setShowLateFee] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LateFeeValues, any, LateFeeInput>({
    resolver: zodResolver(lateFeeSchema),
    defaultValues: {
      charge_date: format(new Date(), "yyyy-MM-dd"),
      description: "Late fee",
    },
  });

  async function load() {
    setLoading(true);
    const [payRes, chargeRes] = await Promise.all([
      supabase
        .from("payments")
        .select("id, amount, payment_date, for_month")
        .eq("lease_id", lease.id)
        .order("for_month", { ascending: true }),
      supabase
        .from("tenant_charges")
        .select("*")
        .eq("lease_id", lease.id)
        .order("charge_date", { ascending: false }),
    ]);
    setPayments(payRes.data || []);
    setCharges(chargeRes.data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [lease.id]);

  const monthlyLedger = useMemo(() => {
    const start = startOfMonth(new Date(lease.start_date));
    const today = startOfMonth(new Date());
    const end = startOfMonth(new Date(lease.end_date));
    const stop = isBefore(today, end) ? today : end;

    const rows: { key: string; label: string; expected: number; paid: number; balance: number }[] = [];
    let cursor = start;
    let cumulative = 0;

    while (!isBefore(stop, cursor)) {
      const key = format(cursor, "yyyy-MM");
      const expected = Number(lease.monthly_rent);
      const paidThisMonth = payments
        .filter((p) => p.for_month && p.for_month.startsWith(key))
        .reduce((s, p) => s + Number(p.amount), 0);
      cumulative += expected - paidThisMonth;
      rows.push({
        key,
        label: format(cursor, "MMM yyyy"),
        expected,
        paid: paidThisMonth,
        balance: cumulative,
      });
      cursor = addMonths(cursor, 1);
    }
    return rows;
  }, [lease, payments]);

  const totalCharges = charges.reduce((s, c) => s + Number(c.amount), 0);
  const totalExpected = monthlyLedger.reduce((s, r) => s + r.expected, 0) + totalCharges;
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);
  const outstanding = Math.max(0, totalExpected - totalPaid);

  async function onAddLateFee(values: LateFeeInput) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("tenant_charges").insert({
      owner_id: user.id,
      lease_id: lease.id,
      charge_date: values.charge_date,
      charge_type: "late_fee",
      amount: values.amount,
      description: values.description,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Late fee added");
    reset({
      charge_date: format(new Date(), "yyyy-MM-dd"),
      description: "Late fee",
    });
    setShowLateFee(false);
    load();
    router.refresh();
  }

  async function deleteCharge(id: string) {
    if (!confirm("Remove this charge?")) return;
    const { error } = await supabase.from("tenant_charges").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Removed");
    load();
  }

  return (
    <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
        <div>
          <h2 className="font-medium">Rent ledger</h2>
          <p className="text-xs text-stone-500">
            Expected ${totalExpected.toLocaleString()} · Paid ${totalPaid.toLocaleString()} ·
            {outstanding > 0 ? (
              <span className="text-red-700 font-medium">
                {" "}
                Outstanding ${outstanding.toLocaleString()}
              </span>
            ) : (
              <span className="text-green-700 font-medium"> All paid</span>
            )}
          </p>
        </div>
        <button
          onClick={() => setShowLateFee((v) => !v)}
          className="text-xs text-teal-700 hover:underline flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" />
          Add late fee
        </button>
      </div>

      {showLateFee && (
        <form
          onSubmit={handleSubmit(onAddLateFee)}
          className="bg-stone-50 border-b border-stone-100 p-3 grid grid-cols-1 sm:grid-cols-4 gap-2 items-end"
          noValidate
        >
          <Input
            label="Date"
            type="date"
            error={errors.charge_date?.message}
            {...register("charge_date")}
          />
          <Input
            label="Amount"
            type="number"
            step="0.01"
            inputMode="decimal"
            error={errors.amount?.message}
            {...register("amount")}
          />
          <Input
            label="Reason"
            placeholder="e.g. Late rent fee"
            error={errors.description?.message}
            {...register("description")}
          />
          <Button type="submit" loading={isSubmitting} size="md">
            Add
          </Button>
        </form>
      )}

      {loading ? (
        <div className="p-4 text-sm text-stone-500">Loading...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Month</th>
                <th className="text-right px-4 py-2 font-medium">Expected</th>
                <th className="text-right px-4 py-2 font-medium">Paid</th>
                <th className="text-center px-4 py-2 font-medium">Status</th>
                <th className="text-right px-4 py-2 font-medium">Running balance</th>
              </tr>
            </thead>
            <tbody>
              {monthlyLedger.map((r) => {
                const isPaid = r.paid >= r.expected;
                const isPartial = r.paid > 0 && r.paid < r.expected;
                return (
                  <tr key={r.key} className="border-t border-stone-100">
                    <td className="px-4 py-2.5">{r.label}</td>
                    <td className="px-4 py-2.5 text-right">${r.expected.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right text-green-700">
                      ${r.paid.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {isPaid ? (
                        <StatusBadge tone="green">Paid</StatusBadge>
                      ) : isPartial ? (
                        <StatusBadge tone="amber">Partial</StatusBadge>
                      ) : (
                        <StatusBadge tone="red">Due</StatusBadge>
                      )}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right font-medium ${
                        r.balance > 0 ? "text-red-700" : "text-stone-400"
                      }`}
                    >
                      {r.balance > 0 ? `$${r.balance.toLocaleString()}` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {charges.length > 0 && (
        <div className="border-t border-stone-100">
          <div className="px-4 py-2 bg-stone-50 text-xs font-medium uppercase text-stone-600">
            Other charges
          </div>
          <table className="w-full text-sm">
            <tbody>
              {charges.map((c) => (
                <tr key={c.id} className="border-t border-stone-100">
                  <td className="px-4 py-2.5 text-stone-600 w-32">
                    {format(new Date(c.charge_date), "MMM d, yyyy")}
                  </td>
                  <td className="px-4 py-2.5">{c.description}</td>
                  <td className="px-4 py-2.5 text-right text-amber-700 font-medium">
                    +${Number(c.amount).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right w-12">
                    <button
                      onClick={() => deleteCharge(c.id)}
                      className="text-stone-400 hover:text-red-600"
                      title="Remove"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
