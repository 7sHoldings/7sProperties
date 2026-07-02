"use client";

import { useEffect, useMemo, useState } from "react";
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
import PendingFilesInput from "@/components/PendingFilesInput";
import { uploadPendingFiles } from "@/lib/uploadPending";

const STANDARD_CATEGORIES = [
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
];
const CUSTOM_SENTINEL = "__custom__";
const CATEGORY_OPTIONS = [
  ...STANDARD_CATEGORIES.map((c) => ({
    value: c,
    label: c.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase()),
  })),
  { value: CUSTOM_SENTINEL, label: "Custom…" },
];

function toTitle(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

type Props = {
  mode: "create" | "edit";
  expenseId?: string;
  initial?: Partial<ExpenseValues>;
};

export default function ExpenseForm({ mode, expenseId, initial }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [properties, setProperties] = useState<any[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  // If the existing category isn't in the standard list, open the custom field
  // pre-filled with it (edit mode where a user previously typed a custom label).
  const initialIsCustom = useMemo(
    () =>
      !!initial?.category &&
      !STANDARD_CATEGORIES.includes(initial.category as string),
    [initial?.category]
  );
  const [customCategory, setCustomCategory] = useState(
    initialIsCustom ? String(initial?.category ?? "") : ""
  );

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseValues, any, ExpenseInput>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      property_id: initial?.property_id ?? "",
      expense_date: initial?.expense_date ?? format(new Date(), "yyyy-MM-dd"),
      amount: initial?.amount,
      category: initialIsCustom ? CUSTOM_SENTINEL : (initial?.category ?? "repairs"),
      description: initial?.description ?? "",
      vendor: initial?.vendor ?? "",
      notes: initial?.notes ?? "",
    },
  });

  const selectedCategory = watch("category");
  const isCustomSelected = selectedCategory === CUSTOM_SENTINEL;

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

    // If they picked Custom, use the typed label. Normalise to snake_case so
    // it matches the shape of built-in categories (queries and pie-chart
    // labels split on underscores).
    let finalCategory = values.category;
    if (values.category === CUSTOM_SENTINEL) {
      const trimmed = customCategory.trim();
      if (!trimmed) {
        toast.error("Enter a name for the custom category");
        return;
      }
      finalCategory = trimmed
        .toLowerCase()
        .replace(/[^a-z0-9\s_-]/g, "")
        .replace(/[\s-]+/g, "_")
        .replace(/^_+|_+$/g, "");
      if (!finalCategory) {
        toast.error("Custom category name is invalid");
        return;
      }
    }

    const payload = {
      property_id: values.property_id,
      expense_date: values.expense_date,
      amount: values.amount,
      category: finalCategory,
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

      if (pendingFiles.length > 0) {
        await uploadPendingFiles(supabase, user.id, created.id, "expense", pendingFiles);
      }

      toast.success(
        pendingFiles.length > 0
          ? `Expense added with ${pendingFiles.length} file${pendingFiles.length === 1 ? "" : "s"}`
          : "Expense added"
      );
      router.push("/expenses");
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
        options={CATEGORY_OPTIONS}
        error={errors.category?.message}
        {...register("category")}
      />

      {isCustomSelected && (
        <Input
          label="Custom category name"
          required
          placeholder="e.g. HOA special assessment"
          value={customCategory}
          onChange={(e) => setCustomCategory(e.target.value)}
          hint="Free-form label. Saved lower-case with underscores so it groups cleanly on reports."
        />
      )}

      <Input
        label="Description"
        required
        placeholder="e.g. Plumbing repair"
        error={errors.description?.message}
        {...register("description")}
      />
      <Input label="Vendor" error={errors.vendor?.message} {...register("vendor")} />
      <Textarea label="Notes" rows={2} error={errors.notes?.message} {...register("notes")} />

      {mode === "create" && (
        <PendingFilesInput
          files={pendingFiles}
          onChange={setPendingFiles}
          label="Receipt photos / files"
          hint="Attach receipts now or upload later. Max 10 MB each."
        />
      )}

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
