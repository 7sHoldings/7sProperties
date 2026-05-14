"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
import Drawer from "@/components/ui/Drawer";
import PendingFilesInput from "@/components/PendingFilesInput";
import DocumentUpload from "@/components/DocumentUpload";
import { uploadPendingFiles } from "@/lib/uploadPending";

export const CONSTRUCTION_CATEGORIES = [
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
];

const CATEGORY_OPTIONS = CONSTRUCTION_CATEGORIES.map((c) => ({
  value: c,
  label: c.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
}));

const QUICK_CHIPS: { value: string; label: string }[] = [
  { value: "materials", label: "Materials" },
  { value: "labor", label: "Labor" },
  { value: "permits", label: "Permits" },
  { value: "framing", label: "Framing" },
  { value: "electrical", label: "Electrical" },
  { value: "plumbing", label: "Plumbing" },
];

type EditInitial = {
  id: string;
  expense_date: string;
  amount: number;
  category: string;
  description: string;
  vendor: string;
  notes: string;
};

type Props = {
  projectId: string;
  open: boolean;
  onClose: () => void;
  mode?: "create" | "edit";
  initial?: EditInitial;
  vendorSuggestions?: string[];
};

function emptyDefaults(projectId: string): ConstructionExpenseValues {
  return {
    project_id: projectId,
    expense_date: format(new Date(), "yyyy-MM-dd"),
    amount: undefined,
    category: "materials",
    description: "",
    vendor: "",
    notes: "",
  };
}

export default function ConstructionExpenseForm({
  projectId,
  open,
  onClose,
  mode = "create",
  initial,
  vendorSuggestions = [],
}: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [addAnother, setAddAnother] = useState(false);
  const vendorListId = useId();
  const amountRef = useRef<HTMLInputElement | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ConstructionExpenseValues, any, ConstructionExpenseInput>({
    resolver: zodResolver(constructionExpenseSchema),
    defaultValues:
      mode === "edit" && initial
        ? {
            project_id: projectId,
            expense_date: initial.expense_date,
            amount: initial.amount,
            category: initial.category,
            description: initial.description,
            vendor: initial.vendor,
            notes: initial.notes,
          }
        : emptyDefaults(projectId),
  });

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && initial) {
      reset({
        project_id: projectId,
        expense_date: initial.expense_date,
        amount: initial.amount,
        category: initial.category,
        description: initial.description,
        vendor: initial.vendor,
        notes: initial.notes,
      });
    } else {
      reset(emptyDefaults(projectId));
      setPendingFiles([]);
    }
  }, [open, mode, initial, projectId, reset]);

  const selectedCategory = watch("category");
  const { ref: amountRegisterRef, ...amountRegister } = register("amount");

  async function onSubmit(values: ConstructionExpenseInput) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not authenticated");
      return;
    }

    const payload = {
      expense_date: values.expense_date,
      amount: values.amount,
      category: values.category,
      description: values.description,
      vendor: values.vendor || null,
      notes: values.notes || null,
    };

    if (mode === "edit" && initial) {
      const { error } = await supabase
        .from("construction_expenses")
        .update(payload)
        .eq("id", initial.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      if (pendingFiles.length > 0) {
        await uploadPendingFiles(
          supabase,
          user.id,
          initial.id,
          "construction_expense",
          pendingFiles
        );
      }
      toast.success("Expense updated");
      onClose();
      router.refresh();
      return;
    }

    const { data: created, error } = await supabase
      .from("construction_expenses")
      .insert({ owner_id: user.id, project_id: projectId, ...payload })
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
        ? `Expense logged with ${pendingFiles.length} file${pendingFiles.length === 1 ? "" : "s"}`
        : "Expense logged"
    );

    router.refresh();

    if (addAnother) {
      const today = format(new Date(), "yyyy-MM-dd");
      reset({
        ...emptyDefaults(projectId),
        expense_date: today,
        category: values.category,
        vendor: values.vendor || "",
      });
      setPendingFiles([]);
      setTimeout(() => amountRef.current?.focus(), 50);
    } else {
      onClose();
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={mode === "edit" ? "Edit build expense" : "Log build expense"}
      subtitle={
        mode === "edit"
          ? "Update this construction cost"
          : "Track materials, labor, permits, and more"
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full" noValidate>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <div className="text-xs font-medium text-stone-600 mb-1.5">Quick category</div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_CHIPS.map((chip) => {
                const active = selectedCategory === chip.value;
                return (
                  <button
                    key={chip.value}
                    type="button"
                    onClick={() =>
                      setValue("category", chip.value, { shouldValidate: true })
                    }
                    className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                      active
                        ? "bg-teal-700 text-white border-teal-700"
                        : "bg-white border-stone-200 text-stone-700 hover:border-teal-400 hover:bg-stone-50"
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
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
              placeholder="0.00"
              required
              error={errors.amount?.message}
              {...amountRegister}
              ref={(el) => {
                amountRegisterRef(el);
                amountRef.current = el;
              }}
            />
          </div>

          <Select
            label="Category"
            required
            options={CATEGORY_OPTIONS}
            error={errors.category?.message}
            {...register("category")}
          />

          <Input
            label="Description"
            required
            placeholder="e.g. 2x4 lumber for second floor framing"
            error={errors.description?.message}
            {...register("description")}
          />

          <Input
            label="Vendor"
            list={vendorSuggestions.length > 0 ? vendorListId : undefined}
            placeholder="e.g. Home Depot"
            error={errors.vendor?.message}
            {...register("vendor")}
          />
          {vendorSuggestions.length > 0 && (
            <datalist id={vendorListId}>
              {vendorSuggestions.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
          )}

          <Textarea label="Notes" rows={2} error={errors.notes?.message} {...register("notes")} />

          {mode === "edit" && initial ? (
            <DocumentUpload constructionExpenseId={initial.id} />
          ) : (
            <PendingFilesInput
              files={pendingFiles}
              onChange={setPendingFiles}
              label="Receipt / photo"
              hint="Attach invoice, receipt, or progress photo. Max 10 MB each."
            />
          )}
        </div>

        <footer className="border-t border-stone-200 px-5 py-3 bg-stone-50 flex flex-col-reverse sm:flex-row sm:items-center gap-2">
          {mode === "create" && (
            <label className="inline-flex items-center gap-2 text-xs text-stone-600 mr-auto select-none">
              <input
                type="checkbox"
                checked={addAnother}
                onChange={(e) => setAddAnother(e.target.checked)}
                className="rounded border-stone-300"
              />
              Add another after saving
            </label>
          )}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center px-3 py-1.5 text-sm border border-stone-200 bg-white rounded-md hover:bg-stone-100"
          >
            Cancel
          </button>
          <Button type="submit" loading={isSubmitting}>
            {mode === "edit"
              ? "Save changes"
              : addAnother
                ? "Save & add another"
                : "Save expense"}
          </Button>
        </footer>
      </form>
    </Drawer>
  );
}
