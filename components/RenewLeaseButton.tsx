"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { addYears, format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/FormField";
import Button from "@/components/ui/Button";
import { parseDbDate } from "@/lib/dates";

type Lease = {
  id: string;
  unit_id: string;
  tenant_id: string;
  end_date: string;
  monthly_rent: number;
  security_deposit: number | null;
  rent_due_day: number;
};

const renewSchema = z
  .object({
    start_date: z.string().min(1, "Start required"),
    end_date: z.string().min(1, "End required"),
    monthly_rent: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
      z.number().positive("Must be positive")
    ),
  })
  .refine((d) => d.end_date >= d.start_date, {
    message: "End must be after start",
    path: ["end_date"],
  });
type RenewValues = z.input<typeof renewSchema>;
type RenewInput = z.output<typeof renewSchema>;

export default function RenewLeaseButton({ lease }: { lease: Lease }) {
  const supabase = createClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const startDate = format(parseDbDate(lease.end_date), "yyyy-MM-dd");
  const endDate = format(addYears(parseDbDate(lease.end_date), 1), "yyyy-MM-dd");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RenewValues, any, RenewInput>({
    resolver: zodResolver(renewSchema),
    defaultValues: {
      start_date: startDate,
      end_date: endDate,
      monthly_rent: Number(lease.monthly_rent),
    },
  });

  async function onSubmit(values: RenewInput) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const [_oldUpdate, newInsert] = await Promise.all([
      supabase.from("leases").update({ status: "expired" }).eq("id", lease.id),
      supabase
        .from("leases")
        .insert({
          owner_id: user.id,
          unit_id: lease.unit_id,
          tenant_id: lease.tenant_id,
          start_date: values.start_date,
          end_date: values.end_date,
          monthly_rent: values.monthly_rent,
          security_deposit: lease.security_deposit,
          rent_due_day: lease.rent_due_day,
          status: "active",
        }),
    ]);

    if (newInsert.error) {
      toast.error(newInsert.error.message);
      return;
    }
    toast.success("Lease renewed");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button variant="secondary" size="md" onClick={() => setOpen(true)}>
        <RefreshCw className="w-3.5 h-3.5" />
        Renew lease
      </Button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-5">
            <h3 className="font-medium text-stone-900 mb-1">Renew lease</h3>
            <p className="text-sm text-stone-500 mb-4">
              The current lease will be marked expired and a new one created starting on the
              date below.
            </p>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="New start"
                  type="date"
                  error={errors.start_date?.message}
                  {...register("start_date")}
                />
                <Input
                  label="New end"
                  type="date"
                  error={errors.end_date?.message}
                  {...register("end_date")}
                />
              </div>
              <Input
                label="Monthly rent"
                type="number"
                step="0.01"
                error={errors.monthly_rent?.message}
                hint="Adjust if you're raising rent"
                {...register("monthly_rent")}
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" type="button" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" loading={isSubmitting}>
                  Create renewal
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
