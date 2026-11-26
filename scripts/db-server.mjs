import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import fs from "node:fs";

const dataDir = "./data/pgdata";
fs.mkdirSync(dataDir, { recursive: true });

console.log("[DB] Starting embedded PostgreSQL database...");
const db = new PGlite(dataDir);
await db.waitReady;

const server = new PGLiteSocketServer({
  db,
  port: 5432,
  host: "127.0.0.1",
});

await server.start();
console.log("[DB] PostgreSQL is listening on postgresql://postgres:postgres@127.0.0.1:5432/app_db");

// Handle shutdown
const shutdown = async () => {
  console.log("\n[DB] Stopping PostgreSQL server...");
  try {
    await server.stop();
  } catch (e) {
    // ignore
  }
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
