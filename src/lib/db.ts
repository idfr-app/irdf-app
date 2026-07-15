import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

/**
 * Two ways in:
 *  • userClient(accessToken) — RLS-enforced, acts AS the signed-in user. Use for
 *    anything driven by a request from the console.
 *  • svc() — service role, bypasses RLS. Use ONLY server-side in the orchestrator
 *    and cron, and ALWAYS scope every query by tenant_id explicitly. RLS is the
 *    safety net; explicit tenant scoping is the rule.
 */

let _svc: SupabaseClient | null = null;

export function svc(): SupabaseClient {
  if (!env.isServer) throw new Error("svc() is server-only");
  if (_svc) return _svc;
  _svc = createClient(env.supabaseUrl(), env.supabaseServiceKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _svc;
}

export function userClient(accessToken: string): SupabaseClient {
  return createClient(env.supabaseUrl(), env.supabaseAnonKey(), {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
