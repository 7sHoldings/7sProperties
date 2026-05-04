import type { SupabaseClient } from "@supabase/supabase-js";

const COLUMN: Record<string, string> = {
  expense: "expense_id",
  payment: "payment_id",
  property: "property_id",
  tenant: "tenant_id",
  lease: "lease_id",
};

const DOC_TYPE: Record<string, string> = {
  expense: "receipt",
  payment: "receipt",
};

/**
 * Upload pending files to Supabase Storage and create rows in `documents`
 * linking them to the just-created record.
 */
export async function uploadPendingFiles(
  supabase: SupabaseClient,
  userId: string,
  recordId: string,
  recordType: "expense" | "payment" | "property" | "tenant" | "lease",
  files: File[]
) {
  const column = COLUMN[recordType];
  const docType = DOC_TYPE[recordType] || "other";

  for (const file of files) {
    const path = `${userId}/${column}/${recordId}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage
      .from("documents")
      .upload(path, file);
    if (upErr) {
      console.error("upload error", upErr);
      continue;
    }
    await supabase.from("documents").insert({
      owner_id: userId,
      [column]: recordId,
      document_type: docType,
      file_name: file.name,
      file_path: path,
      file_size: file.size,
      mime_type: file.type,
    });
  }
}
