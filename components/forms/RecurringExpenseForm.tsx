"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import {
  recurringExpenseSchema,
  type RecurringExpenseInput,
  type RecurringExpenseValues,
} from "@/lib/schemas";
import { Input, Select, Textarea } from "@/components/ui/FormField";
import Button from "@/components/ui/Button";

const CATEGORIES = [
  { value: "mortgage", label: "Mortgage" },
  { value: "insurance", label: "Insurance" },
  { value: "property_tax", label: "Property tax" },
  { value: "hoa", label: "HOA" },
  { value: "utilities", label: "Utilities" },
  { value: "management_fee", label: "Management fee" },
  { value: "maintenance", label: "Maintenance" },
  { value: "other", label: "Other" },
];

const FREQUENCIES = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
];

type Props = {
  mode: "create" | "edit";
  recurringId?: string;
  initial?: Partial<RecurringExpenseValues>;
};

export default function RecurringExpenseForm({ mode, recurringId, initial }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [properties, setProperties] = useState<any[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RecurringExpenseValues, any, RecurringExpenseInput>({
    resolver: zodResolver(recurringExpenseSchema),
    defaultValues: {
      property_id: initial?.property_id ?? "",
      category: initial?.category ?? "insurance",
      description: initial?.description ?? "",
      vendor: initial?.vendor ?? "",
      amount: initial?.amount,
      frequency: (initial?.frequency as any) ?? "monthly",
      start_date: initial?.start_date ?? format(new Date(), "yyyy-MM-dd"),
      end_date: initial?.end_date ?? "",
      day_of_month: initial?.day_of_month ?? 1,
      active: initial?.active ?? true,
      notes: initial?.notes ?? "",
    },
  });

  useEffect(() => {
    supabase
      .from("properties")
      .select("id, name")
      .order("name")
      .then(({ data }) => setProperties(data || []));
  }, []);

  async function onSubmit(values: RecurringExpenseInput) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const payload = {
      property_id: values.property_id || null,
      category: values.category,
      description: values.description,
      vendor: values.vendor || null,
      amount: values.amount,
      frequency: values.frequency,
      start_date: values.start_date,
      end_date: values.end_date || null,
      day_of_month: values.day_of_month,
      active: values.active,
      notes: values.notes || null,
    };

    if (mode === "create") {
      const { error } = await supabase
        .from("recurring_expenses")
        .insert({ owner_id: user.id, ...payload });
      if (error) return toast.error(error.message);
      toast.success("Recurring expense saved");
    } else {
      const { error } = await supabase
        .from("recurring_expenses")
        .update(payload)
        .eq("id", recurringId!);
      if (error) return toast.error(error.message);
      toast.success("Updated");
    }
    router.push("/recurring");
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="bg-white border border-stone-200 rounded-xl p-5 sm:p-6 space-y-4"
      noValidate
    >
      <Select
        label="Property (optional)"
        hint="Leave blank if this expense isn't tied to one property"
        error={errors.property_id?.message}
        {...register("property_id")}
      >
        <option value="">No specific property (general / all)</option>
        {properties.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </Select>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Select
          label="Category"
          required
          options={CATEGORIES}
          error={errors.category?.message}
          {...register("category")}
        />
        <Input
          label="Amount"
          type="number"
          step="0.01"
          inputMode="decimal"
          required
          error={errors.amount?.message}
          {...register("amount")}
        />
      </div>

      <Input
        label="Description"
        required
        placeholder="e.g. Mortgage payment, Homeowners insurance"
        error={errors.description?.message}
        {...register("description")}
      />
      <Input label="Vendor" error={errors.vendor?.message} {...register("vendor")} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Select
          label="Frequency"
          required
          options={FREQUENCIES}
          error={errors.frequency?.message}
          {...register("frequency")}
        />
        <Input
          label="Start date"
          type="date"
          required
          error={errors.start_date?.message}
          {...register("start_date")}
        />
        <Input
          label="Day of month"
          type="number"
          min="1"
          max="28"
          inputMode="numeric"
          hint="When it's due"
          error={errors.day_of_month?.message}
          {...register("day_of_month")}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          label="End date (optional)"
          type="date"
          hint="Leave blank for ongoing"
          error={errors.end_date?.message}
          {...register("end_date")}
        />
        <div>
          <label className="flex items-center gap-2 mt-7 text-sm cursor-pointer">
            <input type="checkbox" {...register("active")} className="rounded" />
            <span>Active (will generate expenses)</span>
          </label>
        </div>
      </div>

      <Textarea label="Notes" rows={2} error={errors.notes?.message} {...register("notes")} />

      <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
        <Link
          href="/recurring"
          className="inline-flex items-center justify-center px-4 py-2 text-sm border border-stone-200 rounded-md hover:bg-stone-50"
        >
          Cancel
        </Link>
        <Button type="submit" loading={isSubmitting} size="lg">
          {mode === "create" ? "Save" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
