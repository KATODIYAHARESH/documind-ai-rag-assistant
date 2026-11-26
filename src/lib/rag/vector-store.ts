import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { chunks, documents } from "@/db/schema";
import type { Chunk } from "./chunker";

export interface ChunkHit {
  id: string;
  documentId: string;
  documentName: string;
  pageNumber: number;
  chunkIndex: number;
  text: string;
  similarity: number;
}

const BATCH = 40;

export async function storeChunks(input: {
  documentId: string;
  userId: string;
  embeddingModel: string;
  chunks: Chunk[];
  embeddings: number[][];
}): Promise<void> {
  const rows = input.chunks.map((c, i) => ({
    documentId: input.documentId,
    userId: input.userId,
    chunkIndex: c.chunkIndex,
    pageNumber: c.pageNumber,
    text: c.text,
    tokenEstimate: c.tokenEstimate,
    embeddingModel: input.embeddingModel,
    embedding: input.embeddings[i],
  }));
  for (let i = 0; i < rows.length; i += BATCH) {
    await db.insert(chunks).values(rows.slice(i, i + BATCH));
  }
}

export async function deleteVectorsForDocument(documentId: string): Promise<void> {
  await db.delete(chunks).where(eq(chunks.documentId, documentId));
}

/**
 * Cosine similarity search executed in PostgreSQL. Vectors are L2-normalised at
 * embedding time, so the dot product computed via unnest() equals cosine similarity.
 */
export async function searchChunks(args: {
  userId: string;
  embeddingModel: string;
  queryVector: number[];
  documentIds?: string[] | null;
  limit: number;
}): Promise<ChunkHit[]> {
  // The query vector is bound as ONE parameter using a PostgreSQL array literal
  // (drizzle would otherwise expand a JS array into a 768-element tuple).
  const queryLiteral = `{${args.queryVector.map((v) => String(v)).join(",")}}`;
  const similarity = sql<number>`(select coalesce(sum(t.a * t.b), 0) from unnest(${chunks.embedding}, ${queryLiteral}::float8[]) as t(a, b))`.as(
    "similarity",
  );
  const conditions = [
    eq(chunks.userId, args.userId),
    eq(chunks.embeddingModel, args.embeddingModel),
  ] as const;
  const filters = args.documentIds?.length
    ? and(...conditions, inArray(chunks.documentId, args.documentIds))
    : and(...conditions);

  return db
    .select({
      id: chunks.id,
      documentId: chunks.documentId,
      documentName: documents.originalName,
      pageNumber: chunks.pageNumber,
      chunkIndex: chunks.chunkIndex,
      text: chunks.text,
      similarity,
    })
    .from(chunks)
    .innerJoin(documents, eq(documents.id, chunks.documentId))
    .where(filters)
    .orderBy(sql`similarity desc`)
    .limit(args.limit);
}

export async function countChunksForUser(userId: string): Promise<number> {
  const rows = await db.select({ id: chunks.id }).from(chunks).where(eq(chunks.userId, userId)).limit(1);
  return rows.length;
}

export async function listChunksForDocument(documentId: string) {
  return db
    .select({ id: chunks.id, pageNumber: chunks.pageNumber, chunkIndex: chunks.chunkIndex, text: chunks.text })
    .from(chunks)
    .where(eq(chunks.documentId, documentId))
    .orderBy(asc(chunks.chunkIndex));
}
