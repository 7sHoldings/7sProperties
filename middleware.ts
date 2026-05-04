import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isOwnerLogin = path === "/login" || path.startsWith("/login/");
  const isTenantLogin = path === "/tenant/login" || path === "/tenant/signup";
  const isAuth = path.startsWith("/auth");
  const isTenantArea = path.startsWith("/tenant") && !isTenantLogin;

  // Unauthenticated: redirect to the appropriate login
  if (!user) {
    if (isOwnerLogin || isTenantLogin || isAuth) return response;
    const url = request.nextUrl.clone();
    url.pathname = path.startsWith("/tenant") ? "/tenant/login" : "/login";
    return NextResponse.redirect(url);
  }

  // Determine role from user metadata (set on signup)
  const role = (user.user_metadata?.role as string) || "owner";

  // Tenant trying to access owner-only pages → redirect to tenant portal
  if (role === "tenant" && !isTenantArea && !isTenantLogin && !isAuth) {
    const url = request.nextUrl.clone();
    url.pathname = "/tenant";
    return NextResponse.redirect(url);
  }

  // Owner trying to access tenant pages → redirect to owner dashboard
  if (role === "owner" && isTenantArea) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // Already-authenticated user hitting login pages → bounce to their home
  if (user && (isOwnerLogin || isTenantLogin)) {
    const url = request.nextUrl.clone();
    url.pathname = role === "tenant" ? "/tenant" : "/";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
