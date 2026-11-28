import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { ZodType } from "zod";
import { logger } from "./logger";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code = "error",
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type RouteContext = { params: Promise<Record<string, string | undefined>> };
type RouteHandler = (req: NextRequest, ctx: RouteContext) => Promise<Response>;

/**
 * Blocks cross-site, cookie-authenticated state changes (CSRF defence for the
 * `SameSite=None` session cookie). Bearer-token requests are immune by construction.
 */
function guardCrossSiteRequest(req: NextRequest): void {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return;
  if (req.headers.get("sec-fetch-site") !== "cross-site") return;
  if (req.headers.get("authorization")?.toLowerCase().startsWith("bearer ")) return;
  if (!req.cookies.get("documind_session")) return;
  throw new ApiError(403, "Cross-site request blocked for your security.", "csrf");
}

/** Wraps a route handler with centralized error handling and structured logging. */
export function route(handler: RouteHandler) {
  return async (req: NextRequest, ctx: RouteContext): Promise<Response> => {
    const started = Date.now();
    try {
      guardCrossSiteRequest(req);
      const res = await handler(req, ctx);
      logger.info(`${req.method} ${req.nextUrl.pathname}`, { status: res.status, ms: Date.now() - started });
      return res;
    } catch (err) {
      return handleError(err, `${req.method} ${req.nextUrl.pathname}`);
    }
  };
}

export function handleError(err: unknown, context: string): NextResponse {
  if (err instanceof ApiError) {
    logger.warn(`${context} -> ${err.status}`, { code: err.code, message: err.message });
    return fail(err.status, err.message, err.code);
  }
  const message = err instanceof Error ? err.message : String(err);
  logger.error(`${context} -> 500`, { error: message, stack: err instanceof Error ? err.stack : undefined });
  return fail(500, message || "Something went wrong on our side. Please try again.", "internal_error");
}

export function fail(status: number, message: string, code = "error"): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status });
}

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

export async function parseJson<T>(schema: ZodType<T>, req: Request): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ApiError(400, "Request body must be valid JSON.", "invalid_json");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ApiError(400, issue?.message ?? "Invalid request body.", "validation_error");
  }
  return parsed.data;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Returns true for well-formed UUIDs (any version). */
export function isUuid(value: string | undefined | null): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "local";
}
