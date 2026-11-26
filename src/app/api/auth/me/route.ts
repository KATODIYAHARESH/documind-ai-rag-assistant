import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { fail, ok, parseJson, route } from "@/lib/http";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const profileSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(60, "Name must be 60 characters or fewer."),
});

export const GET = route(async () => {
  const user = await getSessionUser();
  if (!user) return fail(401, "Not authenticated.", "unauthorized");
  return ok({ user });
});

export const PATCH = route(async (req) => {
  const user = await getSessionUser();
  if (!user) return fail(401, "Not authenticated.", "unauthorized");
  const body = await parseJson(profileSchema, req);
  const [updated] = await db
    .update(users)
    .set({ name: body.name })
    .where(eq(users.id, user.id))
    .returning({ id: users.id, email: users.email, name: users.name, createdAt: users.createdAt });
  return ok({ user: { id: updated.id, email: updated.email, name: updated.name, createdAt: updated.createdAt.toISOString() } });
});
