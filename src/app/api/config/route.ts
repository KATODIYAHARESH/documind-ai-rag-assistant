import { ok, route } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { config } from "@/lib/config";
import { formatBytes } from "@/lib/format";
import { describeEmbedder, getEmbedder } from "@/lib/rag/embeddings";
import { describeLLM } from "@/lib/rag/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Non-secret runtime configuration shown on the Settings page. */
export const GET = route(async () => {
  await requireUser();
  const embedder = getEmbedder();
  return ok({
    app: { name: config.appName, version: config.version },
    llm: describeLLM(),
    embeddings: { ...describeEmbedder(), dimension: embedder.dimension || 1536 },
    retrieval: {
      topK: config.retrieval.topK,
      candidateK: config.retrieval.candidateK,
      minScore: embedder.minScore,
      chunkTargetTokens: config.chunking.targetTokens,
      chunkOverlapTokens: config.chunking.overlapTokens,
    },
    limits: {
      maxUploadBytes: config.upload.maxBytes,
      maxUploadLabel: formatBytes(config.upload.maxBytes),
      acceptedMime: config.upload.acceptedMime,
    },
    ocr: { enabled: config.ocr.enabled },
  });
});
