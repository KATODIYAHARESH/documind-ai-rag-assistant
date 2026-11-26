import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { documents } from "@/db/schema";
import type { DocumentDto, DocumentStatus, SafeUser } from "../types";
import { ApiError, isUuid } from "../http";

export const documentColumns = {
  id: documents.id,
  filename: documents.filename,
  originalName: documents.originalName,
  sizeBytes: documents.sizeBytes,
  mimeType: documents.mimeType,
  status: documents.status,
  statusMessage: documents.statusMessage,
  error: documents.error,
  pageCount: documents.pageCount,
  chunkCount: documents.chunkCount,
  embeddingModel: documents.embeddingModel,
  createdAt: documents.createdAt,
  processedAt: documents.processedAt,
};

export interface DocumentRow {
  id: string;
  filename: string;
  originalName: string;
  sizeBytes: number;
  mimeType: string;
  status: DocumentStatus;
  statusMessage: string | null;
  error: string | null;
  pageCount: number | null;
  chunkCount: number;
  embeddingModel: string | null;
  createdAt: Date;
  processedAt: Date | null;
}

export function toDocumentDto(row: DocumentRow): DocumentDto {
  return {
    id: row.id,
    filename: row.filename,
    originalName: row.originalName,
    sizeBytes: row.sizeBytes,
    mimeType: row.mimeType,
    status: row.status,
    statusMessage: row.statusMessage,
    error: row.error,
    pageCount: row.pageCount,
    chunkCount: row.chunkCount,
    embeddingModel: row.embeddingModel,
    createdAt: row.createdAt.toISOString(),
    processedAt: row.processedAt ? row.processedAt.toISOString() : null,
  };
}

export async function getOwnedDocument(userId: string, id: string | undefined): Promise<DocumentRow> {
  if (!isUuid(id)) throw new ApiError(404, "Document not found.", "not_found");
  const [row] = await db
    .select(documentColumns)
    .from(documents)
    .where(and(eq(documents.id, id), eq(documents.userId, userId)))
    .limit(1);
  if (!row) throw new ApiError(404, "Document not found.", "not_found");
  return row;
}

export function toSafeUser(row: { id: string; email: string; name: string; createdAt: Date }): SafeUser {
  return { id: row.id, email: row.email, name: row.name, createdAt: row.createdAt.toISOString() };
}
