import type { Provider, GenRequest, GenResult } from "../types";

/**
 * The deterministic fallback — carried straight from IRDF's design law:
 * "Works with ZERO AI configured." When no provider key is set (or every real
 * provider fails), the engine still ships a usable, on-structure draft. It never
 * fabricates facts; it produces a skeleton with explicit "(verify source)" slots
 * for the operator to complete. This is what Phase 0 runs on by default.
 */
export const templateProvider: Provider = {
  id: "template",
  available: () => true,
  async generate(req: GenRequest): Promise<GenResult> {
    const topic = extractTopic(req);
    const body = render(req.task ?? "", topic);
    return { ok: true, text: body, via: "template", model: "template" };
  },
};

function extractTopic(req: GenRequest): string {
  const last = [...req.messages].reverse().find((m) => m.role === "user");
  return (last?.content ?? "your brand").slice(0, 160);
}

function render(task: string, topic: string): string {
  switch (task) {
    case "content.blog":
      return [
        `TITLE: ${topic} — a plain-language explainer`,
        `HOOK: [2 lines that state who this helps and why it matters now]`,
        `SECTIONS:`,
        `  1) What this is`,
        `  2) When it actually matters`,
        `  3) Steps / how it works`,
        `  4) Common mistakes`,
        `  5) How we help`,
        `SOURCE: (verify source — name the exact rule/fact before publishing)`,
      ].join("\n");
    case "content.social":
      return [
        `REEL (15s): Hook — "${topic}". 3 things you should know → full guide on the blog (link in bio).`,
        `X THREAD: 1/ ${topic} — a short thread. 2/ [key point]. 3/ Full breakdown + template → [blog link].`,
        `LINKEDIN: ${topic} — why it matters for your audience. Read the full explainer → [blog link]. (Source: verify before posting.)`,
      ].join("\n");
    case "content.seo":
      return [
        `KEYWORDS: [6 target terms for "${topic}"]`,
        `TITLE TAG (<60 chars): ${topic}`,
        `META (<155 chars): [one-sentence description of the blog]`,
        `INTERNAL LINKS: [2 relevant existing pages]`,
      ].join("\n");
    case "content.geo":
      return [
        `GEO ASSET — structured, quotable, well-sourced content designed so AI answer-engines learn the brand correctly.`,
        `CLAIM: [one true, specific statement about the brand]`,
        `EVIDENCE: (verify source)`,
        `Q&A the model should be able to answer: [3 question/answer pairs grounded in brand ground-truth]`,
      ].join("\n");
    case "content.email":
      return [`SUBJECT: [<8 words about "${topic}"]`, `BODY (<120 words): [value-first note linking to the blog]`, `OPT-OUT: clear unsubscribe line.`].join("\n");
    case "content.whatsapp":
      return [`BROADCAST (<60 words): [consent-friendly note on "${topic}" with a link]`, `OPT-OUT: reply STOP to unsubscribe.`].join("\n");
    case "ops.brief":
      return `OPERATOR BRIEF · baseline. Topic in focus: ${topic}. [snapshot summary is attached by the orchestrator]`;
    default:
      return `[${task || "draft"}] ${topic} — draft skeleton (no AI configured). (verify source)`;
  }
}
