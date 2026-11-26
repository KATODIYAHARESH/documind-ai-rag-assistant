import { createHash, randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "crypto";
import { cookies, headers } from "next/headers";
import { and, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import type { SafeUser } from "./types";
import { ApiError } from "./http";
import { logger } from "./logger";

export const SESSION_COOKIE = "documind_session";

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;

function sessionTtlMs(): number {
  const days = Number(process.env.SESSION_TTL_DAYS ?? 30);
  return (Number.isFinite(days) ? days : 30) * 86_400_000;
}

function scryptAsync(
  password: string | Buffer,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

const scryptOptions = (N: number, r: number, p: number): ScryptOptions => ({
  N,
  r,
  p,
  maxmem: 256 * 1024 * 1024,
});

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, KEY_LENGTH, scryptOptions(SCRYPT_N, SCRYPT_R, SCRYPT_P));
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltHex, hashHex] = parts;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  if (expected.length === 0) return false;
  const actual = await scryptAsync(
    password,
    salt,
    expected.length,
    scryptOptions(Number(n), Number(r), Number(p)),
  );
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + sessionTtlMs());
  await db.insert(sessions).values({ tokenHash: sha256(token), userId, expiresAt });
  // Opportunistically clear expired sessions for this user.
  await db.delete(sessions).where(and(eq(sessions.userId, userId), lt(sessions.expiresAt, new Date())));
  return token;
}

/**
 * Resolves the session token from `Authorization: Bearer <token>` (works even where
 * browsers block cookies, e.g. embedded cross-site views) or from the session cookie.
 */
export async function readSessionToken(): Promise<string | null> {
  try {
    const requestHeaders = await headers();
    const bearer = requestHeaders.get("authorization")?.match(/^Bearer\s+([A-Za-z0-9\-_=%.]+)$/i)?.[1];
    if (bearer) return bearer;
    const store = await cookies();
    return store.get(SESSION_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<SafeUser | null> {
  const token = await readSessionToken();
  if (!token) return null;
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      createdAt: users.createdAt,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.tokenHash, sha256(token)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) {
    await db.delete(sessions).where(eq(sessions.tokenHash, sha256(token)));
    return null;
  }
  return { id: row.id, email: row.email, name: row.name, createdAt: row.createdAt.toISOString() };
}

export async function requireUser(): Promise<SafeUser> {
  const user = await getSessionUser();
  if (!user) throw new ApiError(401, "Please sign in to continue.", "unauthorized");
  return user;
}

export async function destroyCurrentSession(): Promise<void> {
  try {
    const token = await readSessionToken();
    if (token) await db.delete(sessions).where(eq(sessions.tokenHash, sha256(token)));
  } catch (err) {
    logger.warn("Failed to destroy session", { error: String(err) });
  }
}

/**
 * True when the request reached the browser over HTTPS. Behind a TLS-terminating proxy
 * this is read from `x-forwarded-proto` (then Origin / Referer), so no configuration is
 * required; `COOKIE_SECURE=true` forces it on.
 */
export function isSecureRequest(request?: Request | null): boolean {
  if (process.env.COOKIE_SECURE === "true") return true;
  if (!request) return false;
  const forwarded = request.headers.get("x-forwarded-proto")?.split(",")[0].trim();
  if (forwarded) return forwarded === "https";
  const protocol = (request as { nextUrl?: { protocol?: string } }).nextUrl?.protocol;
  if (protocol) return protocol === "https:";
  const origin = request.headers.get("origin") ?? request.headers.get("referer") ?? "";
  return origin.startsWith("https://");
}

function cookieAttributes(secure: boolean) {
  // `SameSite=None; Secure` lets the session cookie work when the app is shown in an
  // embedded (cross-site) view; plain HTTP keeps the stricter `Lax` default.
  return {
    httpOnly: true,
    sameSite: secure ? ("none" as const) : ("lax" as const),
    secure,
    path: "/",
  };
}

export function sessionCookie(token: string, request?: Request | null) {
  return {
    name: SESSION_COOKIE,
    value: token,
    ...cookieAttributes(isSecureRequest(request)),
    maxAge: Math.floor(sessionTtlMs() / 1000),
  };
}

export function clearedSessionCookie(request?: Request | null) {
  return {
    name: SESSION_COOKIE,
    value: "",
    ...cookieAttributes(isSecureRequest(request)),
    maxAge: 0,
  };
}
