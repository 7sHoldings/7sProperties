"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { X, Landmark, CreditCard } from "lucide-react";

type Method = {
  id: string;
  stripe_payment_method_id: string;
  type: "us_bank_account" | "card";
  brand: string | null;
  last4: string | null;
  is_default: boolean;
  status: string;
};

type Props = {
  leaseId: string;
  forMonth: string; // YYYY-MM-01
  defaultAmount: number;
  methods: Method[];
};

export default function PayRentButton({
  leaseId,
  forMonth,
  defaultAmount,
  methods,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(defaultAmount));
  const active = methods.filter((m) => m.status === "active");
  const [methodId, setMethodId] = useState(
    active.find((m) => m.is_default)?.stripe_payment_method_id ||
      active[0]?.stripe_payment_method_id ||
      ""
  );
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      if (!methodId) throw new Error("Pick a payment method");
      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt <= 0) throw new Error("Enter a valid amount");

      const res = await fetch("/api/stripe/pay-rent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          leaseId,
          paymentMethodId: methodId,
          amount: amt,
          forMonth,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Payment failed");

      const selected = active.find(
        (m) => m.stripe_payment_method_id === methodId
      );
      if (selected?.type === "us_bank_account") {
        toast.success(
          "Payment initiated — it'll clear in 3–5 business days. We'll update the status here as it progresses."
        );
      } else {
        toast.success("Payment successful");
      }
      setOpen(false);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  const selected = active.find((m) => m.stripe_payment_method_id === methodId);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 text-xs bg-teal-700 text-white rounded-md hover:bg-teal-800 font-medium"
      >
        Pay now
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !busy) setOpen(false);
          }}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium">Pay rent</h3>
              <button
                onClick={() => setOpen(false)}
                disabled={busy}
                className="text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-stone-600 mb-1">Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500">
                    $
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={busy}
                    className="w-full pl-7 pr-3 py-2 text-sm border border-stone-200 rounded-md"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-stone-600 mb-1">Pay from</label>
                {active.length === 0 ? (
                  <div className="text-sm bg-amber-50 border border-amber-200 rounded-md p-3 text-amber-900">
                    No active payment methods.{" "}
                    <Link
                      href="/tenant/payments/methods"
                      className="underline font-medium"
                    >
                      Add one
                    </Link>{" "}
                    to pay rent here.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {active.map((m) => {
                      const Icon = m.type === "us_bank_account" ? Landmark : CreditCard;
                      const checked = m.stripe_payment_method_id === methodId;
                      return (
                        <label
                          key={m.stripe_payment_method_id}
                          className={`flex items-center gap-3 p-2.5 border rounded-md cursor-pointer ${
                            checked
                              ? "border-teal-600 bg-teal-50"
                              : "border-stone-200 hover:bg-stone-50"
                          }`}
                        >
                          <input
                            type="radio"
                            name="pm"
                            checked={checked}
                            onChange={() => setMethodId(m.stripe_payment_method_id)}
                            className="sr-only"
                          />
                          <Icon className="w-4 h-4 text-stone-500" />
                          <span className="flex-1 text-sm">
                            {m.brand || (m.type === "us_bank_account" ? "Bank" : "Card")}{" "}
                            ··· {m.last4 || "????"}
                          </span>
                          {m.is_default && (
                            <span className="text-[10px] uppercase tracking-wider text-teal-700">
                              Default
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {selected?.type === "us_bank_account" && (
                <p className="text-xs text-stone-500 bg-stone-50 border border-stone-200 rounded-md p-2.5">
                  ACH transfers take 3–5 business days to clear. You authorize
                  this debit by clicking Pay.
                </p>
              )}
              {selected?.type === "card" && (
                <p className="text-xs text-stone-500 bg-stone-50 border border-stone-200 rounded-md p-2.5">
                  Card fee: 2.9% + $0.30. Consider linking a bank account for
                  lower fees.
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setOpen(false)}
                  disabled={busy}
                  className="px-3 py-1.5 text-sm border border-stone-200 rounded-md"
                >
                  Cancel
                </button>
                <button
                  onClick={submit}
                  disabled={busy || active.length === 0}
                  className="ml-auto px-4 py-1.5 text-sm bg-teal-700 text-white rounded-md disabled:opacity-50"
                >
                  {busy ? "Processing..." : `Pay $${Number(amount || 0).toLocaleString()}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
