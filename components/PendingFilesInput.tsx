"use client";

import { useRef } from "react";
import { Paperclip, X, FileText, Image as ImageIcon } from "lucide-react";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type Props = {
  files: File[];
  onChange: (files: File[]) => void;
  label?: string;
  hint?: string;
};

export default function PendingFilesInput({
  files,
  onChange,
  label = "Attach files",
  hint = "Receipts, screenshots, photos. Max 10 MB each.",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files || []);
    const valid = picked.filter((f) => f.size <= MAX_FILE_SIZE);
    if (valid.length < picked.length) {
      alert("Some files exceeded 10 MB and were skipped.");
    }
    onChange([...files, ...valid]);
    if (inputRef.current) inputRef.current.value = "";
  }

  function remove(idx: number) {
    onChange(files.filter((_, i) => i !== idx));
  }

  return (
    <div>
      <label className="block text-sm text-stone-700 mb-1 font-medium">{label}</label>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-sm border border-dashed border-stone-300 text-stone-600 rounded-md hover:border-teal-400 hover:bg-stone-50"
      >
        <Paperclip className="w-4 h-4" />
        Click to select images or files
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,.pdf,.doc,.docx"
        onChange={handleSelect}
        className="hidden"
      />

      {hint && <p className="text-xs text-stone-500 mt-1">{hint}</p>}

      {files.length > 0 && (
        <ul className="mt-2 space-y-1">
          {files.map((f, i) => (
            <li
              key={i}
              className="flex items-center gap-2 px-2 py-1.5 bg-stone-50 border border-stone-200 rounded-md text-sm"
            >
              {f.type.startsWith("image/") ? (
                <ImageIcon className="w-4 h-4 text-blue-500 shrink-0" />
              ) : (
                <FileText className="w-4 h-4 text-stone-400 shrink-0" />
              )}
              <span className="flex-1 truncate">{f.name}</span>
              <span className="text-xs text-stone-500">{formatSize(f.size)}</span>
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-stone-400 hover:text-red-600"
                aria-label="Remove"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
