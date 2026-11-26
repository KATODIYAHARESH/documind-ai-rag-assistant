# DocuMind AI — AI-Powered Document Intelligence & Knowledge Assistant

> **Your Documents. Your Intelligence.**

DocuMind AI turns PDFs into a searchable knowledge base. Documents are extracted page by page,
chunked, embedded and stored as vectors; every answer is produced with a genuine
**Retrieval-Augmented Generation (RAG)** pipeline and cites the exact document and page it came from.
When nothing relevant is retrieved, DocuMind says so instead of guessing.

| Capability | Where it lives |
| --- | --- |
| LLM API integration | `src/lib/rag/llm.ts` — any OpenAI-compatible chat-completions endpoint, streamed token by token |
| Prompt engineering | `src/lib/rag/prompt.ts` — strict system prompt, few-shot examples, labelled context blocks |
| RAG pipeline | `src/lib/pdf/extract.ts` → `src/lib/rag/{chunker,embeddings,vector-store,retriever}.ts` |
| Full-stack app | Next.js 16 (App Router) + React 19 + TypeScript + PostgreSQL/Drizzle + Tailwind CSS v4 + Framer Motion |

---

## How it works

```
PDF ──▶ validate ──▶ extract text (page by page) ──▶ chunk (~500 tokens, ~100 overlap, never across pages)
    ──▶ embed ──▶ store vectors + {document, page, chunk} metadata ──▶ PostgreSQL

Question ──▶ embed ──▶ cosine search (top-12 candidates) ──▶ score (vector + weighted term coverage)
          ──▶ relevance threshold ──▶ top-5 passages, max 3 per document ──▶ LLM (or grounded extractor)
          ──▶ answer with [S1]…[Sn] citations ──▶ sources panel: file, page, excerpt, relevance
```

Two answer modes, always clearly labelled in the UI and stored with each message:

| Mode | When | What happens |
| --- | --- | --- |
| **Generative** (`generative · <model>`) | `LLM_API_KEY` is set | The retrieved passages and the engineered system prompt are sent to the LLM; the answer streams in. The model is forbidden from using outside knowledge. |
| **Extractive · offline** (`extractive`) | no key configured | No text is generated. The sentences from the retrieved passages that best cover the question (IDF-weighted term coverage + passage relevance) are quoted verbatim with their citations. If none covers the question, the answer is “I couldn't find this information in the uploaded documents.” |

Nothing is fabricated: citations are the passages retrieval actually returned; “relevance” is the real
retrieval score; the dashboard statistics are computed live from database rows.

### Embeddings

`EMBEDDING_PROVIDER` selects the embedder:

* `openai` — OpenAI-compatible `/embeddings` endpoint (`EMBEDDING_MODEL`, default `text-embedding-3-small`).
* `local` — built-in **deterministic hashing-n-gram embedder** (stemmed unigrams + weighted bigrams → signed
  feature hashing into 768 dimensions, sub-linear damping, L2-normalised). No network, no model download; works
  offline and in CI. Cosine similarity + weighted lexical coverage are blended for the relevance score.
* `auto` (default) — OpenAI-compatible when a key is present, otherwise local.

Chunks are tagged with their embedding model; retrieval only compares vectors from the current model.

### Vector store

PostgreSQL stores each chunk's vector as `float8[]`; similarity is computed in SQL
(`sum(a*b)` over `unnest(chunk_vector, query_vector)` — vectors are L2-normalised so the dot product is cosine).
The store is a small adapter (`src/lib/rag/vector-store.ts`), so pgvector, ChromaDB or a hosted vector database
can be swapped in without touching retrieval or the API.

---

## Quick start

```bash
npm install
cp .env.example .env          # set DATABASE_URL (PostgreSQL), optionally LLM_API_KEY
npx drizzle-kit push          # create tables
npm run dev                   # http://localhost:3000
```

Open the app, create an account, click **Add sample documents** (three built-in PDFs), wait a second for indexing and ask, for example:

* “Which vector database does Atlas use?” → *“Vector storage uses ChromaDB 0.5 …” [S1]*
* “What is the Orion office address?” → *“I couldn't find this information in the uploaded documents.”*

### Environment variables

| Variable | Purpose | Default |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection string (required) | — |
| `LLM_API_KEY` | OpenAI-compatible API key. Empty = grounded extractive mode | — |
| `LLM_MODEL` / `LLM_BASE_URL` | Model id and endpoint (`/chat/completions`) | `gpt-4o-mini`, `https://api.openai.com/v1` |
| `LLM_TEMPERATURE` / `LLM_MAX_TOKENS` | Generation settings | `0.2` / `900` |
| `EMBEDDING_PROVIDER` | `auto` \| `openai` \| `local` | `auto` |
| `EMBEDDING_API_KEY` / `EMBEDDING_BASE_URL` / `EMBEDDING_MODEL` | Embedding endpoint settings | OpenAI defaults |
| `LOCAL_EMBEDDING_DIM` | Dimensions of the built-in embedder | `768` |
| `RETRIEVAL_MIN_SCORE` | Minimum relevance for a passage (0–1) | `0.4` |
| `MAX_UPLOAD_BYTES` | Per-file upload limit | `15728640` (15 MB) |
| `SESSION_TTL_DAYS` / `COOKIE_SECURE` | Session lifetime; `Secure` cookies are auto-detected on HTTPS (`COOKIE_SECURE=true` forces it) | `30` / auto |
| `OCR_ENABLED` | Reserved for an OCR pathway (scanned PDFs are flagged “Needs OCR” when off) | `false` |

