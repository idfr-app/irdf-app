import { redirect } from "next/navigation";
import Link from "next/link";
import { svc } from "@/lib/db";
import { currentUser, isPlatformAdmin } from "@/lib/auth";
import { SignOutButton } from "@/components/SignOutButton";
import { PRODUCT } from "@/lib/brand";

export const dynamic = "force-dynamic";

/**
 * BI-NET admin panel — the platform operator's view across every tenant.
 * Uses the service role to read across tenants, but ONLY after confirming the
 * caller is a platform admin. Non-admins are bounced to their own console.
 */
export default async function AdminPanel() {
  const user = await currentUser();
  if (!user) { redirect("/login"); return null; }
  if (!(await isPlatformAdmin(user.id))) { redirect("/app"); return null; }

  const [tenantsRes, govRes, membersRes, assetsCount, probesCount, ledgerCount] = await Promise.all([
    svc().from("tenants").select("id, name, slug, plan, owner_email, created_at").order("created_at", { ascending: false }),
    svc().from("governance").select("tenant_id, enabled, mode, outreach_unlocked, killswitch"),
    svc().from("memberships").select("tenant_id, user_id"),
    svc().from("content_assets").select("*", { count: "exact", head: true }),
    svc().from("ai_perception_probes").select("*", { count: "exact", head: true }),
    svc().from("ledger").select("*", { count: "exact", head: true }),
  ]);

  const tenants = tenantsRes.data ?? [];
  const govBy = new Map((govRes.data ?? []).map((g: any) => [g.tenant_id, g]));
  const membersBy = new Map<string, number>();
  const uniqueUsers = new Set<string>();
  for (const m of membersRes.data ?? []) {
    membersBy.set(m.tenant_id, (membersBy.get(m.tenant_id) ?? 0) + 1);
    uniqueUsers.add(m.user_id);
  }

  const stats = [
    { k: "Tenants", v: tenants.length },
    { k: "Users", v: uniqueUsers.size },
    { k: "Engines on", v: (govRes.data ?? []).filter((g: any) => g.enabled).length },
    { k: "Content assets", v: assetsCount.count ?? 0 },
    { k: "Radar probes", v: probesCount.count ?? 0 },
    { k: "Ledger entries", v: ledgerCount.count ?? 0 },
  ];

  return (
    <main className="wrap admin">
      <header className="mast">
        <div className="mark admin"><span /></div>
        <div>
          <h1>{PRODUCT.name} · Admin</h1>
          <p className="sub">{PRODUCT.full} — platform operations</p>
        </div>
        <div className="mast-right">
          <Link className="btn ghost sm" href="/app">My console</Link>
          <SignOutButton />
        </div>
      </header>

      <div className="statgrid">
        {stats.map((s) => (
          <div className="stat" key={s.k}>
            <div className="num">{s.v}</div>
            <div className="lbl">{s.k}</div>
          </div>
        ))}
      </div>

      <section className="panel span2">
        <h2>Tenants</h2>
        <div className="tbl">
          <div className="tr th">
            <span>Brand</span><span>Owner</span><span>Plan</span><span>Engine</span><span>Mode</span><span>Members</span><span>Created</span>
          </div>
          {tenants.length === 0 ? <div className="empty">No tenants yet.</div> : tenants.map((t: any) => {
            const g: any = govBy.get(t.id) ?? {};
            return (
              <div className="tr" key={t.id}>
                <span><b>{t.name}</b><em>{t.slug}</em></span>
                <span className="mono">{t.owner_email ?? "—"}</span>
                <span><span className={`tag ${t.plan === "pro" ? "outreach" : ""}`}>{t.plan}</span></span>
                <span className={g.killswitch ? "bad" : g.enabled ? "ok" : "muted"}>
                  {g.killswitch ? "killed" : g.enabled ? "on" : "off"}
                </span>
                <span className="mono">{g.mode ?? "—"}</span>
                <span className="mono">{membersBy.get(t.id) ?? 0}</span>
                <span className="mono">{t.created_at ? new Date(t.created_at).toISOString().slice(0, 10) : "—"}</span>
              </div>
            );
          })}
        </div>
      </section>

      <p className="note">
        Read-only oversight for this build. Suspend/impersonate/plan-change controls, per-tenant usage drill-downs, and
        paginated user management arrive as the admin surface grows. All actions here would themselves be sealed to each
        tenant's tamper-evident ledger.
      </p>
    </main>
  );
}
