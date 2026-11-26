import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { ApiError, clientIp, ok, parseJson, route } from "@/lib/http";
import { createSession, sessionCookie, verifyPassword } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { toSafeUser } from "@/lib/services/documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password.").max(128),
});

export const POST = route(async (req) => {
  const ip = clientIp(req);
  if (!rateLimit(`login:${ip}`, 30, 60_000)) {
    throw new ApiError(429, "Too many sign-in attempts. Please wait a minute and try again.", "rate_limited");
  }
  const body = await parseJson(loginSchema, req);
  const email = body.email.toLowerCase();

  const [user] = await db
    .select({ id: users.id, email: users.email, name: users.name, passwordHash: users.passwordHash, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const failedAttempt = () => {
    if (!rateLimit(`login-fail:${ip}:${email}`, 8, 15 * 60_000)) {
      throw new ApiError(429, "Too many failed attempts for this account. Please try again later.", "rate_limited");
    }
  };

  // A specific, actionable message beats a generic one: the most common "can't log in"
  // is an e-mail that was never registered.
  if (!user) {
    failedAttempt();
    throw new ApiError(401, "No account found for this email. Create one to get started.", "unknown_email");
  }

  const valid = await verifyPassword(body.password, user.passwordHash);
  if (!valid) {
    failedAttempt();
    throw new ApiError(401, "Incorrect password. Check it and try again.", "invalid_credentials");
  }

  // The session travels both as an httpOnly cookie and as a bearer token, so it works
  // even where the browser refuses cookies (embedded cross-site views).
  const token = await createSession(user.id);
  const res = ok({ user: toSafeUser(user), token });
  res.cookies.set(sessionCookie(token, req));
  return res;
});
