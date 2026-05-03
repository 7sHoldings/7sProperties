export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-stone-200 rounded ${className}`} />;
}

export function SkeletonText({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-3 ${i === lines - 1 ? "w-2/3" : "w-full"}`} />
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4">
      <Skeleton className="h-4 w-32 mb-3" />
      <Skeleton className="h-8 w-24 mb-2" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-stone-50 border-b border-stone-100 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="px-4 py-3 border-b border-stone-100 last:border-0 flex gap-4">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-3 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
