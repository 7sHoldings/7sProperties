import Link from "next/link";
import MileageForm from "@/components/forms/MileageForm";

export default function NewMileagePage() {
  return (
    <div className="p-4 sm:p-6 max-w-xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-stone-500 mb-4">
        <Link href="/mileage" className="hover:underline">
          Mileage
        </Link>
        <span>›</span>
        <span className="text-stone-900">Log trip</span>
      </div>
      <h1 className="text-2xl font-medium mb-6">Log a trip</h1>
      <MileageForm mode="create" />
    </div>
  );
}
