import { svc } from "./db";
import type { BrandCore } from "./types";

/** Load a tenant's Brand Core (server-side, service role; caller scopes tenant). */
export async function loadBrandCore(tenantId: string): Promise<BrandCore> {
  const { data, error } = await svc()
    .from("brand_core")
    .select("*")
    .eq("tenant_id", tenantId)
    .single();
  if (error || !data) throw new Error(`brand_core missing for tenant ${tenantId}`);
  return {
    tenantId: data.tenant_id,
    accent: data.accent,
    accentInk: data.accent_ink,
    tone: data.tone,
    languages: data.languages ?? ["en"],
    lexiconDo: data.lexicon_do ?? [],
    lexiconDont: data.lexicon_dont ?? [],
    forbiddenClaims: data.forbidden_claims ?? [],
    groundTruth: data.ground_truth ?? {},
  };
}

/**
 * The brand's voice + guardrails, rendered as a system-prompt fragment.
 * This is the *one tone* that flows into every generated asset — the exact
 * counterpart to the accent colour that flows into the console theme.
 */
export function brandVoicePrompt(bc: BrandCore): string {
  const lines = [
    `TONE OF VOICE: ${bc.tone}.`,
    bc.lexiconDo.length ? `PREFER: ${bc.lexiconDo.join("; ")}.` : "",
    bc.lexiconDont.length ? `AVOID: ${bc.lexiconDont.join("; ")}.` : "",
    bc.forbiddenClaims.length
      ? `NEVER CLAIM (truth anchor): ${bc.forbiddenClaims.join("; ")}.`
      : "",
    `BRAND GROUND TRUTH (do not contradict): ${JSON.stringify(bc.groundTruth)}.`,
    "TRUTH ANCHOR: never fabricate facts, statistics, dates or quotes. If a claim needs a source, name it or write '(verify source)'. Never impersonate a real person or authority.",
  ];
  return lines.filter(Boolean).join("\n");
}

/** The AI-assist disclosure appended to every audience-facing asset. */
export const AI_DISCLOSURE =
  "\n\n— AI-assisted draft. A human must review every claim before it reaches an audience.";
