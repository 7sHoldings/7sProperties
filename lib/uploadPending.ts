import type { SupabaseClient } from "@supabase/supabase-js";

const COLUMN: Record<string, string> = {
  expense: "expense_id",
  payment: "payment_id",
  property: "property_id",
  tenant: "tenant_id",
  lease: "lease_id",
  // maintenance attachments are stored against the related property
  maintenance: "property_id",
  construction_expense: "construction_expense_id",
};

const DOC_TYPE: Record<string, string> = {
  expense: "receipt",
  payment: "receipt",
  maintenance: "photo",
  construction_expense: "receipt",
};

export type RecordType =
  | "expense"
  | "payment"
  | "property"
  | "tenant"
  | "lease"
  | "maintenance"
  | "construction_expense";

export type PendingFile = File | { file: File; documentType?: string };

function normalize(files: PendingFile[]): { file: File; documentType?: string }[] {
  return files.map((f) => (f instanceof File ? { file: f } : f));
}

/**
 * Upload pending files to Supabase Storage and create rows in `documents`
 * linking them to the just-created record. Pass either plain `File[]` (all
 * tagged with the record-type default) or `{ file, documentType }[]` to tag
 * each file individually (e.g. tenant onboarding: lease vs id_document).
 */
export async function uploadPendingFiles(
  supabase: SupabaseClient,
  userId: string,
  recordId: string,
  recordType: RecordType,
  files: PendingFile[]
) {
  const column = COLUMN[recordType];
  const defaultDocType = DOC_TYPE[recordType] || "other";

  for (const { file, documentType } of normalize(files)) {
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
      document_type: documentType || defaultDocType,
      file_name: file.name,
      file_path: path,
      file_size: file.size,
      mime_type: file.type,
    });
  }
}
