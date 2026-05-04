"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});

  function validate() {
    const e: typeof errors = {};
    if (password.length < 6) e.password = "At least 6 characters";
    if (confirm !== password) e.confirm = "Passwords do not match";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Password updated");
      router.push("/dashboard");
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
            <h1 className="text-lg font-semibold text-stone-900 leading-tight">7s Rental</h1>
            <p className="text-xs text-stone-500">Set new password</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3" noValidate>
          <PasswordField
            label="New password"
            value={password}
            onChange={setPassword}
            error={errors.password}
          />
          <PasswordField
            label="Confirm password"
            value={confirm}
            onChange={setConfirm}
            error={errors.confirm}
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-teal-700 text-white py-2 rounded-md hover:bg-teal-800 disabled:opacity-50 text-sm font-medium"
          >
            {loading ? "Updating..." : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  return (
    <div>
      <label className="block text-sm text-stone-700 mb-1 font-medium">
        {label}
        <span className="text-red-600 ml-0.5">*</span>
      </label>
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        minLength={6}
        className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 ${
          error ? "border-red-300 focus:ring-red-300" : "border-stone-200 focus:ring-teal-600"
        }`}
      />
      {error && <p className="text-xs text-red-700 mt-1">{error}</p>}
    </div>
  );
}
