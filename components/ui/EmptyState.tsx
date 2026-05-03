import Link from "next/link";
import { ReactNode } from "react";

type Props = {
  icon?: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
};

export default function EmptyState({ icon, title, description, actionLabel, actionHref }: Props) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-10 text-center">
      {icon && <div className="mx-auto w-12 h-12 rounded-full bg-stone-50 flex items-center justify-center text-stone-400 mb-3">{icon}</div>}
      <h3 className="text-base font-medium text-stone-900 mb-1">{title}</h3>
      {description && <p className="text-sm text-stone-500 mb-4">{description}</p>}
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-teal-700 text-white rounded-md hover:bg-teal-800"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
