import type { Provider, GenRequest, GenResult } from "../types";
import { env } from "../../env";

/**
 * Anthropic provider. Only reachable through the router, and only when a
 * server-side key exists. Model id is passed as "anthropic:<model>"; the router
 * strips the prefix before calling here.
 */
export function anthropicProvider(modelId: string): Provider {
  return {
    id: "anthropic",
    available: () => !!env.anthropicKey(),
    async generate(req: GenRequest): Promise<GenResult> {
      const key = env.anthropicKey();
      if (!key) return { ok: false, text: "", via: "template", model: modelId, error: "no key" };
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: modelId,
            max_tokens: req.maxTokens ?? 800,
            temperature: req.temperature ?? 0.5,
            system: req.system,
            messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
          }),
        });
        if (!res.ok) {
          return { ok: false, text: "", via: "template", model: modelId, error: `http ${res.status}` };
        }
        const data = await res.json();
        const text: string = (data.content ?? [])
          .filter((b: { type: string }) => b.type === "text")
          .map((b: { text: string }) => b.text)
          .join("\n")
          .trim();
        return {
          ok: !!text,
          text,
          via: `ai:anthropic:${modelId}`,
          model: modelId,
          usage: {
            inputTokens: data.usage?.input_tokens,
            outputTokens: data.usage?.output_tokens,
          },
        };
      } catch (e) {
        return { ok: false, text: "", via: "template", model: modelId, error: String(e) };
      }
    },
  };
}
