CREATE TABLE IF NOT EXISTS "users" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS "sessions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "token_hash" TEXT NOT NULL UNIQUE,
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS "documents" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "filename" TEXT NOT NULL,
  "original_name" TEXT NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "mime_type" TEXT NOT NULL,
  "file_hash" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'processing',
  "status_message" TEXT,
  "error" TEXT,
  "page_count" INTEGER,
  "chunk_count" INTEGER NOT NULL DEFAULT 0,
  "embedding_model" TEXT,
  "file_data" BYTEA NOT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "processed_at" TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS "documents_user_created_idx" ON "documents" ("user_id", "created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "documents_user_hash_uidx" ON "documents" ("user_id", "file_hash");

CREATE TABLE IF NOT EXISTS "chunks" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "document_id" UUID NOT NULL REFERENCES "documents"("id") ON DELETE CASCADE,
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "chunk_index" INTEGER NOT NULL,
  "page_number" INTEGER NOT NULL,
  "text" TEXT NOT NULL,
  "token_estimate" INTEGER NOT NULL,
  "embedding_model" TEXT NOT NULL,
  "embedding" DOUBLE PRECISION[] NOT NULL
);

CREATE INDEX IF NOT EXISTS "chunks_user_model_idx" ON "chunks" ("user_id", "embedding_model");
CREATE INDEX IF NOT EXISTS "chunks_doc_idx" ON "chunks" ("document_id");

CREATE TABLE IF NOT EXISTS "conversations" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title" TEXT NOT NULL,
  "document_ids" JSONB,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS "conversations_user_idx" ON "conversations" ("user_id", "updated_at");

CREATE TABLE IF NOT EXISTS "messages" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "conversation_id" UUID NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "sources" JSONB,
  "model" TEXT,
  "mode" TEXT,
  "latency_ms" INTEGER,
  "top_score" DOUBLE PRECISION,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS "messages_conv_idx" ON "messages" ("conversation_id", "created_at");
