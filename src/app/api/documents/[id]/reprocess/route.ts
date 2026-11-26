import { after } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { ApiError, ok, route } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { getOwnedDocument, toDocumentDto } from "@/lib/services/documents";
import { processDocument } from "@/lib/rag/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = route(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const row = await getOwnedDocument(user.id, id);
  if (row.status === "processing") throw new ApiError(409, "This document is already being processed.", "in_progress");
  await db
    .update(documents)
    .set({ status: "processing", error: null, statusMessage: "Queued for processing" })
    .where(eq(documents.id, row.id));
  after(() => {
    void processDocument(row.id);
  });
  return ok({ document: { ...toDocumentDto(row), status: "processing", statusMessage: "Queued for processing", error: null } }, { status: 202 });
});
