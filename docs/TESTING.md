# Testing guide

All scenarios below are exercised automatically against a **production build** by:

```bash
npm run build && bash scripts/e2e.sh        # optional: PORT=3200 bash scripts/e2e.sh
```

The script boots `next start` on port 3100, creates two throw-away accounts, generates real PDF fixtures
with a minimal PDF writer, runs the scenarios, restarts the server for the persistence test, and finally
boots the server with an unreachable LLM endpoint to simulate a provider outage. The last run is saved in
[`E2E_RESULTS.txt`](./E2E_RESULTS.txt). No responses, statistics or citations are hard-coded anywhere.

## Required scenarios

| # | Scenario | Procedure | Observed (latest run) |
| --- | --- | --- | --- |
| 1 | **Document upload** | `POST /api/documents/samples`, poll `GET /api/documents`; then upload `upload.pdf` (real, text-based), `fake.pdf` (plain text renamed), `notes.txt` and `blank.pdf` (image-only pages). | Samples indexed in 0.0–0.3 s (`pages=2 chunks=2` for the overview). Mixed request: `created=1`, per-file errors for the fake PDF and the `.txt`. `blank.pdf` → `needs_ocr` with an explicit message. Duplicate upload → `400 "Already in your library…"`. |
| 2 | **Document-specific question** | `POST /api/chat {"question":"Which vector database does Atlas use?"}` | Answer: *“Vector storage uses ChromaDB 0.5 with a persistent storage directory mounted on the application server. [S1]”* — source `S1 = Atlas Platform - Technical Overview.pdf, page 1, relevance 0.71`. |
| 3 | **Multiple documents** | “How much does the Growth plan cost and what response time does Enterprise support include?” | Retrieval returns passages from **both** `Pricing and Plans.pdf` (0.80) and `Technical Overview.pdf` (0.45); answer quotes Growth pricing from the pricing document with `[S1]`. |
| 4 | **Unknown information** | “What is the Orion office address?” | No passage reaches the 0.40 threshold (`returned=0`); answer: *“I couldn't find this information in the uploaded documents.”* Mode badge `No matching passage`. |
| 5 | **Retrieval verification** | Inspect the `sources` SSE event and the Sources panel. | Every source carries `label`, `documentName`, `pageNumber`, `snippet`, `score`, `chunkIndex`; the panel also shows candidates considered, threshold, embedding model and retrieval time. “Open page” loads `/api/documents/{id}/file#page=N`. |
| 6 | **API failure** | Server started with `LLM_API_KEY=sk-test-invalid LLM_BASE_URL=http://127.0.0.1:9/v1`. | `sources` still streams (retrieval works); then `error` event: *“The AI provider could not be reached. Please try again in a moment.”* `/api/health` stays `200`, following requests succeed, the UI shows an inline error with **Try again**. |
| 7 | **Persistence** | `kill` the server, start it again, list documents and ask a question. | Statuses survive (`needs_ocr,indexed,indexed,indexed`); the answer *“The engineering team is led by Dr. Amara Chen. [S1]”* is produced from the persisted vectors. |
| 8 | **Security** | Unauthenticated calls; user B against user A's document, file and conversation; malformed ids; `grep` the client bundle for secrets. | `401` without a session; `404` for every cross-user access (document, PDF file, DELETE, conversation); `404` for non-UUID ids; `.env` ignored by git; keys only read from `process.env` server-side. |

## Session delivery (login reliability)

The preview is typically displayed inside an embedded (cross-site) frame, where browsers refuse `SameSite=Lax`
cookies — the server would create a session on every login but the next page load would have none. The suite therefore checks both
delivery mechanisms:

* `POST /api/auth/login` returns a bearer `token`; with **no cookies at all**, `Authorization: Bearer <token>` authenticates
  `/api/auth/me` and `/api/documents` (`200`), while an invalid token gets `401`.
* With `x-forwarded-proto: https` the `Set-Cookie` header carries `Secure` + `SameSite=None`; over plain HTTP it stays `SameSite=Lax`.
* A cookie-authenticated cross-site write (`sec-fetch-site: cross-site`) is refused with `403`; the same request with the bearer token is accepted.
* Unknown e-mail → `401` with “No account found for this email. Create one to get started.” (the login form shows a *Create an account* link).
* Without a cookie, the protected layout renders an `AuthGuard` that resolves the session from the stored token before showing the workspace.

## Additional checks covered by the script

* Auth validation: duplicate e-mail `409`, weak password `400`, wrong password `401`, logout → `/dashboard` redirects to `/login` (`307`).
* Follow-up questions keep conversation context; **Regenerate** replaces the previous assistant message (reloaded conversation still has exactly `user, assistant`).
* Document deletion removes its vectors (`chunks` count 6 → 4) and the file endpoint returns `404` afterwards.
* Dashboard statistics equal the real row counts (documents, indexed, chunks, questions, conversations, storage bytes).
* All pages render: `/`, `/login`, `/signup`, `/dashboard`, `/dashboard/documents`, `/dashboard/assistant`, `/dashboard/history`, `/dashboard/settings`.

## Manual UI checklist

1. Sign up → dashboard onboarding card → **Add sample documents** → documents list shows *Processing* → *Indexed* with chunk counts.
2. Assistant: ask a question → sources appear on the right while the answer streams; click an `[S1]` chip → the source card highlights; *Open page* shows the PDF at that page.
3. Toggle *Search all documents* off and select a single document → ask something only another document knows → “couldn't find”.
4. Upload a non-PDF or an oversized file → toast with the server's validation message; upload the same PDF twice → duplicate toast.
5. Stop a streaming answer → bubble is marked *Stopped*; *Try again* after an error regenerates.
6. Mobile widths: conversation panel and sources panel become drawers; sidebar is a drawer behind the menu button.
