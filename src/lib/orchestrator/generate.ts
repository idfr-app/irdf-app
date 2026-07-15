import { svc } from "../db";
import { generate as route } from "../ai/router";
import { brandVoicePrompt, AI_DISCLOSURE } from "../brandCore";
import type { BrandCore, PlannedAction, Snapshot } from "../types";

/**
 * GENERATE — turn a planned content action into a finished, brand-tone-locked,
 * truth-anchored asset, using the user-chosen model via the neutral router (which
 * falls back to deterministic templates). Audience-facing formats get the
 * AI-assist disclosure. Persists a content_assets row and returns its id.
 *
 * Non-content actions (perception.probe, ux.flag, ops.*) produce no asset here —
 * they are handled directly in act().
 */
const CONTENT_FORMATS: Record<string, string> = {
  "content.blog": "blog",
  "content.social": "social",
  "content.seo": "seo",
  "content.geo": "geo",
  "content.email": "email",
  "content.whatsapp": "whatsapp",
};

export async function generateAsset(
  tenantId: string,
  action: PlannedAction,
  bc: BrandCore,
  snapshot: Snapshot,
  model: string,
  actionId: string | null,
): Promise<{ assetId: string | null; via: string }> {
  const format = CONTENT_FORMATS[action.type];
  if (!format) return { assetId: null, via: "n/a" };

  const language = bc.languages[0] ?? "en";
  const topic = String(action.context?.story ?? action.title);

  const system = [
    `You produce ${format} content for a brand.`,
    brandVoicePrompt(bc),
    `Write in: ${language}. Return plain text only — no markdown fences.`,
    format === "geo"
      ? "This is a GEO asset: structured, quotable, well-sourced, designed so AI answer-engines learn the brand correctly."
      : "",
  ].filter(Boolean).join("\n");

  const result = await route({
    system,
    messages: [{ role: "user", content: topic }],
    model,
    task: action.type,
    temperature: 0.5,
    maxTokens: 700,
  });

  const audienceFacing = action.outreach || format === "social" || format === "blog";
  const body = audienceFacing ? result.text + AI_DISCLOSURE : result.text;

  const { data, error } = await svc()
    .from("content_assets")
    .insert({
      tenant_id: tenantId,
      action_id: actionId,
      format,
      language,
      body,
      via: result.via,
      meta: {
        model: result.model,
        usage: result.usage ?? null,
        disclosure: audienceFacing,
        sources: [],           // Phase 1: carry cited sources through from the radar
      },
    })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("asset insert failed");

  return { assetId: data.id as string, via: result.via };
}
