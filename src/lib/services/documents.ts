import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { ApiError, isUuid } from "@/lib/http";
import type { DocumentDto, DocumentStatus, SafeUser } from "@/lib/types";

export const documentColumns = {
  id: documents.id,
  userId: documents.userId,
  filename: documents.filename,
  originalName: documents.originalName,
  sizeBytes: documents.sizeBytes,
  mimeType: documents.mimeType,
  fileHash: documents.fileHash,
  status: documents.status,
  statusMessage: documents.statusMessage,
  error: documents.error,
  pageCount: documents.pageCount,
  chunkCount: documents.chunkCount,
  embeddingModel: documents.embeddingModel,
  createdAt: documents.createdAt,
  processedAt: documents.processedAt,
};

export function toSafeUser(user: {
  id: string;
  email: string;
  name: string;
  createdAt: Date | string;
}): SafeUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: typeof user.createdAt === "string" ? user.createdAt : user.createdAt.toISOString(),
  };
}

export function toDocumentDto(row: {
  id: string;
  filename: string;
  originalName: string;
  sizeBytes: number;
  mimeType: string;
  status: DocumentStatus;
  statusMessage?: string | null;
  error?: string | null;
  pageCount?: number | null;
  chunkCount?: number | null;
  embeddingModel?: string | null;
  createdAt: Date | string;
  processedAt?: Date | string | null;
}): DocumentDto {
  return {
    id: row.id,
    filename: row.filename,
    originalName: row.originalName,
    sizeBytes: row.sizeBytes,
    mimeType: row.mimeType,
    status: row.status,
    statusMessage: row.statusMessage ?? null,
    error: row.error ?? null,
    pageCount: row.pageCount ?? null,
    chunkCount: row.chunkCount ?? 0,
    embeddingModel: row.embeddingModel ?? null,
    createdAt: typeof row.createdAt === "string" ? row.createdAt : row.createdAt.toISOString(),
    processedAt: row.processedAt
      ? typeof row.processedAt === "string"
        ? row.processedAt
        : row.processedAt.toISOString()
      : null,
  };
}

export async function getOwnedDocument(userId: string, documentId: string | undefined) {
  if (!documentId || !isUuid(documentId)) {
    throw new ApiError(404, "Document not found.", "not_found");
  }

  const [row] = await db
    .select(documentColumns)
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
    .limit(1);

  if (!row) {
    throw new ApiError(404, "Document not found.", "not_found");
  }

  return row;
}
