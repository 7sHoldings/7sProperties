"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import PropertyForm from "@/components/forms/PropertyForm";
import { Skeleton } from "@/components/ui/Skeleton";

export default function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const supabase = createClient();
  const [property, setProperty] = useState<any | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    supabase
      .from("properties")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) setNotFound(true);
        else setProperty(data);
      });
  }, [id]);

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-stone-500 mb-4">
        <Link href="/properties" className="hover:underline">
          Properties
        </Link>
        <span>›</span>
        {property ? (
          <>
            <Link href={`/properties/${id}`} className="hover:underline">
              {property.name}
            </Link>
            <span>›</span>
          </>
        ) : null}
        <span className="text-stone-900">Edit</span>
      </div>

      <h1 className="text-2xl font-medium mb-6">Edit property</h1>

      {notFound ? (
        <p className="text-stone-500">Property not found.</p>
      ) : !property ? (
        <div className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <div className="grid grid-cols-3 gap-3">
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
          </div>
          <Skeleton className="h-9 w-full" />
        </div>
      ) : (
        <PropertyForm
          mode="edit"
          propertyId={id}
          initial={{
            name: property.name,
            address: property.address,
            city: property.city || "",
            state: property.state || "",
            zip: property.zip || "",
            property_type: property.property_type || "single_family",
            square_feet: property.square_feet ?? undefined,
            bedrooms: property.bedrooms ?? undefined,
            bathrooms: property.bathrooms ?? undefined,
            purchase_price: property.purchase_price ?? undefined,
            purchase_date: property.purchase_date || "",
            notes: property.notes || "",
          }}
        />
      )}
    </div>
  );
}
