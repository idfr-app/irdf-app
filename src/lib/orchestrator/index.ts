import { svc } from "../db";
import { loadBrandCore } from "../brandCore";
import { seal, verify } from "../ledger";
import { canAuto, outreachGate, isAllowed } from "../guardrails";
import { availableModels } from "../ai/router";
import { observe } from "./observe";
import { orient } from "./orient";
import { executeAction, persistAction, setActionStatus } from "./act";
import type { CycleResult, Governance, PlannedAction } from "../types";

/**
 * The full OODA cycle, per tenant — the generalised IRDF.cycle().
 *   Observe → Orient(Plan) → Generate → Act(auto or queue) → Log
 *
 * Autonomy model, enforced here + in guardrails:
 *   - engine off / kill switch on ⇒ nothing runs
 *   - low/med reversible internal actions may auto-run within the mode ceiling
 *     and the daily budget; everything else is queued for a human tap
 *   - audience-facing actions are ALWAYS queued and additionally gated by the
 *     outreach lock — they never auto-run in any mode
 */
export async function runCycle(tenantId: string, actor = "orchestrator"): Promise<CycleResult> {
  const gov = await loadGovernance(tenantId);
  if (!gov.enabled) return empty("off");
  if (gov.killswitch) return empty("killswitch");

  const bc = await loadBrandCore(tenantId);
  const brandName = await tenantName(tenantId);
  const usage = await todayUsage(tenantId);

  // Decide whether to probe perception this cycle (plan + cadence).
  const plan = await tenantPlan(tenantId);
  const probe = shouldProbe(plan);
  const models = probeModels(plan);
  const genModel = availableModels().slice(-1)[0] ?? "template"; // best available; per-task choice is Phase 2

  // 1) OBSERVE
  const { snapshot, snapshotId } = await observe(tenantId, gov, bc, brandName, { probe, models });

  // 2) ORIENT
  const candidates = orient(snapshot, brandName).filter((a) => isAllowed(a.type));

  const { data: planRow } = await svc().from("plans")
    .insert({ tenant_id: tenantId, snapshot_id: snapshotId, via: "rules" })
    .select("id").single();
  const planId = planRow!.id as string;

  await seal(tenantId, "plan", {
    title: "Plan formed", via: "rules", count: candidates.length,
    actions: candidates.map((a) => ({ type: a.type, priority: a.priority })),
  });

  // 3) + 4) GENERATE + ACT
  const executed: CycleResult["executed"] = [];
  const queued: CycleResult["queued"] = [];
  let autoBudget = gov.maxAutoPerDay - usage.autoActions;
  let dayBudget = gov.maxActionsPerDay - usage.totalActions;

  for (const a of candidates) {
    if (dayBudget <= 0) break;                               // daily cap reached
    const usageNow = { autoActions: gov.maxAutoPerDay - autoBudget };

    if (canAuto(a, gov, usageNow) && autoBudget > 0) {
      const actionId = await persistAction(tenantId, planId, a, "approved", `${actor} (auto)`);
      const r = await executeAction(tenantId, a, actionId, bc, snapshot, brandName, genModel);
      await setActionStatus(actionId, r.status, `${actor} (auto)`);
      await seal(tenantId, "act", {
        title: a.title, type: a.type, risk: a.risk, autonomy: gov.mode,
        status: r.status, actor: `${actor} (auto)`, assetId: r.assetId ?? null, result: r.result,
      });
      executed.push({ type: a.type, status: r.status, assetId: r.assetId });
      autoBudget -= 1; dayBudget -= 1;
      if (a.type.startsWith("content.")) await bumpUsage(tenantId, "generations");
    } else {
      // Queue for a human. Audience-facing actions also show the outreach gate.
      const gate = outreachGate(a, gov);
      const status = gate ? "blocked" : "queued";
      const actionId = await persistAction(tenantId, planId, a, status, "pending");
      queued.push({ id: actionId, type: a.type });
    }
  }

  return {
    ran: true, via: "rules", snapshotId, executed, queued,
  };
}

/**
 * Approve one queued action (the human tap). Executes it now, regardless of
 * autonomy mode, but still honours the outreach lock for audience-facing types.
 */
