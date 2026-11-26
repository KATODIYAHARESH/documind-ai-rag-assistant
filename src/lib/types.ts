export interface SafeUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export type DocumentStatus = "processing" | "indexed" | "error" | "needs_ocr";

export interface DocumentDto {
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
  createdAt: string;
  processedAt: string | null;
}

export interface Source {
  label: string;
  chunkId: string;
  documentId: string;
  documentName: string;
  pageNumber: number;
  snippet: string;
  score: number;
  chunkIndex: number;
}

export interface RetrievalInfo {
  provider: "local" | "openai";
  embeddingModel: string;
  dimension: number;
  candidates: number;
  returned: number;
  bestScore: number;
  minScore: number;
  topK: number;
  documentIds: string[] | null;
  durationMs: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources: Source[] | null;
  model: string | null;
  mode: string | null;
  latencyMs: number | null;
  topScore: number | null;
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  documentIds: string[] | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  totals: {
    documents: number;
    indexed: number;
    processing: number;
    needsOcr: number;
    errors: number;
    chunks: number;
    questions: number;
    conversations: number;
    storageBytes: number;
  };
  recentDocuments: DocumentDto[];
  recentConversations: ConversationSummary[];
}

export interface PublicConfig {
  app: { name: string; version: string };
  llm: { configured: boolean; provider: string; model: string };
  embeddings: { provider: "local" | "openai"; model: string; dimension: number };
  retrieval: {
    topK: number;
    candidateK: number;
    minScore: number;
    chunkTargetTokens: number;
    chunkOverlapTokens: number;
  };
  limits: { maxUploadBytes: number; maxUploadLabel: string; acceptedMime: string[] };
  ocr: { enabled: boolean };
}
