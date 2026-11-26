import type { RetrievalInfo, Source } from "@/lib/types";
import { authHeaders } from "./session-token";

export interface ChatStreamRequest {
  question: string;
  conversationId?: string | null;
  documentIds?: string[] | null;
  regenerate?: boolean;
}

export interface ChatDone {
  messageId?: string;
  conversationId: string;
  title?: string;
  model?: string | null;
  mode?: string;
  latencyMs?: number;
  topScore?: number;
  notFound?: boolean;
  cancelled?: boolean;
}

export interface ChatStreamHandlers {
  onSources?: (sources: Source[], retrieval: RetrievalInfo) => void;
  onDelta?: (text: string) => void;
  onDone?: (done: ChatDone) => void;
  onError?: (message: string) => void;
}

/** Consumes the /api/chat server-sent events stream. */
export async function streamChat(
  body: ChatStreamRequest,
  handlers: ChatStreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const { onSources, onDelta, onDone, onError } = handlers;

  let res: Response;
  try {
    res = await fetch("/api/chat", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (signal?.aborted) return;
    onError?.(err instanceof Error ? err.message : "Could not reach the assistant.");
    return;
  }

  if (!res.ok) {
    let message = `Request failed (${res.status}).`;
    try {
      const data = (await res.json()) as { error?: { message?: string } };
      if (data?.error?.message) message = data.error.message;
    } catch {
      // keep default message
    }
    onError?.(message);
    return;
  }
  if (!res.body) {
    onError?.("The assistant returned an empty stream.");
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const dispatch = (raw: string) => {
    let event = "message";
    let data = "";
    for (const line of raw.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data += line.slice(5).trim();
    }
    if (!data) return;
    let payload: unknown;
    try {
      payload = JSON.parse(data);
    } catch {
      return;
    }
    if (event === "sources") {
      const p = payload as { sources: Source[]; retrieval: RetrievalInfo };
      onSources?.(p.sources ?? [], p.retrieval);
    } else if (event === "delta") {
      const text = (payload as { text?: string }).text;
      if (text) onDelta?.(text);
    } else if (event === "done") {
      onDone?.(payload as ChatDone);
    } else if (event === "error") {
      onError?.((payload as { message?: string }).message ?? "Something went wrong.");
    }
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let separator: number;
      while ((separator = buffer.indexOf("\n\n")) >= 0) {
        const frame = buffer.slice(0, separator);
        buffer = buffer.slice(separator + 2);
        if (frame.trim()) dispatch(frame);
      }
    }
    if (buffer.trim()) dispatch(buffer);
  } catch (err) {
    if (signal?.aborted) return;
    onError?.(err instanceof Error ? `Connection lost: ${err.message}` : "Connection to the assistant was lost.");
  }
}
