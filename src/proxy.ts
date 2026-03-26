import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// =============================================================
// MIDDLEWARE — Runs on EVERY request before the page loads
// =============================================================
//
// WHY MIDDLEWARE FOR AUTH?
// Instead of checking auth in every page component, middleware
// intercepts the request BEFORE the page loads.
//
// Flow:
//   Browser request → Middleware → (auth check) → Page
//
// If user is not logged in and tries to access /board/*,
// middleware redirects them to /auth/login.
//
// This is the same pattern Next.js recommends for Supabase auth.
//
// WHAT DOES THIS MIDDLEWARE DO?
// 1. Refreshes the auth session (JWT tokens expire, this renews them)
// 2. Protects /board/* routes — only logged-in users can access
// 3. Redirects logged-in users away from /auth/* pages

export default async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
          });
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Refresh the auth session (important — tokens expire!)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Protect board routes — must be logged in
  if (pathname.startsWith("/board") && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }

  // Redirect logged-in users away from auth pages
  if (pathname.startsWith("/auth") && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

// Only run middleware on these routes (skip static files, API, etc.)
export const config = {
  matcher: ["/", "/board/:path*", "/auth/:path*"],
};
