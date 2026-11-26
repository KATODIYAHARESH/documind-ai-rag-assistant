const STOPWORDS = new Set(
  (
    "a an and are as at be but by for from has have had he her hers him his i if in into is it its of on or " +
    "our ours so such than that the their theirs them then there these they this those to was we were what when " +
    "where which who whom will with you your yours me my mine not no yes do does did done can could would should " +
    "may might about over under between within without also just only more most other some any each per via using " +
    "used use up down out off than there here please tell explain describe"
  ).split(" "),
);

/** Light suffix stripper so "embeddings" and "embedding" share a feature. */
export function stem(token: string): string {
  let t = token;
  if (t.length > 6 && t.endsWith("ing")) t = t.slice(0, -3);
  else if (t.length > 5 && t.endsWith("ed")) t = t.slice(0, -2);
  else if (t.length > 5 && t.endsWith("es")) t = t.slice(0, -2);
  else if (t.length > 3 && t.endsWith("s") && !t.endsWith("ss") && !t.endsWith("us") && !t.endsWith("is"))
    t = t.slice(0, -1);
  return t;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w.length > 1 && !STOPWORDS.has(w))
    .map(stem);
}

export function bigrams(tokens: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i + 1 < tokens.length; i++) out.push(`${tokens[i]} ${tokens[i + 1]}`);
  return out;
}

/** Collapses PDF line breaks and stray whitespace while keeping sentence punctuation. */
export function normalizeText(raw: string): string {
  return raw
    .replace(/\r/g, "")
    .replace(/([A-Za-z])-\n(?=[a-z])/g, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

// Break after . ! ? only when followed by a sentence start; never inside decimals ("0. 5 with").
const SENTENCE_SPLIT = /(?<=[.!?])\s+(?![0-9]+\s)(?=[A-Z0-9"“(\[])/;
const ABBREVIATION = /\b(?:[A-Z]|Dr|Mr|Mrs|Ms|Mx|St|vs|e\.g|i\.e|etc|No|Nos|Inc|Ltd|Corp|Co|Sr|Jr|Fig|Figs|approx|Prof|Rev|Hon)\.$/;

/** Splits text into sentences, keeping abbreviations such as "Dr." or "Inc." with their sentence. */
export function splitSentences(text: string): string[] {
  const parts = text
    .split(SENTENCE_SPLIT)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const merged: string[] = [];
  for (const part of parts) {
    const previous = merged[merged.length - 1];
    if (previous && ABBREVIATION.test(previous)) merged[merged.length - 1] = `${previous} ${part}`;
    else merged.push(part);
  }
  return merged;
}
