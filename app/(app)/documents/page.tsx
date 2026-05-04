import { createClient } from "@/lib/supabase/server";
import DocumentsList from "@/components/lists/DocumentsList";

export default async function DocumentsPage() {
  const supabase = await createClient();
  const [docsRes, propsRes] = await Promise.all([
    supabase
      .from("documents")
      .select(
        "*, properties(name), tenants(full_name), expenses(description, property_id), payments(payment_date, leases(tenants(full_name)))"
      )
      .order("created_at", { ascending: false }),
    supabase.from("properties").select("id, name").order("name"),
  ]);

  const docs = (docsRes.data || []) as any[];
  const properties = (propsRes.data || []) as any[];

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-medium">Documents</h1>
          <p className="text-sm text-stone-500">
            {docs.length} file{docs.length === 1 ? "" : "s"} · uploaded from properties, tenants,
            expenses, payments
          </p>
        </div>
      </div>

      <DocumentsList docs={docs} properties={properties} />
    </div>
  );
}
