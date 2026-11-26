#!/usr/bin/env bash
# DocuMind AI — end-to-end functional test against a production build.
#
#   npm run build && bash scripts/e2e.sh
#
# Covers the scenarios documented in docs/TESTING.md: auth, ingestion, document-specific,
# multi-document and unknown questions, scope filtering, regeneration, upload validation,
# cross-user isolation, vector deletion, restart persistence and LLM-provider failure.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-3100}"
BASE="http://127.0.0.1:$PORT"
LOG="/tmp/documind-e2e-server.log"
JAR=/tmp/documind-e2e-a.jar
JARB=/tmp/documind-e2e-b.jar
DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:5432/app_db}"
PSQL="psql $DB_URL -tAc"
rm -f "$JAR" "$JARB"

stop() {
  {
    for p in /proc/[0-9]*; do
      [ -r "$p/cmdline" ] || continue
      cmd=$(tr '\0' ' ' < "$p/cmdline" 2>/dev/null) || continue
      case "$cmd" in *"next start -p $PORT"*|*"next-serve"*) kill "${p#/proc/}" 2>/dev/null || true ;; esac
    done
    sleep 1
  } 2>/dev/null
}

start() {
  (cd "$ROOT" && setsid nohup npx next start -p "$PORT" > "$LOG" 2>&1 < /dev/null &)
  for _ in $(seq 1 45); do
    sleep 1
    curl -s "$BASE/api/health" | grep -q '"ok":true' && return 0
  done
  echo "SERVER FAILED TO START"; tail -20 "$LOG"; exit 1
}

# JSON helper: J '<js expression using o>' reads stdin.
J() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const o=JSON.parse(s);console.log(eval(process.argv[1]))}catch(e){console.log('PARSE_ERR '+e.message+' :: '+s.slice(0,160))}})" "$1"; }
JS() { sed 's/ \[[0-9][0-9][0-9]\]$//' | J "$1"; }
CODE() { curl -s -o /dev/null -w "%{http_code}" "$@"; }

# Streams a chat request and summarises the SSE events.
CHAT() {
  curl -s -N --max-time 90 -b "${2:-$JAR}" -X POST "$BASE/api/chat" -H 'Content-Type: application/json' -d "$1" > /tmp/documind-chat-raw.txt
  node -e "
let s=require('fs').readFileSync('/tmp/documind-chat-raw.txt','utf8');let a='',src=[],info=null,err=null,done=null,n=0;
for(const f of s.split('\n\n')){let ev='message',data='';for(const l of f.split('\n')){if(l.startsWith('event:'))ev=l.slice(6).trim();else if(l.startsWith('data:'))data+=l.slice(5).trim();}if(!data)continue;let p;try{p=JSON.parse(data)}catch{continue}n++;
if(ev==='delta')a+=p.text;else if(ev==='sources'){src=p.sources||[];info=p.retrieval}else if(ev==='done')done=p;else if(ev==='error')err=p.message;}
if(!n){console.log('  RAW ('+s.length+' chars): '+s.slice(0,300));}
console.log('  ANSWER  : '+a.replace(/\n+/g,' | ').slice(0,400));
console.log('  SOURCES : '+src.map(x=>x.label+'='+x.documentName+' p.'+x.pageNumber+' ['+x.score+']').join(' ; '));
console.log('  RETRIEVE: candidates='+(info&&info.candidates)+' returned='+(info&&info.returned)+' best='+(info&&info.bestScore)+' min='+(info&&info.minScore)+' embedder='+(info&&info.embeddingModel));
console.log('  DONE    : mode='+(done&&done.mode)+' latency='+(done&&done.latencyMs)+'ms conv='+(done&&done.conversationId)+' error='+(err||'none'));"
}

DOCS() { curl -s -b "$JAR" "$BASE/api/documents" | J "o.documents.map(d=>'  - '+d.originalName+' | '+d.status+' | pages='+d.pageCount+' chunks='+d.chunkCount+' | '+(d.statusMessage||d.error)).join('\n')"; }
WAIT() { for _ in $(seq 1 20); do S=$(curl -s -b "$JAR" "$BASE/api/documents" | J "o.documents.map(d=>d.status).join(',')"); case "$S" in *processing*|PARSE_ERR*) sleep 1.5 ;; *) break ;; esac; done; }

