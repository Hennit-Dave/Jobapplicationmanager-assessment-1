import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signinSchema } from "@/lib/validation/auth";
import { verifyPassword } from "@/lib/auth/password";
import { checkRateLimit, getClientIp, rateLimitedResponse } from "@/lib/auth/rateLimit";
import { createSessionForUser, attachSessionCookie } from "@/lib/auth/manualSession";

// PRD v3 5.3 describes this logic as the Credentials provider's
// authorize() callback. It lives here instead because @auth/core refuses
// to run at all (every /api/auth/* endpoint, not just sign-in) when
// Credentials is the only provider and session.strategy is "database" --
// see auth.ts for the confirmed error and the reasoning. The steps are
// otherwise exactly as specified: rate limit first, before any bcrypt
// comparison happens (AGENTS.md rule 5 / RULES-security-validation.md), so
// a rate-limited request never touches the password check.
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const json = await request.json().catch(() => null);
  const parsed = signinSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { email, password } = parsed.data;

  const rateLimit = await checkRateLimit("signin", ip, email);
  if (!rateLimit.success) {
    return rateLimitedResponse(rateLimit);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  if (!user.emailVerified) {
    return NextResponse.json(
      { error: "Please verify your email before signing in.", code: "email-not-verified" },
      { status: 403 },
    );
  }

  const passwordMatches = await verifyPassword(password, user.passwordHash);
  if (!passwordMatches) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  const { sessionToken, expires } = await createSessionForUser(user.id);
  const response = NextResponse.json({ redirectTo: "/dashboard" });
  attachSessionCookie(response, request, sessionToken, expires);
  return response;
}
