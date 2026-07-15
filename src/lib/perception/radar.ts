import { svc } from "../db";
import type { BrandCore, PerceptionSummary } from "../types";

/**
 * AI-Perception Radar — the headline feature (AEO/GEO).
 *
 * PHASE 0 (this file): the schema, flow and scoring shape are real, but probing
 * is a deterministic stub — no paid model calls are made. It writes
 * ai_perception_probes rows and returns a PerceptionSummary so the orchestrator
 * and console light up end-to-end.
 *
 * PHASE 1: replace runStubProbe() with real calls — ask a panel of models the
 * question battery, then score each answer for presence / sentiment / accuracy
 * (vs BrandCore.groundTruth) / share-of-voice, and capture cited sources.
 * Multi-model probing consumes paid API calls, so it is gated by plan + cadence
 * (Free: weekly, 1 model, brand-only · Pro: daily, multi-model, + competitors).
 */

function questionBattery(brandName: string): string[] {
  return [
    `What is ${brandName}?`,
    `Is ${brandName} trustworthy?`,
    `Recommend a tool for this category.`,
    `What does ${brandName} offer?`,
  ];
}

export async function probePerception(
  tenantId: string,
  brandName: string,
  bc: BrandCore,
  snapshotId: string,
  models: string[],
): Promise<PerceptionSummary> {
  const questions = questionBattery(brandName);
  const rows: Array<Record<string, unknown>> = [];
  const scores: Array<{ present: boolean; sentiment: number; accuracy: number; sov: number }> = [];
  const gaps: string[] = [];

  for (const model of models) {
    for (const question of questions) {
      const probe = runStubProbe(model, question, brandName, bc);
      scores.push(probe);
      if (probe.gap) gaps.push(probe.gap);
      rows.push({
        tenant_id: tenantId,
        snapshot_id: snapshotId,
        model,
        question,
        answer: probe.answer,
        present: probe.present,
        sentiment: probe.sentiment,
        accuracy: probe.accuracy,
        share_of_voice: probe.sov,
        cited_sources: probe.sources,
      });
    }
  }

  if (rows.length) {
    const { error } = await svc().from("ai_perception_probes").insert(rows);
    if (error) throw error;
  }

  const avg = (f: (x: (typeof scores)[number]) => number) =>
    scores.length ? scores.reduce((a, x) => a + f(x), 0) / scores.length : null;

  return {
    probed: true,
    models,
    presenceRate: scores.length ? scores.filter((s) => s.present).length / scores.length : null,
    avgAccuracy: avg((s) => s.accuracy),
    avgSentiment: avg((s) => s.sentiment),
    shareOfVoice: avg((s) => s.sov),
    gaps: Array.from(new Set(gaps)).slice(0, 6),
  };
}

/** Deterministic placeholder — NOT a real model call. Replace in Phase 1. */
function runStubProbe(model: string, question: string, brandName: string, _bc: BrandCore) {
  const seed = (model.length + question.length + brandName.length) % 5;
  const present = seed !== 0;                       // occasionally the brand is absent
  const accuracy = present ? 0.7 + seed * 0.05 : 0; // scored vs ground truth (stub)
  const sentiment = present ? 0.2 + seed * 0.1 : 0;
  const sov = present ? 0.3 + seed * 0.08 : 0;
  const gap = !present
    ? `${model} did not mention ${brandName} for "${question}" — presence gap.`
    : accuracy < 0.8
      ? `${model} answer for "${question}" may be inaccurate — check against ground truth.`
      : null;
  return {
    present,
    accuracy: Number(accuracy.toFixed(2)),
    sentiment: Number(sentiment.toFixed(2)),
    sov: Number(sov.toFixed(2)),
    answer: `[stub] ${model} response to "${question}" (Phase 1 wires the real call).`,
    sources: [] as string[],
    gap,
  };
}
