import { Suspense } from "react";
import Link from "next/link";
import PaymentForm from "@/components/forms/PaymentForm";

export default function NewPaymentPage() {
  return (
    <div className="p-4 sm:p-6 max-w-xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-stone-500 mb-4">
        <Link href="/payments" className="hover:underline">
          Payments
        </Link>
        <span>›</span>
        <span className="text-stone-900">Record</span>
      </div>
      <h1 className="text-2xl font-medium mb-1">Record payment</h1>
      <p className="text-sm text-stone-500 mb-6">
        Rent or a security deposit — pick the type below.
      </p>
      <Suspense fallback={<div className="text-stone-500">Loading...</div>}>
        <PaymentForm mode="create" />
      </Suspense>
    </div>
  );
}
