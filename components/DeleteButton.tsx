"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

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
  confirmMessage = "This action cannot be undone.",
  variant = "button",
}: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);

  async function performDelete() {
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Deleted");
    setOpen(false);
    if (redirectTo) router.push(redirectTo);
    router.refresh();
  }

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title={label}
          className="text-stone-400 hover:text-red-600"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="px-3 py-1.5 text-sm border border-red-200 text-red-700 rounded-md hover:bg-red-50"
        >
          {label}
        </button>
      )}

      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={performDelete}
        title={`Delete ${label.toLowerCase() === "delete" ? "this item" : label.toLowerCase()}?`}
        message={confirmMessage}
        confirmLabel="Delete"
        variant="danger"
      />
    </>
  );
}
