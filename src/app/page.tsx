import { svc } from "@/lib/db";
import { verify, tail } from "@/lib/ledger";
import { ACTION_CATALOGUE } from "@/lib/guardrails";
import { activeTenant } from "@/lib/tenant";
import { ConsoleActions } from "@/components/ConsoleActions";

export const dynamic = "force-dynamic";

/**
 * The one-tone console. Phase 0 reads the demo tenant server-side; Phase 1 swaps
 * to the session-scoped, RLS-enforced client. Everything renders in the tenant's
 * accent (applied in layout.tsx), with the chain-integrity seal as the anchor.
 */
export default async function Console() {
  const tenantId = activeTenant();

  let ready = true;
  let brand = "the brand", plan = "free";
  let gov: any = null, snap: any = null, queue: any[] = [], led: any[] = [];
  let integrity = { ok: true, brokenSeq: -1 };

  try {
    const [{ data: t }, { data: g }, { data: s }, { data: q }] = await Promise.all([
      svc().from("tenants").select("name, plan").eq("id", tenantId).single(),
      svc().from("governance").select("*").eq("tenant_id", tenantId).single(),
      svc().from("snapshots").select("*").eq("tenant_id", tenantId).order("taken_at", { ascending: false }).limit(1).maybeSingle(),
      svc().from("actions").select("*").eq("tenant_id", tenantId).in("status", ["queued", "blocked"]).order("priority", { ascending: false }),
    ]);
    brand = t?.name ?? brand; plan = t?.plan ?? plan;
    gov = g; snap = s; queue = q ?? [];
    led = await tail(tenantId, 12);
    integrity = await verify(tenantId);
  } catch {
    ready = false;
  }

  if (!ready) return <NotConfigured />;

  const p = snap?.perception ?? {};
  const signals: any[] = snap?.signals ?? [];

  return (
    <main className="wrap">
      <header className="mast">
        <div className="mark"><span /></div>
        <div>
          <h1>Brand Brain · Console</h1>
          <p className="sub">See how AI perceives {brand} — then shape it, generate it, and ship it, with you in control.</p>
        </div>
        <div className="brand">{brand} · {plan.toUpperCase()}</div>
      </header>

      <div className="grid">
        {/* Governance / autonomy */}
        <section className="panel span2">
          <h2>Autonomy</h2>
          <div className="gov">
            <span className={`pill ${gov?.enabled ? "on" : "off"}`}>{gov?.enabled ? "engine on" : "engine off"}</span>
            <span className="pill">mode: {gov?.mode}</span>
            <span className={`pill ${gov?.outreach_unlocked ? "on" : "off"}`}>outreach {gov?.outreach_unlocked ? "unlocked" : "locked"}</span>
            {gov?.killswitch ? <span className="pill" style={{ color: "var(--bad)" }}>KILLED</span> : null}
            <span className="pill">auto/day: {gov?.max_auto_per_day}</span>
          </div>
          <ConsoleActions tenantHint={brand} />
        </section>

        {/* Reality snapshot */}
        <section className="panel">
          <h2>Reality snapshot</h2>
          {snap ? (
            <div className="telem">
              {signals.map((s, i) => (
                <div className="row" key={i}><span className="k">{s.key}</span><span className="v">{String(s.value)}</span></div>
              ))}
              {signals.length === 0 ? <div className="empty">No signals yet — run a cycle.</div> : null}
            </div>
          ) : <div className="empty">No snapshot yet — run a cycle.</div>}
        </section>

        {/* AI-Perception Radar */}
        <section className="panel">
          <h2>AI-Perception Radar</h2>
          {p?.probed ? (
            <div className="telem">
              <div className="row"><span className="k">presence</span><span className="v">{pct(p.presenceRate)}</span></div>
              <div className="row"><span className="k">accuracy</span><span className="v">{pct(p.avgAccuracy)}</span></div>
              <div className="row"><span className="k">sentiment</span><span className="v">{sent(p.avgSentiment)}</span></div>
              <div className="row"><span className="k">share-of-voice</span><span className="v">{pct(p.shareOfVoice)}</span></div>
              {(p.gaps ?? []).slice(0, 3).map((g: string, i: number) => (
                <div className="row" key={i}><span className="k">gap</span><span className="v" style={{ color: "var(--warn)" }}>{g}</span></div>
              ))}
            </div>
          ) : <div className="empty">Not probed yet. Free plan probes weekly; Pro probes daily across models.</div>}
        </section>

        {/* Approval queue */}
        <section className="panel span2 q">
          <h2>Approval queue · {queue.length}</h2>
          {queue.length === 0 ? (
            <div className="empty">Nothing waiting. When the engine proposes an audience-facing or higher-risk action, it lands here for a one-tap decision.</div>
          ) : queue.map((a) => (
            <div className="item" key={a.id}>
              <div className="title">{a.title || ACTION_CATALOGUE[a.type]?.label || a.type}</div>
              <div className="why">{a.rationale}</div>
              <div className="foot">
                <span className={`tag ${a.risk}`}>{a.risk}</span>
                {a.outreach ? <span className="tag outreach">outreach</span> : null}
                {a.status === "blocked" ? <span className="tag high">gated</span> : null}
                <ConsoleActions approveId={a.id} />
              </div>
            </div>
          ))}
        </section>

        {/* Ledger + integrity seal (the signature element) */}
        <section className="panel span2">
          <h2>Tamper-evident ledger</h2>
          <div className={`seal ${integrity.ok ? "ok" : "bad"}`}>
            <div className="disc"><b>{integrity.ok ? "✓" : "✗"}</b></div>
            <div className="meta">
              <div><b>{integrity.ok ? "chain intact" : `broken at seq ${integrity.brokenSeq}`}</b> · {led.length} recent entries</div>
              <div className="hash">head {led[0]?.hash ? led[0].hash.slice(0, 32) + "…" : "—"}</div>
            </div>
          </div>
          <div className="led" style={{ marginTop: 14 }}>
            {led.map((e) => (
              <div className="e" key={e.seq}>
                <span className="seq">{e.seq}</span>
                <span className={`kind ${e.kind}`}>{e.kind}</span>
                <span className="t">{(e.payload?.title as string) ?? (e.payload?.event as string) ?? e.kind}</span>
              </div>
            ))}
            {led.length === 0 ? <div className="empty">Ledger empty except genesis.</div> : null}
          </div>
        </section>
      </div>

      <p className="note">
        Phase 0 skeleton · deterministic template generation · one web-analytics connector · demo tenant.
        Audience-facing actions never auto-run and stay behind the outreach lock; the kill switch disarms the engine and
        purges the pending queue while preserving the ledger. Replace the demo tenant with a session-scoped, RLS-enforced
        user in Phase 1.
      </p>
    </main>
  );
}

function pct(v: number | null | undefined) { return v == null ? "—" : `${Math.round(v * 100)}%`; }
function sent(v: number | null | undefined) { return v == null ? "—" : (v > 0 ? "+" : "") + v.toFixed(2); }

function NotConfigured() {
  return (
    <main className="wrap">
      <header className="mast">
        <div className="mark"><span /></div>
        <div>
          <h1>Brand Brain · Console</h1>
          <p className="sub">Almost there — connect the database to bring the console online.</p>
        </div>
      </header>
      <section className="panel">
        <h2>Setup</h2>
        <div className="telem">
          <div className="row"><span className="k">1</span><span className="v">Copy .env.example → .env.local and fill Supabase keys</span></div>
          <div className="row"><span className="k">2</span><span className="v">Apply supabase/migrations/0001_init.sql and 0002_seed.sql</span></div>
          <div className="row"><span className="k">3</span><span className="v">Reload — the demo tenant lights up</span></div>
        </div>
        <p className="note">See README.md for the full walkthrough.</p>
      </section>
    </main>
  );
}
