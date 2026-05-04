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
  distributionSchema,
  type DistributionInput,
  type DistributionValues,
} from "@/lib/schemas";
import { Input, Select, Textarea } from "@/components/ui/FormField";
import Button from "@/components/ui/Button";

const METHODS = [
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "check", label: "Check" },
  { value: "cash", label: "Cash" },
  { value: "venmo", label: "Venmo" },
  { value: "zelle", label: "Zelle" },
  { value: "other", label: "Other" },
];

type Props = {
  mode: "create" | "edit";
  distributionId?: string;
  initial?: Partial<DistributionValues>;
};

export default function DistributionForm({ mode, distributionId, initial }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [properties, setProperties] = useState<any[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DistributionValues, any, DistributionInput>({
    resolver: zodResolver(distributionSchema),
    defaultValues: {
      property_id: initial?.property_id ?? "",
      distribution_date: initial?.distribution_date ?? format(new Date(), "yyyy-MM-dd"),
      amount: initial?.amount,
      destination: initial?.destination ?? "",
      payment_method: initial?.payment_method ?? "bank_transfer",
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

  async function onSubmit(values: DistributionInput) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not authenticated");
      return;
    }

    const payload = {
      property_id: values.property_id || null,
      distribution_date: values.distribution_date,
      amount: values.amount,
      destination: values.destination,
      payment_method: values.payment_method || null,
      notes: values.notes || null,
    };

    if (mode === "create") {
      const { error } = await supabase
        .from("distributions")
        .insert({ owner_id: user.id, ...payload });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Distribution recorded");
    } else {
      const { error } = await supabase
        .from("distributions")
        .update(payload)
        .eq("id", distributionId!);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Distribution updated");
    }

    router.push("/distributions");
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="bg-white border border-stone-200 rounded-xl p-5 sm:p-6 space-y-4"
      noValidate
    >
      <Select
        label="From property"
        hint="Leave blank if not tied to a specific property"
        error={errors.property_id?.message}
        {...register("property_id")}
      >
        <option value="">— General (no property) —</option>
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
          error={errors.distribution_date?.message}
          {...register("distribution_date")}
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
        label="Destination"
        required
        placeholder="e.g. Vape store investment, Personal account"
        hint="Where the money is going"
        error={errors.destination?.message}
        {...register("destination")}
      />

      <Select
        label="Method"
        options={METHODS}
        error={errors.payment_method?.message}
        {...register("payment_method")}
      />

      <Textarea label="Notes" rows={2} error={errors.notes?.message} {...register("notes")} />

      <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
        <Link
          href="/distributions"
          className="inline-flex items-center justify-center px-4 py-2 text-sm border border-stone-200 rounded-md hover:bg-stone-50"
        >
          Cancel
        </Link>
        <Button type="submit" loading={isSubmitting} size="lg">
          {mode === "create" ? "Record distribution" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
