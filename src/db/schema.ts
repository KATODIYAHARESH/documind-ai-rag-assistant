import {
  customType,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { DocumentStatus, Source } from "@/lib/types";

/** PostgreSQL `bytea` column mapped to a Node Buffer (not built into drizzle pg-core). */
export const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
  toDriver(value) {
    return value;
  },
  fromDriver(value) {
    return value;
  },
});

const ts = (name: string) => timestamp(name, { withTimezone: true });

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: ts("created_at").defaultNow().notNull(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: ts("expires_at").notNull(),
  createdAt: ts("created_at").defaultNow().notNull(),
});

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    originalName: text("original_name").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    mimeType: text("mime_type").notNull(),
    fileHash: text("file_hash").notNull(),
    status: text("status").$type<DocumentStatus>().notNull().default("processing"),
    statusMessage: text("status_message"),
    error: text("error"),
    pageCount: integer("page_count"),
    chunkCount: integer("chunk_count").notNull().default(0),
    embeddingModel: text("embedding_model"),
    fileData: bytea("file_data").notNull(),
    createdAt: ts("created_at").defaultNow().notNull(),
    processedAt: ts("processed_at"),
  },
  (t) => [
    index("documents_user_created_idx").on(t.userId, t.createdAt),
    uniqueIndex("documents_user_hash_uidx").on(t.userId, t.fileHash),
  ],
);

export const chunks = pgTable(
  "chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    pageNumber: integer("page_number").notNull(),
    text: text("text").notNull(),
    tokenEstimate: integer("token_estimate").notNull(),
    embeddingModel: text("embedding_model").notNull(),
    embedding: doublePrecision("embedding").array().notNull(),
  },
  (t) => [
    index("chunks_user_model_idx").on(t.userId, t.embeddingModel),
    index("chunks_doc_idx").on(t.documentId),
  ],
);

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    documentIds: jsonb("document_ids").$type<string[] | null>(),
    createdAt: ts("created_at").defaultNow().notNull(),
    updatedAt: ts("updated_at").defaultNow().notNull(),
  },
  (t) => [index("conversations_user_idx").on(t.userId, t.updatedAt)],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: text("role").$type<"user" | "assistant">().notNull(),
    content: text("content").notNull(),
    sources: jsonb("sources").$type<Source[] | null>(),
    model: text("model"),
    mode: text("mode"),
    latencyMs: integer("latency_ms"),
    topScore: doublePrecision("top_score"),
    createdAt: ts("created_at").defaultNow().notNull(),
  },
  (t) => [index("messages_conv_idx").on(t.conversationId, t.createdAt)],
);
