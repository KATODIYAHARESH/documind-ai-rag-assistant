import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const NEON_DEFAULT_URL =
  "postgresql://neondb_owner:npg_E2WFMk8dugVH@ep-old-night-bdl9y1qw-pooler.c-8.us-east-2.aws.neon.tech/neondb?sslmode=require";

const databaseUrl = process.env.DATABASE_URL || NEON_DEFAULT_URL;

const needsSsl =
  databaseUrl.includes("sslmode=require") ||
  databaseUrl.includes("neon.tech") ||
  databaseUrl.includes("supabase.co") ||
  databaseUrl.includes("pooler.supabase.com") ||
  databaseUrl.includes("render.com") ||
  databaseUrl.includes("rlwy.net") ||
  (!databaseUrl.includes("localhost") && !databaseUrl.includes("127.0.0.1"));

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: databaseUrl,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
    max: 5,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
  });

globalForDb.__arenaNextJsPostgresqlPool = pool;

export const db = drizzle(pool);
