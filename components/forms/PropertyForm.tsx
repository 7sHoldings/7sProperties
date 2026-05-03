"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { propertySchema, type PropertyInput, type PropertyValues } from "@/lib/schemas";
import { Input, Select, Textarea } from "@/components/ui/FormField";
import Button from "@/components/ui/Button";

const PROPERTY_TYPES = [
  { value: "single_family", label: "Single family" },
  { value: "duplex", label: "Duplex" },
  { value: "triplex", label: "Triplex" },
  { value: "fourplex", label: "Fourplex" },
  { value: "condo", label: "Condo" },
  { value: "apartment", label: "Apartment" },
  { value: "townhouse", label: "Townhouse" },
  { value: "other", label: "Other" },
];

type Props = {
  mode: "create" | "edit";
  propertyId?: string;
  initial?: Partial<PropertyValues>;
};

export default function PropertyForm({ mode, propertyId, initial }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PropertyValues, any, PropertyInput>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      name: initial?.name ?? "",
      address: initial?.address ?? "",
      city: initial?.city ?? "",
      state: initial?.state ?? "",
      zip: initial?.zip ?? "",
      property_type: initial?.property_type ?? "single_family",
      square_feet: initial?.square_feet,
      bedrooms: initial?.bedrooms,
      bathrooms: initial?.bathrooms,
      purchase_price: initial?.purchase_price,
      purchase_date: initial?.purchase_date ?? "",
      notes: initial?.notes ?? "",
    },
  });

  async function onSubmit(values: PropertyInput) {
    if (mode === "create") {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Not authenticated");
        return;
      }

      const { data: property, error } = await supabase
        .from("properties")
        .insert({
          owner_id: user.id,
          name: values.name,
          address: values.address,
          city: values.city || null,
          state: values.state || null,
          zip: values.zip || null,
          property_type: values.property_type,
          bedrooms: values.bedrooms ?? null,
          bathrooms: values.bathrooms ?? null,
          square_feet: values.square_feet ?? null,
          purchase_price: values.purchase_price ?? null,
          purchase_date: values.purchase_date || null,
          notes: values.notes || null,
        })
        .select()
        .single();

      if (error || !property) {
        toast.error(error?.message || "Failed to create property");
        return;
      }

      await supabase.from("units").insert({
        property_id: property.id,
        unit_label: "Main",
        bedrooms: values.bedrooms ?? null,
        bathrooms: values.bathrooms ?? null,
        square_feet: values.square_feet ?? null,
      });

      toast.success("Property added");
      router.push("/properties");
      router.refresh();
    } else {
      const { error } = await supabase
        .from("properties")
        .update({
          name: values.name,
          address: values.address,
          city: values.city || null,
          state: values.state || null,
          zip: values.zip || null,
          property_type: values.property_type,
          bedrooms: values.bedrooms ?? null,
          bathrooms: values.bathrooms ?? null,
          square_feet: values.square_feet ?? null,
          purchase_price: values.purchase_price ?? null,
          purchase_date: values.purchase_date || null,
          notes: values.notes || null,
        })
        .eq("id", propertyId!);

      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Property updated");
      router.push(`/properties/${propertyId}`);
      router.refresh();
    }
  }

  const cancelHref = mode === "edit" && propertyId ? `/properties/${propertyId}` : "/properties";

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="bg-white border border-stone-200 rounded-xl p-5 sm:p-6 space-y-4"
      noValidate
    >
      <Input
        label="Property name"
        required
        placeholder="Maple Street House"
        error={errors.name?.message}
        {...register("name")}
      />
      <Input
        label="Address"
        required
        placeholder="412 Maple St"
        error={errors.address?.message}
        {...register("address")}
      />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Input label="City" error={errors.city?.message} {...register("city")} />
        <Input label="State" placeholder="TX" error={errors.state?.message} {...register("state")} />
        <Input label="ZIP" placeholder="12345" error={errors.zip?.message} {...register("zip")} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Select
          label="Property type"
          required
          options={PROPERTY_TYPES}
          error={errors.property_type?.message}
          {...register("property_type")}
        />
        <Input
          label="Square feet"
          type="number"
          inputMode="numeric"
          error={errors.square_feet?.message}
          {...register("square_feet")}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Bedrooms"
          type="number"
          inputMode="numeric"
          error={errors.bedrooms?.message}
          {...register("bedrooms")}
        />
        <Input
          label="Bathrooms"
          type="number"
          step="0.5"
          inputMode="decimal"
          error={errors.bathrooms?.message}
          {...register("bathrooms")}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          label="Purchase price"
          type="number"
          step="0.01"
          inputMode="decimal"
          error={errors.purchase_price?.message}
          {...register("purchase_price")}
        />
        <Input
          label="Purchase date"
          type="date"
          error={errors.purchase_date?.message}
          {...register("purchase_date")}
        />
      </div>

      {mode === "edit" && (
        <Textarea label="Notes" rows={3} error={errors.notes?.message} {...register("notes")} />
      )}

      <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
        <Link
          href={cancelHref}
          className="inline-flex items-center justify-center px-4 py-2 text-sm border border-stone-200 rounded-md hover:bg-stone-50"
        >
          Cancel
        </Link>
        <Button type="submit" loading={isSubmitting} size="lg">
          {mode === "create" ? "Save property" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
