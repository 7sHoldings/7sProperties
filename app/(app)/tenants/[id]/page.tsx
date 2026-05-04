import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import DeleteButton from "@/components/DeleteButton";
import DocumentUpload from "@/components/DocumentUpload";
import InviteTenantButton from "@/components/InviteTenantButton";

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!tenant) notFound();

  const [leasesRes, paymentsRes] = await Promise.all([
    supabase
      .from("leases")
      .select("*, units(unit_label, properties(id, name))")
      .eq("tenant_id", id)
      .order("start_date", { ascending: false }),
    supabase
      .from("payments")
      .select("*, leases!inner(tenant_id)")
      .eq("leases.tenant_id", id)
      .order("payment_date", { ascending: false })
      .limit(20),
  ]);

  const leases = (leasesRes.data || []) as any[];
  const payments = (paymentsRes.data || []) as any[];
  const totalPaid = payments.reduce((s: number, p: any) => s + Number(p.amount), 0);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-stone-500 mb-4">
        <Link href="/tenants" className="hover:underline">Tenants</Link>
        <span>›</span>
        <span className="text-stone-900">{tenant.full_name}</span>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-medium">{tenant.full_name}</h1>
          <p className="text-sm text-stone-500 mt-1">
            {tenant.email || "—"} · {tenant.phone || "—"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <InviteTenantButton
            tenantId={tenant.id}
            tenantEmail={tenant.email}
            portalActivated={!!tenant.portal_activated_at}
          />
          <Link
            href={`/tenants/${tenant.id}/edit`}
            className="px-3 py-1.5 text-sm bg-white border border-stone-200 rounded-md hover:bg-stone-50"
          >
            Edit
          </Link>
          <DeleteButton
            table="tenants"
            id={tenant.id}
            redirectTo="/tenants"
            confirmMessage="This tenant, all their leases, and all payment history will be deleted. Any units they occupy will be set back to vacant."
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <Stat label="Active leases" value={leases.filter((l: any) => l.status === "active").length} />
        <Stat label="Total payments" value={payments.length} />
        <Stat label="Lifetime paid" value={`$${totalPaid.toLocaleString()}`} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <div className="bg-white border border-stone-200 rounded-xl p-4">
          <h2 className="font-medium mb-3">Lease history</h2>
          {leases.length === 0 ? (
            <p className="text-sm text-stone-500">No leases.</p>
          ) : (
            <ul className="text-sm divide-y divide-stone-100">
              {leases.map((l: any) => (
                <li key={l.id} className="py-2">
                  <div className="flex justify-between">
                    <Link href={`/properties/${l.units?.properties?.id}`} className="hover:underline">
                      {l.units?.properties?.name}
                      {l.units?.unit_label && l.units.unit_label !== "Main" ? ` · ${l.units.unit_label}` : ""}
                    </Link>
                    <span className="text-stone-600">${Number(l.monthly_rent).toLocaleString()}/mo</span>
                  </div>
                  <div className="text-xs text-stone-500 mt-0.5">
                    {format(new Date(l.start_date), "MMM d, yyyy")} – {format(new Date(l.end_date), "MMM d, yyyy")} · {l.status}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white border border-stone-200 rounded-xl p-4">
          <h2 className="font-medium mb-3">Payment history</h2>
          {payments.length === 0 ? (
            <p className="text-sm text-stone-500">No payments yet.</p>
          ) : (
            <ul className="text-sm divide-y divide-stone-100">
              {payments.map((p: any) => (
                <li key={p.id} className="flex justify-between py-2">
                  <div>
                    <div>{format(new Date(p.payment_date), "MMM d, yyyy")}</div>
                    <div className="text-xs text-stone-500">For {format(new Date(p.for_month), "MMM yyyy")}</div>
                  </div>
                  <span className="text-green-700 font-medium">${Number(p.amount).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-white border border-stone-200 rounded-xl p-4">
          <h2 className="font-medium mb-3">Emergency contact</h2>
          <p className="text-sm">
            <span className="text-stone-500">Name:</span> {tenant.emergency_contact_name || "—"}
          </p>
          <p className="text-sm mt-1">
            <span className="text-stone-500">Phone:</span> {tenant.emergency_contact_phone || "—"}
          </p>
          {tenant.notes && (
            <>
              <h3 className="font-medium mt-4 mb-1 text-sm">Notes</h3>
              <p className="text-sm text-stone-700 whitespace-pre-wrap">{tenant.notes}</p>
            </>
          )}
        </div>

        <DocumentUpload tenantId={tenant.id} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4">
      <div className="text-xs text-stone-500 mb-1">{label}</div>
      <div className="text-lg font-medium">{value}</div>
    </div>
  );
}
