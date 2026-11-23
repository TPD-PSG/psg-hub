import Anthropic from "@anthropic-ai/sdk";

// One client for the whole app (reads ANTHROPIC_API_KEY from the environment)
export const claude = new Anthropic();

export type ClaudeModel = "claude-opus-5-5" | "claude-sonnet-5-5" | "claude-haiku-5-5";
type Effort = "low" | "medium" | "high" | "xhigh" | "max";
type Content = Anthropic.Beta.BetaContentBlockParam[];

// Why a Claude call didn't produce usable output, in words we can show staff
export class ClaudeOutputError extends Error {
  constructor(
    message: string,
    public reason: "refusal" | "max_tokens" | "invalid_json" | "empty",
  ) {
    super(message);
    this.name = "ClaudeOutputError";
  }
}

type BaseOptions = {
  model: ClaudeModel;
  // Either a single user message's content, or a whole conversation
  content?: Content;
  messages?: Anthropic.Beta.BetaMessageParam[];
  system?: string;
  maxTokens?: number;
  // Extraction jobs work well at low effort and stay inside Railway's 60s request limit
  effort?: Effort;
};

// Sends the request as a stream (no HTTP timeouts on long replies) and checks why it stopped.
async function run(opts: BaseOptions & { format?: Anthropic.Beta.BetaJSONOutputFormat }) {
  const usesFallback = opts.model !== "claude-haiku-5-5"; // Haiku has no server-side fallback
  const stream = claude.beta.messages.stream({
    model: opts.model,
    max_tokens: opts.maxTokens ?? 16000,
    ...(opts.system ? { system: opts.system } : {}),
    messages: opts.messages ?? [{ role: "user", content: opts.content ?? [] }],
    output_config: {
      effort: opts.effort ?? "low",
      ...(opts.format ? { format: opts.format } : {}),
    },
    // If the model declines on safety grounds, the API retries on a suitable model in the same call
    ...(usesFallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
  });
  const message = await stream.finalMessage();

  if (message.stop_reason === "refusal") {
    throw new ClaudeOutputError("Claude declined to process this document.", "refusal");
  }
  if (message.stop_reason === "max_tokens") {
    throw new ClaudeOutputError("The document was too long to process in one go; the reply was cut off.", "max_tokens");
  }
  const text = message.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map(b => b.text)
    .join("")
    .trim();
  if (!text) throw new ClaudeOutputError("Claude returned an empty reply.", "empty");
  return text;
}

/**
 * Ask Claude for JSON matching `schema` (structured outputs: the reply is constrained to the schema).
 * The schema's top level must be an object. Throws ClaudeOutputError if the reply is unusable.
 */
export async function extractJson<T>(opts: BaseOptions & { schema: Record<string, unknown> }): Promise<T> {
  const text = await run({ ...opts, format: { type: "json_schema", schema: opts.schema } });
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ClaudeOutputError("Claude's reply wasn't valid JSON.", "invalid_json");
  }
}

/** Plain-text reply (e.g. meeting minutes, answers), with the same stop checks. */
export async function generateText(opts: BaseOptions): Promise<string> {
  return run(opts);
}

/** A PDF as a document block (base64, no newlines). */
export function pdfBlock(base64: string): Anthropic.Beta.BetaContentBlockParam {
  return { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64.replace(/\s/g, "") } };
}

// Small helpers for building JSON schemas: every property required, nulls allowed, no extras
export const nullable = (type: "string" | "number" | "integer" | "boolean", description?: string) => ({
  type: [type, "null"],
  ...(description ? { description } : {}),
});
export function objectSchema(properties: Record<string, unknown>) {
  return { type: "object", properties, required: Object.keys(properties), additionalProperties: false };
}
