"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Send, Copy, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";

type Props = {
  tenantId: string;
  tenantEmail: string | null;
  portalActivated: boolean;
};

// crypto.randomUUID is browser-native; node 19+ also has it
function generateToken() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function InviteTenantButton({ tenantId, tenantEmail, portalActivated }: Props) {
  const supabase = createClient();
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [inviteUrl, setInviteUrl] = useState("");
  const [copied, setCopied] = useState(false);

  if (portalActivated) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md bg-green-50 text-green-800 border border-green-200">
        <Check className="w-3.5 h-3.5" />
        Portal active
      </span>
    );
  }

  async function generate() {
    if (!tenantEmail) {
      toast.error("Tenant must have an email to receive an invite");
      return;
    }
    setGenerating(true);
    const token = generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14);

    const { error } = await supabase
      .from("tenants")
      .update({
        invite_token: token,
        invite_expires_at: expiresAt.toISOString(),
      })
      .eq("id", tenantId);

    if (error) {
      toast.error(error.message);
      setGenerating(false);
      return;
    }

    const url = `${window.location.origin}/tenant/signup?token=${token}`;
    setInviteUrl(url);
    setGenerating(false);
    toast.success("Invite link generated. Expires in 14 days.");
    router.refresh();
  }

  async function copy() {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (inviteUrl) {
    return (
      <div className="flex flex-col gap-2 w-full">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inviteUrl}
            readOnly
            onClick={(e) => (e.target as HTMLInputElement).select()}
            className="flex-1 text-xs px-2 py-1.5 border border-stone-200 rounded-md bg-stone-50 font-mono"
          />
          <button
            onClick={copy}
            className="inline-flex items-center gap-1 text-xs px-2 py-1.5 border border-stone-200 rounded-md hover:bg-stone-50"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="text-xs text-stone-500">
          Share this link with the tenant. It expires in 14 days.
        </p>
      </div>
    );
  }

  return (
    <Button onClick={generate} loading={generating} variant="secondary" size="md">
      <Send className="w-3.5 h-3.5" />
      Invite to portal
    </Button>
  );
}
