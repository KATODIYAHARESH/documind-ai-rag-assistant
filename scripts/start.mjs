import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import fs from "node:fs";
import { spawn } from "node:child_process";

const databaseUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/app_db";
const isLocalEmbedded = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("127.0.0.1") || process.env.DATABASE_URL.includes("localhost");

let server = null;
if (isLocalEmbedded) {
  const dataDir = "./data/pgdata";
  fs.mkdirSync(dataDir, { recursive: true });

  console.log("[DocuMind] Starting embedded PostgreSQL service...");
  const db = new PGlite(dataDir);
  await db.waitReady;

  server = new PGLiteSocketServer({
    db,
    port: 5432,
    host: "127.0.0.1",
  });

  await server.start();
  console.log("[DocuMind] PostgreSQL running at postgresql://postgres:postgres@127.0.0.1:5432/app_db");
} else {
  console.log("[DocuMind] Using remote PostgreSQL database from DATABASE_URL");
}

const mode = process.argv[2] === "dev" ? "dev" : "start";
console.log(`[DocuMind] Starting Next.js (${mode} mode)...`);

const nextArgs = mode === "dev" ? ["next", "dev", "--webpack"] : ["next", "start"];
const nextProcess = spawn("npx", nextArgs, {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    DATABASE_URL: databaseUrl,
  },
});

const cleanup = async () => {
  console.log("\n[DocuMind] Shutting down services...");
  try {
    nextProcess.kill();
  } catch {}
  if (server) {
    try {
      await server.stop();
    } catch {}
  }
  process.exit(0);
};

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

nextProcess.on("close", async (code) => {
  if (server) {
    try {
      await server.stop();
    } catch {}
  }
  process.exit(code ?? 0);
});
