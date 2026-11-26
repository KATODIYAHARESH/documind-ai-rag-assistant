import { config } from "../config";
import { ApiError } from "../http";
import { logger } from "../logger";
import type { LlmMessage } from "./prompt";

export interface LLMProvider {
  readonly provider: string;
  readonly model: string;
  generate(
    messages: LlmMessage[],
    options: { onDelta: (text: string) => void; signal?: AbortSignal },
  ): Promise<{ text: string; finishReason: string | null }>;
}

interface ChatChunk {
  choices?: Array<{ delta?: { content?: string | null }; finish_reason?: string | null }>;
}

class OpenAiCompatibleProvider implements LLMProvider {
  readonly provider = "openai-compatible";
  readonly model: string;

  constructor() {
    this.model = config.llm.model;
  }

  async generate(
    messages: LlmMessage[],
    options: { onDelta: (text: string) => void; signal?: AbortSignal },
  ): Promise<{ text: string; finishReason: string | null }> {
    let res: Response;
    try {
      res = await fetch(`${config.llm.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.llm.apiKey}`,
        },
        body: JSON.stringify({
          model: config.llm.model,
          messages,
          temperature: config.llm.temperature,
          max_tokens: config.llm.maxTokens,
          stream: true,
        }),
        signal: options.signal,
      });
    } catch (err) {
      if (options.signal?.aborted) throw new ApiError(499, "Generation cancelled.", "cancelled");
      logger.error("LLM provider unreachable", { error: String(err) });
      throw new ApiError(502, "The AI provider could not be reached. Please try again in a moment.", "llm_unreachable");
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      logger.error("LLM provider error", { status: res.status, detail: detail.slice(0, 300) });
      throw new ApiError(502, `The AI provider returned an error (HTTP ${res.status}).`, "llm_error");
    }
    if (!res.body) throw new ApiError(502, "The AI provider returned an empty response stream.", "llm_error");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    let finishReason: string | null = null;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let newline: number;
        while ((newline = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (data === "[DONE]") continue;
          try {
            const json = JSON.parse(data) as ChatChunk;
            const delta = json.choices?.[0]?.delta?.content;
            if (typeof delta === "string" && delta.length) {
              text += delta;
              options.onDelta(delta);
            }
            const reason = json.choices?.[0]?.finish_reason;
            if (reason) finishReason = reason;
          } catch {
            // Ignore keep-alive or partial lines.
          }
        }
      }
    } catch (err) {
      if (options.signal?.aborted) throw new ApiError(499, "Generation cancelled.", "cancelled");
      throw err;
    }

    return { text, finishReason };
  }
}

let cached: LLMProvider | null = null;
let resolved = false;

/** Returns the configured LLM provider, or null when no API key is set (extractive mode). */
export function getLLM(): LLMProvider | null {
  if (resolved) return cached;
  resolved = true;
  if (config.llm.apiKey) {
    cached = new OpenAiCompatibleProvider();
    logger.info("LLM provider ready", { model: cached.model, baseUrl: config.llm.baseUrl });
  } else {
    logger.info("No LLM API key configured - grounded extractive mode active");
  }
  return cached;
}

export function describeLLM(): { configured: boolean; provider: string; model: string } {
  const llm = getLLM();
  return llm
    ? { configured: true, provider: llm.provider, model: llm.model }
    : { configured: false, provider: "extractive-offline", model: "Grounded passage extraction" };
}
