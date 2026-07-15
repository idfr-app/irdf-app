/**
 * Central env access. Secrets are read here and NEVER written to any tenant
 * table or returned to the browser. The AI router reads provider keys from
 * server env only (BYOK per-tenant keys arrive in Phase 2 via a vault, not here).
 */
function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}
function opt(name: string): string | undefined {
  return process.env[name] || undefined;
}

export const env = {
  // Public (safe for the browser)
  supabaseUrl: () => req("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: () => req("NEXT_PUBLIC_SUPABASE_ANON_KEY"),

  // Server-only
  supabaseServiceKey: () => req("SUPABASE_SERVICE_ROLE_KEY"),
  cronSecret: () => opt("CRON_SECRET"),

  // AI provider keys — server-only, optional. Absent ⇒ deterministic templates.
  anthropicKey: () => opt("ANTHROPIC_API_KEY"),
  openaiKey: () => opt("OPENAI_API_KEY"),

  isServer: typeof window === "undefined",
};
