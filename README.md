# BI-NET — Brand Intelligence & Narrative Engine Technology

An embeddable, multi-tenant **brand brain**. BI-NET runs a continuous
**Observe → Orient → Generate → Act → Log** loop for any brand, with a human in
the loop at every step that touches a real audience.

Two panels:
- **User panel** (`/app`) — for the brand owner / startup / campaign organiser.
  Sign in, set your brand, and run the engine on your own workspace.
- **Admin panel** (`/admin`) — for BI-NET platform operators. Cross-tenant
  oversight of every brand on the platform.

Auth is **passwordless email + OTP**: enter your email, get a 6-digit code, you're in.
Registration and login are the same flow.

---

## What runs today

- **Real multi-tenant auth** (Supabase Auth, cookie-based SSR). Each new user is
  provisioned a private workspace (tenant + brand core + governance + ledger
  genesis) on first sign-in. Row-level security isolates every tenant.
- **The OODA orchestrator** — attended (console button) or unattended (cron).
- **AI Router** across Anthropic + OpenAI with a deterministic template fallback,
  so it works end-to-end even with no AI keys.
- **Guardrails** — allowlisted actions, risk tiers, autonomy ceiling
  (Manual/Semi/Full), daily caps, the outreach lock, and a kill switch.
- **Tamper-evident ledger** — append-only, hash-chained, verified in both
  TypeScript and SQL.
- **Brand Core** — one accent + one voice, themed into the console and every asset.
- **AI-Perception Radar (AEO/GEO)** — schema + flow live; real multi-model probing
  is the next feature to light up.

---

## Setup / deploy checklist

You need a Supabase project and (optionally) AI keys. Then:

### 1. Environment variables

Copy `.env.example` → `.env.local` locally, and set the same vars in Vercel
(Project → Settings → Environment Variables):

| Key | Where |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API (**secret**) |
| `CRON_SECRET` | any long random string |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | optional (absent ⇒ templates) |

### 2. Database — run the migrations in order

In the Supabase SQL editor, run:
- `supabase/migrations/0001_init.sql`
- `supabase/migrations/0002_seed.sql` (optional sample brand — safe to skip/delete)
- `supabase/migrations/0003_auth_and_admin.sql`

### 3. Supabase Auth settings (so email + OTP works)

1. **Authentication → Providers → Email**: enable it.
2. **Authentication → URL Configuration**: set **Site URL** to your Vercel URL
   (e.g. `https://your-app.vercel.app`).
3. **Authentication → Email Templates → Magic Link**: make sure the body shows the
   code by including the token, e.g.:

   ```html
   <h2>Your BI-NET sign-in code</h2>
   <p>Enter this code to sign in:</p>
   <p style="font-size:24px;font-weight:bold;letter-spacing:3px">{{ .Token }}</p>
   ```

   (`{{ .Token }}` is the 6-digit code the login screen asks for.)

> **Email at scale:** Supabase's built-in email is rate-limited (a few per hour) —
> fine for testing. For a commercial launch, connect your own SMTP under
> **Authentication → Emails → SMTP Settings** (e.g. Resend, SendGrid, Postmark).

### 4. Make yourself the first BI-NET admin

Sign in through the app once (so your user exists), then run this in the Supabase
SQL editor with your real email:

```sql
insert into platform_admins (user_id, note)
select id, 'founder' from auth.users where email = 'you@example.com';
```

Reload `/app` — an **Admin** link appears; `/admin` is now open to you.

### 5. Run

```bash
npm install     # picks up @supabase/ssr
npm run dev     # http://localhost:3000
```

`/` is the landing page → **Sign in** → `/app` is your console.

---

## Unattended cycles (cron)

`vercel.json` schedules `/api/cron` daily. It runs one cycle for **every tenant
whose engine is enabled and not killed**, protected by `CRON_SECRET`. Autonomy
still governs what runs vs. queues — cron cannot bypass the mode ceiling or the
outreach lock.

---

## Architecture

```
Public landing (/)              BI-NET marketing + sign-in
        │
Login (/login)                  email → 6-digit OTP → session cookie
        │
  ┌─────┴───────────────────────────────────────────────┐
User panel (/app)                       Admin panel (/admin)
their own tenant, brand setup,          cross-tenant stats + tenant table,
OODA loop, approval queue, ledger       gated to platform_admins
        │
Orchestrator  Observe → Orient → Generate → Act → Log     src/lib/orchestrator
        │
   {Sensor connectors · AI-Perception Radar · AI Router · Guardrails}
        │
Data + Ledger + Brand Core (Postgres, RLS, append-only)   supabase/migrations
        │
Supabase Auth (cookie SSR)                                src/lib/supabase, src/lib/auth
```

Product identity ("BI-NET" + full form + accent) has one source of truth:
`src/lib/brand.ts`.

---

## Roadmap from here

- **AI-Perception Radar v1** — real scheduled probes against live models, scored
  for presence / accuracy / sentiment / share-of-voice.
- **Publishing** — gated draft → schedule → publish integrations.
- **Billing** — Free vs Pro plans, quotas, BYOK keys.
- **API + embeddable widget + MCP server** — the non-console surfaces for
  programmatic access.
- **Admin depth** — suspend / impersonate / plan controls, usage drill-downs,
  paginated user management (all sealed to each tenant's ledger).

---

## Design principles baked in

Augmented autonomy (human owns the risk), truth-anchored generation (no
fabrication, sources cited, AI disclosed), one brand everywhere (accent + tone),
provider-neutral AI (never dies without a key), and multi-tenant by construction
(RLS on every tenant table; the service-role key is server-only and always
tenant-scoped).
