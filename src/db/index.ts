import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl =
  process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/app_db";

const needsSsl =
  Boolean(process.env.DATABASE_URL) &&
  (databaseUrl.includes("sslmode=require") ||
    databaseUrl.includes("neon.tech") ||
    databaseUrl.includes("supabase.co") ||
    databaseUrl.includes("pooler.supabase.com") ||
    databaseUrl.includes("render.com") ||
    databaseUrl.includes("rlwy.net") ||
    (!databaseUrl.includes("localhost") && !databaseUrl.includes("127.0.0.1")));

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: databaseUrl,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool);