Secrets are read only on the server. The browser never receives API keys; `/api/config` exposes only
non-secret status (provider, model, limits).

---

## Features

* **Landing page** — luxury crimson design system (black / crimson / white / grey only), glassmorphism, floating
  PDF cards, animated chat preview, How-it-works, Features, RAG technology, Why DocuMind, Stack, footer.
* **Authentication** — sign-up / login / logout, scrypt password hashes, httpOnly session cookies stored in
  PostgreSQL, rate limiting, protected `/dashboard/*` routes (server-side redirect).
* **Dashboard** — live totals (documents, processed, indexed chunks, questions asked), recent uploads, recent
  conversations, quick upload / ask actions, onboarding card with sample documents.
* **Documents** — drag & drop and multi-file upload with real progress, backend validation (extension, MIME,
  magic bytes, size), duplicate detection (SHA-256), processing status, “Needs OCR” for scanned PDFs, retry,
  search, filters, in-app PDF preview, deletion with vector cascade.
* **AI Assistant** — three-panel workspace: knowledge-base scope + history, streaming chat (Markdown, code blocks
  with copy, citation chips, copy / regenerate / stop), sources panel with file, page, excerpt, relevance and
  “open page”, suggested questions, typing indicators, error states with retry.
* **Chat history & settings** — persisted conversations with their sources, per-conversation scope, delete one or
  all; profile editing, provider status, retrieval configuration, device preferences.

## API

All routes return JSON errors as `{ "error": { "code", "message" } }` and are authenticated via the session cookie.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/auth/register` · `/login` · `/logout` | Account management |
| GET / PATCH | `/api/auth/me` | Current user · update display name |
| GET / POST | `/api/documents` | List (search `?q=`) · upload (multipart `files`) |
| GET / DELETE | `/api/documents/{id}` | Metadata · delete (cascades vectors) |
| GET | `/api/documents/{id}/file` | Stream the original PDF (owner only) |
| POST | `/api/documents/{id}/reprocess` · `/api/documents/samples` | Retry processing · add built-in samples |
| GET / DELETE | `/api/chat` | List conversations · clear all |
| POST | `/api/chat` | Ask a question — **SSE stream**: `sources` → `delta`* → `done` / `error` |
| GET / DELETE | `/api/chat/{id}` | Conversation with messages · delete |
| GET | `/api/dashboard/stats` | Live workspace statistics |
| GET | `/api/config` | Non-secret runtime configuration |
| GET | `/api/health` | Health check (database, providers) |

## Project structure

```
src/
├─ app/
│  ├─ page.tsx, layout.tsx          Landing page, root layout
│  ├─ (auth)/                       Login & signup (split layout, redirects signed-in users)
│  ├─ (app)/                        Protected shell (sidebar, topbar, page transitions)
│  │  └─ dashboard/                 overview · documents · assistant · history · settings
│  └─ api/                          Route handlers = REST API (auth, documents, chat, stats, config, health)
├─ db/schema.ts                     Drizzle schema: users, sessions, documents, chunks, conversations, messages
├─ lib/
│  ├─ auth.ts · http.ts · rate-limit.ts · files.ts · config.ts · logger.ts
│  ├─ pdf/extract.ts (pdf.js via unpdf) · pdf/write.ts (sample PDFs)
│  └─ rag/ tokenize · chunker · embeddings · vector-store · retriever · prompt · llm · reader · ingest
├─ components/  ui/ · app/ · documents/ · assistant/ · marketing/ · auth/
├─ hooks/       use-documents · use-conversations · use-stats · use-preferences
├─ context/     auth · toast
└─ services/    api.ts (fetch wrapper) · chat-stream.ts (SSE parser)
scripts/e2e.sh                      End-to-end functional test against a production build
docs/                               TESTING.md · DEPLOYMENT.md · E2E_RESULTS.txt
```

## Security

* Passwords hashed with scrypt (N=16384, r=8, p=1, random 16-byte salt, constant-time compare).
* Sessions: 256-bit random tokens, only SHA-256 hashes stored, expiry enforced. Delivered as an httpOnly cookie
  (`SameSite=Lax` on HTTP, `SameSite=None; Secure` on HTTPS so it also works in embedded views) **and** as a bearer
  token — every API call works even where the browser refuses cookies; cross-site cookie-authenticated writes are blocked.
* Uploads validated server-side (extension, MIME type, `%PDF-` magic bytes, size, batch limits), filenames sanitised.
* Every document / conversation / vector query is scoped by `user_id`; other users receive `404`.
* Rate limiting on auth, uploads, chat; structured JSON logging; centralised error handling; no secrets in the client.
* Prompt-injection hardening: the system prompt instructs the model to treat document text as data, never instructions.

## Testing

```bash
npm run build && bash scripts/e2e.sh
```

See [docs/TESTING.md](docs/TESTING.md) for the eight required scenarios and the latest run in
[docs/E2E_RESULTS.txt](docs/E2E_RESULTS.txt).

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) (Vercel + managed PostgreSQL, or Railway/Render with persistent
storage; environment, health checks, HTTPS cookies, and the background-processing note for serverless).

## A note on the reference Python stack

The brief suggested FastAPI + ChromaDB + Sentence-Transformers. This repository implements the same
architecture on the runtime the project is hosted in — Next.js route handlers play the role of the FastAPI
layer, PostgreSQL is both the relational store and the vector store (swappable adapter), and embeddings come
from an OpenAI-compatible API or the built-in deterministic embedder. Every capability (ingestion, chunking,
embeddings, vector retrieval, LLM streaming, engineered prompts, citations, history, security) is implemented
end-to-end; only the process runtime differs.
