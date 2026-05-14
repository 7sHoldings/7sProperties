"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Landmark, CreditCard, X } from "lucide-react";
import { getStripePromise } from "@/lib/stripe/client";

type Choice = null | "ach_instant" | "ach_manual" | "card";

export default function AddPaymentMethodButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<Choice>(null);
  const [busy, setBusy] = useState(false);
  const [accountHolderName, setAccountHolderName] = useState("");
  const [email, setEmail] = useState("");
  const [routing, setRouting] = useState("");
  const [account, setAccount] = useState("");

  function close() {
    if (busy) return;
    setOpen(false);
    setChoice(null);
    setAccountHolderName("");
    setEmail("");
    setRouting("");
    setAccount("");
  }

  async function savePM(paymentMethodId: string, makeDefault = false) {
    const res = await fetch("/api/stripe/payment-methods", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ paymentMethodId, makeDefault }),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Failed" }));
      throw new Error(error || "Failed to save payment method");
    }
  }

  async function startAchInstant() {
    setBusy(true);
    try {
      const stripe = await getStripePromise();
      if (!stripe) throw new Error("Stripe not loaded — check publishable key");

      const res = await fetch("/api/stripe/financial-connections", { method: "POST" });
      const { client_secret, error } = await res.json();
      if (!res.ok || !client_secret) throw new Error(error || "Failed to start link flow");

      const { setupIntent, error: stripeErr } = await stripe.collectBankAccountForSetup({
        clientSecret: client_secret,
        params: {
          payment_method_type: "us_bank_account",
          payment_method_data: {
            billing_details: {
              name: accountHolderName || undefined,
              email: email || undefined,
            },
          },
        },
        expand: ["payment_method"],
      });
      if (stripeErr) throw new Error(stripeErr.message);
      if (!setupIntent?.payment_method) {
        throw new Error("No payment method returned");
      }

      // Confirm the setup intent to finalize attachment
      const { setupIntent: confirmed, error: confirmErr } =
        await stripe.confirmUsBankAccountSetup(client_secret);
      if (confirmErr) throw new Error(confirmErr.message);

      const pmId =
        typeof confirmed?.payment_method === "string"
          ? confirmed.payment_method
          : (confirmed?.payment_method as any)?.id;
      if (!pmId) throw new Error("Setup did not complete");

      await savePM(pmId, true);
      toast.success("Bank account linked");
      close();
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function startAchManual() {
    if (!accountHolderName || !routing || !account) {
      toast.error("Fill in name, routing, and account numbers");
      return;
    }
    setBusy(true);
    try {
      const stripe = await getStripePromise();
      if (!stripe) throw new Error("Stripe not loaded");

      const res = await fetch("/api/stripe/setup-intent-manual", { method: "POST" });
      const { client_secret, error } = await res.json();
      if (!res.ok || !client_secret) throw new Error(error || "Failed");

      const { setupIntent, error: stripeErr } = await stripe.confirmUsBankAccountSetup(
        client_secret,
        {
          payment_method: {
            us_bank_account: {
              routing_number: routing,
              account_number: account,
              account_holder_type: "individual",
            },
            billing_details: {
              name: accountHolderName,
              email: email || undefined,
            },
          },
        }
      );
      if (stripeErr) throw new Error(stripeErr.message);

      const pmId =
        typeof setupIntent?.payment_method === "string"
          ? setupIntent.payment_method
          : (setupIntent?.payment_method as any)?.id;
      if (!pmId) throw new Error("Setup did not complete");

      await savePM(pmId, true);
      toast.success(
        "Bank account added — we'll send micro-deposits to verify in 1-2 days"
      );
      close();
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-teal-700 text-white rounded-md hover:bg-teal-800"
      >
        <Plus className="w-4 h-4" />
        Add payment method
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">
                {choice === null
                  ? "Add a payment method"
                  : choice === "ach_instant"
                    ? "Link bank instantly"
                    : choice === "ach_manual"
                      ? "Enter bank details manually"
                      : "Add a card"}
              </h3>
              <button
                onClick={close}
                disabled={busy}
                className="text-stone-400 hover:text-stone-700"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {choice === null && (
              <div className="space-y-2">
                <button
                  onClick={() => setChoice("ach_instant")}
                  className="w-full flex items-center gap-3 p-3 border border-stone-200 rounded-md hover:bg-stone-50 text-left"
                >
                  <Landmark className="w-5 h-5 text-teal-700" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">Bank account (instant)</div>
                    <div className="text-xs text-stone-500">
                      Log into your bank — no waiting. 0.8% fee, capped at $5.
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => setChoice("ach_manual")}
                  className="w-full flex items-center gap-3 p-3 border border-stone-200 rounded-md hover:bg-stone-50 text-left"
                >
                  <Landmark className="w-5 h-5 text-stone-500" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">Bank account (manual)</div>
                    <div className="text-xs text-stone-500">
                      Routing + account number. We&apos;ll verify with two
                      small test deposits in 1–2 days.
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => setChoice("card")}
                  className="w-full flex items-center gap-3 p-3 border border-stone-200 rounded-md hover:bg-stone-50 text-left"
                >
                  <CreditCard className="w-5 h-5 text-stone-500" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">Debit or credit card</div>
                    <div className="text-xs text-stone-500">
                      Instant. 2.9% + $0.30 fee per payment.
                    </div>
                  </div>
                </button>
              </div>
            )}

            {choice === "ach_instant" && (
              <div className="space-y-3">
                <p className="text-sm text-stone-600">
                  We&apos;ll open a secure window to your bank. Your credentials
                  never touch this site.
                </p>
                <input
                  value={accountHolderName}
                  onChange={(e) => setAccountHolderName(e.target.value)}
                  placeholder="Account holder name"
                  className="w-full px-3 py-2 text-sm border border-stone-200 rounded-md"
                />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email (optional)"
                  className="w-full px-3 py-2 text-sm border border-stone-200 rounded-md"
                />
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setChoice(null)}
                    disabled={busy}
                    className="px-3 py-1.5 text-sm border border-stone-200 rounded-md"
                  >
                    Back
                  </button>
                  <button
                    onClick={startAchInstant}
                    disabled={busy || !accountHolderName}
                    className="ml-auto px-3 py-1.5 text-sm bg-teal-700 text-white rounded-md disabled:opacity-50"
                  >
                    {busy ? "Linking..." : "Continue"}
                  </button>
                </div>
              </div>
            )}

            {choice === "ach_manual" && (
              <div className="space-y-3">
                <input
                  value={accountHolderName}
                  onChange={(e) => setAccountHolderName(e.target.value)}
                  placeholder="Account holder name"
                  className="w-full px-3 py-2 text-sm border border-stone-200 rounded-md"
                />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email (optional)"
                  className="w-full px-3 py-2 text-sm border border-stone-200 rounded-md"
                />
                <input
                  value={routing}
                  onChange={(e) => setRouting(e.target.value.replace(/\D/g, ""))}
                  placeholder="Routing number (9 digits)"
                  maxLength={9}
                  inputMode="numeric"
                  className="w-full px-3 py-2 text-sm border border-stone-200 rounded-md"
                />
                <input
                  value={account}
                  onChange={(e) => setAccount(e.target.value.replace(/\D/g, ""))}
                  placeholder="Account number"
                  inputMode="numeric"
                  className="w-full px-3 py-2 text-sm border border-stone-200 rounded-md"
                />
                <p className="text-xs text-stone-500">
                  By saving this account you authorize debits from it to pay
                  your rent. We&apos;ll send two small test deposits to verify
                  ownership before charges can be made.
                </p>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setChoice(null)}
                    disabled={busy}
                    className="px-3 py-1.5 text-sm border border-stone-200 rounded-md"
                  >
                    Back
                  </button>
                  <button
                    onClick={startAchManual}
                    disabled={busy}
                    className="ml-auto px-3 py-1.5 text-sm bg-teal-700 text-white rounded-md disabled:opacity-50"
                  >
                    {busy ? "Saving..." : "Save bank account"}
                  </button>
                </div>
              </div>
            )}

            {choice === "card" && (
              <CardEntry
                onCancel={() => setChoice(null)}
                onSaved={async (pmId) => {
                  try {
                    await savePM(pmId, true);
                    toast.success("Card added");
                    close();
                    router.refresh();
                  } catch (err: any) {
                    toast.error(err.message);
                  }
                }}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}

function CardEntry({
  onCancel,
  onSaved,
}: {
  onCancel: () => void;
  onSaved: (paymentMethodId: string) => void | Promise<void>;
}) {
  const [number, setNumber] = useState("");
  const [expMonth, setExpMonth] = useState("");
  const [expYear, setExpYear] = useState("");
  const [cvc, setCvc] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const stripe = await getStripePromise();
      if (!stripe) throw new Error("Stripe not loaded");
      const { paymentMethod, error } = await stripe.createPaymentMethod({
        type: "card",
        card: {
          number,
          exp_month: Number(expMonth),
          exp_year: Number(expYear),
          cvc,
        } as any,
        billing_details: { name: name || undefined },
      });
      if (error) throw new Error(error.message);
      if (!paymentMethod) throw new Error("No payment method");
      await onSaved(paymentMethod.id);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name on card"
        className="w-full px-3 py-2 text-sm border border-stone-200 rounded-md"
      />
      <input
        value={number}
        onChange={(e) => setNumber(e.target.value.replace(/\s/g, ""))}
        placeholder="Card number"
        inputMode="numeric"
        className="w-full px-3 py-2 text-sm border border-stone-200 rounded-md"
      />
      <div className="grid grid-cols-3 gap-2">
        <input
          value={expMonth}
          onChange={(e) => setExpMonth(e.target.value.replace(/\D/g, ""))}
          placeholder="MM"
          maxLength={2}
          inputMode="numeric"
          className="px-3 py-2 text-sm border border-stone-200 rounded-md"
        />
        <input
          value={expYear}
          onChange={(e) => setExpYear(e.target.value.replace(/\D/g, ""))}
          placeholder="YYYY"
          maxLength={4}
          inputMode="numeric"
          className="px-3 py-2 text-sm border border-stone-200 rounded-md"
        />
        <input
          value={cvc}
          onChange={(e) => setCvc(e.target.value.replace(/\D/g, ""))}
          placeholder="CVC"
          maxLength={4}
          inputMode="numeric"
          className="px-3 py-2 text-sm border border-stone-200 rounded-md"
        />
      </div>
      <p className="text-xs text-stone-500">
        Cards carry a higher fee (2.9% + $0.30) than bank transfers.
      </p>
      <div className="flex gap-2 pt-1">
        <button
          onClick={onCancel}
          disabled={busy}
          className="px-3 py-1.5 text-sm border border-stone-200 rounded-md"
        >
          Back
        </button>
        <button
          onClick={submit}
          disabled={busy || !number || !expMonth || !expYear || !cvc}
          className="ml-auto px-3 py-1.5 text-sm bg-teal-700 text-white rounded-md disabled:opacity-50"
        >
          {busy ? "Saving..." : "Save card"}
        </button>
      </div>
    </div>
  );
}