# ------------------------------------------------------------------ fixtures
cat > /tmp/documind-gen.mjs <<'EOF'
import fs from "fs";
function pdf(pages) {
  const objs = []; objs[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objs[2] = `<< /Type /Pages /Kids [${pages.map((_, i) => `${3 + i * 2} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  const fontNum = 3 + pages.length * 2;
  pages.forEach((lines, i) => { const pn = 3 + i * 2, cn = pn + 1; let c = "BT\n/F1 11 Tf\n16 TL\n72 740 Td\n"; if (!lines.length) c += "( ) Tj\n"; lines.forEach((l, li) => { c += `(${l.replace(/[\\()]/g, m => "\\" + m)}) Tj${li < lines.length - 1 ? " T*" : ""}\n`; }); c += "ET\n";
    objs[pn] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontNum} 0 R >> >> /Contents ${cn} 0 R >>`; objs[cn] = `<< /Length ${Buffer.byteLength(c)} >>\nstream\n${c}endstream`; });
  objs[fontNum] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  let out = "%PDF-1.4\n"; const off = [];
  for (let n = 1; n < objs.length; n++) { off[n] = Buffer.byteLength(out); out += `${n} 0 obj\n${objs[n]}\nendobj\n`; }
  const x = Buffer.byteLength(out), size = objs.length; out += `xref\n0 ${size}\n0000000000 65535 f \n`;
  for (let n = 1; n < size; n++) out += `${String(off[n]).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF\n`; return Buffer.from(out, "latin1");
}
fs.writeFileSync("/tmp/documind-upload.pdf", pdf([["Helios Battery User Guide", "The Helios X1 battery has a capacity of 512 Wh and weighs 4.2 kilograms."], ["Charging takes 90 minutes with the 650 W charger.", "Warranty period is 36 months for the Helios X1."]]));
fs.writeFileSync("/tmp/documind-blank.pdf", pdf([[], []]));
fs.writeFileSync("/tmp/documind-fake.pdf", "this is not a pdf, just plain text");
fs.writeFileSync("/tmp/documind-notes.txt", "plain text notes");
EOF
node /tmp/documind-gen.mjs

stop
$PSQL "delete from users where email in ('ada@example.com','eve@example.com')" > /dev/null 2>&1
start

echo "################ DOCUMIND E2E ################"
echo "## health"; curl -s "$BASE/api/health" | J "'  ok='+o.ok+' db='+o.database+' llm='+JSON.stringify(o.llm)+' embeddings='+o.embeddings.provider"
echo "## auth: register / duplicate / weak password / wrong password / me / unauthenticated"
echo "  register        [$(CODE -c "$JAR" -X POST "$BASE/api/auth/register" -H 'Content-Type: application/json' -d '{"name":"Ada Lovelace","email":"ada@example.com","password":"password123"}')]"
echo "  duplicate email [$(CODE -X POST "$BASE/api/auth/register" -H 'Content-Type: application/json' -d '{"name":"Xy Zz","email":"ada@example.com","password":"password123"}')]"
echo "  weak password   [$(CODE -X POST "$BASE/api/auth/register" -H 'Content-Type: application/json' -d '{"name":"Bob","email":"bob@example.com","password":"x"}')]"
echo "  wrong password  [$(CODE -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' -d '{"email":"ada@example.com","password":"wrongpass1"}')]"
echo "  me              [$(CODE -b "$JAR" "$BASE/api/auth/me")]   documents unauthenticated [$(CODE "$BASE/api/documents")]"
TOKEN=$(curl -s -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' -d '{"email":"ada@example.com","password":"password123"}' | J "o.token||''")
echo "## session delivery (cookie + bearer, for embedded views where cookies are refused)"
echo "  login returns a ${#TOKEN}-char token; bearer-only me [$(CODE -H "Authorization: Bearer $TOKEN" "$BASE/api/auth/me")] documents [$(CODE -H "Authorization: Bearer $TOKEN" "$BASE/api/documents")] invalid token [$(CODE -H 'Authorization: Bearer invalid' "$BASE/api/documents")]"
echo "  cookie over https: $(curl -s -D - -o /dev/null -H 'x-forwarded-proto: https' -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' -d '{"email":"ada@example.com","password":"password123"}' | grep -i '^set-cookie' | sed 's/=[^;]*;/=***;/' | tr -d '\r')"
echo "  cookie over http : $(curl -s -D - -o /dev/null -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' -d '{"email":"ada@example.com","password":"password123"}' | grep -i '^set-cookie' | sed 's/=[^;]*;/=***;/' | tr -d '\r')"
echo "  unknown email    [$(CODE -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' -d '{"email":"nobody@example.com","password":"whatever123"}')] -> $(curl -s -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' -d '{"email":"nobody@example.com","password":"whatever123"}' | J "o.error.message")"
echo "  cross-site cookie POST [$(CODE -b "$JAR" -H 'sec-fetch-site: cross-site' -H 'Origin: https://evil.example' -X POST "$BASE/api/documents/samples")] (expected 403) same with bearer [$(CODE -H "Authorization: Bearer $TOKEN" -H 'sec-fetch-site: cross-site' -X POST "$BASE/api/documents/samples")] (expected 201 or 429)"
echo "## T1 document upload + indexing (samples)"
curl -s -b "$JAR" -X POST "$BASE/api/documents/samples" | J "'  '+o.message"
WAIT; DOCS
echo "## T2 document-specific question"; CHAT '{"question":"Which vector database does Atlas use?"}'
echo "## T3 multi-document question"; CHAT '{"question":"How much does the Growth plan cost and what response time does Enterprise support include?"}'
echo "## T4 unknown information"; CHAT '{"question":"What is the Orion office address?"}'
ORION=$(curl -s -b "$JAR" "$BASE/api/documents" | J "(o.documents.find(d=>/Orion/.test(d.originalName))||{}).id")
echo "## T5 scope filter: Atlas question, only the Orion report selected"; CHAT "{\"question\":\"Which vector database does Atlas use?\",\"documentIds\":[\"$ORION\"]}"
echo "## follow-up question in the same conversation"; OUT=$(CHAT '{"question":"What embedding model does Atlas use for indexing?"}'); echo "$OUT"
CONV=$(echo "$OUT" | grep -o 'conv=[0-9a-f-]*' | cut -d= -f2)
echo "## T6 API failure: unknown conversation id -> [$(CODE -b "$JAR" -X POST "$BASE/api/chat" -H 'Content-Type: application/json' -d '{"question":"hello there","conversationId":"00000000-0000-4000-8000-000000000000"}')]"
echo "## regenerate last answer"; CHAT "{\"question\":\"What embedding model does Atlas use for indexing?\",\"conversationId\":\"$CONV\",\"regenerate\":true}"
echo "## conversation reload"; curl -s -b "$JAR" "$BASE/api/chat/$CONV" | J "'  messages='+o.messages.length+' roles='+o.messages.map(m=>m.role).join(',')+' | last mode='+o.messages[o.messages.length-1].mode+' sources='+(o.messages[o.messages.length-1].sources||[]).length+' scope='+JSON.stringify(o.conversation.documentIds)"
echo "## T1b upload validation"
curl -s -b "$JAR" -X POST "$BASE/api/documents" -F "files=@/tmp/documind-upload.pdf;type=application/pdf" -F "files=@/tmp/documind-fake.pdf;type=application/pdf" -F "files=@/tmp/documind-notes.txt" | J "'  mixed request -> created='+o.documents.length+' errors='+JSON.stringify(o.errors)"
curl -s -b "$JAR" -X POST "$BASE/api/documents" -F "files=@/tmp/documind-upload.pdf;type=application/pdf" | JS "'  duplicate -> '+o.error.message"
echo "  image-only pdf   [$(CODE -b "$JAR" -X POST "$BASE/api/documents" -F "files=@/tmp/documind-blank.pdf;type=application/pdf")]   no files [$(CODE -b "$JAR" -X POST "$BASE/api/documents" -F "x=y")]"
WAIT; DOCS
echo "## question answered from the freshly uploaded PDF"; CHAT '{"question":"How long is the warranty for the Helios X1 and how long does charging take?"}'
echo "## dashboard stats (live)"; curl -s -b "$JAR" "$BASE/api/dashboard/stats" | J "'  '+JSON.stringify(o.totals)"
HEL=$(curl -s -b "$JAR" "$BASE/api/documents" | J "(o.documents.find(d=>/upload\.pdf/.test(d.originalName))||{}).id")
echo "## PDF file endpoint: [$(curl -s -b "$JAR" -o /tmp/documind-dl.pdf -w '%{http_code} %{content_type} %{size_download}B' "$BASE/api/documents/$HEL/file")] magic=$(head -c 5 /tmp/documind-dl.pdf)"
echo "## T8 security: user B vs user A's resources"
curl -s -c "$JARB" -o /dev/null -X POST "$BASE/api/auth/register" -H 'Content-Type: application/json' -d '{"name":"Eve Mallory","email":"eve@example.com","password":"password123"}'
echo "  GET document    [$(CODE -b "$JARB" "$BASE/api/documents/$HEL")]   GET file [$(CODE -b "$JARB" "$BASE/api/documents/$HEL/file")]   DELETE document [$(CODE -b "$JARB" -X DELETE "$BASE/api/documents/$HEL")]   GET conversation [$(CODE -b "$JARB" "$BASE/api/chat/$CONV")]"
echo "  malformed id    [$(CODE -b "$JAR" "$BASE/api/documents/not-a-uuid")] (expected 404)"
echo "## delete document -> vectors removed"
echo "  vectors before: $($PSQL "select count(*) from chunks")"
curl -s -b "$JAR" -w " [%{http_code}]" -X DELETE "$BASE/api/documents/$HEL" | JS "'  delete -> '+JSON.stringify(o)"
echo "  vectors after:  $($PSQL "select count(*) from chunks")   GET deleted [$(CODE -b "$JAR" "$BASE/api/documents/$HEL")]"
echo "## T7 persistence: restart the server"; stop; start
curl -s -b "$JAR" "$BASE/api/documents" | J "'  statuses after restart: '+o.documents.map(d=>d.status).join(',')"
CHAT '{"question":"Who leads the Atlas engineering team?"}'
echo "## clear all conversations"; curl -s -b "$JAR" -w " [%{http_code}]" -X DELETE "$BASE/api/chat" | JS "'  '+JSON.stringify(o)"
echo "## logout"; curl -s -b "$JAR" -c "$JAR" -o /dev/null -X POST "$BASE/api/auth/logout"; echo "  me after logout [$(CODE -b "$JAR" "$BASE/api/auth/me")]   /dashboard logged out -> $(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' "$BASE/dashboard")"
curl -s -c "$JAR" -o /dev/null -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' -d '{"email":"ada@example.com","password":"password123"}'
echo "## pages"; for p in / /login /signup; do echo "  $p [$(CODE "$BASE$p")]"; done
for p in /dashboard /dashboard/documents /dashboard/assistant /dashboard/history /dashboard/settings; do echo "  $p [$(CODE -b "$JAR" "$BASE$p")]"; done
echo "## T6 API failure: LLM provider unreachable (misconfigured key), app must degrade gracefully"
stop
(cd "$ROOT" && LLM_API_KEY=sk-test-invalid LLM_BASE_URL=http://127.0.0.1:9/v1 LLM_MODEL=test-model setsid nohup npx next start -p "$PORT" > "$LOG" 2>&1 < /dev/null &)
for _ in $(seq 1 45); do sleep 1; curl -s "$BASE/api/health" | grep -q '"ok":true' && break; done
curl -s "$BASE/api/health" | J "'  health with broken LLM: ok='+o.ok+' llm.configured='+o.llm.configured"
CHAT '{"question":"Which vector database does Atlas use?"}'
echo "  next request still served: health [$(CODE "$BASE/api/health")] documents [$(CODE -b "$JAR" "$BASE/api/documents")]"
stop
$PSQL "delete from users where email in ('ada@example.com','eve@example.com')" > /dev/null 2>&1
echo "################ DONE ################"
