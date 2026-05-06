"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  constructionProjectSchema,
  type ConstructionProjectInput,
  type ConstructionProjectValues,
} from "@/lib/schemas";
import { Input, Select, Textarea } from "@/components/ui/FormField";
import Button from "@/components/ui/Button";

const PROPERTY_TYPES = [
  { value: "", label: "—" },
  { value: "single_family", label: "Single family" },
  { value: "duplex", label: "Duplex" },
  { value: "triplex", label: "Triplex" },
  { value: "fourplex", label: "Fourplex" },
  { value: "condo", label: "Condo" },
  { value: "apartment", label: "Apartment" },
  { value: "townhouse", label: "Townhouse" },
  { value: "lot", label: "Lot / Land" },
  { value: "other", label: "Other" },
];

const STATUSES = [
  { value: "planning", label: "Planning" },
  { value: "in_progress", label: "In progress" },
  { value: "on_hold", label: "On hold" },
  { value: "completed", label: "Completed" },
];

type Props = {
  mode: "create" | "edit";
  projectId?: string;
  initial?: Partial<ConstructionProjectValues>;
};

export default function ConstructionProjectForm({ mode, projectId, initial }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ConstructionProjectValues, any, ConstructionProjectInput>({
    resolver: zodResolver(constructionProjectSchema),
    defaultValues: {
      name: initial?.name ?? "",
      address: initial?.address ?? "",
      city: initial?.city ?? "",
      state: initial?.state ?? "",
      zip: initial?.zip ?? "",
      property_type: initial?.property_type ?? "single_family",
      status: initial?.status ?? "planning",
      start_date: initial?.start_date ?? "",
      expected_completion_date: initial?.expected_completion_date ?? "",
      actual_completion_date: initial?.actual_completion_date ?? "",
      budget: initial?.budget,
      bedrooms: initial?.bedrooms,
      bathrooms: initial?.bathrooms,
      square_feet: initial?.square_feet,
      notes: initial?.notes ?? "",
    },
  });

  async function onSubmit(values: ConstructionProjectInput) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not authenticated");
      return;
    }

    const payload = {
      name: values.name,
      address: values.address || null,
      city: values.city || null,
      state: values.state || null,
      zip: values.zip || null,
      property_type: values.property_type || null,
      status: values.status,
      start_date: values.start_date || null,
      expected_completion_date: values.expected_completion_date || null,
      actual_completion_date: values.actual_completion_date || null,
      budget: values.budget ?? null,
      bedrooms: values.bedrooms ?? null,
      bathrooms: values.bathrooms ?? null,
      square_feet: values.square_feet ?? null,
      notes: values.notes || null,
    };

    if (mode === "create") {
      const { data: created, error } = await supabase
        .from("construction_projects")
        .insert({ owner_id: user.id, ...payload })
        .select()
        .single();
      if (error || !created) {
        toast.error(error?.message || "Failed to create project");
        return;
      }
      toast.success("Project created");
      router.push(`/construction/${created.id}`);
      router.refresh();
      return;
    }

    const { error } = await supabase
      .from("construction_projects")
      .update(payload)
      .eq("id", projectId!);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Project updated");
    router.push(`/construction/${projectId}`);
    router.refresh();
  }

  const cancelHref =
    mode === "edit" && projectId ? `/construction/${projectId}` : "/construction";

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="bg-white border border-stone-200 rounded-xl p-5 sm:p-6 space-y-4"
      noValidate
    >
      <Input
        label="Project name"
        required
        placeholder="Oak Ridge build"
        error={errors.name?.message}
        {...register("name")}
      />

      <Input
        label="Address"
        placeholder="123 Future Ln"
        error={errors.address?.message}
        {...register("address")}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Input label="City" error={errors.city?.message} {...register("city")} />
        <Input label="State" placeholder="TX" error={errors.state?.message} {...register("state")} />
        <Input label="ZIP" placeholder="12345" error={errors.zip?.message} {...register("zip")} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Select
          label="Property type"
          options={PROPERTY_TYPES}
          error={errors.property_type?.message}
          {...register("property_type")}
        />
        <Select
          label="Status"
          required
          options={STATUSES}
          error={errors.status?.message}
          {...register("status")}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Input
          label="Start date"
          type="date"
          error={errors.start_date?.message}
          {...register("start_date")}
        />
        <Input
          label="Expected completion"
          type="date"
          error={errors.expected_completion_date?.message}
          {...register("expected_completion_date")}
        />
        <Input
          label="Actual completion"
          type="date"
          error={errors.actual_completion_date?.message}
          {...register("actual_completion_date")}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          label="Budget"
          type="number"
          step="0.01"
          inputMode="decimal"
          error={errors.budget?.message}
          {...register("budget")}
        />
        <Input
          label="Square feet"
          type="number"
          inputMode="numeric"
          error={errors.square_feet?.message}
          {...register("square_feet")}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Bedrooms"
          type="number"
          inputMode="numeric"
          error={errors.bedrooms?.message}
          {...register("bedrooms")}
        />
        <Input
          label="Bathrooms"
          type="number"
          step="0.5"
          inputMode="decimal"
          error={errors.bathrooms?.message}
          {...register("bathrooms")}
        />
      </div>

      <Textarea label="Notes" rows={3} error={errors.notes?.message} {...register("notes")} />

      <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
        <Link
          href={cancelHref}
          className="inline-flex items-center justify-center px-4 py-2 text-sm border border-stone-200 rounded-md hover:bg-stone-50"
        >
          Cancel
        </Link>
        <Button type="submit" loading={isSubmitting} size="lg">
          {mode === "create" ? "Save project" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
