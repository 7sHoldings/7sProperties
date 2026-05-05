import Link from "next/link";
import ConstructionProjectForm from "@/components/forms/ConstructionProjectForm";

export default function NewConstructionPage() {
  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-stone-500 mb-4">
        <Link href="/construction" className="hover:underline">
          Construction
        </Link>
        <span>›</span>
        <span className="text-stone-900">New project</span>
      </div>
      <h1 className="text-2xl font-medium mb-6">New construction project</h1>
      <ConstructionProjectForm mode="create" />
    </div>
  );
}
