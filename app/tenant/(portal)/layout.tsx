import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TenantShell from "@/components/TenantShell";

export default async function TenantLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/tenant/login");

  const role = (user.user_metadata?.role as string) || "owner";
  if (role !== "tenant") redirect("/");

  const { data: tenant } = await supabase
    .from("tenants")
    .select("full_name")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  return (
    <TenantShell userEmail={user.email || ""} tenantName={tenant?.full_name || ""}>
      {children}
    </TenantShell>
  );
}
