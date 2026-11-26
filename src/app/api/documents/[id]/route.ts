import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { isUuid, ok, route } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { getOwnedDocument, toDocumentDto } from "@/lib/services/documents";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const row = await getOwnedDocument(user.id, id);
  return ok({ document: toDocumentDto(row) });
});

/** Deletes the document, its metadata row and (via cascade) all of its vectors. */
export const DELETE = route(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  if (!isUuid(id)) return ok({ ok: false, deleted: 0 }, { status: 404 });
  const deleted = await db
    .delete(documents)
    .where(and(eq(documents.id, id), eq(documents.userId, user.id)))
    .returning({ id: documents.id, filename: documents.filename });
  if (!deleted.length) return ok({ ok: false, deleted: 0 }, { status: 404 });
  logger.info("Document deleted", { documentId: deleted[0].id });
  return ok({ ok: true, deleted: deleted.length });
});
