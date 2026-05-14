import Link from "next/link";
import PropertyForm from "@/components/forms/PropertyForm";

export default function NewPropertyPage() {
  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-stone-500 mb-4">
        <Link href="/properties" className="hover:underline">
          Rental Homes
        </Link>
        <span>›</span>
        <span className="text-stone-900">Add new</span>
      </div>

      <h1 className="text-2xl font-medium mb-6">Add rental home</h1>

      <PropertyForm mode="create" />
    </div>
  );
}
