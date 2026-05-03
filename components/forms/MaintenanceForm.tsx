"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { maintenanceSchema, type MaintenanceInput, type MaintenanceValues } from "@/lib/schemas";
import { Input, Select, Textarea } from "@/components/ui/FormField";
import Button from "@/components/ui/Button";

const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const STATUSES = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

type Props = {
  mode: "create" | "edit";
  requestId?: string;
  initial?: Partial<MaintenanceValues>;
};

export default function MaintenanceForm({ mode, requestId, initial }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [properties, setProperties] = useState<any[]>([]);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<MaintenanceValues, any, MaintenanceInput>({
    resolver: zodResolver(maintenanceSchema),
    defaultValues: {
      property_id: initial?.property_id ?? "",
      title: initial?.title ?? "",
      description: initial?.description ?? "",
      priority: (initial?.priority as any) ?? "medium",
      status: (initial?.status as any) ?? "open",
      reported_date: initial?.reported_date ?? format(new Date(), "yyyy-MM-dd"),
      completed_date: initial?.completed_date ?? "",
      contractor: initial?.contractor ?? "",
      cost: initial?.cost,
      notes: initial?.notes ?? "",
    },
  });

  const status = watch("status");

  useEffect(() => {
    supabase
      .from("properties")
      .select("id, name")
      .order("name")
      .then(({ data }) => setProperties(data || []));
  }, []);

  async function onSubmit(values: MaintenanceInput) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not authenticated");
      return;
    }

    const completedDate =
      values.status === "completed"
        ? values.completed_date || format(new Date(), "yyyy-MM-dd")
        : null;

    const payload = {
      property_id: values.property_id,
      title: values.title,
      description: values.description || null,
      priority: values.priority,
      status: values.status,
      reported_date: values.reported_date,
      completed_date: completedDate,
      contractor: values.contractor || null,
      cost: values.cost ?? null,
      notes: values.notes || null,
    };

    if (mode === "create") {
      const { error } = await supabase
        .from("maintenance_requests")
        .insert({ owner_id: user.id, ...payload });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Maintenance request created");
    } else {
      const { error } = await supabase
        .from("maintenance_requests")
        .update(payload)
        .eq("id", requestId!);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Maintenance updated");
    }

    router.push("/maintenance");
    router.refresh();
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

      <Input
        label="Issue title"
        required
        placeholder="Leaky faucet in kitchen"
        error={errors.title?.message}
        {...register("title")}
      />

      <Textarea
        label="Description"
        rows={3}
        error={errors.description?.message}
        {...register("description")}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Select
          label="Priority"
          required
          options={PRIORITIES}
          error={errors.priority?.message}
          {...register("priority")}
        />
        <Select
          label="Status"
          required
          options={STATUSES}
          error={errors.status?.message}
          {...register("status")}
        />
        <Input
          label="Reported"
          type="date"
          required
          error={errors.reported_date?.message}
          {...register("reported_date")}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Input
          label="Contractor"
          error={errors.contractor?.message}
          {...register("contractor")}
        />
        <Input
          label="Cost"
          type="number"
          step="0.01"
          inputMode="decimal"
          error={errors.cost?.message}
          {...register("cost")}
        />
        {status === "completed" && (
          <Input
            label="Completed"
            type="date"
            error={errors.completed_date?.message}
            {...register("completed_date")}
          />
        )}
      </div>

      {mode === "edit" && (
        <Textarea label="Notes" rows={2} error={errors.notes?.message} {...register("notes")} />
      )}

      <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
        <Link
          href="/maintenance"
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
