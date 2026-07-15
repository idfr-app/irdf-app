-- ═══════════════════════════════════════════════════════════════════════════
-- IRDF-APP · Phase 0 seed — a runnable demo tenant.
-- Replace the accent/tone/languages with your real Brand Core, and attach a real
-- auth user via the membership row (swap the placeholder user_id).
-- ═══════════════════════════════════════════════════════════════════════════
insert into tenants (id, slug, name, plan)
values ('00000000-0000-0000-0000-000000000001', 'vakillite', 'VakilLite', 'pro')
on conflict (id) do nothing;

-- Brand Core (placeholder). accent = "signal teal"; change it and the whole
-- console + every generated asset re-themes. Hindi-first, multilingual heritage.
insert into brand_core (tenant_id, accent, accent_ink, tone, languages, lexicon_do, lexicon_dont, forbidden_claims, ground_truth)
values (
  '00000000-0000-0000-0000-000000000001',
  '#1BC6C0', '#0B1220',
  'confident, warm, precise, plain-spoken Hinglish; explains the law simply and never oversells',
  array['en','hi'],
  array['plain language','cite the source','respect the reader'],
  array['legalese without explanation','hype','fear-mongering'],
  array['guaranteed legal outcome','we are a law firm','court-certified'],
  jsonb_build_object(
    'what', 'VakilLite is a Hindi-first legal-document platform for Indian citizens and MSMEs',
    'is_law_firm', false,
    'offers', array['rent agreements','affidavits','legal notices','NDAs','promissory notes']
  )
) on conflict (tenant_id) do nothing;

insert into governance (tenant_id, enabled, mode, outreach_unlocked)
values ('00000000-0000-0000-0000-000000000001', false, 'manual', false)
on conflict (tenant_id) do nothing;

insert into connectors (tenant_id, kind, label, config, enabled)
values ('00000000-0000-0000-0000-000000000001', 'web_analytics', 'Website analytics',
        jsonb_build_object('provider','stub','property','vakillite.com'), true)
on conflict do nothing;

-- Ledger genesis: seq 0, prev_hash = 'IRDF-GENESIS'. ts_ms is fixed so the demo
-- chain verifies deterministically. The app appends from seq 1 onward.
insert into ledger (tenant_id, seq, kind, payload, prev_hash, hash, ts_ms)
select
  '00000000-0000-0000-0000-000000000001', 0, 'govern',
  jsonb_build_object('event','genesis','note','ledger opened'),
  'IRDF-GENESIS',
  irdf_ledger_hash('IRDF-GENESIS', '00000000-0000-0000-0000-000000000001', 0, 'govern',
                   jsonb_build_object('event','genesis','note','ledger opened'), 1700000000000),
  1700000000000
where not exists (select 1 from ledger where tenant_id = '00000000-0000-0000-0000-000000000001' and seq = 0);

-- To grant yourself access after signing up:
--   insert into memberships (tenant_id, user_id, role)
--   values ('00000000-0000-0000-0000-000000000001', '<your-auth-uid>', 'owner');
