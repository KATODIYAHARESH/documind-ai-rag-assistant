import type { RetrievalInfo, Source } from "@/lib/types";

/** Client-side message shape (server message + transient streaming state). */
export interface UIMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  sources?: Source[] | null;
  retrieval?: RetrievalInfo | null;
  model?: string | null;
  mode?: string | null;
  latencyMs?: number | null;
  /** Waiting for the first stream event (typing indicator). */
  pending?: boolean;
  /** Receiving answer tokens. */
  streaming?: boolean;
  /** Friendly error message when generation failed. */
  error?: string | null;
}
