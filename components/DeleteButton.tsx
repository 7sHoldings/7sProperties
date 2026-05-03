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

/**
 * Run cleanup BEFORE the row is deleted (DB cascades will fire on delete,
 * but app-level side effects like resetting unit status need to happen here).
 */
async function preDeleteCleanup(supabase: ReturnType<typeof createClient>, table: string, id: string) {
  if (table === "tenants") {
    // Find this tenant's active leases → mark their units vacant
    const { data: leases } = await supabase
      .from("leases")
      .select("unit_id")
      .eq("tenant_id", id)
      .eq("status", "active");
    const unitIds = Array.from(new Set((leases || []).map((l: any) => l.unit_id).filter(Boolean)));
    if (unitIds.length) {
      await supabase.from("units").update({ status: "vacant" }).in("id", unitIds);
    }
  } else if (table === "leases") {
    // Get unit, mark vacant only if no OTHER active leases on that unit
    const { data: lease } = await supabase
      .from("leases")
      .select("unit_id")
      .eq("id", id)
      .maybeSingle();
    if (lease?.unit_id) {
      const { count } = await supabase
        .from("leases")
        .select("id", { count: "exact", head: true })
        .eq("unit_id", lease.unit_id)
        .eq("status", "active")
        .neq("id", id);
      if ((count || 0) === 0) {
        await supabase.from("units").update({ status: "vacant" }).eq("id", lease.unit_id);
      }
    }
  }
}

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
    await preDeleteCleanup(supabase, table, id);

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
