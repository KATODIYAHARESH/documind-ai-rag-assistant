import { createHash } from "crypto";
import { after } from "next/server";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { ApiError, fail, ok, route } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { cleanDisplayName, sanitizeFilename, validatePdf } from "@/lib/files";
import { formatBytes } from "@/lib/format";
import { config } from "@/lib/config";
import { logger } from "@/lib/logger";
import { recoverStaleDocuments, processDocument } from "@/lib/rag/ingest";
import { documentColumns, toDocumentDto } from "@/lib/services/documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILES = 10;

export const GET = route(async (req) => {
  const user = await requireUser();
  await recoverStaleDocuments(user.id);
  const query = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const condition = query
    ? and(
        eq(documents.userId, user.id),
        or(ilike(documents.originalName, `%${query}%`), ilike(documents.filename, `%${query}%`)),
      )
    : eq(documents.userId, user.id);
  const rows = await db
    .select(documentColumns)
    .from(documents)
    .where(condition)
    .orderBy(desc(documents.createdAt))
    .limit(200);
  return ok({ documents: rows.map(toDocumentDto) });
});

export const POST = route(async (req) => {
  const user = await requireUser();
  if (!rateLimit(`upload:${user.id}`, 30, 60_000)) {
    throw new ApiError(429, "Too many uploads in a short time. Please wait a moment.", "rate_limited");
  }
  const form = await req.formData().catch(() => null);
  if (!form) throw new ApiError(400, "Expected multipart form data with a `files` field.", "invalid_form");
  const files = form.getAll("files").filter((entry): entry is File => entry instanceof File);
  if (!files.length) throw new ApiError(400, "No files were uploaded.", "no_files");
  if (files.length > MAX_FILES) throw new ApiError(400, `Upload at most ${MAX_FILES} files at a time.`, "too_many_files");

  const totalBytes = files.reduce((n, f) => n + f.size, 0);
  if (totalBytes > config.upload.maxBytes * 3) {
    throw new ApiError(413, `The total upload exceeds ${formatBytes(config.upload.maxBytes * 3)}.`, "too_large");
  }

  const created = [];
  const errors: { filename: string; message: string }[] = [];

  for (const file of files) {
    const displayName = cleanDisplayName(file.name);
    try {
      const buffer = await validatePdf(file);
      const fileHash = createHash("sha256").update(buffer).digest("hex");
      const [duplicate] = await db
        .select({ id: documents.id, originalName: documents.originalName })
        .from(documents)
        .where(and(eq(documents.userId, user.id), eq(documents.fileHash, fileHash)))
        .limit(1);
      if (duplicate) {
        errors.push({ filename: displayName, message: `Already in your library as "${duplicate.originalName}".` });
        continue;
      }
      const [row] = await db
        .insert(documents)
        .values({
          userId: user.id,
          filename: sanitizeFilename(file.name),
          originalName: displayName,
          sizeBytes: buffer.length,
          mimeType: "application/pdf",
          fileHash,
          status: "processing",
          statusMessage: "Queued for processing",
          fileData: buffer,
        })
        .returning(documentColumns);
      created.push(toDocumentDto(row));
      after(() => {
        void processDocument(row.id);
      });
    } catch (err) {
      if (err instanceof ApiError) {
        errors.push({ filename: displayName, message: err.message });
      } else {
        logger.error("Upload failed", { error: String(err) });
        errors.push({ filename: displayName, message: "The file could not be saved." });
      }
    }
  }

  if (!created.length) {
    return Response.json(
      { error: { code: "upload_failed", message: errors[0]?.message ?? "No documents could be uploaded." }, errors },
      { status: errors[0] ? 400 : 500 },
    );
  }
  return Response.json({ documents: created, errors }, { status: 201 });
});
