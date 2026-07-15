import { svc } from "../db";
import { ACTION_CATALOGUE } from "../guardrails";
import { generateAsset } from "./generate";
import type { ActionStatus, BrandCore, Governance, PlannedAction, Snapshot } from "../types";

/**
 * ACT — execute exactly one action. Content actions produce a finished asset via
 * generate(); internal actions perform a reversible, footprint-free effect.
 * Nothing here dispatches to an external audience — publishing is a separate,
 * explicitly-gated step (Phase 2). Every call records an actions row and returns
 * the outcome for the ledger.
 */

export async function persistAction(
  tenantId: string,
  planId: string,
  a: PlannedAction,
  status: ActionStatus,
  actor: string,
): Promise<string> {
  const { data, error } = await svc()
    .from("actions")
    .insert({
      tenant_id: tenantId, plan_id: planId, type: a.type, priority: a.priority,
      risk: a.risk, reversible: a.reversible, outreach: a.outreach,
      status, title: a.title, rationale: a.rationale, actor,
    })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("action insert failed");
  return data.id as string;
}

export async function setActionStatus(actionId: string, status: ActionStatus, actor: string) {
  await svc().from("actions")
    .update({ status, actor, decided_at: new Date().toISOString() })
    .eq("id", actionId);
}

export async function executeAction(
  tenantId: string,
  action: PlannedAction,
  actionId: string,
  bc: BrandCore,
  snapshot: Snapshot,
  brandName: string,
  model: string,
): Promise<{ status: ActionStatus; assetId?: string; result: string }> {
  const meta = ACTION_CATALOGUE[action.type];
  if (!meta) return { status: "blocked", result: "unknown action type" };

  // Content formats → finished asset via the neutral router (template fallback).
  if (action.type.startsWith("content.")) {
    const { assetId, via } = await generateAsset(tenantId, action, bc, snapshot, model, actionId);
    return { status: "executed", assetId: assetId ?? undefined, result: `drafted via ${via}` };
  }

  // Internal, reversible effects.
  switch (action.type) {
    case "perception.probe":
      return { status: "executed", result: snapshot.perception.probed
        ? `Radar ran: presence ${pct(snapshot.perception.presenceRate)}, accuracy ${pct(snapshot.perception.avgAccuracy)}.`
        : "Radar scheduled for the next Pro-cadence cycle." };
    case "ux.flag":
      return { status: "executed", result: `Flagged for the product team: ${action.title}.` };
    case "ops.alert":
      return { status: "executed", result: `Internal alert recorded: ${action.rationale}` };
    case "ops.brief": {
      const brief = buildBrief(snapshot, brandName);
      const { data } = await svc().from("content_assets").insert({
        tenant_id: tenantId, action_id: actionId, format: "brief",
        language: bc.languages[0] ?? "en", body: brief, via: "template",
        meta: { kind: "operator_brief" },
      }).select("id").single();
      return { status: "executed", assetId: data?.id, result: "Operator brief generated." };
    }
    case "pricing.suggest":
      return { status: "executed", result: "Pricing experiment proposed (suggestion only — never auto-applied)." };
    default:
      return { status: "executed", result: "Executed (internal, reversible)." };
  }
}

function pct(v: number | null): string {
  return v == null ? "—" : `${Math.round(v * 100)}%`;
}

function buildBrief(s: Snapshot, brandName: string): string {
  const line = (k: string) => s.signals.find((x) => x.key === k)?.label ?? null;
  const p = s.perception;
  return [
    `OPERATOR BRIEF · ${brandName} · ${new Date(s.takenAt).toLocaleString()}`,
    ...[line("sessions_24h"), line("signups_24h"), line("conversion_pct"), line("top_page")].filter(Boolean),
    p.probed
      ? `AI perception — presence ${pct(p.presenceRate)}, accuracy ${pct(p.avgAccuracy)}, share-of-voice ${pct(p.shareOfVoice)}.`
      : "AI perception — not probed this cycle.",
    p.gaps.length ? `Gaps: ${p.gaps.join(" | ")}` : "No perception gaps detected.",
  ].join("\n");
}
