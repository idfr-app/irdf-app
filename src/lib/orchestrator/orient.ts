import { ACTION_CATALOGUE, isAllowed } from "../guardrails";
import type { PlannedAction, Snapshot } from "../types";

/**
 * ORIENT — the deterministic planner (generalised IRDF.plan()). It reads the
 * snapshot and emits candidate actions drawn ONLY from the allowlist. The
 * AI-Perception equation is an explicit input: detected gaps drive GEO/blog
 * actions "act after seeing". Everything is truth-anchored and reversible by
 * default; audience-facing actions are proposed but gated downstream.
 *
 * Deterministic by design — the engine plans with zero AI configured. AI
 * enrichment (re-ranking + copy) happens later in generate(), not here.
 */
export function orient(snapshot: Snapshot, brandName: string): PlannedAction[] {
  const out: PlannedAction[] = [];
  const push = (type: string, priority: number, title: string, rationale: string, context?: Record<string, unknown>) => {
    if (!isAllowed(type)) return;
    const m = ACTION_CATALOGUE[type];
    out.push({ type, priority, risk: m.risk, reversible: m.reversible, outreach: m.outreach, title, rationale, context });
  };

  const sig = (key: string) => snapshot.signals.find((s) => s.key === key);
  const num = (key: string, d = 0) => { const v = sig(key)?.value; return typeof v === "number" ? v : d; };

  // The always-on heartbeat: re-probe how AI engines describe the brand.
  push("perception.probe", 4, "Scan AI answer-engines", `Check how models describe ${brandName} right now, and feed the gaps into the plan.`);

  // 1) PERCEPTION-DRIVEN (highest leverage): correct what AI engines get wrong.
  const gaps = snapshot.perception.gaps ?? [];
  const presence = snapshot.perception.presenceRate;
  const topPage = String(sig("top_page")?.value ?? "your top page");

  if (presence != null && presence < 0.6) {
    push("content.geo", 5, "Publish a GEO asset to fix presence",
      `AI engines mention ${brandName} in only ${Math.round((presence) * 100)}% of relevant answers — publish structured, sourced content so they learn the brand.`,
      { format: "geo" });
  }
  if (gaps.length) {
    push("content.blog", 5, "Correct a perception gap at the source",
      `Detected: ${gaps[0]} — write an owned, cited blog that becomes the source of truth.`,
      { format: "blog", story: gaps[0] });
    push("content.social", 4, "Amplify the correction",
      `Turn the correcting blog into platform-native posts that funnel back to it.`,
      { format: "social" });
  }

  // 2) FUNNEL / DEMAND (from analytics signals).
  const conv = num("conversion_pct", 100);
  const bounce = num("bounce_rate", 0);
  const signups = num("signups_24h", -1);

  if (signups === 0) {
    push("content.whatsapp", 3, "Warm up a quiet day",
      "No sign-ups in 24h — draft a consent-friendly broadcast for warm leads (held until you open outreach).");
    push("content.email", 2, "Draft a short campaign",
      "Draft a value-first email around this week's story (held until you open outreach).");
  }
  if (conv < 40) {
    push("content.seo", 3, `Own the intent behind ${topPage}`,
      `Conversion is ~${conv}% — tune keywords/meta/internal links for the top landing page.`,
      { format: "seo", page: topPage });
    push("pricing.suggest", 2, "Propose a pricing experiment",
      "Low conversion — suggest ONE reversible pricing experiment (suggestion only; never auto-applied).");
  }
  if (bounce > 60) {
    push("ux.flag", 4, `Flag friction on ${topPage}`,
      `Bounce rate ${bounce}% on the top page — flag it for the product team while traffic is arriving.`,
      { page: topPage });
  }

  // 3) FALLBACK: never return empty — always give the operator a baseline brief.
  if (out.length <= 1) {
    push("ops.brief", 2, "Baseline operator brief", "All quiet — produce a baseline brief from the snapshot.");
  }

  // De-dupe by type (keep highest priority) and sort. Cap at 7 per cycle.
  const best: Record<string, PlannedAction> = {};
  for (const a of out) if (!best[a.type] || best[a.type].priority < a.priority) best[a.type] = a;
  return Object.values(best).sort((x, y) => y.priority - x.priority).slice(0, 7);
}
