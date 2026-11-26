import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { ApiError, clientIp, ok, parseJson, route } from "@/lib/http";
import { hashPassword, createSession, sessionCookie } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { toSafeUser } from "@/lib/services/documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(60, "Name must be 60 characters or fewer."),
  email: z.string().trim().email("Enter a valid email address.").max(254),
  password: z.string().min(8, "Password must be at least 8 characters.").max(128, "Password must be 128 characters or fewer."),
});

export const POST = route(async (req) => {
  if (!rateLimit(`register:${clientIp(req)}`, 10, 60_000)) {
    throw new ApiError(429, "Too many sign-up attempts. Please wait a minute and try again.", "rate_limited");
  }
  const body = await parseJson(registerSchema, req);
  const email = body.email.toLowerCase();
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) throw new ApiError(409, "An account with this email already exists. Log in instead.", "email_taken");

  const passwordHash = await hashPassword(body.password);
  let inserted: { id: string; email: string; name: string; createdAt: Date } | undefined;
  try {
    [inserted] = await db
      .insert(users)
      .values({ email, name: body.name, passwordHash })
      .returning({ id: users.id, email: users.email, name: users.name, createdAt: users.createdAt });
  } catch (err) {
    if ((err as { code?: string }).code === "23505") throw new ApiError(409, "An account with this email already exists. Log in instead.", "email_taken");
    throw err;
  }
  if (!inserted) throw new ApiError(500, "The account could not be created.", "internal_error");

  // The session travels both as an httpOnly cookie and as a bearer token, so it works
  // even where the browser refuses cookies (embedded cross-site views).
  const token = await createSession(inserted.id);
  const res = ok({ user: toSafeUser(inserted), token }, { status: 201 });
  res.cookies.set(sessionCookie(token, req));
  return res;
});
