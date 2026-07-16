import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client. @supabase/ssr stores the session in cookies
 * (not localStorage), so the server can read it for SSR + route handlers.
 * Only the public anon key is used here — RLS enforces access at the DB level.
 */
export function browserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
