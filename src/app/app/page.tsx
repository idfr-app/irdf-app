import { redirect } from "next/navigation";
import Link from "next/link";
import { svc } from "@/lib/db";
import { verify, tail } from "@/lib/ledger";
import { ACTION_CATALOGUE } from "@/lib/guardrails";
import { loadBrandCore } from "@/lib/brandCore";
import { brandStyle } from "../theme";
import { currentUser, getUserTenant, isPlatformAdmin } from "@/lib/auth";
import { ConsoleActions } from "@/components/ConsoleActions";
import { SignOutButton } from "@/components/SignOutButton";
import { BrandCoreForm } from "@/components/BrandCoreForm";
import { PRODUCT } from "@/lib/brand";

export const dynamic = "force-dynamic";

/**
 * The brand owner's console. Resolves the caller's OWN tenant from their session
 * (provisioning a private workspace on first visit), themes in that tenant's
 * accent, and drives the Observe→Orient→Generate→Act→Log loop under their control.
 */
export default async function UserConsole() {
  const user = await currentUser();
  if (!user) { redirect("/login"); return null; }

  const tenantId = await getUserTenant();
  if (!tenantId) { redirect("/login"); return null; }

  const admin = await isPlatformAdmin(user.id);
  const bc = await loadBrandCore(tenantId);

  const [{ data: t }, { data: g }, { data: s }, { data: q }] = await Promise.all([
    svc().from("tenants").select("name, plan").eq("id", tenantId).single(),
    svc().from("governance").select("*").eq("tenant_id", tenantId).single(),
    svc().from("snapshots").select("*").eq("tenant_id", tenantId).order("taken_at", { ascending: false }).limit(1).maybeSingle(),
    svc().from("actions").select("*").eq("tenant_id", tenantId).in("status", ["queued", "blocked"]).order("priority", { ascending: false }),
  ]);

  const brand = t?.name ?? "Your brand";
  const plan = t?.plan ?? "free";
  const gov = g;
  const snap = s;
  const queue = q ?? [];
  const led = await tail(tenantId, 12);
  const integrity = await verify(tenantId);

  const p: any = snap?.perception ?? {};
  const signals: any[] = snap?.signals ?? [];

  const initialBrand = {
    name: brand,
    accent: bc.accent,
    tone: bc.tone,
    languages: (bc.languages ?? ["en"]).join(", "),
    ground_truth: Object.entries(bc.groundTruth ?? {}).map(([k, v]) => `${k}: ${v}`).join("\n"),
  };

  return (
    <main className="wrap" style={brandStyle(bc)}>
      <header className="mast">
        <div className="mark"><span /></div>
        <div>
          <h1>{brand} · Console</h1>
          <p className="sub">Powered by {PRODUCT.name} — {PRODUCT.full}</p>
        </div>
        <div className="mast-right">
          <span className="brand">{plan.toUpperCase()}</span>
          {admin ? <Link className="btn ghost sm" href="/admin">Admin</Link> : null}
          <SignOutButton />
        </div>
      </header>

      <div className="grid">
        {/* Brand Core */}
        <section className="panel span2">
          <h2>Brand</h2>
          <BrandCoreForm initial={initialBrand} />
        </section>

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
              {signals.map((sig, i) => (
                <div className="row" key={i}><span className="k">{sig.key}</span><span className="v">{String(sig.value)}</span></div>
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
              {(p.gaps ?? []).slice(0, 3).map((gp: string, i: number) => (
                <div className="row" key={i}><span className="k">gap</span><span className="v" style={{ color: "var(--warn)" }}>{gp}</span></div>
              ))}
            </div>
          ) : <div className="empty">Not probed yet. Free plan probes weekly; Pro probes daily across models.</div>}
        </section>

        {/* Approval queue */}
        <section className="panel span2 q">
          <h2>Approval queue · {queue.length}</h2>
          {queue.length === 0 ? (
            <div className="empty">Nothing waiting. When the engine proposes an audience-facing or higher-risk action, it lands here for a one-tap decision.</div>
          ) : queue.map((a: any) => (
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

        {/* Ledger + integrity seal */}
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
            {led.map((e: any) => (
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
        {PRODUCT.name} · deterministic template generation and one web-analytics connector are active in this build.
        Audience-facing actions never auto-run and stay behind the outreach lock; the kill switch disarms the engine and
        purges the pending queue while preserving the ledger.
      </p>
    </main>
  );
}

function pct(v: number | null | undefined) { return v == null ? "—" : `${Math.round(v * 100)}%`; }
function sent(v: number | null | undefined) { return v == null ? "—" : (v > 0 ? "+" : "") + v.toFixed(2); }
