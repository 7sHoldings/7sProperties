"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import DistributionForm from "@/components/forms/DistributionForm";
import { Skeleton } from "@/components/ui/Skeleton";

export default function EditDistributionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const supabase = createClient();
  const [distribution, setDistribution] = useState<any | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    supabase
      .from("distributions")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) setNotFound(true);
        else setDistribution(data);
      });
  }, [id]);

  return (
    <div className="p-4 sm:p-6 max-w-xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-stone-500 mb-4">
        <Link href="/distributions" className="hover:underline">
          Distributions
        </Link>
        <span>›</span>
        <span className="text-stone-900">Edit</span>
      </div>
      <h1 className="text-2xl font-medium mb-6">Edit distribution</h1>

      {notFound ? (
        <p className="text-stone-500">Not found.</p>
      ) : !distribution ? (
        <div className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : (
        <DistributionForm
          mode="edit"
          distributionId={id}
          initial={{
            property_id: distribution.property_id || "",
            distribution_date: distribution.distribution_date,
            amount: distribution.amount,
            destination: distribution.destination,
            payment_method: distribution.payment_method || "bank_transfer",
            notes: distribution.notes || "",
          }}
        />
      )}
    </div>
  );
}
