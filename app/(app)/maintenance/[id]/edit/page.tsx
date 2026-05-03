"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import MaintenanceForm from "@/components/forms/MaintenanceForm";
import { Skeleton } from "@/components/ui/Skeleton";

export default function EditMaintenancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const supabase = createClient();
  const [request, setRequest] = useState<any | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    supabase
      .from("maintenance_requests")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) setNotFound(true);
        else setRequest(data);
      });
  }, [id]);

  return (
    <div className="p-4 sm:p-6 max-w-xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-stone-500 mb-4">
        <Link href="/maintenance" className="hover:underline">
          Maintenance
        </Link>
        <span>›</span>
        <span className="text-stone-900">Edit</span>
      </div>
      <h1 className="text-2xl font-medium mb-6">Edit maintenance request</h1>

      {notFound ? (
        <p className="text-stone-500">Maintenance request not found.</p>
      ) : !request ? (
        <div className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : (
        <MaintenanceForm
          mode="edit"
          requestId={id}
          initial={{
            property_id: request.property_id,
            title: request.title,
            description: request.description || "",
            priority: request.priority,
            status: request.status,
            reported_date: request.reported_date,
            completed_date: request.completed_date || "",
            contractor: request.contractor || "",
            cost: request.cost ?? undefined,
            notes: request.notes || "",
          }}
        />
      )}
    </div>
  );
}
