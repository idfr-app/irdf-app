-- ═══════════════════════════════════════════════════════════════════════════
-- BI-NET · Brand Intelligence & Narrative Engine Technology
-- Migration 0003 — real auth tenancy + platform admin.
--
-- With Supabase Auth live, the RLS in 0001 (keyed on auth.uid()) now enforces
-- real per-user isolation. This migration adds:
--   • owner_email on tenants (so the admin panel can show who owns each brand)
--   • platform_admins (users who can see the BI-NET operator/admin panel)
-- ═══════════════════════════════════════════════════════════════════════════

-- Show the owner's email in the admin panel without touching the auth schema.
alter table tenants add column if not exists owner_email text;

-- BI-NET platform operators. Membership here grants access to /admin.
create table if not exists platform_admins (
  user_id     uuid primary key,                 -- auth.users.id
  note        text,
  created_at  timestamptz not null default now()
);

alter table platform_admins enable row level security;

-- A signed-in user may read only their own admin row (to check their own status).
-- The server also checks this table with the service role, which bypasses RLS.
drop policy if exists p_platform_admins_self on platform_admins;
create policy p_platform_admins_self on platform_admins
  using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- AFTER you sign up once through the app, make yourself the first BI-NET admin:
--
--   insert into platform_admins (user_id, note)
--   select id, 'founder' from auth.users where email = 'you@example.com';
--
-- (Run that in the Supabase SQL editor with your real email.)
-- ─────────────────────────────────────────────────────────────────────────────
