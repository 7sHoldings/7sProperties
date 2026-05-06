"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { paymentSchema, type PaymentInput, type PaymentValues } from "@/lib/schemas";
import { Input, Select, Textarea } from "@/components/ui/FormField";
import Button from "@/components/ui/Button";
import PendingFilesInput from "@/components/PendingFilesInput";
import { uploadPendingFiles } from "@/lib/uploadPending";

const METHODS = [
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "check", label: "Check" },
  { value: "cash", label: "Cash" },
  { value: "venmo", label: "Venmo" },
  { value: "zelle", label: "Zelle" },
  { value: "paypal", label: "PayPal" },
  { value: "other", label: "Other" },
];

type Props = {
  mode: "create" | "edit";
  paymentId?: string;
  initial?: Partial<PaymentValues>;
};

export default function PaymentForm({ mode, paymentId, initial }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();
  const [leases, setLeases] = useState<any[]>([]);
  const [leasesLoaded, setLeasesLoaded] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const today = format(new Date(), "yyyy-MM-dd");
  const thisMonth = format(new Date(), "yyyy-MM");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PaymentValues, any, PaymentInput>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      lease_id: initial?.lease_id ?? params?.get("lease_id") ?? "",
      payment_date: initial?.payment_date ?? today,
      for_month: initial?.for_month ? String(initial.for_month).slice(0, 7) : thisMonth,
      amount: initial?.amount,
      payment_method: initial?.payment_method ?? "bank_transfer",
      reference_number: initial?.reference_number ?? "",
      notes: initial?.notes ?? "",
    },
  });

  useEffect(() => {
    supabase
      .from("leases")
      .select("id, monthly_rent, status, tenants(full_name), units(unit_label, properties(name))")
      .order("status", { ascending: true })
      .then(({ data }) => {
        setLeases(data || []);
        setLeasesLoaded(true);
      });
  }, []);

  async function onSubmit(values: PaymentInput) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not authenticated");
      return;
    }

    const payload = {
      lease_id: values.lease_id,
      payment_date: values.payment_date,
      for_month: `${values.for_month}-01`,
      amount: values.amount,
      payment_method: values.payment_method || null,
      reference_number: values.reference_number || null,
      notes: values.notes || null,
    };

    if (mode === "create") {
      const { data: created, error } = await supabase
        .from("payments")
        .insert({ owner_id: user.id, ...payload })
        .select()
        .single();
      if (error) {
        toast.error(error.message);
        return;
      }

      if (pendingFiles.length > 0) {
        await uploadPendingFiles(supabase, user.id, created.id, "payment", pendingFiles);
      }

      toast.success(
        pendingFiles.length > 0
          ? `Payment recorded with ${pendingFiles.length} file${pendingFiles.length === 1 ? "" : "s"}`
          : "Payment recorded"
      );
      router.push("/payments");
      router.refresh();
      return;
    }

    const { error } = await supabase.from("payments").update(payload).eq("id", paymentId!);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Payment updated");
    router.push("/payments");
    router.refresh();
  }

  if (mode === "create" && leasesLoaded && leases.length === 0) {
    return (
      <div className="bg-white border border-stone-200 rounded-xl p-6 text-center">
        <h2 className="text-lg font-medium mb-2">No active leases yet</h2>
        <p className="text-sm text-stone-600 mb-4">
          You need a lease (a tenant connected to a unit) before you can record a rent payment.
          Tenants and properties on their own aren&apos;t enough.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Link
            href="/leases/new"
            className="px-4 py-2 text-sm bg-teal-700 text-white rounded-md hover:bg-teal-800"
          >
            + Create a lease
          </Link>
          <Link
            href="/tenants"
            className="px-4 py-2 text-sm border border-stone-200 rounded-md hover:bg-stone-50"
          >
            Go to tenants
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="bg-white border border-stone-200 rounded-xl p-5 sm:p-6 space-y-4"
      noValidate
    >
      <Select label="Lease" required error={errors.lease_id?.message} {...register("lease_id")}>
        <option value="">Select tenant/property</option>
        {leases.map((l: any) => (
          <option key={l.id} value={l.id}>
            {l.tenants?.full_name} — {l.units?.properties?.name}
            {l.status !== "active" ? ` (${l.status})` : ""} ($
            {Number(l.monthly_rent).toLocaleString()}/mo)
          </option>
        ))}
      </Select>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          label="Payment date"
          type="date"
          required
          error={errors.payment_date?.message}
          {...register("payment_date")}
        />
        <Input
          label="For month"
          type="month"
          required
          hint="Which rent month this payment covers"
          error={errors.for_month?.message}
          {...register("for_month")}
        />
      </div>

      <Input
        label="Amount"
        type="number"
        step="0.01"
        inputMode="decimal"
        required
        error={errors.amount?.message}
        {...register("amount")}
      />

      <Select label="Method" options={METHODS} {...register("payment_method")} />

      <Input
        label="Reference / check #"
        error={errors.reference_number?.message}
        {...register("reference_number")}
      />
      <Textarea label="Notes" rows={2} error={errors.notes?.message} {...register("notes")} />

      {mode === "create" && (
        <PendingFilesInput
          files={pendingFiles}
          onChange={setPendingFiles}
          label="Payment proof / check images"
          hint="Attach screenshots, check photos, or ACH confirmations. Max 10 MB each."
        />
      )}

      <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
        <Link
          href="/payments"
          className="inline-flex items-center justify-center px-4 py-2 text-sm border border-stone-200 rounded-md hover:bg-stone-50"
        >
          Cancel
        </Link>
        <Button type="submit" loading={isSubmitting} size="lg">
          {mode === "create" ? "Save payment" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
