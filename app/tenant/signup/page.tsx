"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/FormField";
import Button from "@/components/ui/Button";

const signupSchema = z
  .object({
    password: z.string().min(8, "At least 8 characters"),
    confirm: z.string().min(1, "Confirm your password"),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });
type SignupInput = z.infer<typeof signupSchema>;

export default function TenantSignupPage() {
  return (
    <Suspense fallback={null}>
      <TenantSignupForm />
    </Suspense>
  );
}

function TenantSignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();
  const token = params.get("token") || "";

  const [tenant, setTenant] = useState<any | null>(null);
  const [validating, setValidating] = useState(true);
  const [tokenError, setTokenError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
  });

  useEffect(() => {
    async function check() {
      if (!token) {
        setTokenError("This signup link is missing an invite token. Ask your property owner for a new invite.");
        setValidating(false);
        return;
      }
      const { data, error } = await supabase
        .rpc("lookup_tenant_invite", { p_token: token })
        .maybeSingle();

      if (error || !data) {
        setTokenError("This invite link is invalid. Ask your property owner to send a new one.");
      } else if ((data as any).portal_activated_at) {
        setTokenError("This invite has already been used. Sign in instead.");
      } else if ((data as any).invite_expires_at && new Date((data as any).invite_expires_at) < new Date()) {
        setTokenError("This invite link has expired. Ask your property owner to send a new one.");
      } else if (!(data as any).email) {
        setTokenError("Your tenant record has no email. Contact your property owner.");
      } else {
        setTenant(data);
      }
      setValidating(false);
    }
    check();
  }, [token]);

  async function onSubmit(values: SignupInput) {
    if (!tenant) return;

    const { data, error } = await supabase.auth.signUp({
      email: tenant.email,
      password: values.password,
      options: {
        data: { role: "tenant", invite_token: token },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/tenant`,
      },
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    // Link the tenant row to this new auth user and consume the invite
    // (uses a SECURITY DEFINER RPC because the user can't UPDATE tenants
    // directly until auth_user_id is set — chicken/egg)
    if (data.user) {
      await supabase.rpc("activate_tenant_invite", {
        p_token: token,
        p_user_id: data.user.id,
      });
    }

    toast.success("Account created");
    if (data.session) {
      router.push("/tenant");
    } else {
      router.push("/tenant/login?info=check_email");
    }
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
            <p className="text-xs text-stone-500">Activate tenant portal</p>
          </div>
        </div>

        {validating ? (
          <p className="text-sm text-stone-500">Verifying invite...</p>
        ) : tokenError ? (
          <>
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3 mb-4">
              {tokenError}
            </p>
            <Link
              href="/tenant/login"
              className="text-sm text-teal-700 hover:underline w-full text-center block"
            >
              Back to sign in
            </Link>
          </>
        ) : tenant ? (
          <>
            <p className="text-sm text-stone-600 mb-1">
              Welcome, <span className="font-medium text-stone-900">{tenant.full_name}</span>.
            </p>
            <p className="text-xs text-stone-500 mb-4">
              Set a password to activate your portal at <span className="font-medium">{tenant.email}</span>.
            </p>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
              <Input
                label="Password"
                type="password"
                autoComplete="new-password"
                required
                hint="At least 8 characters"
                error={errors.password?.message}
                {...register("password")}
              />
              <Input
                label="Confirm password"
                type="password"
                autoComplete="new-password"
                required
                error={errors.confirm?.message}
                {...register("confirm")}
              />
              <Button type="submit" loading={isSubmitting} fullWidth size="lg">
                Create my account
              </Button>
            </form>
          </>
        ) : null}
      </div>
    </div>
  );
}
