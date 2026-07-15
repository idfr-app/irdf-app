import type { Provider, GenRequest, GenResult } from "../types";
import { env } from "../../env";

/** OpenAI provider. Model id passed as "openai:<model>"; router strips the prefix. */
export function openaiProvider(modelId: string): Provider {
  return {
    id: "openai",
    available: () => !!env.openaiKey(),
    async generate(req: GenRequest): Promise<GenResult> {
      const key = env.openaiKey();
      if (!key) return { ok: false, text: "", via: "template", model: modelId, error: "no key" };
      try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
          body: JSON.stringify({
            model: modelId,
            temperature: req.temperature ?? 0.5,
            max_tokens: req.maxTokens ?? 800,
            messages: [
              { role: "system", content: req.system },
              ...req.messages.map((m) => ({ role: m.role, content: m.content })),
            ],
          }),
        });
        if (!res.ok) {
          return { ok: false, text: "", via: "template", model: modelId, error: `http ${res.status}` };
        }
        const data = await res.json();
        const text: string = (data.choices?.[0]?.message?.content ?? "").trim();
        return {
          ok: !!text,
          text,
          via: `ai:openai:${modelId}`,
          model: modelId,
          usage: {
            inputTokens: data.usage?.prompt_tokens,
            outputTokens: data.usage?.completion_tokens,
          },
        };
      } catch (e) {
        return { ok: false, text: "", via: "template", model: modelId, error: String(e) };
      }
    },
  };
}
