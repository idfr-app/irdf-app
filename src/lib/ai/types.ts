export interface GenMessage {
  role: "user" | "assistant";
  content: string;
}

export interface GenRequest {
  system: string;
  messages: GenMessage[];
  model?: string;          // "anthropic:<id>" | "openai:<id>" | "template"
  temperature?: number;
  maxTokens?: number;
  task?: string;           // for logging/metering, e.g. "content.blog"
}

export interface GenResult {
  ok: boolean;
  text: string;
  via: string;             // "ai:anthropic:<id>" | "ai:openai:<id>" | "template"
  model: string;
  usage?: { inputTokens?: number; outputTokens?: number };
  error?: string;
}

/** A provider is anything that can turn a GenRequest into text. */
export interface Provider {
  id: string;                       // "anthropic" | "openai" | "template"
  available(): boolean;             // key present / always-on for template
  generate(req: GenRequest): Promise<GenResult>;
}
