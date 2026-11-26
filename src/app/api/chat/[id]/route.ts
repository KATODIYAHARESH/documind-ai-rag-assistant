import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { conversations, messages } from "@/db/schema";
import { ApiError, isUuid, ok, route } from "@/lib/http";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  if (!isUuid(id)) throw new ApiError(404, "Conversation not found.", "not_found");
  const [conversation] = await db
    .select({
      id: conversations.id,
      title: conversations.title,
      documentIds: conversations.documentIds,
      createdAt: conversations.createdAt,
      updatedAt: conversations.updatedAt,
    })
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, user.id)))
    .limit(1);
  if (!conversation) throw new ApiError(404, "Conversation not found.", "not_found");

  const rows = await db
    .select({
      id: messages.id,
      role: messages.role,
      content: messages.content,
      sources: messages.sources,
      model: messages.model,
      mode: messages.mode,
      latencyMs: messages.latencyMs,
      topScore: messages.topScore,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(eq(messages.conversationId, conversation.id))
    .orderBy(asc(messages.createdAt));

  return ok({
    conversation: {
      id: conversation.id,
      title: conversation.title,
      documentIds: conversation.documentIds,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
      messageCount: rows.length,
    },
    messages: rows.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      sources: m.sources,
      model: m.model,
      mode: m.mode,
      latencyMs: m.latencyMs,
      topScore: m.topScore,
      createdAt: m.createdAt.toISOString(),
    })),
  });
});

export const DELETE = route(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  if (!isUuid(id)) throw new ApiError(404, "Conversation not found.", "not_found");
  const deleted = await db
    .delete(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, user.id)))
    .returning({ id: conversations.id });
  if (!deleted.length) throw new ApiError(404, "Conversation not found.", "not_found");
  return ok({ ok: true });
});
