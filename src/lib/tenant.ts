/**
 * Tenant resolution now lives in src/lib/auth.ts (getUserTenant), which derives
 * the caller's OWN tenant from their Supabase session and provisions a private
 * workspace on first sign-in. There is no "active demo tenant" any more.
 *
 * This id is only the optional seeded sample brand from 0002_seed.sql, kept for
 * local reference. It has no members, so no signed-in user is ever routed to it.
 * You can safely delete that tenant row in production.
 */
export const SAMPLE_TENANT = "00000000-0000-0000-0000-000000000001";
