"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, Upload, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Photo = {
  id: string;
  file_name: string;
  file_path: string;
  signedUrl?: string;
  created_at: string;
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export default function PropertyPhotoGallery({ propertyId }: { propertyId: string }) {
  const supabase = createClient();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [viewing, setViewing] = useState<Photo | null>(null);

  async function load() {
    const { data } = await supabase
      .from("documents")
      .select("id, file_name, file_path, mime_type, created_at")
      .eq("property_id", propertyId)
      .eq("document_type", "photo")
      .order("created_at", { ascending: false });

    const list = (data || []) as any[];
    const withUrls = await Promise.all(
      list.map(async (p) => {
        const { data: signed } = await supabase.storage
          .from("documents")
          .createSignedUrl(p.file_path, 3600);
        return { ...p, signedUrl: signed?.signedUrl };
      })
    );
    setPhotos(withUrls);
  }

  useEffect(() => {
    load();
  }, [propertyId]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not authenticated");
      setUploading(false);
      return;
    }

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name} is over 10 MB`);
        continue;
      }
      const path = `${user.id}/property_id/${propertyId}/photos/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage
        .from("documents")
        .upload(path, file);
      if (upErr) {
        toast.error(upErr.message);
        continue;
      }
      await supabase.from("documents").insert({
        owner_id: user.id,
        property_id: propertyId,
        document_type: "photo",
        file_name: file.name,
        file_path: path,
        file_size: file.size,
        mime_type: file.type,
      });
    }

    if (inputRef.current) inputRef.current.value = "";
    setUploading(false);
    toast.success(`Uploaded ${files.length} photo${files.length === 1 ? "" : "s"}`);
    load();
    router.refresh();
  }

  async function remove(p: Photo) {
    if (!confirm(`Remove ${p.file_name}?`)) return;
    await supabase.storage.from("documents").remove([p.file_path]);
    await supabase.from("documents").delete().eq("id", p.id);
    toast.success("Photo removed");
    load();
  }

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-medium flex items-center gap-2">
          <Camera className="w-4 h-4 text-stone-400" />
          Photos
          <span className="text-xs text-stone-500 font-normal">({photos.length})</span>
        </h2>
        <label className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-teal-700 text-white rounded-md hover:bg-teal-800 cursor-pointer">
          <Upload className="w-3.5 h-3.5" />
          {uploading ? "Uploading..." : "Add photos"}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleUpload}
            disabled={uploading}
            className="hidden"
          />
        </label>
      </div>

      {photos.length === 0 ? (
        <div className="border-2 border-dashed border-stone-200 rounded-md p-8 text-center text-sm text-stone-500">
          No photos yet. Upload exterior, interior, and amenity shots.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {photos.map((p) => (
            <div
              key={p.id}
              className="group relative aspect-square rounded-md overflow-hidden bg-stone-100 cursor-pointer"
              onClick={() => setViewing(p)}
            >
              {p.signedUrl ? (
                <img
                  src={p.signedUrl}
                  alt={p.file_name}
                  className="w-full h-full object-cover group-hover:scale-105 transition"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-stone-400">
                  <Camera className="w-6 h-6" />
                </div>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  remove(p);
                }}
                className="absolute top-1 right-1 p-1 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {viewing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
          onClick={() => setViewing(null)}
        >
          <button
            onClick={() => setViewing(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <X className="w-5 h-5" />
          </button>
          {viewing.signedUrl && (
            <img
              src={viewing.signedUrl}
              alt={viewing.file_name}
              className="max-w-full max-h-full rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      )}
    </div>
  );
}
