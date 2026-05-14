"use client";

import { loadStripe, type Stripe } from "@stripe/stripe-js";

let promise: Promise<Stripe | null> | null = null;

export function getStripePromise() {
  if (!promise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!key) {
      console.error(
        "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY missing — bank linking and payment UI will not work."
      );
      promise = Promise.resolve(null);
    } else {
      promise = loadStripe(key);
    }
  }
  return promise;
}
