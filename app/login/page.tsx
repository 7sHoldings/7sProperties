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

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();
  const [isSignUp, setIsSignUp] = useState(false);
  const [info, setInfo] = useState(
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
    setInfo("");
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) {
        toast.error(error.message);
      } else {
        setInfo("Check your email to confirm your account.");
        toast.success("Confirmation email sent");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });
      if (error) toast.error(error.message);
      else {
        toast.success("Welcome back");
        router.push("/");
      }
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
            <p className="text-xs text-stone-500">Property manager</p>
          </div>
        </div>

        <h2 className="text-base font-medium mb-4">{isSignUp ? "Create your account" : "Sign in"}</h2>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
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
            autoComplete={isSignUp ? "new-password" : "current-password"}
            required
            error={errors.password?.message}
            hint={isSignUp ? "At least 6 characters" : undefined}
            {...register("password")}
          />
          <Button type="submit" loading={isSubmitting} fullWidth size="lg">
            {isSignUp ? "Sign up" : "Sign in"}
          </Button>
        </form>

        {info && <p className="mt-4 text-sm text-stone-600">{info}</p>}

        <button
          onClick={() => setIsSignUp(!isSignUp)}
          className="mt-4 text-sm text-teal-700 hover:underline w-full text-center"
        >
          {isSignUp ? "Already have an account? Sign in" : "Need an account? Sign up"}
        </button>

        {!isSignUp && (
          <Link
            href="/login/reset"
            className="mt-2 text-xs text-stone-500 hover:underline w-full text-center block"
          >
            Forgot password?
          </Link>
        )}
      </div>
    </div>
  );
}
