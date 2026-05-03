"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const PROPERTY_TYPES = [
  "single_family",
  "duplex",
  "triplex",
  "fourplex",
  "condo",
  "apartment",
  "townhouse",
  "other",
];

export default function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = createClient();
  const [property, setProperty] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase
      .from("properties")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => setProperty(data));
  }, [id]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);

    const { error: updErr } = await supabase
      .from("properties")
      .update({
        name: fd.get("name") as string,
        address: fd.get("address") as string,
        city: (fd.get("city") as string) || null,
        state: (fd.get("state") as string) || null,
        zip: (fd.get("zip") as string) || null,
        property_type: fd.get("property_type") as string,
        bedrooms: Number(fd.get("bedrooms")) || null,
        bathrooms: Number(fd.get("bathrooms")) || null,
        square_feet: Number(fd.get("square_feet")) || null,
        purchase_price: Number(fd.get("purchase_price")) || null,
        purchase_date: (fd.get("purchase_date") as string) || null,
        notes: (fd.get("notes") as string) || null,
      })
      .eq("id", id);

    if (updErr) {
      setError(updErr.message);
      setLoading(false);
      return;
    }
    router.push(`/properties/${id}`);
    router.refresh();
  }

  if (!property) return <div className="p-6 text-stone-500">Loading...</div>;

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-2 text-sm text-stone-500 mb-4">
        <Link href="/properties" className="hover:underline">Properties</Link>
        <span>›</span>
        <Link href={`/properties/${id}`} className="hover:underline">{property.name}</Link>
        <span>›</span>
        <span className="text-stone-900">Edit</span>
      </div>

      <h1 className="text-2xl font-medium mb-6">Edit property</h1>

      <form onSubmit={handleSubmit} className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
        <Field label="Property name" name="name" required defaultValue={property.name} />
        <Field label="Address" name="address" required defaultValue={property.address} />
        <div className="grid grid-cols-3 gap-3">
          <Field label="City" name="city" defaultValue={property.city || ""} />
          <Field label="State" name="state" defaultValue={property.state || ""} />
          <Field label="ZIP" name="zip" defaultValue={property.zip || ""} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-stone-600 mb-1">Property type</label>
            <select
              name="property_type"
              defaultValue={property.property_type || "single_family"}
              className="w-full px-3 py-2 border border-stone-200 rounded-md"
            >
              {PROPERTY_TYPES.map((t) => (
                <option key={t} value={t}>{t.replace("_", " ")}</option>
              ))}
            </select>
          </div>
          <Field label="Square feet" name="square_feet" type="number" defaultValue={property.square_feet ?? ""} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Bedrooms" name="bedrooms" type="number" defaultValue={property.bedrooms ?? ""} />
          <Field label="Bathrooms" name="bathrooms" type="number" step="0.5" defaultValue={property.bathrooms ?? ""} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Purchase price" name="purchase_price" type="number" step="0.01" defaultValue={property.purchase_price ?? ""} />
          <Field label="Purchase date" name="purchase_date" type="date" defaultValue={property.purchase_date || ""} />
        </div>

        <div>
          <label className="block text-sm text-stone-600 mb-1">Notes</label>
          <textarea
            name="notes"
            rows={3}
            defaultValue={property.notes || ""}
            className="w-full px-3 py-2 border border-stone-200 rounded-md"
          />
        </div>

        {error && <p className="text-sm text-red-700">{error}</p>}
        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={loading} className="px-4 py-2 bg-teal-700 text-white rounded-md hover:bg-teal-800 disabled:opacity-50">
            {loading ? "Saving..." : "Save changes"}
          </button>
          <Link href={`/properties/${id}`} className="px-4 py-2 border border-stone-200 rounded-md hover:bg-stone-50">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
  defaultValue,
  step,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string | number;
  step?: string;
}) {
  return (
    <div>
      <label className="block text-sm text-stone-600 mb-1">{label}</label>
      <input
        type={type}
        name={name}
        required={required}
        defaultValue={defaultValue}
        step={step}
        className="w-full px-3 py-2 border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-600"
      />
    </div>
  );
}
