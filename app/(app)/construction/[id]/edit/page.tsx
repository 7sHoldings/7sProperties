"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import ConstructionProjectForm from "@/components/forms/ConstructionProjectForm";
import { Skeleton } from "@/components/ui/Skeleton";

export default function EditConstructionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const supabase = createClient();
  const [project, setProject] = useState<any | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    supabase
      .from("construction_projects")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) setNotFound(true);
        else setProject(data);
      });
  }, [id]);

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-stone-500 mb-4">
        <Link href="/construction" className="hover:underline">
          Construction
        </Link>
        <span>›</span>
        {project ? (
          <>
            <Link href={`/construction/${id}`} className="hover:underline">
              {project.name}
            </Link>
            <span>›</span>
          </>
        ) : null}
        <span className="text-stone-900">Edit</span>
      </div>

      <h1 className="text-2xl font-medium mb-6">Edit project</h1>

      {notFound ? (
        <p className="text-stone-500">Project not found.</p>
      ) : !project ? (
        <div className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <div className="grid grid-cols-3 gap-3">
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
          </div>
        </div>
      ) : (
        <ConstructionProjectForm
          mode="edit"
          projectId={id}
          initial={{
            name: project.name,
            address: project.address || "",
            city: project.city || "",
            state: project.state || "",
            zip: project.zip || "",
            property_type: project.property_type || "single_family",
            status: project.status || "planning",
            start_date: project.start_date || "",
            expected_completion_date: project.expected_completion_date || "",
            actual_completion_date: project.actual_completion_date || "",
            budget: project.budget ?? undefined,
            bedrooms: project.bedrooms ?? undefined,
            bathrooms: project.bathrooms ?? undefined,
            square_feet: project.square_feet ?? undefined,
            notes: project.notes || "",
          }}
        />
      )}
    </div>
  );
}
