import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.NETLIFY_DB_URL ||
  process.env.NETLIFY_AGENT_RUNNER_DB_CONNECTION_STRING;

if (!databaseUrl) {
  throw new Error("DATABASE_URL or NETLIFY_DB_URL is required");
}

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: databaseUrl,
    ssl:
      databaseUrl.includes("sslmode=require") ||
      (process.env.NODE_ENV === "production" &&
        !databaseUrl.includes("127.0.0.1") &&
        !databaseUrl.includes("localhost"))
        ? { rejectUnauthorized: false }
        : undefined,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool);
