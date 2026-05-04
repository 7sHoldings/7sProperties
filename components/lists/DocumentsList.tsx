"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { FileText, Download, Trash2, Image as ImageIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import ListControls from "@/components/ui/ListControls";
import EmptyState from "@/components/ui/EmptyState";
import StatusBadge from "@/components/ui/StatusBadge";

const TYPES = [
  { value: "all", label: "All types" },
  { value: "lease", label: "Lease" },
  { value: "receipt", label: "Receipt" },
  { value: "id_document", label: "ID document" },
  { value: "insurance", label: "Insurance" },
  { value: "tax_document", label: "Tax document" },
  { value: "photo", label: "Photo" },
  { value: "other", label: "Other" },
];

const ATTACH_TYPES = [
  { value: "all", label: "All sources" },
  { value: "property", label: "Property" },
  { value: "tenant", label: "Tenant" },
  { value: "lease", label: "Lease" },
  { value: "expense", label: "Expense" },
  { value: "payment", label: "Payment" },
  { value: "general", label: "Unattached" },
];

const SORTS = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "name", label: "File name" },
  { value: "size", label: "Size (largest)" },
];

function formatSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(mime: string | null) {
  return !!mime && mime.startsWith("image/");
}

function attachLabel(d: any) {
  if (d.expense_id) return "Expense";
  if (d.payment_id) return "Payment";
  if (d.lease_id) return "Lease";
  if (d.tenant_id) return "Tenant";
  if (d.property_id) return "Property";
  return "General";
}

function attachContext(d: any) {
  if (d.expenses) return d.expenses.description;
  if (d.payments)
    return `${d.payments.leases?.tenants?.full_name || ""} · ${d.payments.payment_date || ""}`;
  if (d.tenants) return d.tenants.full_name;
  if (d.properties) return d.properties.name;
  return "";
}

type Props = {
  docs: any[];
  properties: { id: string; name: string }[];
};

export default function DocumentsList({ docs, properties }: Props) {
  const supabase = createClient();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [docType, setDocType] = useState("all");
  const [attach, setAttach] = useState("all");
  const [propertyId, setPropertyId] = useState("all");
  const [sort, setSort] = useState("newest");

  const filtered = useMemo(() => {
    let list = docs.slice();
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (d) =>
          d.file_name?.toLowerCase().includes(q) ||
          attachContext(d)?.toLowerCase().includes(q)
      );
    }
    if (docType !== "all") list = list.filter((d) => d.document_type === docType);
    if (attach !== "all") {
      list = list.filter((d) => {
        switch (attach) {
          case "property":
            return d.property_id && !d.expense_id && !d.payment_id && !d.lease_id && !d.tenant_id;
          case "tenant":
            return d.tenant_id;
          case "lease":
            return d.lease_id;
          case "expense":
            return d.expense_id;
          case "payment":
            return d.payment_id;
          case "general":
            return !d.property_id && !d.tenant_id && !d.lease_id && !d.expense_id && !d.payment_id;
        }
        return true;
      });
    }
    if (propertyId !== "all") {
      list = list.filter(
        (d) =>
          d.property_id === propertyId ||
          (d.expenses && d.expenses.property_id === propertyId)
      );
    }

    list.sort((a, b) => {
      switch (sort) {
        case "oldest":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "name":
          return (a.file_name || "").localeCompare(b.file_name || "");
        case "size":
          return Number(b.file_size || 0) - Number(a.file_size || 0);
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
    return list;
  }, [docs, search, docType, attach, propertyId, sort]);

  async function handleDownload(doc: any) {
    const { data, error } = await supabase.storage
      .from("documents")
      .createSignedUrl(doc.file_path, 60);
    if (error || !data) {
      toast.error(error?.message || "Failed to get download link");
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  async function handleDelete(doc: any) {
    if (!confirm(`Delete "${doc.file_name}"?`)) return;
    await supabase.storage.from("documents").remove([doc.file_path]);
    const { error } = await supabase.from("documents").delete().eq("id", doc.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    router.refresh();
  }

  const propOptions = [
    { value: "all", label: "All properties" },
    ...properties.map((p) => ({ value: p.id, label: p.name })),
  ];

  return (
    <>
      <ListControls
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search file name or context..."
        filters={[
          { id: "type", label: "Type", value: docType, onChange: setDocType, options: TYPES },
          { id: "attach", label: "Attached to", value: attach, onChange: setAttach, options: ATTACH_TYPES },
          { id: "property", label: "Property", value: propertyId, onChange: setPropertyId, options: propOptions },
        ]}
        sort={{ value: sort, onChange: setSort, options: SORTS }}
        resultCount={filtered.length}
        totalCount={docs.length}
      />

      {docs.length === 0 ? (
        <EmptyState
          icon={<FileText className="w-6 h-6" />}
          title="No documents yet"
          description="Upload receipts, leases, photos, and tax documents from each item's edit page or directly when creating expenses/payments."
        />
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-xl p-8 text-center text-stone-500">
          No documents match your filters.
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
          <ul className="divide-y divide-stone-100">
            {filtered.map((d: any) => (
              <li key={d.id} className="flex items-center gap-3 p-3 hover:bg-stone-50">
                {isImage(d.mime_type) ? (
                  <ImageIcon className="w-5 h-5 text-blue-500 shrink-0" />
                ) : (
                  <FileText className="w-5 h-5 text-stone-400 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{d.file_name}</div>
                  <div className="text-xs text-stone-500 flex flex-wrap items-center gap-2">
                    <StatusBadge tone="stone">{attachLabel(d)}</StatusBadge>
                    {attachContext(d) && <span className="truncate">{attachContext(d)}</span>}
                    {d.document_type && (
                      <span className="capitalize">·{" "}{d.document_type.replace("_", " ")}</span>
                    )}
                    {d.file_size ? <span>· {formatSize(d.file_size)}</span> : null}
                    <span>· {format(new Date(d.created_at), "MMM d, yyyy")}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleDownload(d)}
                  className="text-stone-500 hover:text-teal-700 p-2"
                  title="Download / view"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(d)}
                  className="text-stone-400 hover:text-red-600 p-2"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
