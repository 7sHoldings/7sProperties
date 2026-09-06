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
import { PAYMENT_TYPE_MIGRATION, writePaymentRow } from "@/lib/payments";

const TYPES = [
  { value: "rent", label: "Rent" },
  { value: "deposit", label: "Security deposit" },
];

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
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PaymentValues, any, PaymentInput>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      lease_id: initial?.lease_id ?? params?.get("lease_id") ?? "",
      payment_type: initial?.payment_type ?? (params?.get("type") === "deposit" ? "deposit" : "rent"),
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
      .select(
        "id, monthly_rent, security_deposit, status, tenants(full_name), units(unit_label, properties(name))"
      )
      .order("status", { ascending: true })
      .then(({ data }) => {
        setLeases(data || []);
        setLeasesLoaded(true);
      });
  }, []);

  const paymentType = watch("payment_type");
  const selectedLeaseId = watch("lease_id");
  const isDeposit = paymentType === "deposit";
  const selectedLease = leases.find((l: any) => l.id === selectedLeaseId);
  const leaseDeposit = Number(selectedLease?.security_deposit) || 0;

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
    // payment_type only goes on the row when the column exists. A rent payment
    // falls back to the pre-v13 shape; a deposit never silently saves as rent.
    const withTypeField = (withType: boolean) =>
      withType ? { ...payload, payment_type: values.payment_type } : payload;
    const migrationHint = `Deposits need the ${PAYMENT_TYPE_MIGRATION} migration — run it in the Supabase SQL Editor, then save again.`;

    if (mode === "create") {
      const {
        data: created,
        error,
        missingColumn,
      } = await writePaymentRow(
        (withType) =>
          supabase
            .from("payments")
            .insert({ owner_id: user.id, ...withTypeField(withType) })
            .select()
            .single(),
        values.payment_type
      );
      if (error) {
        toast.error(missingColumn ? migrationHint : error.message);
        return;
      }

      if (pendingFiles.length > 0) {
        await uploadPendingFiles(supabase, user.id, created.id, "payment", pendingFiles);
      }

      const noun = values.payment_type === "deposit" ? "Deposit" : "Payment";
      toast.success(
        pendingFiles.length > 0
          ? `${noun} recorded with ${pendingFiles.length} file${pendingFiles.length === 1 ? "" : "s"}`
          : `${noun} recorded`
      );
      router.push("/payments");
      router.refresh();
      return;
    }

    const { error, missingColumn } = await writePaymentRow(
      (withType) =>
        supabase.from("payments").update(withTypeField(withType)).eq("id", paymentId!).select().single(),
      values.payment_type
    );
    if (error) {
      toast.error(missingColumn ? migrationHint : error.message);
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
      <Select
        label="Payment type"
        required
        options={TYPES}
        hint={
          isDeposit
            ? "Security deposits are held for the tenant — they are tracked separately from rent and left out of income totals."
            : "Regular monthly rent. Counts toward rent collection and income."
        }
        error={errors.payment_type?.message}
        {...register("payment_type")}
      />

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
          hint={
            isDeposit
              ? "Which month to file this deposit under"
              : "Which rent month this payment covers"
          }
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
        hint={
          isDeposit && leaseDeposit > 0
            ? `Deposit on this lease: $${leaseDeposit.toLocaleString()}`
            : !isDeposit && selectedLease
              ? `Monthly rent: $${Number(selectedLease.monthly_rent).toLocaleString()}`
              : undefined
        }
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
          label={isDeposit ? "Deposit proof / check images" : "Payment proof / check images"}
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
          {mode === "create" ? (isDeposit ? "Save deposit" : "Save payment") : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
