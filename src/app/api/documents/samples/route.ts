import { after } from "next/server";
import { ok, route } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { ApiError } from "@/lib/http";
import { createSampleDocuments } from "@/lib/samples";
import { processDocument } from "@/lib/rag/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = route(async (_req) => {
  const user = await requireUser();
  if (!rateLimit(`samples:${user.id}`, 5, 60_000)) throw new ApiError(429, "Please wait a moment before retrying.", "rate_limited");
  const result = await createSampleDocuments(user.id, (id) => {
    after(() => {
      void processDocument(id);
    });
  });
  return ok(
    {
      created: result.created.length,
      skipped: result.skipped,
      message:
        result.created.length > 0
          ? `${result.created.length} sample document${result.created.length === 1 ? "" : "s"} queued for indexing.`
          : "The sample documents are already in your library.",
    },
    { status: 201 },
  );
});
