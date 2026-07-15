-- ═══════════════════════════════════════════════════════════════════════════
-- IRDF-APP · Phase 0 schema
-- Multi-tenant, row-level-security everywhere, append-only hash-chained ledger.
-- Generalises VakilLite/IRDF's localStorage ledger (vlAudit / _seal / verifyLedger)
-- into a tamper-evident Postgres table with a DB-side integrity check.
--
-- Design law: every business row is scoped by tenant_id; RLS makes cross-tenant
-- reads impossible even if application code is wrong. Secrets/keys are NEVER
-- stored in these tables.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;   -- digest() for the ledger hash

-- ── Enums ──────────────────────────────────────────────────────────────────
do $$ begin
  create type autonomy_mode as enum ('manual','semi','full');
exception when duplicate_object then null; end $$;

do $$ begin
  create type member_role as enum ('owner','admin','editor','viewer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type action_status as enum ('proposed','queued','approved','executed','dismissed','blocked');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ledger_kind as enum ('observe','plan','act','govern');
exception when duplicate_object then null; end $$;

-- ── Tenancy & identity ──────────────────────────────────────────────────────
create table if not exists tenants (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  name         text not null,
  plan         text not null default 'free',        -- free | pro
  created_at   timestamptz not null default now()
);

-- Which auth users may see which tenant, and in what role.
create table if not exists memberships (
  tenant_id    uuid not null references tenants(id) on delete cascade,
  user_id      uuid not null,                         -- auth.users.id
  role         member_role not null default 'owner',
  created_at   timestamptz not null default now(),
  primary key (tenant_id, user_id)
);
create index if not exists idx_memberships_user on memberships(user_id);

-- ── Brand Core · one accent colour + one voice, applied to UI and every output ──
create table if not exists brand_core (
  tenant_id      uuid primary key references tenants(id) on delete cascade,
  accent         text not null default '#1BC6C0',     -- single accent, drives console + assets
  accent_ink     text not null default '#0B1220',     -- readable ink on accent
  tone           text not null default 'confident, warm, precise, plain-spoken',
  languages      text[] not null default array['en'], -- Hindi-first heritage → true multilingual
  lexicon_do     text[] not null default '{}',
  lexicon_dont   text[] not null default '{}',
  forbidden_claims text[] not null default '{}',       -- truth-anchor: never assert these
  ground_truth   jsonb not null default '{}'::jsonb,    -- brand facts the radar scores AI answers against
  updated_at     timestamptz not null default now()
);

-- ── Governance · the autonomy control system (per tenant) ───────────────────
create table if not exists governance (
  tenant_id        uuid primary key references tenants(id) on delete cascade,
  enabled          boolean not null default false,      -- default OFF: power is opt-in
  mode             autonomy_mode not null default 'manual',
  outreach_unlocked boolean not null default false,     -- audience-facing actions gated
  killswitch       boolean not null default false,      -- disarms + purges the pending queue
  cadence_minutes  int not null default 30 check (cadence_minutes between 5 and 1440),
  max_auto_per_day int not null default 6,
  max_actions_per_day int not null default 24,
  updated_at       timestamptz not null default now()
);

-- ── Connectors (sensor layer) · pluggable signal sources ────────────────────
create table if not exists connectors (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  kind         text not null,                          -- 'web_analytics', 'search_console', ...
  label        text not null,
  config       jsonb not null default '{}'::jsonb,     -- NON-secret config only; keys live in a vault
  enabled      boolean not null default true,
  created_at   timestamptz not null default now()
);
create index if not exists idx_connectors_tenant on connectors(tenant_id);

-- ── Snapshots · one "reality snapshot" per Observe cycle ────────────────────
create table if not exists snapshots (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  taken_at     timestamptz not null default now(),
  signals      jsonb not null default '[]'::jsonb,      -- normalised Signal[] from connectors
  perception   jsonb not null default '{}'::jsonb       -- AI-Perception Radar summary (Phase 1+)
);
create index if not exists idx_snapshots_tenant_time on snapshots(tenant_id, taken_at desc);

-- ── Plans · the prioritised, truth-anchored strategy per cycle ──────────────
create table if not exists plans (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  snapshot_id  uuid references snapshots(id) on delete set null,
  via          text not null default 'rules',           -- 'rules' | 'ai'
  created_at   timestamptz not null default now()
);
create index if not exists idx_plans_tenant_time on plans(tenant_id, created_at desc);

-- ── Actions · allowlisted, risk-tiered, per plan ────────────────────────────
create table if not exists actions (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  plan_id      uuid references plans(id) on delete cascade,
  type         text not null,                            -- must match the code-side allowlist
  priority     int not null default 3,
  risk         text not null default 'low',              -- low | med | high
  reversible   boolean not null default true,
  outreach     boolean not null default false,
  status       action_status not null default 'proposed',
  title        text not null default '',
  rationale    text not null default '',
  autonomy     autonomy_mode not null default 'manual',
  actor        text,                                     -- 'orchestrator (auto)' | user id
  created_at   timestamptz not null default now(),
  decided_at   timestamptz
);
create index if not exists idx_actions_tenant_status on actions(tenant_id, status, priority desc);

-- ── Content assets · finished, brand-tone-locked outputs ────────────────────
create table if not exists content_assets (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  action_id    uuid references actions(id) on delete set null,
  format       text not null,                            -- blog | social | seo | email | whatsapp | image_prompt | video_prompt | geo
  language     text not null default 'en',
  body         text not null,
  meta         jsonb not null default '{}'::jsonb,        -- hashtags, sources[], model, disclosure
  via          text not null default 'template',          -- template | ai:<model>
  created_at   timestamptz not null default now()
);
create index if not exists idx_assets_tenant_time on content_assets(tenant_id, created_at desc);

-- ── AI-Perception probes (AEO/GEO) · one row per (model, question) answer ───
create table if not exists ai_perception_probes (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  snapshot_id  uuid references snapshots(id) on delete cascade,
  model        text not null,                            -- e.g. 'anthropic:claude', 'openai:gpt'
  question     text not null,
  answer       text not null default '',
  present      boolean,                                  -- did the brand appear at all?
  sentiment    numeric,                                  -- -1..1
  accuracy     numeric,                                  -- 0..1 vs brand ground_truth
  share_of_voice numeric,                                -- 0..1 vs competitors
  cited_sources text[] not null default '{}',
  created_at   timestamptz not null default now()
);
create index if not exists idx_probes_tenant_time on ai_perception_probes(tenant_id, created_at desc);

-- ── Usage metering (drives Free/Pro quotas) ─────────────────────────────────
create table if not exists usage (
  tenant_id    uuid not null references tenants(id) on delete cascade,
  day          date not null default current_date,
  generations  int not null default 0,
  probes       int not null default 0,
  auto_actions int not null default 0,
  primary key (tenant_id, day)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- LEDGER · append-only, hash-chained, tamper-evident, per tenant.
-- h = sha256( prev_hash | tenant | seq | kind | canonical(payload) | ts )
-- The chain is sealed in application code (src/lib/ledger.ts) AND re-derivable
-- here so integrity can be proven without trusting the app.
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists ledger (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  seq          bigint not null,                          -- per-tenant monotonic sequence
  kind         ledger_kind not null,
  payload      jsonb not null default '{}'::jsonb,
  prev_hash    text not null,
  hash         text not null,
  created_at   timestamptz not null default now(),
  ts_ms        bigint not null,                          -- exact ms used in the hash preimage
  unique (tenant_id, seq),
  unique (tenant_id, hash)
);
create index if not exists idx_ledger_tenant_seq on ledger(tenant_id, seq desc);

-- Canonical JSON: sort object keys recursively so the hash preimage is stable
-- and matches the JS-side canonicaliser in src/lib/hash.ts.
create or replace function irdf_canonical(j jsonb) returns text language sql immutable as $$
  select case jsonb_typeof(j)
    when 'object' then '{' || coalesce(string_agg(
        to_json(k.key)::text || ':' || irdf_canonical(j -> k.key),
        ',' order by k.key), '') || '}'
    when 'array'  then '[' || coalesce((
        select string_agg(irdf_canonical(e.val), ',')
        from (select value as val, ordinality from jsonb_array_elements(j) with ordinality) e), '') || ']'
    else j::text
  end
  from (select key from jsonb_object_keys(j) key) k
  where jsonb_typeof(j) = 'object'
  union all
  select case jsonb_typeof(j)
    when 'object' then null
    when 'array'  then '[' || coalesce((
        select string_agg(irdf_canonical(value), ',')
        from jsonb_array_elements(j)), '') || ']'
    else j::text
  end
  where jsonb_typeof(j) <> 'object'
  limit 1;
$$;

create or replace function irdf_ledger_hash(
  p_prev text, p_tenant uuid, p_seq bigint, p_kind text, p_payload jsonb, p_ts_ms bigint
) returns text language sql immutable as $$
  select encode(digest(
    p_prev || '|' || p_tenant::text || '|' || p_seq::text || '|' ||
    p_kind || '|' || irdf_canonical(p_payload) || '|' || p_ts_ms::text,
    'sha256'), 'hex');
$$;

-- Append-only: reject any UPDATE or DELETE on the ledger. Tamper attempts fail loudly.
create or replace function irdf_ledger_immutable() returns trigger language plpgsql as $$
begin
  raise exception 'ledger is append-only (tamper-evident); % is not permitted', tg_op;
end $$;

drop trigger if exists trg_ledger_no_update on ledger;
create trigger trg_ledger_no_update before update on ledger
  for each row execute function irdf_ledger_immutable();

drop trigger if exists trg_ledger_no_delete on ledger;
create trigger trg_ledger_no_delete before delete on ledger
  for each row execute function irdf_ledger_immutable();
-- (Cascade deletes from tenants are allowed via a separate privileged path only.)

-- Independent, DB-side integrity proof. Returns the first broken seq, or -1 if clean.
create or replace function verify_ledger(p_tenant uuid)
returns table(ok boolean, broken_seq bigint) language plpgsql stable as $$
declare
  r ledger%rowtype;
  expected_prev text := 'IRDF-GENESIS';
  expected_hash text;
begin
  for r in select * from ledger where tenant_id = p_tenant order by seq asc loop
    expected_hash := irdf_ledger_hash(expected_prev, r.tenant_id, r.seq, r.kind::text, r.payload, r.ts_ms);
    if r.prev_hash <> expected_prev or r.hash <> expected_hash then
      return query select false, r.seq; return;
    end if;
    expected_prev := r.hash;
  end loop;
  return query select true, (-1)::bigint;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- ROW-LEVEL SECURITY · a user can only ever touch tenants they belong to.
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function irdf_is_member(p_tenant uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m
    where m.tenant_id = p_tenant and m.user_id = auth.uid()
  );
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'brand_core','governance','connectors','snapshots','plans','actions',
    'content_assets','ai_perception_probes','usage','ledger'
  ] loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists p_%1$s_rw on %1$s;', t);
    execute format(
      'create policy p_%1$s_rw on %1$s using (irdf_is_member(tenant_id)) with check (irdf_is_member(tenant_id));',
      t);
  end loop;
end $$;

-- tenants + memberships get their own membership-scoped policies
alter table tenants enable row level security;
drop policy if exists p_tenants_ro on tenants;
create policy p_tenants_ro on tenants using (irdf_is_member(id));

alter table memberships enable row level security;
drop policy if exists p_memberships_self on memberships;
create policy p_memberships_self on memberships using (user_id = auth.uid());

-- NOTE: the server-side orchestrator/cron uses the Supabase service role, which
-- bypasses RLS. It MUST still scope every query by tenant_id (it does — see
-- src/lib/db.ts svc() usage). RLS is the safety net; explicit scoping is the rule.
