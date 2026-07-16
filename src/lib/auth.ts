import { serverSupabase } from "./supabase/server";
import { svc } from "./db";
import { seal } from "./ledger";
import type { User } from "@supabase/supabase-js";

/**
 * Auth + tenancy glue. Every request-driven read resolves the caller's OWN
 * tenant from their session — never a hard-coded demo. New users are provisioned
 * a private workspace (tenant + brand core + governance + ledger genesis) on
 * first sign-in.
 *
 * Provisioning uses the service role because a brand-new user has no membership
 * yet, so RLS would (correctly) block them from creating their first tenant.
 * Every such write is explicitly scoped to the authenticated user.
 */

/** The verified auth user for this request, or null. */
export async function currentUser(): Promise<User | null> {
  const {
    data: { user },
  } = await serverSupabase().auth.getUser();
  return user;
}

/** Is this user a BI-NET platform operator (admin panel access)? */
export async function isPlatformAdmin(userId: string): Promise<boolean> {
  const { data } = await svc()
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

/**
 * Resolve the caller's tenant id, provisioning a fresh workspace if they have
 * none. Returns null only if there is no signed-in user.
 */
export async function getUserTenant(): Promise<string | null> {
  const user = await currentUser();
  if (!user) return null;

  const { data: existing } = await svc()
    .from("memberships")
    .select("tenant_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (existing?.tenant_id) return existing.tenant_id as string;

  return provisionWorkspace(user);
}

/** Create a private, empty, OFF-by-default workspace for a new user. */
async function provisionWorkspace(user: User): Promise<string> {
  const email = user.email ?? "";
  const handle = email.split("@")[0] || "brand";
  const slug = `${slugify(handle)}-${Math.random().toString(36).slice(2, 8)}`;
  const name = titleize(handle) || "My Brand";

  const { data: tenant, error: tErr } = await svc()
    .from("tenants")
    .insert({ slug, name, plan: "free", owner_email: email })
    .select("id")
    .single();
  if (tErr || !tenant) throw tErr ?? new Error("tenant provisioning failed");
  const tenantId = tenant.id as string;

  // Owner membership, default Brand Core, default (OFF/manual/locked) governance.
  await svc().from("memberships").insert({ tenant_id: tenantId, user_id: user.id, role: "owner" });
  await svc().from("brand_core").insert({ tenant_id: tenantId });
  await svc().from("governance").insert({ tenant_id: tenantId });

  // First ledger entry = genesis (seq 0, prev = GENESIS) via the sealed path.
  await seal(tenantId, "govern", {
    event: "workspace_provisioned",
    title: "Workspace created",
    owner: email,
  });

  return tenantId;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || "brand";
}
function titleize(s: string): string {
  return s.replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();
}
