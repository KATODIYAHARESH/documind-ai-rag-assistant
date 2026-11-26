import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { chunks, conversations, documents, messages } from "@/db/schema";
import { ok, route } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { documentColumns, toDocumentDto } from "@/lib/services/documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Every number on the dashboard is computed from live database rows. */
export const GET = route(async () => {
  const user = await requireUser();

  const [docTotals] = await db
    .select({
      documents: sql<number>`count(*)::int`,
      indexed: sql<number>`count(*) filter (where ${documents.status} = 'indexed')::int`,
      processing: sql<number>`count(*) filter (where ${documents.status} = 'processing')::int`,
      needsOcr: sql<number>`count(*) filter (where ${documents.status} = 'needs_ocr')::int`,
      errors: sql<number>`count(*) filter (where ${documents.status} = 'error')::int`,
      storageBytes: sql<number>`coalesce(sum(${documents.sizeBytes}), 0)::int`,
    })
    .from(documents)
    .where(eq(documents.userId, user.id));

  const [chunkTotals] = await db
    .select({ chunks: sql<number>`count(*)::int` })
    .from(chunks)
    .where(eq(chunks.userId, user.id));

  const [conversationTotals] = await db
    .select({ conversations: sql<number>`count(*)::int` })
    .from(conversations)
    .where(eq(conversations.userId, user.id));

  const [questionTotals] = await db
    .select({ questions: sql<number>`count(*)::int` })
    .from(messages)
    .innerJoin(conversations, eq(conversations.id, messages.conversationId))
    .where(and(eq(conversations.userId, user.id), eq(messages.role, "user")));

  const recentDocuments = await db
    .select(documentColumns)
    .from(documents)
    .where(eq(documents.userId, user.id))
    .orderBy(desc(documents.createdAt))
    .limit(5);

  const recentRows = await db
    .select({
      id: conversations.id,
      title: conversations.title,
      documentIds: conversations.documentIds,
      createdAt: conversations.createdAt,
      updatedAt: conversations.updatedAt,
      messageCount: sql<number>`(select count(*)::int from ${messages} where ${messages.conversationId} = ${conversations.id})`,
    })
    .from(conversations)
    .where(eq(conversations.userId, user.id))
    .orderBy(desc(conversations.updatedAt))
    .limit(5);

  return ok({
    totals: {
      documents: docTotals.documents,
      indexed: docTotals.indexed,
      processing: docTotals.processing,
      needsOcr: docTotals.needsOcr,
      errors: docTotals.errors,
      chunks: chunkTotals.chunks,
      questions: questionTotals.questions,
      conversations: conversationTotals.conversations,
      storageBytes: Number(docTotals.storageBytes ?? 0),
    },
    recentDocuments: recentDocuments.map(toDocumentDto),
    recentConversations: recentRows.map((r) => ({
      id: r.id,
      title: r.title,
      documentIds: r.documentIds,
      messageCount: r.messageCount,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
  });
});
