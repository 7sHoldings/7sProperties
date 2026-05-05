"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import {
  constructionExpenseSchema,
  type ConstructionExpenseInput,
  type ConstructionExpenseValues,
} from "@/lib/schemas";
import { Input, Select, Textarea } from "@/components/ui/FormField";
import Button from "@/components/ui/Button";

const CATEGORIES = [
  "land",
  "permits",
  "design",
  "foundation",
  "framing",
  "roofing",
  "electrical",
  "plumbing",
  "hvac",
  "insulation",
  "drywall",
  "flooring",
  "cabinets",
  "appliances",
  "paint",
  "windows_doors",
  "landscaping",
  "labor",
  "materials",
  "inspection",
  "other",
].map((c) => ({
  value: c,
  label: c.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
}));

type Props = {
  projectId: string;
};

export default function ConstructionExpenseForm({ projectId }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ConstructionExpenseValues, any, ConstructionExpenseInput>({
    resolver: zodResolver(constructionExpenseSchema),
    defaultValues: {
      project_id: projectId,
      expense_date: format(new Date(), "yyyy-MM-dd"),
      amount: undefined,
      category: "materials",
      description: "",
      vendor: "",
      notes: "",
    },
  });

  async function onSubmit(values: ConstructionExpenseInput) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not authenticated");
      return;
    }
    const { error } = await supabase.from("construction_expenses").insert({
      owner_id: user.id,
      project_id: projectId,
      expense_date: values.expense_date,
      amount: values.amount,
      category: values.category,
      description: values.description,
      vendor: values.vendor || null,
      notes: values.notes || null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Expense logged");
    reset({
      project_id: projectId,
      expense_date: format(new Date(), "yyyy-MM-dd"),
      amount: undefined,
      category: "materials",
      description: "",
      vendor: "",
      notes: "",
    });
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 text-sm bg-teal-700 text-white rounded-md hover:bg-teal-800"
      >
        + Add expense
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="bg-white border border-stone-200 rounded-xl p-4 sm:p-5 space-y-3"
      noValidate
    >
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm">Log build expense</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-stone-500 hover:text-stone-700"
        >
          Cancel
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
        <Select
          label="Category"
          required
          options={CATEGORIES}
          error={errors.category?.message}
          {...register("category")}
        />
      </div>
      <Input
        label="Description"
        required
        placeholder="e.g. lumber for framing"
        error={errors.description?.message}
        {...register("description")}
      />
      <Input label="Vendor" error={errors.vendor?.message} {...register("vendor")} />
      <Textarea label="Notes" rows={2} error={errors.notes?.message} {...register("notes")} />

      <div className="flex justify-end gap-2 pt-1">
        <Link
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setOpen(false);
          }}
          className="inline-flex items-center justify-center px-3 py-1.5 text-sm border border-stone-200 rounded-md hover:bg-stone-50"
        >
          Cancel
        </Link>
        <Button type="submit" loading={isSubmitting}>
          Save
        </Button>
      </div>
    </form>
  );
}
