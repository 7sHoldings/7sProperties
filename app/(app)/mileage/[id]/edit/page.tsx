"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import MileageForm from "@/components/forms/MileageForm";
import { Skeleton } from "@/components/ui/Skeleton";

export default function EditMileagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const supabase = createClient();
  const [log, setLog] = useState<any | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    supabase
      .from("mileage_logs")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) setNotFound(true);
        else setLog(data);
      });
  }, [id]);

  return (
    <div className="p-4 sm:p-6 max-w-xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-stone-500 mb-4">
        <Link href="/mileage" className="hover:underline">
          Mileage
        </Link>
        <span>›</span>
        <span className="text-stone-900">Edit</span>
      </div>
      <h1 className="text-2xl font-medium mb-6">Edit trip</h1>
      {notFound ? (
        <p className="text-stone-500">Not found.</p>
      ) : !log ? (
        <div className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : (
        <MileageForm
          mode="edit"
          mileageId={id}
          initial={{
            property_id: log.property_id || "",
            trip_date: log.trip_date,
            miles: log.miles,
            purpose: log.purpose,
            notes: log.notes || "",
          }}
        />
      )}
    </div>
  );
}
