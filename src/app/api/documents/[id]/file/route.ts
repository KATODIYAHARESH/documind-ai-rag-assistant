import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { isUuid, route } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { cleanDisplayName } from "@/lib/files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Serves the original PDF (inline) only to its owner. */
export const GET = route(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  if (!isUuid(id)) return new Response("Not found", { status: 404 });
  const [row] = await db
    .select({ fileData: documents.fileData, originalName: documents.originalName, mimeType: documents.mimeType })
    .from(documents)
    .where(and(eq(documents.id, id), eq(documents.userId, user.id)))
    .limit(1);
  if (!row) return new Response("Not found", { status: 404 });

  const name = cleanDisplayName(row.originalName);
  const ascii = name.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  return new Response(new Uint8Array(row.fileData), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(row.fileData.length),
      "Content-Disposition": `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
