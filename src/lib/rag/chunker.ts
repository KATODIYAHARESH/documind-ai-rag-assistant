import { config } from "../config";
import { normalizeText, splitSentences } from "./tokenize";

export interface PageInput {
  pageNumber: number;
  text: string;
}

export interface Chunk {
  chunkIndex: number;
  pageNumber: number;
  text: string;
  tokenEstimate: number;
}

/** Rough token estimate: English text averages ~0.75 words per token. */
export const WORDS_PER_TOKEN = 0.75;

export function estimateTokens(text: string): number {
  return Math.max(1, Math.round(text.split(/\s+/).filter(Boolean).length / WORDS_PER_TOKEN));
}

/**
 * Splits page text into chunks of ~targetTokens words-aware tokens with an overlap of
 * ~overlapTokens. Chunks never cross page boundaries so page citations stay exact.
 */
export function chunkPages(
  pages: PageInput[],
  targetTokens = config.chunking.targetTokens,
  overlapTokens = config.chunking.overlapTokens,
): Chunk[] {
  const targetWords = Math.max(40, Math.round(targetTokens * WORDS_PER_TOKEN));
  const overlapWords = Math.max(10, Math.round(overlapTokens * WORDS_PER_TOKEN));
  const chunks: Chunk[] = [];

  for (const page of pages) {
    const text = normalizeText(page.text ?? "");
    if (text.length < 20) continue;

    const units: string[][] = [];
    for (const sentence of splitSentences(text)) {
      const words = sentence.split(" ").filter(Boolean);
      if (words.length === 0) continue;
      if (words.length <= targetWords) {
        units.push(words);
        continue;
      }
      // Very long "sentence" (tables, no punctuation): sliding word windows.
      for (let i = 0; i < words.length; i += targetWords - overlapWords) {
        units.push(words.slice(i, i + targetWords));
        if (i + targetWords >= words.length) break;
      }
    }

    let current: string[] = [];
    const push = () => {
      const body = current.join(" ").trim();
      if (body.length < 20) return;
      chunks.push({
        chunkIndex: chunks.length,
        pageNumber: page.pageNumber,
        text: body,
        tokenEstimate: estimateTokens(body),
      });
    };

    for (const unit of units) {
      if (current.length > 0 && current.length + unit.length > targetWords) {
        push();
        current = current.slice(-overlapWords);
      }
      current = current.concat(unit);
    }
    if (current.length > 0) {
      // Merge a tiny trailing fragment into the previous chunk instead of creating noise.
      if (current.length < 15 && chunks.length > 0 && chunks[chunks.length - 1].pageNumber === page.pageNumber) {
        const last = chunks[chunks.length - 1];
        last.text = `${last.text} ${current.join(" ").trim()}`;
        last.tokenEstimate = estimateTokens(last.text);
      } else {
        push();
      }
    }
  }

  return chunks;
}
