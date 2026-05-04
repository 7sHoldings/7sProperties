"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { FileText, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import EmptyState from "@/components/ui/EmptyState";

type Doc = {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  document_type: string | null;
  created_at: string;
};

function formatSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function TenantDocumentsPage() {
  const supabase = createClient();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("documents")
        .select("id, file_name, file_path, file_size, mime_type, document_type, created_at")
        .order("created_at", { ascending: false });
      setDocs((data || []) as Doc[]);
      setLoading(false);
    })();
  }, []);

  async function handleDownload(doc: Doc) {
    const { data, error } = await supabase.storage
      .from("documents")
      .createSignedUrl(doc.file_path, 60);
    if (error || !data) {
      toast.error(error?.message || "Failed to get download link");
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-medium">Documents</h1>
        <p className="text-sm text-stone-500">Files shared by your property owner</p>
      </div>

      {loading ? (
        <div className="text-sm text-stone-500">Loading...</div>
      ) : docs.length === 0 ? (
        <EmptyState
          icon={<FileText className="w-6 h-6" />}
          title="No documents yet"
          description="Your property owner hasn't shared any documents with you yet."
        />
      ) : (
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
          <ul className="divide-y divide-stone-100">
            {docs.map((d) => (
              <li key={d.id} className="flex items-center gap-3 p-3 hover:bg-stone-50">
                <FileText className="w-5 h-5 text-stone-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{d.file_name}</div>
                  <div className="text-xs text-stone-500">
                    {d.document_type && (
                      <span className="capitalize">
                        {d.document_type.replace("_", " ")}
                      </span>
                    )}
                    {d.file_size ? ` · ${formatSize(d.file_size)}` : ""}
                    {` · ${format(new Date(d.created_at), "MMM d, yyyy")}`}
                  </div>
                </div>
                <button
                  onClick={() => handleDownload(d)}
                  className="text-stone-500 hover:text-teal-700 p-2"
                  title="Download"
                >
                  <Download className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
