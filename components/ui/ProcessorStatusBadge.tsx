type Status = "succeeded" | "processing" | "pending" | "failed" | "refunded" | null | undefined;

const MAP: Record<string, { label: string; cls: string }> = {
  succeeded: { label: "Cleared", cls: "bg-green-50 text-green-800 border-green-200" },
  processing: { label: "Processing", cls: "bg-amber-50 text-amber-800 border-amber-200" },
  pending: { label: "Pending", cls: "bg-amber-50 text-amber-800 border-amber-200" },
  failed: { label: "Failed", cls: "bg-red-50 text-red-800 border-red-200" },
  refunded: { label: "Refunded", cls: "bg-stone-100 text-stone-700 border-stone-200" },
};

export default function ProcessorStatusBadge({ status }: { status: Status }) {
  // Manually-recorded payments don't carry a processor_status; show "Recorded"
  if (!status) {
    return (
      <span className="inline-flex items-center text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border bg-stone-100 text-stone-700 border-stone-200">
        Recorded
      </span>
    );
  }
  const m = MAP[status] || MAP.pending;
  return (
    <span
      className={`inline-flex items-center text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${m.cls}`}
    >
      {m.label}
    </span>
  );
}
