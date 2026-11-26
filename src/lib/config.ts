function num(value: string | undefined, fallback: number): number {
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function stripSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

const openAiKey = process.env.OPENAI_API_KEY ?? "";

const provider = (process.env.EMBEDDING_PROVIDER ?? "auto").toLowerCase();

export const config = {
  appName: "DocuMind AI",
  version: "1.0.0",
  sessionTtlDays: num(process.env.SESSION_TTL_DAYS, 30),
  cookieSecure: process.env.COOKIE_SECURE === "true",
  upload: {
    maxBytes: num(process.env.MAX_UPLOAD_BYTES, 15 * 1024 * 1024),
    acceptedMime: ["application/pdf"],
  },
  chunking: { targetTokens: 500, overlapTokens: 100 },
  retrieval: { topK: 5, candidateK: 12, maxPerDocument: 3 },
  llm: {
    apiKey: process.env.LLM_API_KEY ?? openAiKey,
    baseUrl: stripSlash(
      process.env.LLM_BASE_URL ?? process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
    ),
    model: process.env.LLM_MODEL ?? "gpt-4o-mini",
    temperature: num(process.env.LLM_TEMPERATURE, 0.2),
    maxTokens: num(process.env.LLM_MAX_TOKENS, 900),
  },
  embeddings: {
    provider: (["auto", "local", "openai"].includes(provider) ? provider : "auto") as
      | "auto"
      | "local"
      | "openai",
    apiKey: process.env.EMBEDDING_API_KEY ?? openAiKey,
    baseUrl: stripSlash(
      process.env.EMBEDDING_BASE_URL ?? process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
    ),
    model: process.env.EMBEDDING_MODEL ?? "text-embedding-3-small",
    localDimension: num(process.env.LOCAL_EMBEDDING_DIM, 768),
    minScoreOverride:
      process.env.RETRIEVAL_MIN_SCORE === undefined
        ? null
        : num(process.env.RETRIEVAL_MIN_SCORE, null as unknown as number),
  },
  ocr: { enabled: process.env.OCR_ENABLED === "true" },
};

export const DEFAULT_MIN_SCORE = 0.4;
