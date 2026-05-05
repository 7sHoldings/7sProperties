"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

type Props = {
  projectId: string;
  alreadyLinkedPropertyId?: string | null;
};

export default function ConvertToPropertyButton({
  projectId,
  alreadyLinkedPropertyId,
}: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);

  if (alreadyLinkedPropertyId) {
    return (
      <a
        href={`/properties/${alreadyLinkedPropertyId}`}
        className="px-3 py-1.5 text-sm bg-white border border-stone-200 rounded-md hover:bg-stone-50"
      >
        View linked property →
      </a>
    );
  }

  async function handleConvert() {
    if (
      !confirm(
        "Mark this build complete and add it as a rental property? A vacant 'Main' unit will be created automatically."
      )
    ) {
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.rpc("convert_construction_to_property", {
      p_project_id: projectId,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Property created");
    router.push(`/properties/${data}`);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleConvert}
      disabled={busy}
      className="px-3 py-1.5 text-sm bg-emerald-700 text-white rounded-md hover:bg-emerald-800 disabled:opacity-60"
    >
      {busy ? "Converting…" : "Convert to property"}
    </button>
  );
}
