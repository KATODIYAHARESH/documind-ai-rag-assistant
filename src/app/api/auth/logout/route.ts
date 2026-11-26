import { ok, route } from "@/lib/http";
import { clearedSessionCookie, destroyCurrentSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = route(async (req) => {
  await destroyCurrentSession();
  const res = ok({ ok: true });
  res.cookies.set(clearedSessionCookie(req));
  return res;
});
