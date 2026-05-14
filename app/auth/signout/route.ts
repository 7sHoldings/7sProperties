import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Signs the user out and sends them to the requested destination (default: /).
// Used by the landing page "Sign in as someone else" link and anywhere we need
// a server-side sign-out without bouncing through a client component.
async function signOut(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const next = searchParams.get("next") || "/";
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(`${origin}${next}`);
}

export async function GET(request: Request) {
  return signOut(request);
}

export async function POST(request: Request) {
  return signOut(request);
}
