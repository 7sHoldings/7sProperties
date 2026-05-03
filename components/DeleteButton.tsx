"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Trash2 } from "lucide-react";

type Props = {
  table: string;
  id: string;
  redirectTo?: string;
  label?: string;
  confirmMessage?: string;
  variant?: "button" | "icon";
};

export default function DeleteButton({
  table,
  id,
  redirectTo,
  label = "Delete",
  confirmMessage = "Are you sure? This cannot be undone.",
  variant = "button",
}: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    if (!confirm(confirmMessage)) return;
    setLoading(true);
    setError("");
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    if (redirectTo) router.push(redirectTo);
    router.refresh();
  }

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={handleDelete}
        disabled={loading}
        title={label}
        className="text-stone-400 hover:text-red-600 disabled:opacity-50"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    );
  }

  return (
    <div className="inline-flex flex-col items-end">
      <button
        type="button"
        onClick={handleDelete}
        disabled={loading}
        className="px-3 py-1.5 text-sm border border-red-200 text-red-700 rounded-md hover:bg-red-50 disabled:opacity-50"
      >
        {loading ? "Deleting..." : label}
      </button>
      {error && <p className="text-xs text-red-700 mt-1">{error}</p>}
    </div>
  );
}
