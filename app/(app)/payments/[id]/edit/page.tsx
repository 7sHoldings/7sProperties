"use client";

import { Suspense, use, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import PaymentForm from "@/components/forms/PaymentForm";
import { Skeleton } from "@/components/ui/Skeleton";
import DocumentUpload from "@/components/DocumentUpload";

export default function EditPaymentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const supabase = createClient();
  const [payment, setPayment] = useState<any | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    supabase
      .from("payments")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) setNotFound(true);
        else setPayment(data);
      });
  }, [id]);

  return (
    <div className="p-4 sm:p-6 max-w-xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-stone-500 mb-4">
        <Link href="/payments" className="hover:underline">
          Payments
        </Link>
        <span>›</span>
        <span className="text-stone-900">Edit</span>
      </div>
      <h1 className="text-2xl font-medium mb-6">Edit payment</h1>

      {notFound ? (
        <p className="text-stone-500">Payment not found.</p>
      ) : !payment ? (
        <div className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
          <Skeleton className="h-9 w-full" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
          </div>
          <Skeleton className="h-9 w-full" />
        </div>
      ) : (
        <>
          <Suspense fallback={null}>
            <PaymentForm
              mode="edit"
              paymentId={id}
              initial={{
                lease_id: payment.lease_id,
                payment_date: payment.payment_date,
                for_month: payment.for_month,
                amount: payment.amount,
                payment_method: payment.payment_method || "bank_transfer",
                reference_number: payment.reference_number || "",
                notes: payment.notes || "",
              }}
            />
          </Suspense>

          <div className="mt-3">
            <DocumentUpload paymentId={id} />
          </div>
        </>
      )}
    </div>
  );
}
