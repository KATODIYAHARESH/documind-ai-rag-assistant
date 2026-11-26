import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import fs from "node:fs";
import { spawn } from "node:child_process";

const dataDir = "./data/pgdata";
fs.mkdirSync(dataDir, { recursive: true });

console.log("[DocuMind] Starting embedded PostgreSQL service...");
const db = new PGlite(dataDir);
await db.waitReady;

const server = new PGLiteSocketServer({
  db,
  port: 5432,
  host: "127.0.0.1",
});

await server.start();
console.log("[DocuMind] PostgreSQL running at postgresql://postgres:postgres@127.0.0.1:5432/app_db");

const mode = process.argv[2] === "dev" ? "dev" : "start";
console.log(`[DocuMind] Starting Next.js (${mode} mode)...`);

const nextArgs = mode === "dev" ? ["next", "dev", "--webpack"] : ["next", "start"];
const nextProcess = spawn("npx", nextArgs, {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/app_db",
  },
});

const cleanup = async () => {
  console.log("\n[DocuMind] Shutting down services...");
  try {
    nextProcess.kill();
  } catch {}
  try {
    await server.stop();
  } catch {}
  process.exit(0);
};

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

nextProcess.on("close", async (code) => {
  try {
    await server.stop();
  } catch {}
  process.exit(code ?? 0);
});
