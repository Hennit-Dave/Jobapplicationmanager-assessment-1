import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { forgotPasswordSchema } from "@/lib/validation/auth";
import { checkRateLimit, getClientIp, rateLimitedResponse } from "@/lib/auth/rateLimit";
import { sendEmail, passwordResetEmail } from "@/lib/email";

const RESET_TOKEN_TTL_MINUTES = 30;

function generateResetToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const json = await request.json().catch(() => null);
  const parsed = forgotPasswordSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { email } = parsed.data;

  const rateLimit = await checkRateLimit("forgot-password", ip, email);
  if (!rateLimit.success) {
    return rateLimitedResponse(rateLimit);
  }

  // PRD v3 5.4.1: always the same generic response, whether or not the
  // account exists -- prevents account enumeration via this endpoint.
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    const token = generateResetToken();
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60_000);
    await prisma.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt },
    });
    const resetUrl = new URL(`/reset-password/${token}`, process.env.NEXTAUTH_URL).toString();
    await sendEmail(user.email, passwordResetEmail(resetUrl));
  }

  return NextResponse.json({
    message: "If an account exists for that email, a reset link has been sent.",
  });
}
