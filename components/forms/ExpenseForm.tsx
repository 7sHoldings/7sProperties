"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { expenseSchema, type ExpenseInput, type ExpenseValues } from "@/lib/schemas";
import { Input, Select, Textarea } from "@/components/ui/FormField";
import Button from "@/components/ui/Button";

const CATEGORIES = [
  "repairs",
  "maintenance",
  "utilities",
  "insurance",
  "property_tax",
  "mortgage",
  "hoa",
  "management_fee",
  "supplies",
  "legal",
  "advertising",
  "other",
].map((c) => ({
  value: c,
  label: c.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase()),
}));

type Props = {
  mode: "create" | "edit";
  expenseId?: string;
  initial?: Partial<ExpenseValues>;
};

export default function ExpenseForm({ mode, expenseId, initial }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [properties, setProperties] = useState<any[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseValues, any, ExpenseInput>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      property_id: initial?.property_id ?? "",
      expense_date: initial?.expense_date ?? format(new Date(), "yyyy-MM-dd"),
      amount: initial?.amount,
      category: initial?.category ?? "repairs",
      description: initial?.description ?? "",
      vendor: initial?.vendor ?? "",
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

  async function onSubmit(values: ExpenseInput) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not authenticated");
      return;
    }

    const payload = {
      property_id: values.property_id,
      expense_date: values.expense_date,
      amount: values.amount,
      category: values.category,
      description: values.description,
      vendor: values.vendor || null,
      notes: values.notes || null,
    };

    if (mode === "create") {
      const { data: created, error } = await supabase
        .from("expenses")
        .insert({ owner_id: user.id, ...payload })
        .select()
        .single();
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Expense added — upload receipts below");
      router.push(`/expenses/${created.id}/edit`);
      router.refresh();
      return;
    } else {
      const { error } = await supabase.from("expenses").update(payload).eq("id", expenseId!);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Expense updated");
      router.push("/expenses");
      router.refresh();
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="bg-white border border-stone-200 rounded-xl p-5 sm:p-6 space-y-4"
      noValidate
    >
      <Select
        label="Property"
        required
        error={errors.property_id?.message}
        {...register("property_id")}
      >
        <option value="">Select property</option>
        {properties.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </Select>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          label="Date"
          type="date"
          required
          error={errors.expense_date?.message}
          {...register("expense_date")}
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

      <Select
        label="Category"
        required
        options={CATEGORIES}
        error={errors.category?.message}
        {...register("category")}
      />

      <Input
        label="Description"
        required
        placeholder="e.g. Plumbing repair"
        error={errors.description?.message}
        {...register("description")}
      />
      <Input label="Vendor" error={errors.vendor?.message} {...register("vendor")} />
      <Textarea label="Notes" rows={2} error={errors.notes?.message} {...register("notes")} />

      <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
        <Link
          href="/expenses"
          className="inline-flex items-center justify-center px-4 py-2 text-sm border border-stone-200 rounded-md hover:bg-stone-50"
        >
          Cancel
        </Link>
        <Button type="submit" loading={isSubmitting} size="lg">
          {mode === "create" ? "Save expense" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
