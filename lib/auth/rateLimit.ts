import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

// AGENTS.md's non-negotiable rule 5: rate limiting keys combine IP and
// account identifier, applied to signup, the custom /api/signin route
// (before any bcrypt comparison), forgot-password, and verification resend.
// RULES-security-validation.md requires a 429 with a retry indication.

const redis = Redis.fromEnv();

export type RateLimitScope =
  | "signup"
  | "signin"
  | "forgot-password"
  | "verify-email-resend"
  | "verify-email-check";

// PRD v3 does not pin exact thresholds, only that these four endpoints
// must be covered. Values below are deliberately generous for a single
// human filling out a form, tight enough to block scripted abuse.
//
// "verify-email-check" (the code-submission endpoint itself) isn't in
// AGENTS.md's list of four rate-limited endpoints, but a 6-digit code is
// only ~1,000,000 possibilities -- guessable well within its 10-minute
// expiry without a limiter. Added as defense-in-depth alongside the
// documented four; flagged for review since it's not explicitly required.
const LIMITS: Record<RateLimitScope, { requests: number; window: Parameters<typeof Ratelimit.slidingWindow>[1] }> = {
  signup: { requests: 5, window: "10 m" },
  signin: { requests: 5, window: "5 m" },
  "forgot-password": { requests: 5, window: "15 m" },
  "verify-email-resend": { requests: 5, window: "10 m" },
  "verify-email-check": { requests: 5, window: "10 m" },
};

const limiters = new Map<RateLimitScope, Ratelimit>();

function getLimiter(scope: RateLimitScope): Ratelimit {
  let limiter = limiters.get(scope);
  if (!limiter) {
    const { requests, window } = LIMITS[scope];
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(requests, window),
      prefix: `application-manager-track:ratelimit:${scope}`,
      analytics: false,
    });
    limiters.set(scope, limiter);
  }
  return limiter;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  /** Seconds until the caller may retry. */
  retryAfterSeconds: number;
}

/**
 * Checks the rate limit for a given scope. The key combines the caller's
 * IP with an account identifier (email) when one is available, per
 * AGENTS.md rule 5.
 */
export async function checkRateLimit(
  scope: RateLimitScope,
  ip: string,
  identifier?: string | null,
): Promise<RateLimitResult> {
  const key = `${ip}:${identifier ? identifier.toLowerCase() : "no-identifier"}`;
  const { success, limit, remaining, reset } = await getLimiter(scope).limit(key);
  return {
    success,
    limit,
    remaining,
    retryAfterSeconds: Math.max(0, Math.ceil((reset - Date.now()) / 1000)),
  };
}

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0];
    if (first) return first.trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

/** Shared 429 shape so every rate-limited endpoint responds identically. */
export function rateLimitedResponse(result: RateLimitResult): NextResponse {
  return NextResponse.json(
    {
      error: "Too many requests. Please try again later.",
      retryAfterSeconds: result.retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSeconds),
      },
    },
  );
}
