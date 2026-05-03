"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { FileText, Upload, Trash2, Download } from "lucide-react";
import { format } from "date-fns";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

type DocRow = {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  document_type: string | null;
  created_at: string;
};

type Props = {
  propertyId?: string;
  tenantId?: string;
  leaseId?: string;
  expenseId?: string;
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export default function DocumentUpload(props: Props) {
  const supabase = createClient();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState("other");
  const [pendingDelete, setPendingDelete] = useState<DocRow | null>(null);

  const filterColumn = props.propertyId
    ? "property_id"
    : props.tenantId
      ? "tenant_id"
      : props.leaseId
        ? "lease_id"
        : "expense_id";
  const filterValue =
    props.propertyId || props.tenantId || props.leaseId || props.expenseId || "";

  async function loadDocs() {
    const { data } = await supabase
      .from("documents")
      .select("*")
      .eq(filterColumn, filterValue)
      .order("created_at", { ascending: false });
    setDocs((data || []) as DocRow[]);
  }

  useEffect(() => {
    if (filterValue) loadDocs();
  }, [filterValue]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      toast.error("File too large (max 10 MB)");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setUploading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not authenticated");
      setUploading(false);
      return;
    }

    const path = `${user.id}/${filterColumn}/${filterValue}/${Date.now()}-${file.name}`;
    const { error: uploadErr } = await supabase.storage.from("documents").upload(path, file);

    if (uploadErr) {
      toast.error(uploadErr.message);
      setUploading(false);
      return;
    }

    const { error: insertErr } = await supabase.from("documents").insert({
      owner_id: user.id,
      [filterColumn]: filterValue,
      document_type: docType,
      file_name: file.name,
      file_path: path,
      file_size: file.size,
      mime_type: file.type,
    });

    if (insertErr) {
      toast.error(insertErr.message);
    } else {
      toast.success("File uploaded");
    }

    if (inputRef.current) inputRef.current.value = "";
    setUploading(false);
    loadDocs();
    router.refresh();
  }

  async function handleDownload(doc: DocRow) {
    const { data, error } = await supabase.storage
      .from("documents")
      .createSignedUrl(doc.file_path, 60);
    if (error || !data) {
      toast.error(error?.message || "Failed to get download link");
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  async function performDelete() {
    if (!pendingDelete) return;
    await supabase.storage.from("documents").remove([pendingDelete.file_path]);
    const { error } = await supabase.from("documents").delete().eq("id", pendingDelete.id);
    if (error) toast.error(error.message);
    else toast.success("File deleted");
    setPendingDelete(null);
    loadDocs();
    router.refresh();
  }

  function formatSize(bytes: number | null) {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4">
      <h2 className="font-medium mb-3">Documents</h2>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          className="px-2 py-1.5 text-sm border border-stone-200 rounded-md"
        >
          <option value="lease">Lease</option>
          <option value="receipt">Receipt</option>
          <option value="id_document">ID document</option>
          <option value="insurance">Insurance</option>
          <option value="tax_document">Tax document</option>
          <option value="photo">Photo</option>
          <option value="other">Other</option>
        </select>
        <label className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-teal-700 text-white rounded-md hover:bg-teal-800 cursor-pointer disabled:opacity-50">
          <Upload className="w-4 h-4" />
          {uploading ? "Uploading..." : "Upload file"}
          <input
            ref={inputRef}
            type="file"
            onChange={handleUpload}
            disabled={uploading}
            className="hidden"
          />
        </label>
        <span className="text-xs text-stone-500">Max 10 MB</span>
      </div>

      {docs.length === 0 ? (
        <p className="text-sm text-stone-500 py-4">No documents yet.</p>
      ) : (
        <ul className="text-sm divide-y divide-stone-100">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center gap-3 py-2">
              <FileText className="w-4 h-4 text-stone-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="truncate">{d.file_name}</div>
                <div className="text-xs text-stone-500">
                  {d.document_type && (
                    <span className="capitalize">{d.document_type.replace("_", " ")}</span>
                  )}
                  {d.file_size ? ` · ${formatSize(d.file_size)}` : ""}
                  {` · ${format(new Date(d.created_at), "MMM d, yyyy")}`}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDownload(d)}
                className="text-stone-400 hover:text-teal-700"
                title="Download"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setPendingDelete(d)}
                className="text-stone-400 hover:text-red-600"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={performDelete}
        title="Delete file?"
        message={pendingDelete ? `"${pendingDelete.file_name}" will be permanently removed.` : ""}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
