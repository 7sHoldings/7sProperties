import Link from "next/link";
import { Suspense } from "react";
import LeaseForm from "@/components/forms/LeaseForm";

export default function NewLeasePage() {
  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-stone-500 mb-4">
        <Link href="/tenants" className="hover:underline">
          Tenants
        </Link>
        <span>›</span>
        <span className="text-stone-900">New lease</span>
      </div>
      <h1 className="text-2xl font-medium mb-2">Create lease</h1>
      <p className="text-sm text-stone-500 mb-6">
        Connect an existing tenant to a vacant unit so you can record rent payments.
      </p>
      <Suspense fallback={null}>
        <LeaseForm />
      </Suspense>
    </div>
  );
}
