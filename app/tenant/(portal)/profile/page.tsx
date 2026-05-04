"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Input, Textarea } from "@/components/ui/FormField";
import Button from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";

const phoneRegex = /^[\d\s().+-]{7,}$/;

const schema = z.object({
  full_name: z.string().trim().min(1, "Name is required").max(120),
  phone: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.string().regex(phoneRegex, "Invalid phone number").optional()
  ),
  emergency_contact_name: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.string().optional()
  ),
  emergency_contact_phone: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.string().regex(phoneRegex, "Invalid phone number").optional()
  ),
  notes: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.string().optional()
  ),
});
type Values = z.input<typeof schema>;
type Output = z.output<typeof schema>;

export default function TenantProfilePage() {
  const supabase = createClient();
  const [tenant, setTenant] = useState<any | null>(null);
  const [userEmail, setUserEmail] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<Values, any, Output>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserEmail(user.email || "");

      const { data } = await supabase
        .from("tenants")
        .select("id, full_name, email, phone, emergency_contact_name, emergency_contact_phone, notes")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (data) {
        setTenant(data);
        reset({
          full_name: data.full_name || "",
          phone: data.phone || "",
          emergency_contact_name: data.emergency_contact_name || "",
          emergency_contact_phone: data.emergency_contact_phone || "",
          notes: data.notes || "",
        });
      }
    })();
  }, []);

  async function onSubmit(values: Output) {
    if (!tenant) return;
    const { error } = await supabase
      .from("tenants")
      .update({
        full_name: values.full_name,
        phone: values.phone || null,
        emergency_contact_name: values.emergency_contact_name || null,
        emergency_contact_phone: values.emergency_contact_phone || null,
        notes: values.notes || null,
      })
      .eq("id", tenant.id);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Profile updated");
    reset(values);
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-medium">Profile</h1>
        <p className="text-sm text-stone-500">Update your contact info</p>
      </div>

      {!tenant ? (
        <div className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : (
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="bg-white border border-stone-200 rounded-xl p-5 sm:p-6 space-y-4"
          noValidate
        >
          <Input
            label="Full name"
            required
            error={errors.full_name?.message}
            {...register("full_name")}
          />

          <div>
            <label className="block text-sm text-stone-700 mb-1 font-medium">Email</label>
            <input
              type="email"
              value={userEmail}
              disabled
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-md bg-stone-50 text-stone-500"
            />
            <p className="text-xs text-stone-500 mt-1">
              Email is your sign-in identifier and can't be changed here.
            </p>
          </div>

          <Input
            label="Phone"
            type="tel"
            inputMode="tel"
            error={errors.phone?.message}
            {...register("phone")}
          />

          <div className="pt-3 border-t border-stone-100">
            <h2 className="text-sm font-medium text-stone-700 mb-3">Emergency contact</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Name"
                error={errors.emergency_contact_name?.message}
                {...register("emergency_contact_name")}
              />
              <Input
                label="Phone"
                type="tel"
                inputMode="tel"
                error={errors.emergency_contact_phone?.message}
                {...register("emergency_contact_phone")}
              />
            </div>
          </div>

          <Textarea label="Notes" rows={3} error={errors.notes?.message} {...register("notes")} />

          <div className="flex justify-end pt-2">
            <Button type="submit" loading={isSubmitting} disabled={!isDirty} size="lg">
              Save changes
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
