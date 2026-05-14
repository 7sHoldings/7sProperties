"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Landmark, CreditCard, Trash2 } from "lucide-react";
import { toast } from "sonner";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

type Method = {
  id: string;
  stripe_payment_method_id: string;
  type: "us_bank_account" | "card";
  brand: string | null;
  last4: string | null;
  is_default: boolean;
  status: "active" | "detached" | "unverified";
};

export default function PaymentMethodRow({ method }: { method: Method }) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch("/api/stripe/payment-methods", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: method.id }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        throw new Error(error || "Failed");
      }
      toast.success("Removed");
      setConfirmOpen(false);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  const Icon = method.type === "us_bank_account" ? Landmark : CreditCard;
  const label =
    method.type === "us_bank_account"
      ? `${method.brand || "Bank"} ··· ${method.last4 || "????"}`
      : `${method.brand?.toUpperCase() || "Card"} ··· ${method.last4 || "????"}`;

  return (
    <>
      <div className="flex items-center gap-3 p-3 border border-stone-200 rounded-md bg-white">
        <Icon className="w-5 h-5 text-stone-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{label}</div>
          <div className="flex items-center gap-2 mt-0.5">
            {method.is_default && (
              <span className="text-[10px] uppercase tracking-wider text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded">
                Default
              </span>
            )}
            {method.status === "unverified" && (
              <span className="text-[10px] uppercase tracking-wider text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                Verification pending
              </span>
            )}
            <span className="text-[10px] text-stone-500">
              {method.type === "us_bank_account" ? "ACH bank transfer" : "Card"}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="text-stone-400 hover:text-red-600"
          aria-label="Remove"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={remove}
        title="Remove this payment method?"
        message={
          method.is_default
            ? "This is your default method. Autopay will be paused until you set a new default."
            : "You can add it again later if needed."
        }
        confirmLabel={busy ? "Removing..." : "Remove"}
        variant="danger"
      />
    </>
  );
}
