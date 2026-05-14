"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { tenantSchema, type TenantInput, type TenantValues } from "@/lib/schemas";
import { Input, Select, Textarea } from "@/components/ui/FormField";
import Button from "@/components/ui/Button";
import PendingFilesInput from "@/components/PendingFilesInput";
import { uploadPendingFiles, type PendingFile } from "@/lib/uploadPending";

type Props = {
  mode: "create" | "edit";
  tenantId?: string;
  initial?: Partial<TenantValues>;
};

export default function TenantForm({ mode, tenantId, initial }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [units, setUnits] = useState<any[]>([]);
  const [agreementFiles, setAgreementFiles] = useState<File[]>([]);
  const [idFiles, setIdFiles] = useState<File[]>([]);
  const [paystubFiles, setPaystubFiles] = useState<File[]>([]);
  const [otherFiles, setOtherFiles] = useState<File[]>([]);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<TenantValues, any, TenantInput>({
    resolver: zodResolver(tenantSchema),
    defaultValues: {
      full_name: initial?.full_name ?? "",
      email: initial?.email ?? "",
      phone: initial?.phone ?? "",
      emergency_contact_name: initial?.emergency_contact_name ?? "",
      emergency_contact_phone: initial?.emergency_contact_phone ?? "",
      notes: initial?.notes ?? "",
      unit_id: "",
      start_date: "",
      end_date: "",
      rent_due_day: 1,
    },
  });

  const watchUnit = watch("unit_id");

  useEffect(() => {
    if (mode !== "create") return;
    supabase
      .from("units")
      .select("id, unit_label, properties(name)")
      .eq("status", "vacant")
      .then(({ data }) => setUnits(data || []));
  }, [mode]);

  async function onSubmit(values: TenantInput) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not authenticated");
      return;
    }

    if (mode === "create") {
      const { data: tenant, error } = await supabase
        .from("tenants")
        .insert({
          owner_id: user.id,
          full_name: values.full_name,
          email: values.email || null,
          phone: values.phone || null,
          emergency_contact_name: values.emergency_contact_name || null,
          emergency_contact_phone: values.emergency_contact_phone || null,
          notes: values.notes || null,
        })
        .select()
        .single();

      if (error || !tenant) {
        toast.error(error?.message || "Failed to create tenant");
        return;
      }

      let leaseId: string | null = null;
      if (values.unit_id) {
        const { data: lease } = await supabase
          .from("leases")
          .insert({
            owner_id: user.id,
            unit_id: values.unit_id,
            tenant_id: tenant.id,
            start_date: values.start_date!,
            end_date: values.end_date!,
            monthly_rent: Number(values.monthly_rent),
            security_deposit: values.security_deposit ?? null,
            rent_due_day: values.rent_due_day ?? 1,
          })
          .select("id")
          .single();
        leaseId = lease?.id || null;
        await supabase.from("units").update({ status: "occupied" }).eq("id", values.unit_id);
      }

      // Upload tenant-level docs (ID, paystubs, other) against the tenant.
      // Upload the signed rental agreement against the lease if one was
      // created, otherwise fall back to the tenant.
      const tenantDocs: PendingFile[] = [
        ...idFiles.map((file) => ({ file, documentType: "id_document" })),
        ...paystubFiles.map((file) => ({ file, documentType: "paystub" })),
        ...otherFiles.map((file) => ({ file, documentType: "other" })),
      ];
      if (!leaseId) {
        tenantDocs.push(
          ...agreementFiles.map((file) => ({ file, documentType: "lease" }))
        );
      }
      if (tenantDocs.length > 0) {
        await uploadPendingFiles(supabase, user.id, tenant.id, "tenant", tenantDocs);
      }
      if (leaseId && agreementFiles.length > 0) {
        await uploadPendingFiles(
          supabase,
          user.id,
          leaseId,
          "lease",
          agreementFiles.map((file) => ({ file, documentType: "lease" }))
        );
      }

      const totalFiles =
        agreementFiles.length + idFiles.length + paystubFiles.length + otherFiles.length;
      toast.success(
        totalFiles > 0
          ? `Tenant added with ${totalFiles} file${totalFiles === 1 ? "" : "s"}`
          : "Tenant added"
      );
      router.push("/tenants");
      router.refresh();
    } else {
      const { error } = await supabase
        .from("tenants")
        .update({
          full_name: values.full_name,
          email: values.email || null,
          phone: values.phone || null,
          emergency_contact_name: values.emergency_contact_name || null,
          emergency_contact_phone: values.emergency_contact_phone || null,
          notes: values.notes || null,
        })
        .eq("id", tenantId!);

      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Tenant updated");
      router.push(`/tenants/${tenantId}`);
      router.refresh();
    }
  }

  const cancelHref = mode === "edit" && tenantId ? `/tenants/${tenantId}` : "/tenants";

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="bg-white border border-stone-200 rounded-xl p-5 sm:p-6 space-y-4"
      noValidate
    >
      <h2 className="text-sm font-medium text-stone-500">Tenant info</h2>
      <Input label="Full name" required error={errors.full_name?.message} {...register("full_name")} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          label="Email"
          type="email"
          inputMode="email"
          error={errors.email?.message}
          {...register("email")}
        />
        <Input
          label="Phone"
          type="tel"
          inputMode="tel"
          error={errors.phone?.message}
          {...register("phone")}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          label="Emergency contact name"
          error={errors.emergency_contact_name?.message}
          {...register("emergency_contact_name")}
        />
        <Input
          label="Emergency contact phone"
          type="tel"
          inputMode="tel"
          error={errors.emergency_contact_phone?.message}
          {...register("emergency_contact_phone")}
        />
      </div>

      {mode === "edit" && (
        <Textarea label="Notes" rows={3} error={errors.notes?.message} {...register("notes")} />
      )}

      {mode === "create" && (
        <>
          <h2 className="text-sm font-medium text-stone-500 pt-4 border-t border-stone-100">
            Lease (optional)
          </h2>
          <Select
            label="Assign to vacant unit"
            error={errors.unit_id?.message}
            {...register("unit_id")}
          >
            <option value="">No lease yet</option>
            {units.map((u: any) => (
              <option key={u.id} value={u.id}>
                {u.properties?.name} — {u.unit_label}
              </option>
            ))}
          </Select>

          {watchUnit && (
            <>
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
                  defaultValue={1}
                  error={errors.rent_due_day?.message}
                  {...register("rent_due_day")}
                />
              </div>
            </>
          )}

          <div className="pt-4 border-t border-stone-100 space-y-3">
            <div>
              <h2 className="text-sm font-medium text-stone-500">Onboarding documents</h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Optional. Attach now or upload later from the tenant page.
              </p>
            </div>
            <PendingFilesInput
              files={agreementFiles}
              onChange={setAgreementFiles}
              label="Signed rental agreement"
              hint="The lease the tenant signed. PDF or images."
            />
            <PendingFilesInput
              files={idFiles}
              onChange={setIdFiles}
              label="Government ID"
              hint="Driver's license, passport, or other photo ID."
            />
            <PendingFilesInput
              files={paystubFiles}
              onChange={setPaystubFiles}
              label="Paystubs / income proof"
              hint="Recent paystubs, tax forms, or employment letter."
            />
            <PendingFilesInput
              files={otherFiles}
              onChange={setOtherFiles}
              label="Other documents"
              hint="Rental application, references, anything else."
            />
          </div>
        </>
      )}

      <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
        <Link
          href={cancelHref}
          className="inline-flex items-center justify-center px-4 py-2 text-sm border border-stone-200 rounded-md hover:bg-stone-50"
        >
          Cancel
        </Link>
        <Button type="submit" loading={isSubmitting} size="lg">
          {mode === "create" ? "Save tenant" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
