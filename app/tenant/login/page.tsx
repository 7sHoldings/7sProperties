"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { loginSchema, type LoginInput } from "@/lib/schemas";
import { Input } from "@/components/ui/FormField";
import Button from "@/components/ui/Button";

export default function TenantLoginPage() {
  return (
    <Suspense fallback={null}>
      <TenantLoginForm />
    </Suspense>
  );
}

function TenantLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();
  const [info] = useState(
    params.get("error") === "auth" ? "Authentication link was invalid or expired." : ""
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    const role = data.user?.user_metadata?.role;
    if (role !== "tenant") {
      await supabase.auth.signOut();
      toast.error("This login is for tenants. Use /login for property owners.");
      return;
    }
    toast.success("Welcome back");
    router.push("/tenant");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-stone-50">
      <div className="w-full max-w-sm bg-white rounded-xl border border-stone-200 p-7 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-md bg-teal-700 text-white flex items-center justify-center font-bold tracking-tight">
            7s
          </div>
          <div>
            <h1 className="text-lg font-semibold text-stone-900 leading-tight">7s Rental</h1>
            <p className="text-xs text-stone-500">Tenant portal</p>
          </div>
        </div>

        <h2 className="text-base font-medium mb-4">Sign in</h2>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            required
            error={errors.email?.message}
            {...register("email")}
          />
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            error={errors.password?.message}
            {...register("password")}
          />
          <Button type="submit" loading={isSubmitting} fullWidth size="lg">
            Sign in
          </Button>
        </form>

        {info && <p className="mt-4 text-sm text-stone-600">{info}</p>}

        <div className="mt-5 pt-4 border-t border-stone-100 text-xs text-stone-500 text-center space-y-2">
          <p>
            New tenant? You need an invite link from your property owner to sign up.
          </p>
          <Link href="/login" className="block text-teal-700 hover:underline">
            Property owner? Sign in here →
          </Link>
        </div>
      </div>
    </div>
  );
}
