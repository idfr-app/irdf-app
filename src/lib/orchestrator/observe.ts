import { svc } from "../db";
import { getConnector } from "../connectors/registry";
import { probePerception } from "../perception/radar";
import { seal } from "../ledger";
import type { BrandCore, Governance, PerceptionSummary, Signal, Snapshot } from "../types";

/**
 * OBSERVE — read every enabled connector into one normalised snapshot, and (on
 * Pro cadence) fold in the AI-Perception Radar. Persists the snapshot and seals
 * an 'observe' entry to the ledger. This is the generalised, multi-tenant
 * version of IRDF.observe().
 */
export async function observe(
  tenantId: string,
  gov: Governance,
  bc: BrandCore,
  brandName: string,
  opts: { probe?: boolean; models?: string[] } = {},
): Promise<{ snapshot: Snapshot; snapshotId: string }> {
  // 1) Gather signals from every enabled connector.
  const { data: rows } = await svc()
    .from("connectors")
    .select("kind, config, enabled")
    .eq("tenant_id", tenantId)
    .eq("enabled", true);

  const signals: Signal[] = [];
  for (const row of rows ?? []) {
    const connector = getConnector(row.kind);
    if (!connector) continue;
    try {
      const s = await connector.fetchSignals({ tenantId, config: row.config ?? {} });
      signals.push(...s);
    } catch {
      // A failing connector must never crash a cycle; it just contributes nothing.
    }
  }

  // 2) Persist the snapshot first (so probes can reference snapshot_id).
  const { data: snapRow, error: snapErr } = await svc()
    .from("snapshots")
    .insert({ tenant_id: tenantId, signals, perception: {} })
    .select("id, taken_at")
    .single();
  if (snapErr || !snapRow) throw snapErr ?? new Error("snapshot insert failed");
  const snapshotId = snapRow.id as string;

  // 3) Perception radar (gated by caller: plan + cadence decide whether to probe).
  let perception = emptyPerception();
  if (opts.probe) {
    perception = await probePerception(
      tenantId, brandName, bc, snapshotId, opts.models ?? ["template"],
    );
    await svc().from("snapshots").update({ perception }).eq("id", snapshotId);
  }

  const snapshot: Snapshot = {
    tenantId,
    takenAt: new Date(snapRow.taken_at).getTime(),
    signals,
    perception,
  };

  await seal(tenantId, "observe", {
    title: "Reality snapshot",
    snapshotId,
    signalCount: signals.length,
    probed: perception.probed,
  });

  return { snapshot, snapshotId };
}

function emptyPerception(): PerceptionSummary {
  return {
    probed: false, models: [], presenceRate: null, avgAccuracy: null,
    avgSentiment: null, shareOfVoice: null, gaps: [] as string[],
  };
}
