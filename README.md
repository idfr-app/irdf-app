# IRDF-APP — Brand Intelligence & Narrative Engine

**Phase 0 skeleton.** An embeddable, multi-tenant "brand brain" that runs a
continuous **Observe → Orient → Generate → Act → Log** loop for any brand, with a
human in the loop at every step that touches a real audience.

This is the generalised, sellable version of VakilLite's IRDF module: the same
proven loop, lifted out of a single app into a provider-neutral, multi-tenant
service.

---

## What's in this build

Phase 0 delivers a **deployable skeleton** — the spine everything else hangs off:

- **Orchestrator** — the full OODA cycle (`src/lib/orchestrator/`), schedulable
  attended (console) or unattended (cron).
- **AI Router** — one neutral `generate()` in front of Anthropic + OpenAI, with a
  **deterministic template fallback** so the product runs end to end even with no
  API keys configured (`src/lib/ai/`).
- **Guardrails** — an allowlisted action catalogue with per-action risk tiers, the
  autonomy ceiling (Manual / Semi / Full), daily caps, and the **outreach lock**
  (`src/lib/guardrails.ts`).
- **Hash-chained ledger** — a tamper-evident, append-only audit trail. The hash
  chain is computed **identically in TypeScript and in SQL**, so the database can
  independently re-verify integrity (`src/lib/ledger.ts`, `verify_ledger()`).
- **Brand Core** — one accent colour + tone-of-voice + lexicon, injected into both
  the console theme and every generation prompt (`src/lib/brandCore.ts`,
  `src/app/theme.ts`).
- **Connector framework** — a tiny `fetchSignals()` interface; the first connector
  (web analytics) ships as a shaped stub (`src/lib/connectors/`).
- **AI-Perception Radar** — the AEO/GEO sensor, stubbed in Phase 0 with the real
  multi-model probing seam marked for Phase 1 (`src/lib/perception/radar.ts`).
- **Console** — an instrument-panel dashboard: governance state, reality snapshot,
  perception radar, approval queue, and the live ledger tail with an integrity
  seal (`src/app/page.tsx`).
- **API surface** — `/api/cycle`, `/api/cron`, `/api/approvals`, `/api/killswitch`,
  `/api/ledger/verify`.
- **Postgres schema** — every table multi-tenant with row-level security; the
  ledger append-only via triggers (`supabase/migrations/`).

---

## Prerequisites

- Node.js 18.17+ and npm
- A Supabase project (free tier is fine), or the Supabase CLI for local dev
- Optional: an Anthropic and/or OpenAI API key (without them, generation uses the
  built-in templates)

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment**

   ```bash
   cp .env.example .env.local
   # fill in your Supabase URL + keys; AI keys are optional
   ```

3. **Apply the database schema**

   Run the two migration files in order against your Supabase database — either
   with the Supabase CLI (`supabase db push`) or by pasting them into the SQL
   editor:

   - `supabase/migrations/0001_init.sql` — schema, RLS, ledger machinery
   - `supabase/migrations/0002_seed.sql` — a demo tenant ("VakilLite"), its brand
     core, one connector, and the ledger genesis block

4. **Run**

   ```bash
   npm run dev
   ```

   Open http://localhost:3000. Press **Run one cycle** to drive one full
   Observe → Orient → Generate → Act → Log pass. Because the seed tenant starts
   **OFF / Manual / outreach-locked**, everything the cycle proposes lands in the
   approval queue for you to Approve or Dismiss — nothing reaches an audience
   without your tap. **Kill switch** disarms the engine and purges the pending
   queue while preserving the ledger.

> **Offline note:** this package is source only — no `node_modules` and no
> production build are included (the build environment had networking disabled).
> `npm install` pulls the dependencies listed in `package.json`.

---

## Architecture map

```
Integration surface   widget · JS SDK · REST API · MCP · webhooks   (Phase 2–3)
        │
Console (one-tone UI)  dashboard · queue · ledger · brand kit        src/app
        │
Orchestrator           Observe → Orient → Generate → Act → Log       src/lib/orchestrator
        │
   ┌────────────┬──────────────────┬───────────────┬──────────────┐
 Sensor        AI-Perception       AI Router        Guardrails
 connectors    Radar (AEO/GEO)     (multi-model)    truth-anchor + risk
 src/lib/      src/lib/            src/lib/ai       tiers + approval gates
 connectors    perception                           src/lib/guardrails.ts
        │
Data + Ledger          tenant store · hash-chained audit · brand core
        │              supabase/migrations · src/lib/ledger.ts
Identity & Billing     auth · roles · plans · usage                  (Phase 2)
```

### How the IRDF patterns were generalised

| IRDF (single app)                        | IRDF-APP (multi-tenant service)                          |
| ---------------------------------------- | -------------------------------------------------------- |
| `IRDF_ACTIONS` catalogue in one file     | `ACTION_CATALOGUE` + risk ranks in `guardrails.ts`       |
| autonomy dial `_autoCeiling/canAuto`     | `autoCeiling()/canAuto()` scoped per tenant governance   |
| `_seal/verifyLedger` over localStorage   | Postgres append-only ledger, verified in both TS and SQL |
| `vlAI.chat()` + template fallback        | `router.generate()` across providers + template fallback |
| in-memory OODA cycle                     | `runCycle()` persisting snapshots/plans/actions/assets   |
| single-user state                        | every table scoped by tenant with row-level security     |

---

## Autonomy model (the control system)

| Mode   | Runs automatically                    | Waits for a human                          |
| ------ | ------------------------------------- | ------------------------------------------ |
| Manual | nothing — proposes only               | everything                                 |
| Semi   | low-risk, reversible, internal        | anything medium/high-risk or audience-facing |
| Full   | low + medium, reversible, internal    | high-risk and anything reaching an audience |

Across every mode: audience-facing actions require the **outreach lock** to be
open, secrets/keys are never touched, and the **kill switch** always works and
always preserves the ledger.

---

## Roadmap

- **Phase 0 (this build)** — multi-tenant skeleton, deployable.
- **Phase 1** — AI-Perception Radar v1 (real 1–2 model probing), richer
  blog/social/SEO generation, session-based tenant + roles, Free tier live.
- **Phase 2** — multi-AI choice + BYOK, Full mode + scheduling + multi-day buffer,
  AEO/GEO v2 (multi-model + competitors + share-of-voice), gated publishing,
  billing, embeddable widget + REST API.
- **Phase 3** — MCP server, agency/multi-brand, white-label, more connectors.

---

## Design principles baked into the code

- **Augmented autonomy** — the machine does the work; the human owns the risk. No
  blind full autonomy on anything audience-facing.
- **Truth-anchored** — generation prompts forbid fabricated facts/stats/quotes,
  ask for sources, and disclose AI assistance on audience-facing assets.
- **One brand everywhere** — a single accent + tone flows through the console and
  every generated asset.
- **Provider-neutral** — pick your AI per task; the product never dies when a
  provider is absent or fails.
- **Multi-tenant by construction** — row-level security on every tenant table; the
  service-role key is server-only and always tenant-scoped.
