import Link from "next/link";
import MaintenanceForm from "@/components/forms/MaintenanceForm";

export default function NewMaintenancePage() {
  return (
    <div className="p-4 sm:p-6 max-w-xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-stone-500 mb-4">
        <Link href="/maintenance" className="hover:underline">
          Maintenance
        </Link>
        <span>›</span>
        <span className="text-stone-900">New</span>
      </div>
      <h1 className="text-2xl font-medium mb-6">New maintenance request</h1>
      <MaintenanceForm mode="create" />
    </div>
  );
}
