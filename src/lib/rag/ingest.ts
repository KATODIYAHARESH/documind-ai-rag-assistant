import { and, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { documents } from "@/db/schema";
import type { DocumentStatus } from "../types";
import { ApiError } from "../http";
import { logger } from "../logger";
import { extractPdfText } from "../pdf/extract";
import { chunkPages } from "./chunker";
import { getEmbedder } from "./embeddings";
import { deleteVectorsForDocument, storeChunks } from "./vector-store";

const EMBED_BATCH = 32;

const NEEDS_OCR_MESSAGE =
  "No extractable text was found. This PDF looks scanned or image-based, and OCR is not enabled on this server. Upload a text-based PDF to index it.";

export async function processDocument(documentId: string): Promise<{ status: DocumentStatus }> {
  const [doc] = await db
    .select({
      id: documents.id,
      userId: documents.userId,
      filename: documents.filename,
      originalName: documents.originalName,
      fileData: documents.fileData,
    })
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);
  if (!doc) throw new ApiError(404, "Document not found.", "not_found");

  const started = Date.now();
  const update = (values: Partial<typeof documents.$inferInsert>) =>
    db.update(documents).set(values).where(eq(documents.id, documentId));

  try {
    await update({ status: "processing", error: null, statusMessage: "Extracting text from PDF…" });
    await deleteVectorsForDocument(documentId);

    const extracted = await extractPdfText(new Uint8Array(doc.fileData));
    if (extracted.totalChars < 20) {
      await update({ status: "needs_ocr", pageCount: extracted.totalPages, statusMessage: NEEDS_OCR_MESSAGE, processedAt: new Date() });
      logger.info("Document needs OCR", { documentId, pages: extracted.totalPages });
      return { status: "needs_ocr" };
    }

    await update({ statusMessage: "Splitting text into chunks…" });
    const chunkList = chunkPages(extracted.pages.map((text, i) => ({ pageNumber: i + 1, text })));
    if (!chunkList.length) {
      await update({ status: "needs_ocr", pageCount: extracted.totalPages, statusMessage: NEEDS_OCR_MESSAGE, processedAt: new Date() });
      return { status: "needs_ocr" };
    }

    const embedder = getEmbedder();
    await update({ statusMessage: `Generating embeddings for ${chunkList.length} chunks…` });
    const embeddings: number[][] = [];
    for (let i = 0; i < chunkList.length; i += EMBED_BATCH) {
      embeddings.push(...(await embedder.embed(chunkList.slice(i, i + EMBED_BATCH).map((c) => c.text))));
    }

    await storeChunks({ documentId, userId: doc.userId, embeddingModel: embedder.model, chunks: chunkList, embeddings });

    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    await update({
      status: "indexed",
      pageCount: extracted.totalPages,
      chunkCount: chunkList.length,
      embeddingModel: embedder.model,
      statusMessage: `Indexed ${chunkList.length} chunks from ${extracted.totalPages} page${extracted.totalPages === 1 ? "" : "s"} in ${seconds}s`,
      processedAt: new Date(),
      error: null,
    });
    logger.info("Document indexed", { documentId, chunks: chunkList.length, pages: extracted.totalPages, ms: Date.now() - started });
    return { status: "indexed" };
  } catch (err) {
    const message =
      err instanceof ApiError
        ? err.message
        : "Processing failed unexpectedly. The file may be corrupted or password-protected.";
    await update({ status: "error", error: message, statusMessage: null, processedAt: new Date() }).catch(() => undefined);
    logger.error("Document processing failed", { documentId, error: String(err) });
    return { status: "error" };
  }
}

/** Marks documents stuck in "processing" (e.g. after a server restart) so the user can retry. */
export async function recoverStaleDocuments(userId: string): Promise<void> {
  const cutoff = new Date(Date.now() - 10 * 60_000);
  await db
    .update(documents)
    .set({
      status: "error",
      error: "Processing was interrupted before finishing (server restart). Click Retry to process again.",
      statusMessage: null,
    })
    .where(and(eq(documents.userId, userId), eq(documents.status, "processing"), lt(documents.createdAt, cutoff)))
    .catch(() => undefined);
}
