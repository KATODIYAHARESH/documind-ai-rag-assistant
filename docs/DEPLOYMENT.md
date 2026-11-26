# Deployment guide

DocuMind AI is a single Next.js 16 application (API route handlers + UI) backed by PostgreSQL.
Documents are stored in the database (`bytea`), so **no writable filesystem is required** — any host with
a managed PostgreSQL works.

## 1. Provision PostgreSQL

Use a managed database (Neon, Supabase, Amazon RDS, Railway, Render…). Copy the connection string into
`DATABASE_URL`. Apply the schema from your machine or a release step:

```bash
npx drizzle-kit push
```

## 2. Environment

| Variable | Production value |
| --- | --- |
| `DATABASE_URL` | managed Postgres connection string (use `sslmode=require` if offered a pooled port) |
| `LLM_API_KEY` | OpenAI-compatible key (optional — omit for grounded extractive mode) |
| `LLM_MODEL` / `LLM_BASE_URL` | e.g. `gpt-4o-mini` / `https://api.openai.com/v1`, or any compatible provider |
| `EMBEDDING_PROVIDER` | `auto` (OpenAI-compatible when `EMBEDDING_API_KEY` is set, otherwise the built-in local embedder) |
| `RETRIEVAL_MIN_SCORE` | leave empty for the default `0.4`; raise for stricter grounding |
| `MAX_UPLOAD_BYTES` | default 15 MB per PDF |
| `COOKIE_SECURE` | **`true`** — the site is served over HTTPS |
| `SESSION_TTL_DAYS` | default `30` |

Never place keys in `NEXT_PUBLIC_*` variables or in client code; all provider calls happen server-side.

## 3. Option A — Vercel

1. Import the repository. Build command `next build` (default), output handled by Next.js.
2. Add the environment variables above.
3. **Background indexing:** document processing runs after the upload response (`after()` from `next/server`).
   On serverless, give the function time: set `maxDuration` in `next.config.ts` if your plan allows
   (`experimental: { ... }` not required; see `functions` config in `vercel.json`: `{"functions":{"api/documents/*.js":{"maxDuration":60}}}`)
   or trigger processing from a queue/worker if you expect large PDFs. Uploads respond immediately; the UI polls the status.
4. Health check: `GET /api/health` → `200 {"ok":true,…}`.

## 3. Option B — Railway / Render (long-running Node)

1. Service → *GitHub repo*, build `npm install && npm run build`, start `npm run start` (port from `PORT`).
2. Add the environment variables; `COOKIE_SECURE=true`.
3. Run `npx drizzle-kit push` once as a release command (`npx drizzle-kit push && npm run start` works too).
4. Health check path `/api/health`.

Because the server is long-running, `after()` processing runs to completion — no extra worker needed.

## 4. Verify after deploy

```bash
curl -s https://<app>/api/health
# register → cookie jar, then upload a PDF and ask a question:
curl -s -c jar -X POST https://<app>/api/auth/register -H 'Content-Type: application/json' \
  -d '{"name":"Smoke Test","email":"smoke@example.com","password":"password123"}'
curl -s -b jar -X POST https://<app>/api/documents/samples
sleep 3 && curl -s -b jar https://<app>/api/documents | head -c 400
curl -s -N -b jar -X POST https://<app>/api/chat -H 'Content-Type: application/json' \
  -d '{"question":"Which vector database does Atlas use?"}' | head -c 600
```

Expect `status: indexed` for the samples and an SSE stream with a `sources` event followed by the answer.
Then sign in through the deployed UI and confirm: upload → *Indexed* badge → cited answer → *Open page*.

## 5. CORS

The frontend and API share an origin, so no CORS headers are needed. If you split them across domains,
add an `Access-Control-Allow-Origin` middleware for the API origin and `credentials: true` handling — the
session cookie is `SameSite=Lax` and would need `SameSite=None; Secure` in that setup.

## 6. Scaling notes

* Vectors live in PostgreSQL; for corpora above ~100k chunks add `pgvector` behind the `vector-store` adapter
  (same interface, HNSW index) or a hosted vector database.
* Switch to `EMBEDDING_PROVIDER=openai` for semantic (not lexical) embeddings before raising `RETRIEVAL_MIN_SCORE`.
* Rate limits and the recover-stale-documents sweep are per-instance; use a shared store (Redis) when running many replicas.
