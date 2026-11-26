import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { conversations, documents, messages } from "@/db/schema";
import { ApiError, ok, parseJson, route } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { getEmbedder } from "@/lib/rag/embeddings";
import { getLLM } from "@/lib/rag/llm";
import { retrieve } from "@/lib/rag/retriever";
import { extractiveAnswer } from "@/lib/rag/reader";
import { NOT_FOUND_ANSWER, buildMessages } from "@/lib/rag/prompt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const chatSchema = z.object({
  question: z
    .string()
    .trim()
    .min(2, "Please enter a question (at least 2 characters).")
    .max(2000, "Questions are limited to 2,000 characters."),
  conversationId: z.string().uuid("Invalid conversation id.").optional().nullable(),
  documentIds: z.array(z.string().uuid("Invalid document id.")).optional().nullable(),
  regenerate: z.boolean().optional(),
});

const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};

type Send = (event: string, data: unknown) => void;
type History = Array<{ role: "user" | "assistant"; content: string }>;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function streamText(send: Send, text: string): Promise<void> {
  const size = 14;
  for (let i = 0; i < text.length; i += size) {
    send("delta", { text: text.slice(i, i + size) });
    await sleep(8);
  }
}

/** Validates that the requested document scope belongs to the user and is indexed. */
async function resolveScope(userId: string, requested: string[] | null | undefined): Promise<string[] | null> {
  if (!requested?.length) return null;
  const valid = await db
    .select({ id: documents.id })
    .from(documents)
    .where(and(eq(documents.userId, userId), inArray(documents.id, requested), eq(documents.status, "indexed")));
  return valid.length ? valid.map((v) => v.id) : null;
}

const messageCount = sql<number>`(select count(*)::int from ${messages} where ${messages.conversationId} = ${conversations.id})`;

