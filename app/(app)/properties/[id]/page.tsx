import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import DeleteButton from "@/components/DeleteButton";
import DocumentUpload from "@/components/DocumentUpload";

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: property } = await supabase
    .from("properties")
    .select("*, units(id, unit_label, status, bedrooms, bathrooms, square_feet)")
    .eq("id", id)
    .maybeSingle();

  if (!property) notFound();

  const [leasesRes, paymentsRes, expensesRes, maintRes] = await Promise.all([
    supabase
      .from("leases")
      .select("*, tenants(id, full_name), units!inner(id, unit_label, property_id)")
      .eq("units.property_id", id)
      .order("start_date", { ascending: false }),
    supabase
      .from("payments")
      .select("id, amount, payment_date, for_month, leases!inner(units!inner(property_id), tenants(full_name))")
      .eq("leases.units.property_id", id)
      .order("payment_date", { ascending: false })
      .limit(10),
    supabase
      .from("expenses")
      .select("id, amount, description, category, expense_date")
      .eq("property_id", id)
      .order("expense_date", { ascending: false })
      .limit(10),
    supabase
      .from("maintenance_requests")
      .select("id, title, status, priority, reported_date, cost")
      .eq("property_id", id)
      .order("reported_date", { ascending: false })
      .limit(10),
  ]);

  const leases = (leasesRes.data || []) as any[];
  const payments = (paymentsRes.data || []) as any[];
  const expenses = (expensesRes.data || []) as any[];
  const maintenance = (maintRes.data || []) as any[];

  const totalRent = leases
    .filter((l: any) => l.status === "active")
    .reduce((s: number, l: any) => s + Number(l.monthly_rent), 0);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-stone-500 mb-4">
        <Link href="/properties" className="hover:underline">Properties</Link>
        <span>›</span>
        <span className="text-stone-900 truncate">{property.name}</span>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-medium">{property.name}</h1>
          <p className="text-sm text-stone-500 mt-1">
            {property.address}
            {property.city ? `, ${property.city}` : ""}
            {property.state ? `, ${property.state}` : ""}
            {property.zip ? ` ${property.zip}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/properties/${property.id}/edit`}
            className="px-3 py-1.5 text-sm bg-white border border-stone-200 rounded-md hover:bg-stone-50"
          >
            Edit
          </Link>
          <DeleteButton
            table="properties"
            id={property.id}
            redirectTo="/properties"
            confirmMessage={`Deleting will permanently remove this property along with ${property.units?.length || 0} unit(s), ${leases.length} lease(s), ${payments.length}+ payment(s), ${expenses.length}+ expense(s), and ${maintenance.length}+ maintenance request(s).${leases.some((l: any) => l.status === "active") ? " ⚠️ This property has ACTIVE leases." : ""}`}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Stat label="Type" value={(property.property_type || "—").replace("_", " ")} />
        <Stat label="Bedrooms" value={property.bedrooms ?? "—"} />
        <Stat label="Bathrooms" value={property.bathrooms ?? "—"} />
        <Stat label="Active rent" value={totalRent ? `$${totalRent.toLocaleString()}/mo` : "—"} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <div className="bg-white border border-stone-200 rounded-xl p-4">
          <h2 className="font-medium mb-3">Units</h2>
          {property.units?.length === 0 ? (
            <p className="text-sm text-stone-500">No units.</p>
          ) : (
            <ul className="text-sm divide-y divide-stone-100">
              {property.units?.map((u: any) => (
                <li key={u.id} className="flex justify-between py-2">
                  <span>{u.unit_label}</span>
                  <span className="capitalize text-stone-600">{u.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white border border-stone-200 rounded-xl p-4">
          <h2 className="font-medium mb-3">Leases</h2>
          {leases.length === 0 ? (
            <p className="text-sm text-stone-500">No leases yet.</p>
          ) : (
            <ul className="text-sm divide-y divide-stone-100">
              {leases.map((l: any) => (
                <li key={l.id} className="flex justify-between py-2">
                  <div>
                    <Link href={`/tenants/${l.tenants?.id}`} className="hover:underline">
                      {l.tenants?.full_name}
                    </Link>
                    <div className="text-xs text-stone-500">
                      {format(new Date(l.start_date), "MMM yyyy")} – {format(new Date(l.end_date), "MMM yyyy")} · {l.status}
                    </div>
                  </div>
                  <span>${Number(l.monthly_rent).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <div className="bg-white border border-stone-200 rounded-xl p-4">
          <h2 className="font-medium mb-3">Recent payments</h2>
          {payments.length === 0 ? (
            <p className="text-sm text-stone-500">No payments yet.</p>
          ) : (
            <ul className="text-sm divide-y divide-stone-100">
              {payments.map((p: any) => (
                <li key={p.id} className="flex justify-between py-2">
                  <span>{p.leases?.tenants?.full_name || "—"}</span>
                  <span className="text-green-700">${Number(p.amount).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white border border-stone-200 rounded-xl p-4">
          <h2 className="font-medium mb-3">Recent expenses</h2>
          {expenses.length === 0 ? (
            <p className="text-sm text-stone-500">No expenses yet.</p>
          ) : (
            <ul className="text-sm divide-y divide-stone-100">
              {expenses.map((e: any) => (
                <li key={e.id} className="flex justify-between py-2">
                  <div>
                    <div>{e.description}</div>
                    <div className="text-xs text-stone-500 capitalize">{e.category.replace("_", " ")}</div>
                  </div>
                  <span className="text-red-700">−${Number(e.amount).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-white border border-stone-200 rounded-xl p-4">
          <h2 className="font-medium mb-3">Maintenance</h2>
          {maintenance.length === 0 ? (
            <p className="text-sm text-stone-500">No maintenance requests.</p>
          ) : (
            <ul className="text-sm divide-y divide-stone-100">
              {maintenance.map((m: any) => (
                <li key={m.id} className="flex justify-between py-2">
                  <div>
                    <div>{m.title}</div>
                    <div className="text-xs text-stone-500 capitalize">
                      {m.priority} · {m.status.replace("_", " ")}
                    </div>
                  </div>
                  <span className="text-stone-600">
                    {m.cost ? `$${Number(m.cost).toLocaleString()}` : "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DocumentUpload propertyId={property.id} />
      </div>

      {property.notes && (
        <div className="bg-white border border-stone-200 rounded-xl p-4 mt-3">
          <h2 className="font-medium mb-2">Notes</h2>
          <p className="text-sm text-stone-700 whitespace-pre-wrap">{property.notes}</p>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4">
      <div className="text-xs text-stone-500 mb-1">{label}</div>
      <div className="text-base font-medium capitalize">{value}</div>
    </div>
  );
}
