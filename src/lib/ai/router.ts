import type { GenRequest, GenResult, Provider } from "./types";
import { templateProvider } from "./providers/template";
import { anthropicProvider } from "./providers/anthropic";
import { openaiProvider } from "./providers/openai";

/**
 * The provider-neutral router — the generalised vlAI.chat().
 * One call in front of every provider. Model is "vendor:id"; unknown vendors,
 * missing keys, or a provider error all degrade gracefully to deterministic
 * templates, so the engine is never dead. Per-task model choice and BYOK
 * (Phase 2) both slot in here without changing any caller.
 */
function resolve(model?: string): Provider {
  if (!model || model === "template") return templateProvider;
  const [vendor, ...rest] = model.split(":");
  const id = rest.join(":");
  switch (vendor) {
    case "anthropic": return anthropicProvider(id || "claude-sonnet-4-6");
    case "openai":    return openaiProvider(id || "gpt-4o-mini");
    default:          return templateProvider;
  }
}

export async function generate(req: GenRequest): Promise<GenResult> {
  const provider = resolve(req.model);
  if (!provider.available()) {
    return templateProvider.generate(req);
  }
  const result = await provider.generate(req);
  // Any real-provider failure → template, so a cycle always produces something.
  if (!result.ok || !result.text) {
    return templateProvider.generate(req);
  }
  return result;
}

/** Which models are usable right now (drives the console's per-task picker). */
export function availableModels(): string[] {
  const models = ["template"];
  if (anthropicProvider("").available()) models.push("anthropic:claude-sonnet-4-6");
  if (openaiProvider("").available()) models.push("openai:gpt-4o-mini");
  return models;
}
