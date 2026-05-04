"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { mortgageSchema, type MortgageInput, type MortgageValues } from "@/lib/schemas";
import { Input, Textarea } from "@/components/ui/FormField";
import Button from "@/components/ui/Button";

export default function MortgageSection({ propertyId }: { propertyId: string }) {
  const supabase = createClient();
  const [mortgage, setMortgage] = useState<any | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<MortgageValues, any, MortgageInput>({
    resolver: zodResolver(mortgageSchema),
  });

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("mortgages")
      .select("*")
      .eq("property_id", propertyId)
      .maybeSingle();
    setMortgage(data);
    if (data) {
      reset({
        lender: data.lender || "",
        original_principal: data.original_principal,
        current_balance: data.current_balance,
        interest_rate: data.interest_rate,
        monthly_payment: data.monthly_payment,
        term_months: data.term_months,
        start_date: data.start_date || "",
        notes: data.notes || "",
      });
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [propertyId]);

  async function onSubmit(values: MortgageInput) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const payload = {
      property_id: propertyId,
      lender: values.lender || null,
      original_principal: values.original_principal ?? null,
      current_balance: values.current_balance ?? null,
      interest_rate: values.interest_rate ?? null,
      monthly_payment: values.monthly_payment ?? null,
      term_months: values.term_months ?? null,
      start_date: values.start_date || null,
      notes: values.notes || null,
    };

    if (mortgage) {
      const { error } = await supabase.from("mortgages").update(payload).eq("id", mortgage.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase
        .from("mortgages")
        .insert({ owner_id: user.id, ...payload });
      if (error) return toast.error(error.message);
    }
    toast.success("Mortgage saved");
    setEditing(false);
    load();
  }

  if (loading) {
    return (
      <div className="bg-white border border-stone-200 rounded-xl p-4 text-sm text-stone-500">
        Loading...
      </div>
    );
  }

  if (!mortgage && !editing) {
    return (
      <div className="bg-white border border-stone-200 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Mortgage</h2>
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-teal-700 hover:underline"
          >
            + Add mortgage
          </button>
        </div>
        <p className="text-sm text-stone-500 mt-2">No mortgage on file.</p>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="bg-white border border-stone-200 rounded-xl p-4">
        <h2 className="font-medium mb-3">{mortgage ? "Edit mortgage" : "Add mortgage"}</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
          <Input label="Lender" {...register("lender")} />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Original principal"
              type="number"
              step="0.01"
              error={errors.original_principal?.message}
              {...register("original_principal")}
            />
            <Input
              label="Current balance"
              type="number"
              step="0.01"
              error={errors.current_balance?.message}
              {...register("current_balance")}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Interest rate %"
              type="number"
              step="0.001"
              error={errors.interest_rate?.message}
              {...register("interest_rate")}
            />
            <Input
              label="Monthly payment"
              type="number"
              step="0.01"
              error={errors.monthly_payment?.message}
              {...register("monthly_payment")}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Term (months)"
              type="number"
              hint="e.g. 360 for a 30-year loan"
              error={errors.term_months?.message}
              {...register("term_months")}
            />
            <Input label="Start date" type="date" {...register("start_date")} />
          </div>
          <Textarea label="Notes" rows={2} {...register("notes")} />
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setEditing(false);
                load();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              Save
            </Button>
          </div>
        </form>
      </div>
    );
  }

  // Display mode
  const m = mortgage;
  const equityNote =
    m.original_principal && m.current_balance
      ? `Paid off: $${(Number(m.original_principal) - Number(m.current_balance)).toLocaleString()}`
      : null;

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-medium">Mortgage</h2>
        <button
          onClick={() => setEditing(true)}
          className="text-stone-400 hover:text-teal-700"
          title="Edit"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="space-y-2 text-sm">
        {m.lender && (
          <div className="flex justify-between">
            <span className="text-stone-500">Lender</span>
            <span>{m.lender}</span>
          </div>
        )}
        {m.current_balance != null && (
          <div className="flex justify-between">
            <span className="text-stone-500">Current balance</span>
            <span className="font-medium">
              ${Number(m.current_balance).toLocaleString()}
            </span>
          </div>
        )}
        {m.monthly_payment != null && (
          <div className="flex justify-between">
            <span className="text-stone-500">Monthly payment</span>
            <span>${Number(m.monthly_payment).toLocaleString()}</span>
          </div>
        )}
        {m.interest_rate != null && (
          <div className="flex justify-between">
            <span className="text-stone-500">Interest rate</span>
            <span>{Number(m.interest_rate)}%</span>
          </div>
        )}
        {equityNote && (
          <div className="text-xs text-green-700 mt-2 pt-2 border-t border-stone-100">
            {equityNote}
          </div>
        )}
      </div>
    </div>
  );
}
