import { createBrowserClient } from "@supabase/ssr";

// =============================================================
// SUPABASE BROWSER CLIENT
// =============================================================
//
// WHY TWO CLIENTS (browser vs server)?
// Supabase needs different configurations depending on where it runs:
//
// BROWSER CLIENT (this file):
// - Runs in the user's browser
// - Uses the anon key (public, safe to expose)
// - Handles auth cookies automatically
// - Used by React components
//
// SERVER CLIENT (supabase-server.ts):
// - Runs on the Node.js server
// - Reads cookies from the request to get the user session
// - Used in Server Components, API routes, middleware
//
// WHY @supabase/ssr?
// Standard @supabase/supabase-js stores auth tokens in localStorage.
// That doesn't work with Server-Side Rendering (SSR) because the
// server has no localStorage. @supabase/ssr uses cookies instead,
// which are sent with every request — server and client both can read them.
//
// ALTERNATIVE: Use @supabase/supabase-js directly with localStorage.
// Works for client-only apps but breaks SSR and server-side auth checks.

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
