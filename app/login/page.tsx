"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Building2 } from "lucide-react";

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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(
    params.get("error") === "auth" ? "Authentication link was invalid or expired." : ""
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) setMessage(error.message);
      else setMessage("Check your email to confirm your account.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage(error.message);
      else router.push("/");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-xl border border-stone-200 p-8">
        <div className="flex items-center gap-2 mb-6">
          <Building2 className="w-6 h-6 text-teal-700" />
          <h1 className="text-xl font-medium">Rental Manager</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-stone-600 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>
          <div>
            <label className="block text-sm text-stone-600 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-3 py-2 border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-teal-700 text-white py-2 rounded-md hover:bg-teal-800 disabled:opacity-50"
          >
            {loading ? "Loading..." : isSignUp ? "Sign up" : "Sign in"}
          </button>
        </form>

        {message && <p className="mt-4 text-sm text-stone-600">{message}</p>}

        <button
          onClick={() => setIsSignUp(!isSignUp)}
          className="mt-4 text-sm text-teal-700 hover:underline w-full text-center"
        >
          {isSignUp ? "Already have an account? Sign in" : "Need an account? Sign up"}
        </button>

        {!isSignUp && (
          <Link href="/login/reset" className="mt-2 text-xs text-stone-500 hover:underline w-full text-center block">
            Forgot password?
          </Link>
        )}
      </div>
    </div>
  );
}
