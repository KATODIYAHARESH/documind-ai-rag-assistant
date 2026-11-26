import { config } from "../config";
import type { RetrievalInfo, Source } from "../types";
import { getEmbedder } from "./embeddings";
import { searchChunks, type ChunkHit } from "./vector-store";
import { bigrams, tokenize } from "./tokenize";

export interface Passage {
  label: string;
  documentId: string;
  documentName: string;
  pageNumber: number;
  text: string;
  score: number;
}

export interface RetrievalResult {
  sources: Source[];
  passages: Passage[];
  info: RetrievalInfo;
}

interface Scored extends ChunkHit {
  score: number;
  tokens: Set<string>;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * Local embedder scores blend vector similarity with weighted lexical coverage
 * (tokens found in most candidates are down-weighted, a cheap IDF proxy).
 */
function localScore(hit: Scored, queryTokens: string[], queryBigrams: Set<string>, tokenDf: Map<string, number>, candidateCount: number): number {
  let totalWeight = 0;
  let matchedWeight = 0;
  for (const token of queryTokens) {
    const df = tokenDf.get(token) ?? 0;
    const weight = df > candidateCount * 0.6 ? 0.4 : token.length > 9 || /\d/.test(token) ? 1.6 : 1;
    totalWeight += weight;
    if (hit.tokens.has(token)) matchedWeight += weight;
  }
  const coverage = totalWeight ? matchedWeight / totalWeight : 0;
  let bigramBonus = 0;
  for (const bg of queryBigrams) if (hit.tokens.has(bg)) bigramBonus += 0.15;
  const blended = Math.min(1, coverage + Math.min(0.3, bigramBonus));
  return 0.7 * blended + 0.3 * Math.min(1, hit.similarity / 0.12);
}

function makeSnippet(text: string, queryTokens: string[], max = 480): string {
  const lower = text.toLowerCase();
  const sorted = [...queryTokens].sort((a, b) => b.length - a.length);
  let position = -1;
  for (const token of sorted) {
    const idx = lower.indexOf(token);
    if (idx >= 0) {
      position = idx;
      break;
    }
  }
  if (position < 0) return text.length > max ? `${text.slice(0, max)}…` : text;
  const start = Math.max(0, position - Math.floor(max / 3));
  const raw = text.slice(start, start + max);
  const prefix = start > 0 ? "…" : "";
  const suffix = start + max < text.length ? "…" : "";
  return `${prefix}${raw.trim()}${suffix}`;
}

export async function retrieve(
  userId: string,
  question: string,
  documentIds: string[] | null,
): Promise<RetrievalResult> {
  const embedder = getEmbedder();
  const started = Date.now();
  const [queryVector] = await embedder.embed([question]);

  const candidates = await searchChunks({
    userId,
    embeddingModel: embedder.model,
    queryVector,
    documentIds,
    limit: config.retrieval.candidateK,
  });

  const queryTokens = tokenize(question);
  const queryBigrams = new Set(bigrams(queryTokens));
  const tokenDf = new Map<string, number>();

  const scored: Scored[] = candidates.map((c) => {
    const tokens = new Set(tokenize(c.text));
    for (const t of queryTokens) if (tokens.has(t)) tokenDf.set(t, (tokenDf.get(t) ?? 0) + 1);
    return { ...c, tokens, score: c.similarity };
  });

  for (const c of scored) {
    c.score = embedder.provider === "local" ? localScore(c, queryTokens, queryBigrams, tokenDf, scored.length) : c.similarity;
  }

  scored.sort((a, b) => b.score - a.score);
  const above = scored.filter((c) => c.score >= embedder.minScore);

  // Diversity: cap passages per document so multi-document questions see every source.
  const perDoc = new Map<string, number>();
  const picked: Scored[] = [];
  for (const c of above) {
    const count = perDoc.get(c.documentId) ?? 0;
    if (count >= config.retrieval.maxPerDocument) continue;
    perDoc.set(c.documentId, count + 1);
    picked.push(c);
    if (picked.length >= config.retrieval.topK) break;
  }

  const passages: Passage[] = picked.map((c, i) => ({
    label: `S${i + 1}`,
    documentId: c.documentId,
    documentName: c.documentName,
    pageNumber: c.pageNumber,
    text: c.text,
    score: round3(c.score),
  }));

  const sources: Source[] = picked.map((c, i) => ({
    label: `S${i + 1}`,
    chunkId: c.id,
    documentId: c.documentId,
    documentName: c.documentName,
    pageNumber: c.pageNumber,
    snippet: makeSnippet(c.text, queryTokens),
    score: round3(c.score),
    chunkIndex: c.chunkIndex,
  }));

  const info: RetrievalInfo = {
    provider: embedder.provider,
    embeddingModel: embedder.model,
    dimension: embedder.dimension || queryVector.length,
    candidates: candidates.length,
    returned: sources.length,
    bestScore: scored[0] ? round3(scored[0].score) : 0,
    minScore: embedder.minScore,
    topK: config.retrieval.topK,
    documentIds,
    durationMs: Date.now() - started,
  };

  return { sources, passages, info };
}
