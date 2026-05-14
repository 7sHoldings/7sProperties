"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type Method = {
  id: string;
  stripe_payment_method_id: string;
  type: "us_bank_account" | "card";
  brand: string | null;
  last4: string | null;
  status: string;
};

type Lease = {
  id: string;
  monthly_rent: number | string;
  rent_due_day: number | null;
  autopay_enabled: boolean | null;
  autopay_payment_method_id: string | null;
};

export default function AutopayToggle({
  lease,
  methods,
}: {
  lease: Lease;
  methods: Method[];
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(!!lease.autopay_enabled);
  const [methodId, setMethodId] = useState(
    lease.autopay_payment_method_id ||
      methods.find((m) => m.status === "active")?.stripe_payment_method_id ||
      ""
  );
  const [busy, setBusy] = useState(false);

  const activeMethods = methods.filter((m) => m.status === "active");

  async function update(nextEnabled: boolean) {
    if (nextEnabled && !methodId) {
      toast.error("Pick a payment method first");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/stripe/autopay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          leaseId: lease.id,
          paymentMethodId: methodId || undefined,
          enable: nextEnabled,
        }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        throw new Error(error || "Failed");
      }
      setEnabled(nextEnabled);
      toast.success(nextEnabled ? "Autopay turned on" : "Autopay turned off");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-medium">Autopay</h3>
          <p className="text-sm text-stone-500 mt-0.5">
            Charge ${Number(lease.monthly_rent).toLocaleString()} on day{" "}
            {lease.rent_due_day || 1} of each month
          </p>
        </div>
        <label className="inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={enabled}
            disabled={busy || activeMethods.length === 0}
            onChange={(e) => update(e.target.checked)}
          />
          <div className="relative w-11 h-6 bg-stone-200 peer-checked:bg-teal-600 rounded-full transition-colors peer-disabled:opacity-50">
            <div
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                enabled ? "translate-x-5" : ""
              }`}
            />
          </div>
        </label>
      </div>

      {activeMethods.length === 0 ? (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5 mt-3">
          Add a verified payment method to enable autopay.
        </p>
      ) : (
        <div className="mt-3">
          <label className="block text-xs text-stone-600 mb-1">
            Charge to
          </label>
          <select
            value={methodId}
            onChange={(e) => setMethodId(e.target.value)}
            disabled={busy}
            className="w-full px-3 py-2 text-sm border border-stone-200 rounded-md"
          >
            {activeMethods.map((m) => (
              <option
                key={m.stripe_payment_method_id}
                value={m.stripe_payment_method_id}
              >
                {m.type === "us_bank_account" ? "Bank" : "Card"} ···{" "}
                {m.last4 || "????"}
                {m.brand ? ` (${m.brand})` : ""}
              </option>
            ))}
          </select>
          {enabled && methodId !== lease.autopay_payment_method_id && (
            <button
              type="button"
              onClick={() => update(true)}
              disabled={busy}
              className="mt-2 text-xs text-teal-700 hover:text-teal-800"
            >
              {busy ? "Updating..." : "Save method change"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
