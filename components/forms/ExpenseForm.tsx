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
import { Field, Input, Textarea } from "@/components/ui/FormField";
import Button from "@/components/ui/Button";
import PendingFilesInput from "@/components/PendingFilesInput";
import { uploadPendingFiles } from "@/lib/uploadPending";
import { CONSTRUCTION_CATEGORIES } from "@/components/forms/ConstructionExpenseForm";

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

function toOption(c: string) {
  return { value: c, label: c.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) };
}
const RENTAL_CATEGORY_OPTIONS = [
  ...STANDARD_CATEGORIES.map(toOption),
  { value: CUSTOM_SENTINEL, label: "Custom…" },
];
const CONSTRUCTION_CATEGORY_OPTIONS = [
  ...CONSTRUCTION_CATEGORIES.map(toOption),
  { value: CUSTOM_SENTINEL, label: "Custom…" },
];

// Option values are prefixed so we can tell rental homes from construction
// projects in a single dropdown ("prop:UUID" vs "proj:UUID").
const PROP_PREFIX = "prop:";
const PROJ_PREFIX = "proj:";
function isConstructionSelection(v: string) {
  return v.startsWith(PROJ_PREFIX);
}
function stripPrefix(v: string) {
  if (v.startsWith(PROP_PREFIX)) return v.slice(PROP_PREFIX.length);
  if (v.startsWith(PROJ_PREFIX)) return v.slice(PROJ_PREFIX.length);
  return v;
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
  const [projects, setProjects] = useState<any[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  // Edit mode currently only works for rental expenses (rows already in
  // `expenses`), so the initial selection always maps to a property.
  const initialSelectValue = initial?.property_id
    ? `${PROP_PREFIX}${initial.property_id}`
    : "";

  // If the existing category isn't in the standard list, open the custom field
  // pre-filled with it (edit mode where a user previously typed a custom label).
  const initialIsCustom = useMemo(() => {
    if (!initial?.category) return false;
    const cat = initial.category as string;
    // A saved category is "custom" if it isn't in either the rental or the
    // construction list (edit mode doesn't know the type yet).
    return (
      !STANDARD_CATEGORIES.includes(cat) && !CONSTRUCTION_CATEGORIES.includes(cat)
    );
  }, [initial?.category]);
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
      property_id: initialSelectValue,
      expense_date: initial?.expense_date ?? format(new Date(), "yyyy-MM-dd"),
      amount: initial?.amount,
      category: initialIsCustom ? CUSTOM_SENTINEL : (initial?.category ?? "repairs"),
      description: initial?.description ?? "",
      vendor: initial?.vendor ?? "",
      notes: initial?.notes ?? "",
    },
  });

  const selectedTarget = watch("property_id");
  const isConstruction = isConstructionSelection(selectedTarget || "");
  const categoryOptions = isConstruction
    ? CONSTRUCTION_CATEGORY_OPTIONS
    : RENTAL_CATEGORY_OPTIONS;
  const selectedCategory = watch("category");
  const isCustomSelected = selectedCategory === CUSTOM_SENTINEL;

  // When switching target type, snap the category to a sensible default so the
  // Select doesn't show a value that no longer exists in the options list.
  useEffect(() => {
    if (!selectedCategory) return;
    const currentValues = categoryOptions.map((o) => o.value);
    if (!currentValues.includes(selectedCategory)) {
      setValue("category", isConstruction ? "materials" : "repairs");
    }
  }, [isConstruction, selectedCategory, categoryOptions, setValue]);

  useEffect(() => {
    supabase
      .from("properties")
      .select("id, name")
      .order("name")
      .then(({ data }) => setProperties(data || []));
    // Only offer construction projects when creating; edit mode is tied to a
    // rental expense row already in `expenses`.
    if (mode === "create") {
      supabase
        .from("construction_projects")
        .select("id, name, status")
        .order("name")
        .then(({ data }) => setProjects(data || []));
    }
  }, [mode]);

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

    const rawTarget = values.property_id || "";
    const targetIsConstruction = isConstructionSelection(rawTarget);
    const targetId = stripPrefix(rawTarget);

    if (mode === "create") {
      if (targetIsConstruction) {
        // Route the insert to construction_expenses and stash any attached
        // files against the new construction_expense row.
        const { data: created, error } = await supabase
          .from("construction_expenses")
          .insert({
            owner_id: user.id,
            project_id: targetId,
            expense_date: values.expense_date,
            amount: values.amount,
            category: finalCategory,
            description: values.description,
            vendor: values.vendor || null,
            notes: values.notes || null,
          })
          .select()
          .single();
        if (error) {
          toast.error(error.message);
          return;
        }
        if (pendingFiles.length > 0) {
          await uploadPendingFiles(
            supabase,
            user.id,
            created.id,
            "construction_expense",
            pendingFiles
          );
        }
        toast.success(
          pendingFiles.length > 0
            ? `Build expense added with ${pendingFiles.length} file${pendingFiles.length === 1 ? "" : "s"}`
            : "Build expense added"
        );
        router.push(`/construction/${targetId}`);
        router.refresh();
        return;
      }

      const { data: created, error } = await supabase
        .from("expenses")
        .insert({
          owner_id: user.id,
          property_id: targetId,
          expense_date: values.expense_date,
          amount: values.amount,
          category: finalCategory,
          description: values.description,
          vendor: values.vendor || null,
          notes: values.notes || null,
        })
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
      // Edit path only handles rental expenses today. Ignore prefix mangling
      // and pass the raw UUID.
      const { error } = await supabase
        .from("expenses")
        .update({
          property_id: targetId,
          expense_date: values.expense_date,
          amount: values.amount,
          category: finalCategory,
          description: values.description,
          vendor: values.vendor || null,
          notes: values.notes || null,
        })
        .eq("id", expenseId!);
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
      <Field
        label="Property or construction project"
        required
        error={errors.property_id?.message}
        hint={
          mode === "create" && projects.length > 0
            ? "Rental homes and in-progress builds both accept expenses."
            : undefined
        }
      >
        <select
          required
          className={`w-full px-3 py-2 text-sm border rounded-md bg-white focus:outline-none focus:ring-2 transition-colors ${
            errors.property_id
              ? "border-red-300 focus:ring-red-300 focus:border-red-400"
              : "border-stone-200 focus:ring-teal-600 focus:border-teal-600"
          }`}
          {...register("property_id")}
        >
          <option value="">Select property or project</option>
          {properties.length > 0 && (
            <optgroup label="Rental Homes">
              {properties.map((p) => (
                <option key={p.id} value={`${PROP_PREFIX}${p.id}`}>
                  {p.name}
                </option>
              ))}
            </optgroup>
          )}
          {projects.length > 0 && (
            <optgroup label="Construction Projects">
              {projects.map((p) => (
                <option key={p.id} value={`${PROJ_PREFIX}${p.id}`}>
                  {p.name}
                  {p.status && p.status !== "in_progress"
                    ? ` (${p.status.replace(/_/g, " ")})`
                    : ""}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </Field>

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

      <Field label="Category" required error={errors.category?.message}>
        <select
          required
          className={`w-full px-3 py-2 text-sm border rounded-md bg-white focus:outline-none focus:ring-2 transition-colors ${
            errors.category
              ? "border-red-300 focus:ring-red-300 focus:border-red-400"
              : "border-stone-200 focus:ring-teal-600 focus:border-teal-600"
          }`}
          {...register("category")}
        >
          {categoryOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>

      {isCustomSelected && (
        <Input
          label="Custom category name"
          required
          placeholder={
            isConstruction ? "e.g. site survey" : "e.g. HOA special assessment"
          }
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
