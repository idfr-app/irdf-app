import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * Server-side Supabase client bound to the request's cookies. Use in Server
 * Components, Server Actions, and Route Handlers. Uses ONLY getAll/setAll (the
 * current @supabase/ssr contract). Writing cookies from a Server Component
 * throws — the try/catch swallows it; the middleware keeps sessions fresh.
 *
 * (Next 14: cookies() is synchronous.)
 */
export function serverSupabase() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — ignore; middleware refreshes.
          }
        },
      },
    },
  );
}
