"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import TenantForm from "@/components/forms/TenantForm";
import { Skeleton } from "@/components/ui/Skeleton";

export default function EditTenantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const supabase = createClient();
  const [tenant, setTenant] = useState<any | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    supabase
      .from("tenants")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) setNotFound(true);
        else setTenant(data);
      });
  }, [id]);

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-stone-500 mb-4">
        <Link href="/tenants" className="hover:underline">
          Tenants
        </Link>
        <span>›</span>
        {tenant && (
          <>
            <Link href={`/tenants/${id}`} className="hover:underline">
              {tenant.full_name}
            </Link>
            <span>›</span>
          </>
        )}
        <span className="text-stone-900">Edit</span>
      </div>

      <h1 className="text-2xl font-medium mb-6">Edit tenant</h1>

      {notFound ? (
        <p className="text-stone-500">Tenant not found.</p>
      ) : !tenant ? (
        <div className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
          <Skeleton className="h-9 w-full" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
          </div>
          <Skeleton className="h-9 w-full" />
        </div>
      ) : (
        <TenantForm
          mode="edit"
          tenantId={id}
          initial={{
            full_name: tenant.full_name,
            email: tenant.email || "",
            phone: tenant.phone || "",
            emergency_contact_name: tenant.emergency_contact_name || "",
            emergency_contact_phone: tenant.emergency_contact_phone || "",
            notes: tenant.notes || "",
          }}
        />
      )}
    </div>
  );
}
