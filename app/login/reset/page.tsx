"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState("");
  const [emailError, setEmailError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEmailError("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("Enter a valid email");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/login/update-password`,
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else {
      setInfo("Check your email for a reset link.");
      toast.success("Reset email sent");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-stone-50">
      <div className="w-full max-w-sm bg-white rounded-xl border border-stone-200 p-7 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-md bg-teal-700 text-white flex items-center justify-center font-bold tracking-tight">
            7s
          </div>
          <div>
            <h1 className="text-lg font-semibold text-stone-900 leading-tight">7s Properties</h1>
            <p className="text-xs text-stone-500">Reset password</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3" noValidate>
          <div>
            <label className="block text-sm text-stone-700 mb-1 font-medium">
              Email<span className="text-red-600 ml-0.5">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 ${
                emailError
                  ? "border-red-300 focus:ring-red-300"
                  : "border-stone-200 focus:ring-teal-600"
              }`}
            />
            {emailError && <p className="text-xs text-red-700 mt-1">{emailError}</p>}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-teal-700 text-white py-2 rounded-md hover:bg-teal-800 disabled:opacity-50 text-sm font-medium"
          >
            {loading ? "Sending..." : "Send reset link"}
          </button>
        </form>

        {info && <p className="mt-4 text-sm text-stone-600">{info}</p>}

        <Link
          href="/login"
          className="mt-4 text-sm text-teal-700 hover:underline w-full text-center block"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
