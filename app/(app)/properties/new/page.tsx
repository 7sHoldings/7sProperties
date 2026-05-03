"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function NewPropertyPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Not authenticated"); setLoading(false); return; }

    // Create property
    const { data: property, error: propError } = await supabase.from("properties").insert({
      owner_id: user.id,
      name: formData.get("name") as string,
      address: formData.get("address") as string,
      city: formData.get("city") as string,
      state: formData.get("state") as string,
      zip: formData.get("zip") as string,
      property_type: formData.get("property_type") as string,
      bedrooms: Number(formData.get("bedrooms")) || null,
      bathrooms: Number(formData.get("bathrooms")) || null,
      square_feet: Number(formData.get("square_feet")) || null,
      purchase_price: Number(formData.get("purchase_price")) || null,
      purchase_date: (formData.get("purchase_date") as string) || null,
    }).select().single();

    if (propError || !property) {
      setError(propError?.message || "Failed to create property");
      setLoading(false);
      return;
    }

    // Create default unit
    await supabase.from("units").insert({
      property_id: property.id,
      unit_label: "Main",
      bedrooms: Number(formData.get("bedrooms")) || null,
      bathrooms: Number(formData.get("bathrooms")) || null,
      square_feet: Number(formData.get("square_feet")) || null,
    });

    router.push("/properties");
    router.refresh();
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-2 text-sm text-stone-500 mb-4">
        <Link href="/properties" className="hover:underline">Properties</Link>
        <span>›</span>
        <span className="text-stone-900">Add new</span>
      </div>

      <h1 className="text-2xl font-medium mb-6">Add property</h1>

      <form onSubmit={handleSubmit} className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
        <Field label="Property name" name="name" required placeholder="Maple Street House" />
        <Field label="Address" name="address" required placeholder="412 Maple St" />
        <div className="grid grid-cols-3 gap-3">
          <Field label="City" name="city" />
          <Field label="State" name="state" />
          <Field label="ZIP" name="zip" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-stone-600 mb-1">Property type</label>
            <select name="property_type" className="w-full px-3 py-2 border border-stone-200 rounded-md">
              <option value="single_family">Single family</option>
              <option value="duplex">Duplex</option>
              <option value="triplex">Triplex</option>
              <option value="fourplex">Fourplex</option>
              <option value="condo">Condo</option>
              <option value="apartment">Apartment</option>
              <option value="townhouse">Townhouse</option>
              <option value="other">Other</option>
            </select>
          </div>
          <Field label="Square feet" name="square_feet" type="number" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Bedrooms" name="bedrooms" type="number" />
          <Field label="Bathrooms" name="bathrooms" type="number" step="0.5" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Purchase price" name="purchase_price" type="number" step="0.01" />
          <Field label="Purchase date" name="purchase_date" type="date" />
        </div>

        {error && <p className="text-sm text-red-700">{error}</p>}

        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={loading} className="px-4 py-2 bg-teal-700 text-white rounded-md hover:bg-teal-800 disabled:opacity-50">
            {loading ? "Saving..." : "Save property"}
          </button>
          <Link href="/properties" className="px-4 py-2 border border-stone-200 rounded-md hover:bg-stone-50">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

function Field({ label, name, type = "text", required = false, placeholder, step }: { label: string; name: string; type?: string; required?: boolean; placeholder?: string; step?: string }) {
  return (
    <div>
      <label className="block text-sm text-stone-600 mb-1">{label}</label>
      <input
        type={type}
        name={name}
        required={required}
        placeholder={placeholder}
        step={step}
        className="w-full px-3 py-2 border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-600"
      />
    </div>
  );
}
