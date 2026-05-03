import Link from "next/link";
import TenantForm from "@/components/forms/TenantForm";

export default function NewTenantPage() {
  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-stone-500 mb-4">
        <Link href="/tenants" className="hover:underline">
          Tenants
        </Link>
        <span>›</span>
        <span className="text-stone-900">Add new</span>
      </div>
      <h1 className="text-2xl font-medium mb-6">Add tenant</h1>
      <TenantForm mode="create" />
    </div>
  );
}
