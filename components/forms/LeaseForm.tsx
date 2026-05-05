"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { format, addYears } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { leaseSchema, type LeaseInput, type LeaseValues } from "@/lib/schemas";
import { Input, Select, Textarea } from "@/components/ui/FormField";
import Button from "@/components/ui/Button";

export default function LeaseForm() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();
  const [tenants, setTenants] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);

  const today = format(new Date(), "yyyy-MM-dd");
  const oneYear = format(addYears(new Date(), 1), "yyyy-MM-dd");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LeaseValues, any, LeaseInput>({
    resolver: zodResolver(leaseSchema),
    defaultValues: {
      tenant_id: params?.get("tenant_id") ?? "",
      unit_id: params?.get("unit_id") ?? "",
      start_date: today,
      end_date: oneYear,
      monthly_rent: undefined,
      security_deposit: undefined,
      rent_due_day: 1,
      notes: "",
    },
  });

  useEffect(() => {
    supabase
      .from("tenants")
      .select("id, full_name")
      .order("full_name", { ascending: true })
      .then(({ data }) => setTenants(data || []));
    supabase
      .from("units")
      .select("id, unit_label, status, properties(name)")
      .eq("status", "vacant")
      .then(({ data }) => setUnits(data || []));
  }, []);

  async function onSubmit(values: LeaseInput) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not authenticated");
      return;
    }

    const { error } = await supabase.from("leases").insert({
      owner_id: user.id,
      tenant_id: values.tenant_id,
      unit_id: values.unit_id,
      start_date: values.start_date,
      end_date: values.end_date,
      monthly_rent: values.monthly_rent,
      security_deposit: values.security_deposit ?? null,
      rent_due_day: values.rent_due_day ?? 1,
      notes: values.notes || null,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    await supabase.from("units").update({ status: "occupied" }).eq("id", values.unit_id);

    toast.success("Lease created");
    const tenantId = values.tenant_id;
    router.push(`/tenants/${tenantId}`);
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="bg-white border border-stone-200 rounded-xl p-5 sm:p-6 space-y-4"
      noValidate
    >
      {tenants.length === 0 && (
        <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-900">
          No tenants yet.{" "}
          <Link href="/tenants/new" className="underline font-medium">
            Add a tenant first
          </Link>
          .
        </div>
      )}

      {units.length === 0 && (
        <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-900">
          No vacant units available.{" "}
          <Link href="/properties/new" className="underline font-medium">
            Add a property
          </Link>{" "}
          or end an existing lease first.
        </div>
      )}

      <Select label="Tenant" required error={errors.tenant_id?.message} {...register("tenant_id")}>
        <option value="">Select tenant</option>
        {tenants.map((t: any) => (
          <option key={t.id} value={t.id}>
            {t.full_name}
          </option>
        ))}
      </Select>

      <Select label="Unit" required error={errors.unit_id?.message} {...register("unit_id")}>
        <option value="">Select vacant unit</option>
        {units.map((u: any) => (
          <option key={u.id} value={u.id}>
            {u.properties?.name} — {u.unit_label}
          </option>
        ))}
      </Select>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          label="Start date"
          type="date"
          required
          error={errors.start_date?.message}
          {...register("start_date")}
        />
        <Input
          label="End date"
          type="date"
          required
          error={errors.end_date?.message}
          {...register("end_date")}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Input
          label="Monthly rent"
          type="number"
          step="0.01"
          inputMode="decimal"
          required
          error={errors.monthly_rent?.message}
          {...register("monthly_rent")}
        />
        <Input
          label="Security deposit"
          type="number"
          step="0.01"
          inputMode="decimal"
          error={errors.security_deposit?.message}
          {...register("security_deposit")}
        />
        <Input
          label="Due day (1-31)"
          type="number"
          inputMode="numeric"
          error={errors.rent_due_day?.message}
          {...register("rent_due_day")}
        />
      </div>

      <Textarea label="Notes" rows={2} error={errors.notes?.message} {...register("notes")} />

      <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
        <Link
          href="/tenants"
          className="inline-flex items-center justify-center px-4 py-2 text-sm border border-stone-200 rounded-md hover:bg-stone-50"
        >
          Cancel
        </Link>
        <Button type="submit" loading={isSubmitting} size="lg">
          Create lease
        </Button>
      </div>
    </form>
  );
}
