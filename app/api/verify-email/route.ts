import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyEmailCodeSchema } from "@/lib/validation/auth";
import { verifyEmailToken, VERIFY_EMAIL_COOKIE_NAME } from "@/lib/auth/verifyEmailToken";
import { checkRateLimit, getClientIp, rateLimitedResponse } from "@/lib/auth/rateLimit";
import { createSessionForUser, attachSessionCookie } from "@/lib/auth/manualSession";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(VERIFY_EMAIL_COOKIE_NAME)?.value;
  const userId = token ? await verifyEmailToken(token) : null;
  if (!userId) {
    return NextResponse.json(
      { error: "Your verification session has expired. Please sign up again." },
      { status: 400 },
    );
  }

  // Defense-in-depth: not one of AGENTS.md's four listed rate-limited
  // endpoints, but a 6-digit code has only ~1,000,000 possibilities.
  const ip = getClientIp(request);
  const rateLimit = await checkRateLimit("verify-email-check", ip, userId);
  if (!rateLimit.success) {
    return rateLimitedResponse(rateLimit);
  }

  const json = await request.json().catch(() => null);
  const parsed = verifyEmailCodeSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const now = new Date();

  // RULES-security-validation.md "Token / code rules": expiry is checked
  // against the database, inside a transaction that also consumes the
  // code -- never a UI countdown, and no gap between check and consume
  // for a concurrent request to race through.
  const verifiedUserId = await prisma.$transaction(async (tx) => {
    const matchingCode = await tx.verificationCode.findFirst({
      where: {
        userId,
        code: parsed.data.code,
        consumedAt: null,
        expiresAt: { gt: now },
      },
    });

    if (!matchingCode) {
      return null;
    }

    await tx.verificationCode.update({
      where: { id: matchingCode.id },
      data: { consumedAt: now },
    });

    await tx.user.update({
      where: { id: userId },
      data: { emailVerified: now },
    });

    return userId;
  });

  if (!verifiedUserId) {
    return NextResponse.json({ error: "Invalid or expired code." }, { status: 400 });
  }

  const { sessionToken, expires } = await createSessionForUser(verifiedUserId);
  const response = NextResponse.json({ redirectTo: "/dashboard" });
  attachSessionCookie(response, request, sessionToken, expires);
  response.cookies.delete(VERIFY_EMAIL_COOKIE_NAME);
  return response;
}
