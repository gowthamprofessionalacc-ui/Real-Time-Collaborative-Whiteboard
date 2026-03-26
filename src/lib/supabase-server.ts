import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// =============================================================
// SUPABASE SERVER CLIENT
// =============================================================
//
// Used in Server Components and API routes.
// Reads auth cookies from the request headers.
//
// WHY COOKIES FOR AUTH?
// When a user logs in, Supabase stores a JWT token.
// - In the browser: stored as a cookie
// - On the server: read from the request's Cookie header
// This way, both client and server know who the user is.

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // This can fail in Server Components (read-only).
            // It's fine — the middleware handles cookie setting.
          }
        },
      },
    }
  );
}
