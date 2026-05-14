import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/", "/login", "/tenant/login", "/tenant/signup", "/auth"];

function isPublicPath(path: string) {
  if (path === "/") return true;
  return PUBLIC_PATHS.some((p) => p !== "/" && (path === p || path.startsWith(p + "/")));
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const path = request.nextUrl.pathname;

  // Stripe webhook is called by Stripe itself (no cookies); signature is
  // verified inside the handler. Skip auth entirely.
  if (path === "/api/stripe/webhook") return response;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isOwnerLoginRoute = path === "/login" || path.startsWith("/login/");
  const isTenantLoginRoute = path === "/tenant/login" || path === "/tenant/signup";
  const isTenantArea = (path === "/tenant" || path.startsWith("/tenant/")) && !isTenantLoginRoute;
  const isApiRoute = path.startsWith("/api/");

  // Unauthenticated: allow public paths, redirect everything else to appropriate login
  if (!user) {
    if (isPublicPath(path)) return response;
    if (isApiRoute) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = path.startsWith("/tenant") ? "/tenant/login" : "/login";
    return NextResponse.redirect(url);
  }

  const role = (user.user_metadata?.role as string) || "owner";

  // Logged-in user hitting a login page → bounce to their home
  if (isOwnerLoginRoute || isTenantLoginRoute) {
    const url = request.nextUrl.clone();
    url.pathname = role === "tenant" ? "/tenant" : "/dashboard";
    return NextResponse.redirect(url);
  }

  // API routes: auth-gate only, no role redirects (both roles need to call them)
  if (isApiRoute) return response;

  // Tenant hitting an owner-only path → bounce to tenant portal
  if (role === "tenant" && !isTenantArea && path !== "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/tenant";
    return NextResponse.redirect(url);
  }

  // Owner hitting a tenant-only path → bounce to owner dashboard
  if (role === "owner" && isTenantArea) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
