import { sql } from "drizzle-orm";
import { db } from "@/db";
import { describeEmbedder } from "@/lib/rag/embeddings";
import { describeLLM } from "@/lib/rag/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let database: "ok" | "unavailable" = "ok";
  try {
    await db.execute(sql`select 1`);
  } catch {
    database = "unavailable";
  }
  const healthy = database === "ok";
  return Response.json(
    {
      ok: healthy,
      status: healthy ? "ok" : "degraded",
      database,
      llm: describeLLM(),
      embeddings: describeEmbedder(),
      time: new Date().toISOString(),
    },
    { status: healthy ? 200 : 500 },
  );
}