export async function approveQueued(tenantId: string, actionId: string, actor: string): Promise<{ ok: boolean; status: string; assetId?: string; result: string }> {
  const gov = await loadGovernance(tenantId);
  if (gov.killswitch) return { ok: false, status: "blocked", result: "Kill switch is active." };

  const { data: row } = await svc().from("actions")
    .select("*").eq("tenant_id", tenantId).eq("id", actionId).single();
  if (!row) return { ok: false, status: "blocked", result: "Action not found." };
  if (!["queued", "blocked"].includes(row.status)) {
    return { ok: false, status: row.status, result: `Already ${row.status}.` };
  }

  const action: PlannedAction = {
    type: row.type, priority: row.priority, risk: row.risk,
    reversible: row.reversible, outreach: row.outreach, title: row.title, rationale: row.rationale,
  };
  const gate = outreachGate(action, gov);
  if (gate) return { ok: false, status: "blocked", result: gate };

  const bc = await loadBrandCore(tenantId);
  const brandName = await tenantName(tenantId);
  const { data: snap } = await svc().from("snapshots")
    .select("id, taken_at, signals, perception").eq("tenant_id", tenantId)
    .order("taken_at", { ascending: false }).limit(1).single();
  const snapshot = {
    tenantId, takenAt: new Date(snap!.taken_at).getTime(),
    signals: snap!.signals ?? [], perception: snap!.perception ?? { probed: false, models: [], presenceRate: null, avgAccuracy: null, avgSentiment: null, shareOfVoice: null, gaps: [] },
  };
  const genModel = availableModels().slice(-1)[0] ?? "template";

  const r = await executeAction(tenantId, action, actionId, bc, snapshot, brandName, genModel);
  await setActionStatus(actionId, r.status, actor);
  await seal(tenantId, "act", {
    title: action.title, type: action.type, risk: action.risk,
    status: r.status, actor, assetId: r.assetId ?? null, result: r.result,
  });
  if (action.type.startsWith("content.")) await bumpUsage(tenantId, "generations");
  return { ok: true, status: r.status, assetId: r.assetId, result: r.result };
}

/** Dismiss a queued action (the other human tap). */
export async function dismissQueued(tenantId: string, actionId: string, actor: string) {
  await setActionStatus(actionId, "dismissed", actor);
  await seal(tenantId, "act", { title: "Dismissed", actionId, actor, status: "dismissed" });
}

/**
 * Kill switch — instantly disarm and purge the PENDING queue. The ledger is
 * always preserved (it is append-only), and its integrity is re-verified so the
 * governance event is provably recorded on an intact chain.
 */
export async function killSwitch(tenantId: string, actor: string) {
  await svc().from("governance").update({ killswitch: true, enabled: false }).eq("tenant_id", tenantId);
  await svc().from("actions")
    .update({ status: "dismissed", actor, decided_at: new Date().toISOString() })
    .eq("tenant_id", tenantId).in("status", ["queued", "blocked", "proposed"]);
  await seal(tenantId, "govern", { event: "killswitch", actor, purgedQueue: true });
  const integrity = await verify(tenantId);
  return { disarmed: true, ledgerIntact: integrity.ok };
}

// ── small data helpers ───────────────────────────────────────────────────────
async function loadGovernance(tenantId: string): Promise<Governance> {
  const { data } = await svc().from("governance").select("*").eq("tenant_id", tenantId).single();
  return {
    tenantId, enabled: data.enabled, mode: data.mode, outreachUnlocked: data.outreach_unlocked,
    killswitch: data.killswitch, cadenceMinutes: data.cadence_minutes,
    maxAutoPerDay: data.max_auto_per_day, maxActionsPerDay: data.max_actions_per_day,
  };
}
async function tenantName(tenantId: string): Promise<string> {
  const { data } = await svc().from("tenants").select("name").eq("id", tenantId).single();
  return data?.name ?? "the brand";
}
async function tenantPlan(tenantId: string): Promise<string> {
  const { data } = await svc().from("tenants").select("plan").eq("id", tenantId).single();
  return data?.plan ?? "free";
}
async function todayUsage(tenantId: string) {
  const day = new Date().toISOString().slice(0, 10);
  const { data } = await svc().from("usage").select("*").eq("tenant_id", tenantId).eq("day", day).maybeSingle();
  return {
    autoActions: data?.auto_actions ?? 0,
    totalActions: (data?.auto_actions ?? 0) + 0, // Phase 0 counts autos toward the day cap; manual approvals are separate
  };
}
async function bumpUsage(tenantId: string, field: "generations" | "probes" | "auto_actions") {
  const day = new Date().toISOString().slice(0, 10);
  const { data } = await svc().from("usage").select("*").eq("tenant_id", tenantId).eq("day", day).maybeSingle();
  const next = {
    tenant_id: tenantId, day,
    generations: (data?.generations ?? 0) + (field === "generations" ? 1 : 0),
    probes: (data?.probes ?? 0) + (field === "probes" ? 1 : 0),
    auto_actions: (data?.auto_actions ?? 0) + (field === "auto_actions" ? 1 : 0),
  };
  await svc().from("usage").upsert(next, { onConflict: "tenant_id,day" });
}

// Free: weekly, single model, brand-only. Pro: daily, multi-model. (Phase 0 = template model.)
function shouldProbe(plan: string): boolean {
  if (plan === "pro") return true;                          // daily
  return new Date().getUTCDay() === 1;                      // free: Mondays only
}
function probeModels(plan: string): string[] {
  const all = availableModels();                            // ['template', maybe real models]
  return plan === "pro" ? all : [all[0] ?? "template"];     // free: one model
}

function empty(reason: string): CycleResult {
  return { ran: false, reason, executed: [], queued: [] };
}
