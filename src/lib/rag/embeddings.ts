import { config, DEFAULT_MIN_SCORE } from "../config";
import { ApiError } from "../http";
import { logger } from "../logger";
import { bigrams, tokenize } from "./tokenize";

export interface Embedder {
  readonly provider: "local" | "openai";
  readonly model: string;
  readonly dimension: number;
  readonly minScore: number;
  embed(texts: string[]): Promise<number[][]>;
}

function hash32(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Deterministic offline embedder: signed feature hashing of stemmed unigrams + bigrams
 * (weighted) into a fixed-dimensional, L2-normalised vector. No network, no model download.
 */
class LocalHashingEmbedder implements Embedder {
  readonly provider = "local" as const;
  readonly model = "documind-hashing-ngram-v1";
  readonly dimension: number;
  readonly minScore: number;

  constructor(dimension: number, minScore: number) {
    this.dimension = dimension;
    this.minScore = minScore;
  }

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.vector(t));
  }

  private vector(text: string): number[] {
    const dim = this.dimension;
    const acc = new Float64Array(dim);
    const add = (feature: string, weight: number) => {
      const h = hash32(feature);
      const sign = (h & 1) === 1 ? 1 : -1;
      acc[(h >>> 1) % dim] += sign * weight;
      acc[hash32(`${feature}\u0001`) % dim] += sign * weight;
    };

    const tokens = tokenize(text);
    for (const token of tokens) add(token, token.length > 9 || /\d/.test(token) ? 1.6 : 1);
    for (const bg of bigrams(tokens)) add(bg, 2.2);

    const out = new Array<number>(dim);
    let norm = 0;
    for (let i = 0; i < dim; i++) {
      const damped = Math.sign(acc[i]) * Math.log1p(Math.abs(acc[i]));
      out[i] = damped;
      norm += damped * damped;
    }
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < dim; i++) out[i] = out[i] / norm;
    return out;
  }
}

/** OpenAI-compatible embeddings endpoint (OpenAI, Azure, OpenRouter, local servers...). */
class OpenAiCompatibleEmbedder implements Embedder {
  readonly provider = "openai" as const;
  readonly model: string;
  dimension = 0;
  readonly minScore: number;
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor() {
    this.model = config.embeddings.model;
    this.minScore = config.embeddings.minScoreOverride ?? 0.3;
    this.apiKey = config.embeddings.apiKey;
    this.baseUrl = config.embeddings.baseUrl;
  }

  async embed(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    for (let i = 0; i < texts.length; i += 64) {
      const batch = texts.slice(i, i + 64);
      let res: Response;
      try {
        res = await fetch(`${this.baseUrl}/embeddings`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
          body: JSON.stringify({ model: this.model, input: batch }),
        });
      } catch (err) {
        logger.error("Embedding provider unreachable", { error: String(err) });
        throw new ApiError(502, "The embedding provider could not be reached.", "embedding_error");
      }
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        logger.error("Embedding provider error", { status: res.status, detail: detail.slice(0, 300) });
        throw new ApiError(502, `The embedding provider returned an error (HTTP ${res.status}).`, "embedding_error");
      }
      const json = (await res.json()) as { data?: Array<{ embedding?: number[] }> };
      for (const item of json.data ?? []) {
        if (!item.embedding) throw new ApiError(502, "The embedding provider returned an incomplete response.", "embedding_error");
        results.push(item.embedding);
      }
      if (!this.dimension && results[0]) this.dimension = results[0].length;
    }
    return results;
  }
}

let cached: Embedder | null = null;

export function getEmbedder(): Embedder {
  if (cached) return cached;
  const { provider, apiKey } = config.embeddings;
  const useOpenAi = provider === "openai" || (provider === "auto" && apiKey.length > 0);
  const minScore = config.embeddings.minScoreOverride ?? DEFAULT_MIN_SCORE;
  cached = useOpenAi ? new OpenAiCompatibleEmbedder() : new LocalHashingEmbedder(config.embeddings.localDimension, minScore);
  logger.info("Embedder resolved", { provider: cached.provider, model: cached.model, dimension: cached.dimension });
  return cached;
}

export function describeEmbedder(): { provider: "local" | "openai"; model: string; dimension: number } {
  const e = getEmbedder();
  return { provider: e.provider, model: e.model, dimension: e.dimension || 1536 };
}
