"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import { depositTxSchema, type DepositTxInput, type DepositTxValues } from "@/lib/schemas";
import { Input, Select } from "@/components/ui/FormField";
import Button from "@/components/ui/Button";

type Props = {
  leaseId: string;
  initialDeposit: number;
};

export default function DepositLedger({ leaseId, initialDeposit }: Props) {
  const supabase = createClient();
  const router = useRouter();
  const [txs, setTxs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DepositTxValues, any, DepositTxInput>({
    resolver: zodResolver(depositTxSchema),
    defaultValues: {
      transaction_date: format(new Date(), "yyyy-MM-dd"),
      transaction_type: "deduction",
      description: "",
    },
  });

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("deposit_transactions")
      .select("*")
      .eq("lease_id", leaseId)
      .order("transaction_date", { ascending: false });
    setTxs(data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [leaseId]);

  const refunded = txs
    .filter((t) => t.transaction_type === "refund")
    .reduce((s, t) => s + Number(t.amount), 0);
  const deducted = txs
    .filter((t) => t.transaction_type === "deduction")
    .reduce((s, t) => s + Number(t.amount), 0);
  const stillHeld = Number(initialDeposit) - refunded - deducted;

  async function onSubmit(values: DepositTxInput) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    if (values.amount > stillHeld) {
      toast.error(`Amount exceeds held balance of $${stillHeld.toLocaleString()}`);
      return;
    }
    const { error } = await supabase.from("deposit_transactions").insert({
      owner_id: user.id,
      lease_id: leaseId,
      ...values,
      notes: values.notes || null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Recorded");
    setShowForm(false);
    reset();
    load();
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Remove this transaction?")) return;
    const { error } = await supabase.from("deposit_transactions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removed");
    load();
  }

  if (!initialDeposit) {
    return (
      <div className="bg-white border border-stone-200 rounded-xl p-4 text-sm text-stone-500">
        No security deposit on file for this lease.
      </div>
    );
  }

  return (
    <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
        <div>
          <h2 className="font-medium">Security deposit</h2>
          <p className="text-xs text-stone-500">
            Held: ${Number(initialDeposit).toLocaleString()} · Deducted: ${deducted.toLocaleString()}{" "}
            · Refunded: ${refunded.toLocaleString()} ·{" "}
            <span className="font-medium text-stone-700">
              Still held: ${stillHeld.toLocaleString()}
            </span>
          </p>
        </div>
        {stillHeld > 0 && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="text-xs text-teal-700 hover:underline flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            Record
          </button>
        )}
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="bg-stone-50 border-b border-stone-100 p-3 grid grid-cols-1 sm:grid-cols-5 gap-2 items-end"
          noValidate
        >
          <Input
            label="Date"
            type="date"
            error={errors.transaction_date?.message}
            {...register("transaction_date")}
          />
          <Select
            label="Type"
            options={[
              { value: "deduction", label: "Deduction" },
              { value: "refund", label: "Refund" },
            ]}
            {...register("transaction_type")}
          />
          <Input
            label="Amount"
            type="number"
            step="0.01"
            error={errors.amount?.message}
            {...register("amount")}
          />
          <Input
            label="Reason"
            placeholder="e.g. Carpet damage"
            error={errors.description?.message}
            {...register("description")}
          />
          <Button type="submit" loading={isSubmitting} size="md">
            Save
          </Button>
        </form>
      )}

      {loading ? (
        <div className="p-4 text-sm text-stone-500">Loading...</div>
      ) : txs.length === 0 ? (
        <div className="p-4 text-sm text-stone-500">
          No deposit transactions yet.
        </div>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {txs.map((t) => (
              <tr key={t.id} className="border-t border-stone-100">
                <td className="px-4 py-2.5 text-stone-600 w-32">
                  {format(new Date(t.transaction_date), "MMM d, yyyy")}
                </td>
                <td className="px-4 py-2.5 capitalize w-24">
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      t.transaction_type === "refund"
                        ? "bg-blue-50 text-blue-800"
                        : "bg-amber-50 text-amber-800"
                    }`}
                  >
                    {t.transaction_type}
                  </span>
                </td>
                <td className="px-4 py-2.5">{t.description}</td>
                <td className="px-4 py-2.5 text-right font-medium">
                  −${Number(t.amount).toLocaleString()}
                </td>
                <td className="px-4 py-2.5 text-right w-12">
                  <button
                    onClick={() => remove(t.id)}
                    className="text-stone-400 hover:text-red-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
