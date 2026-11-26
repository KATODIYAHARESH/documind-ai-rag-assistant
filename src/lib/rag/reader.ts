import type { Embedder } from "./embeddings";
import type { Passage } from "./retriever";
import { NOT_FOUND_ANSWER } from "./prompt";
import { bigrams, splitSentences, tokenize } from "./tokenize";

interface Sentence {
  text: string;
  label: string;
  documentId: string;
  passageScore: number;
  score: number;
}

/** Minimum share of question terms (IDF-weighted) a sentence must contain to be quoted. */
const MIN_LEXICAL_LOCAL = 0.3;
const MIN_LEXICAL_REMOTE = 0.3;

function dot(a: number[], b: number[]): number {
  let sum = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) sum += a[i] * b[i];
  return sum;
}

function isComparative(question: string): boolean {
  return /\b(compare|comparison|difference|differences|both|versus|vs\.?|contrast|similar|each)\b/i.test(question);
}

/** Removes an ALL-CAPS heading that PDF extraction glued to the start of a sentence. */
function stripHeading(text: string): string {
  return text.replace(/^((?:(?:[A-Z0-9][A-Z0-9&/'’.-]*|-)\s+){2,})(?=[A-Z][a-z])/, "");
}

/**
 * Grounded extractive answering used when no LLM API key is configured.
 * Selects the sentences from the retrieved passages that best match the question
 * (IDF-weighted term coverage) and quotes them verbatim with citations. Nothing is
 * generated; if no sentence actually covers the question, the answer says so.
 */
export async function extractiveAnswer(question: string, passages: Passage[], embedder: Embedder): Promise<string> {
  if (!passages.length) return NOT_FOUND_ANSWER;

  const queryTokens = tokenize(question);
  if (!queryTokens.length) return NOT_FOUND_ANSWER;
  const queryBigrams = new Set(bigrams(queryTokens));

  const collected: Array<Omit<Sentence, "score">> = [];
  const seen = new Set<string>();
  for (const passage of passages) {
    for (const raw of splitSentences(passage.text)) {
      const text = stripHeading(raw.trim()).trim();
      if (text.length < 24 || text.length > 700) continue;
      const key = text.toLowerCase().slice(0, 140);
      if (seen.has(key)) continue;
      seen.add(key);
      collected.push({ text, label: passage.label, documentId: passage.documentId, passageScore: passage.score });
    }
  }
  if (!collected.length) return NOT_FOUND_ANSWER;

  const sentenceTokens = collected.map((s) => tokenize(s.text));
  const documentFrequency = new Map<string, number>();
  for (const tokens of sentenceTokens) {
    for (const token of new Set(tokens)) documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
  }
  const idf = (token: string) => Math.log(1 + collected.length / (1 + (documentFrequency.get(token) ?? 0)));
  const totalWeight = queryTokens.reduce((sum, token) => sum + idf(token), 0) || 1;

  const lexical = collected.map((_sentence, i) => {
    const tokens = sentenceTokens[i];
    const present = new Set(tokens);
    let matched = 0;
    for (const token of queryTokens) if (present.has(token)) matched += idf(token);
    let bigramHits = 0;
    for (let j = 0; j + 1 < tokens.length; j++) {
      if (queryBigrams.has(`${tokens[j]} ${tokens[j + 1]}`)) bigramHits++;
    }
    return Math.min(1, matched / totalWeight + 0.15 * bigramHits);
  });

  let semantic: number[] | null = null;
  if (embedder.provider !== "local") {
    const [queryVector] = await embedder.embed([question]);
    const vectors = await embedder.embed(collected.map((s) => s.text));
    semantic = vectors.map((vector) => {
      const norm = Math.sqrt(dot(vector, vector)) || 1;
      return dot(vector, queryVector) / norm;
    });
  }

  // Passage-level retrieval relevance acts as a prior on top of the sentence's own score,
  // so sentences from the best-matching passage are quoted first.
  const scored: Sentence[] = collected.map((sentence, i) => {
    const base = semantic ? 0.5 * lexical[i] + 0.5 * Math.max(0, semantic[i]) : lexical[i];
    return { ...sentence, score: base + 0.5 * Math.min(1, sentence.passageScore) };
  });

  const minLexical = embedder.provider === "local" ? MIN_LEXICAL_LOCAL : MIN_LEXICAL_REMOTE;
  const eligible = scored.filter((s, i) => lexical[i] >= minLexical);
  if (!eligible.length) return NOT_FOUND_ANSWER;

  const documents = new Set(passages.map((p) => p.documentId));
  const comparative = isComparative(question) && documents.size > 1;
  const limit = comparative ? 4 : 2;
  const perDocument = new Map<string, number>();
  const picked: Sentence[] = [];
  const take = (sentence: Sentence) => {
    picked.push(sentence);
    perDocument.set(sentence.documentId, (perDocument.get(sentence.documentId) ?? 0) + 1);
  };

  const byScore = [...eligible].sort((a, b) => b.score - a.score);
  if (comparative) {
    // Make sure every relevant document contributes its best sentence.
    for (const documentId of documents) {
      if (picked.length >= limit) break;
      const best = byScore.find((s) => s.documentId === documentId);
      if (best) take(best);
    }
  }
  for (const sentence of byScore) {
    if (picked.length >= limit) break;
    if (picked.includes(sentence)) continue;
    if ((perDocument.get(sentence.documentId) ?? 0) >= 2) continue;
    take(sentence);
  }

  picked.sort((a, b) => Number(a.label.slice(1)) - Number(b.label.slice(1)));
  const bullets = picked.map((s) => `- ${s.text} [${s.label}]`);
  const header = picked.length === 1 ? "According to the uploaded documents:" : "From the uploaded documents:";
  return `${header}\n\n${bullets.join("\n\n")}`;
}