/** Lists the user's conversations, newest first. */
export const GET = route(async () => {
  const user = await requireUser();
  const rows = await db
    .select({
      id: conversations.id,
      title: conversations.title,
      documentIds: conversations.documentIds,
      createdAt: conversations.createdAt,
      updatedAt: conversations.updatedAt,
      messageCount,
    })
    .from(conversations)
    .where(eq(conversations.userId, user.id))
    .orderBy(desc(conversations.updatedAt))
    .limit(100);
  return ok({
    conversations: rows.map((r) => ({
      id: r.id,
      title: r.title,
      documentIds: r.documentIds,
      messageCount: r.messageCount,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
  });
});

/** Deletes every conversation of the current user. */
export const DELETE = route(async () => {
  const user = await requireUser();
  const deleted = await db
    .delete(conversations)
    .where(eq(conversations.userId, user.id))
    .returning({ id: conversations.id });
  return ok({ ok: true, deleted: deleted.length });
});

/**
 * Server-sent events stream:
 *   sources -> { sources, retrieval }   the passages actually retrieved
 *   delta   -> { text }                 answer tokens
 *   done    -> { messageId, ... }       final metadata
 *   error   -> { message }              friendly failure message
 */
export const POST = route(async (req) => {
  const user = await requireUser();
  if (!rateLimit(`chat:${user.id}`, 40, 60_000)) {
    throw new ApiError(429, "Too many questions in a short time. Please wait a moment.", "rate_limited");
  }
  const body = await parseJson(chatSchema, req);

  let conversation: { id: string; title: string; documentIds: string[] | null } | undefined;

  if (body.conversationId) {
    const [row] = await db
      .select({
        id: conversations.id,
        userId: conversations.userId,
        title: conversations.title,
        documentIds: conversations.documentIds,
      })
      .from(conversations)
      .where(eq(conversations.id, body.conversationId))
      .limit(1);
    if (!row || row.userId !== user.id) throw new ApiError(404, "Conversation not found.", "not_found");
    conversation = { id: row.id, title: row.title, documentIds: row.documentIds };
  }

  const requestedScope =
    body.documentIds === undefined ? (conversation?.documentIds ?? null) : body.documentIds;
  const scope = await resolveScope(user.id, requestedScope);

  let question = body.question;
  let history: History = [];

  if (conversation) {
    const rows = await db
      .select({ id: messages.id, role: messages.role, content: messages.content })
      .from(messages)
      .where(eq(messages.conversationId, conversation.id))
      .orderBy(desc(messages.createdAt))
      .limit(8);
    rows.reverse();
    if (body.regenerate) {
      const lastUserIndex = rows.map((r) => r.role).lastIndexOf("user");
      const lastUser = lastUserIndex >= 0 ? rows[lastUserIndex] : undefined;
      if (!lastUser) throw new ApiError(400, "There is nothing to regenerate yet.", "nothing_to_regenerate");
      question = lastUser.content;
      history = rows.slice(0, lastUserIndex).map(({ role, content }) => ({ role, content }));
      const stale = rows.slice(lastUserIndex + 1).map((r) => r.id);
      if (stale.length) await db.delete(messages).where(inArray(messages.id, stale));
    } else {
      history = rows.map(({ role, content }) => ({ role, content }));
    }
  }

  if (!conversation) {
    const [created] = await db
      .insert(conversations)
      .values({
        userId: user.id,
        title: question.replace(/\s+/g, " ").trim().slice(0, 70),
        documentIds: scope,
      })
      .returning({ id: conversations.id, title: conversations.title, documentIds: conversations.documentIds });
    conversation = { id: created.id, title: created.title, documentIds: created.documentIds };
  } else {
    await db
      .update(conversations)
      .set({ documentIds: scope, updatedAt: new Date() })
      .where(eq(conversations.id, conversation.id));
  }

  if (!body.regenerate) {
    await db.insert(messages).values({ conversationId: conversation.id, role: "user", content: question });
  }

  const conv = conversation;
  const userQuestion = question;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const send: Send = (event, data) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Client disconnected.
        }
      };
      const started = Date.now();
      let partial = "";

      try {
        const retrieval = await retrieve(user.id, userQuestion, scope);
        send("sources", { sources: retrieval.sources, retrieval: retrieval.info });

        const llm = getLLM();
        let answer = "";
        let mode: string;
        let model: string | null = null;

        if (!retrieval.sources.length) {
          mode = "not-found";
          answer = NOT_FOUND_ANSWER;
          partial = answer;
          await streamText(send, answer);
        } else if (llm) {
          mode = "generative";
          model = llm.model;
          const abort = new AbortController();
          req.signal.addEventListener("abort", () => abort.abort(), { once: true });
          const result = await llm.generate(buildMessages(userQuestion, retrieval.passages, history), {
            onDelta: (text) => {
              partial += text;
              send("delta", { text });
            },
            signal: abort.signal,
          });
          answer = result.text.trim();
          if (!answer) throw new ApiError(502, "The AI model returned an empty answer. Please try again.", "llm_empty");
        } else {
          mode = "extractive";
          model = getEmbedder().model;
          answer = await extractiveAnswer(userQuestion, retrieval.passages, getEmbedder());
          partial = answer;
          await streamText(send, answer);
        }

        const latencyMs = Date.now() - started;
        const [saved] = await db
          .insert(messages)
          .values({
            conversationId: conv.id,
            role: "assistant",
            content: answer,
            sources: retrieval.sources,
            model,
            mode,
            latencyMs,
            topScore: retrieval.info.bestScore,
          })
          .returning({ id: messages.id });
        send("done", {
          messageId: saved.id,
          conversationId: conv.id,
          title: conv.title,
          model,
          mode,
          latencyMs,
          topScore: retrieval.info.bestScore,
          notFound: mode === "not-found",
        });
      } catch (err) {
        const cancelled = err instanceof ApiError && err.code === "cancelled";
        if (cancelled) {
          if (partial.trim()) {
            await db
              .insert(messages)
              .values({ conversationId: conv.id, role: "assistant", content: partial, mode: "interrupted" })
              .catch(() => undefined);
          }
          send("done", { conversationId: conv.id, cancelled: true });
        } else {
          logger.error("Answer generation failed", { conversationId: conv.id, error: String(err) });
          send("error", {
            message:
              err instanceof ApiError
                ? err.message
                : "The answer could not be generated right now. Please try again.",
          });
        }
      } finally {
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
});
