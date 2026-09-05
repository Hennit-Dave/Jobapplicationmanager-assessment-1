import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyEmailToken, VERIFY_EMAIL_COOKIE_NAME } from "@/lib/auth/verifyEmailToken";
import { checkRateLimit, getClientIp, rateLimitedResponse } from "@/lib/auth/rateLimit";
import { resendOrIssueVerificationCode } from "@/lib/auth/verificationCode";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(VERIFY_EMAIL_COOKIE_NAME)?.value;
  const userId = token ? await verifyEmailToken(token) : null;
  if (!userId) {
    return NextResponse.json(
      { error: "Your verification session has expired. Please sign up again." },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json(
      { error: "Your verification session has expired. Please sign up again." },
      { status: 400 },
    );
  }

  const ip = getClientIp(request);
  const rateLimit = await checkRateLimit("verify-email-resend", ip, user.email);
  if (!rateLimit.success) {
    return rateLimitedResponse(rateLimit);
  }

  if (user.emailVerified) {
    return NextResponse.json({ ok: true });
  }

  // PRD v3 5.2.5: resend is gated by a server-enforced 60-second cooldown
  // read from the database (`lastSentAt`), never from client-side state.
  const result = await resendOrIssueVerificationCode(userId, user.email);
  if (!result.sent) {
    return NextResponse.json(
      {
        error: "Please wait before requesting another code.",
        retryAfterSeconds: result.cooldownRemainingSeconds,
      },
      { status: 429 },
    );
  }

  return NextResponse.json({ ok: true });
}
