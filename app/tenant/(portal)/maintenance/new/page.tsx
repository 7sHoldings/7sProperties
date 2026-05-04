"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { Input, Select, Textarea } from "@/components/ui/FormField";
import Button from "@/components/ui/Button";
import PendingFilesInput from "@/components/PendingFilesInput";
import { uploadPendingFiles } from "@/lib/uploadPending";

const schema = z.object({
  title: z.string().trim().min(1, "Briefly describe the issue").max(150),
  description: z.string().trim().min(1, "Add some detail to help diagnose").max(2000),
  priority: z.enum(["low", "medium", "high", "urgent"]),
});
type FormValues = z.infer<typeof schema>;

export default function TenantNewMaintenancePage() {
  const router = useRouter();
  const supabase = createClient();
  const [tenant, setTenant] = useState<any | null>(null);
  const [property, setProperty] = useState<any | null>(null);
  const [loadError, setLoadError] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { priority: "medium" },
  });

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: t } = await supabase
        .from("tenants")
        .select("id, full_name")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (!t) {
        setLoadError("No tenant record linked to your account.");
        return;
      }
      setTenant(t);

      const { data: lease } = await supabase
        .from("leases")
        .select("units(property_id, properties(name))")
        .eq("tenant_id", t.id)
        .eq("status", "active")
        .maybeSingle();

      const unit = (lease as any)?.units;
      if (!unit?.property_id) {
        setLoadError("You don't have an active lease, so you can't submit a request right now.");
        return;
      }
      setProperty({
        id: unit.property_id,
        name: unit.properties?.name,
      });
    })();
  }, []);

  async function onSubmit(values: FormValues) {
    if (!tenant || !property) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Note: owner_id should be the property's owner. We don't know that as a tenant
    // from the client directly, but RLS allows the property owner to be inferred via
    // the property. We'll set owner_id via a SECURITY DEFINER function fallback OR
    // we can read property.owner_id from a view. Simpler: query properties first.
    const { data: prop } = await supabase
      .from("properties")
      .select("id")
      .eq("id", property.id)
      .maybeSingle();

    if (!prop) {
      toast.error("Property not found");
      return;
    }

    // owner_id is required by schema. Tenants can't read other users so we need to
    // get it from the property row through RLS (tenant can SELECT properties they
    // lease, but properties.owner_id is exposed). Re-query with owner_id:
    const { data: propWithOwner } = await supabase
      .from("properties")
      .select("id, owner_id")
      .eq("id", property.id)
      .maybeSingle();

    if (!propWithOwner?.owner_id) {
      toast.error("Could not resolve property owner");
      return;
    }

    const { error } = await supabase.from("maintenance_requests").insert({
      owner_id: propWithOwner.owner_id,
      property_id: property.id,
      tenant_id: tenant.id,
      title: values.title,
      description: values.description,
      priority: values.priority,
      status: "open",
      reported_date: format(new Date(), "yyyy-MM-dd"),
      submitted_by_tenant: true,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    if (pendingFiles.length > 0) {
      // Photos go in storage tied to the property (RLS allows tenant doc inserts via tenant_id)
      // We store them with tenant_id link for the tenant to retain ability to view them
      const userId = user.id;
      for (const file of pendingFiles) {
        const path = `${userId}/maintenance/${property.id}/${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage.from("documents").upload(path, file);
        if (upErr) continue;
        await supabase.from("documents").insert({
          owner_id: propWithOwner.owner_id,
          property_id: property.id,
          tenant_id: tenant.id,
          document_type: "photo",
          file_name: file.name,
          file_path: path,
          file_size: file.size,
          mime_type: file.type,
        });
      }
    }

    toast.success(
      pendingFiles.length > 0
        ? `Request submitted with ${pendingFiles.length} photo${pendingFiles.length === 1 ? "" : "s"}`
        : "Request submitted"
    );
    router.push("/tenant/maintenance");
    router.refresh();
  }

  return (
    <div className="p-4 sm:p-6 max-w-xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-stone-500 mb-4">
        <Link href="/tenant/maintenance" className="hover:underline">
          Maintenance
        </Link>
        <span>›</span>
        <span className="text-stone-900">New request</span>
      </div>
      <h1 className="text-2xl font-medium mb-6">Submit a maintenance request</h1>

      {loadError ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          {loadError}
        </div>
      ) : !property ? (
        <div className="text-sm text-stone-500">Loading...</div>
      ) : (
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="bg-white border border-stone-200 rounded-xl p-5 sm:p-6 space-y-4"
          noValidate
        >
          <div className="text-sm text-stone-600 bg-stone-50 border border-stone-100 rounded-md px-3 py-2">
            For: <span className="font-medium text-stone-900">{property.name}</span>
          </div>

          <Input
            label="Issue title"
            required
            placeholder="e.g. Leaking kitchen faucet"
            error={errors.title?.message}
            {...register("title")}
          />
          <Textarea
            label="Describe the issue"
            rows={5}
            required
            placeholder="When did it start? What's affected? Any photos to share, mention so we can request them."
            error={errors.description?.message}
            {...register("description")}
          />
          <Select
            label="Priority"
            required
            options={[
              { value: "low", label: "Low — not urgent" },
              { value: "medium", label: "Medium" },
              { value: "high", label: "High — affecting daily use" },
              { value: "urgent", label: "Urgent — safety / can't be delayed" },
            ]}
            error={errors.priority?.message}
            {...register("priority")}
          />

          <PendingFilesInput
            files={pendingFiles}
            onChange={setPendingFiles}
            label="Photos"
            hint="Pictures help your owner diagnose the issue faster. Max 10 MB each."
          />

          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
            <Link
              href="/tenant/maintenance"
              className="inline-flex items-center justify-center px-4 py-2 text-sm border border-stone-200 rounded-md hover:bg-stone-50"
            >
              Cancel
            </Link>
            <Button type="submit" loading={isSubmitting} size="lg">
              Submit request
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
