"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { mileageSchema, type MileageInput, type MileageValues } from "@/lib/schemas";
import { Input, Select, Textarea } from "@/components/ui/FormField";
import Button from "@/components/ui/Button";

type Props = {
  mode: "create" | "edit";
  mileageId?: string;
  initial?: Partial<MileageValues>;
};

export default function MileageForm({ mode, mileageId, initial }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [properties, setProperties] = useState<any[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<MileageValues, any, MileageInput>({
    resolver: zodResolver(mileageSchema),
    defaultValues: {
      property_id: initial?.property_id ?? "",
      trip_date: initial?.trip_date ?? format(new Date(), "yyyy-MM-dd"),
      miles: initial?.miles,
      purpose: initial?.purpose ?? "",
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

  async function onSubmit(values: MileageInput) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const payload = {
      property_id: values.property_id || null,
      trip_date: values.trip_date,
      miles: values.miles,
      purpose: values.purpose,
      notes: values.notes || null,
    };

    if (mode === "create") {
      const { error } = await supabase.from("mileage_logs").insert({ owner_id: user.id, ...payload });
      if (error) return toast.error(error.message);
      toast.success("Trip logged");
    } else {
      const { error } = await supabase.from("mileage_logs").update(payload).eq("id", mileageId!);
      if (error) return toast.error(error.message);
      toast.success("Trip updated");
    }
    router.push("/mileage");
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="bg-white border border-stone-200 rounded-xl p-5 sm:p-6 space-y-4"
      noValidate
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          label="Date"
          type="date"
          required
          error={errors.trip_date?.message}
          {...register("trip_date")}
        />
        <Input
          label="Miles"
          type="number"
          step="0.1"
          inputMode="decimal"
          required
          hint="Round trip"
          error={errors.miles?.message}
          {...register("miles")}
        />
      </div>

      <Select
        label="Property"
        hint="Optional — leave blank for general business mileage"
        error={errors.property_id?.message}
        {...register("property_id")}
      >
        <option value="">— No specific property —</option>
        {properties.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </Select>

      <Input
        label="Purpose"
        required
        placeholder="e.g. Property inspection, contractor meeting"
        error={errors.purpose?.message}
        {...register("purpose")}
      />
      <Textarea label="Notes" rows={2} error={errors.notes?.message} {...register("notes")} />

      <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
        <Link
          href="/mileage"
          className="inline-flex items-center justify-center px-4 py-2 text-sm border border-stone-200 rounded-md hover:bg-stone-50"
        >
          Cancel
        </Link>
        <Button type="submit" loading={isSubmitting} size="lg">
          {mode === "create" ? "Save trip" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
