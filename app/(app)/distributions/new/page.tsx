import Link from "next/link";
import DistributionForm from "@/components/forms/DistributionForm";

export default function NewDistributionPage() {
  return (
    <div className="p-4 sm:p-6 max-w-xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-stone-500 mb-4">
        <Link href="/distributions" className="hover:underline">
          Distributions
        </Link>
        <span>›</span>
        <span className="text-stone-900">Record</span>
      </div>
      <h1 className="text-2xl font-medium mb-6">Record profit taken out</h1>
      <DistributionForm mode="create" />
    </div>
  );
}
