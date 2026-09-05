import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { signupSchema } from "@/lib/validation/auth";
import { hashPassword } from "@/lib/auth/password";
import { checkRateLimit, getClientIp, rateLimitedResponse } from "@/lib/auth/rateLimit";
import { sendEmail, verificationCodeEmail } from "@/lib/email";
import {
  createVerifyEmailToken,
  VERIFY_EMAIL_COOKIE_MAX_AGE_SECONDS,
  VERIFY_EMAIL_COOKIE_NAME,
} from "@/lib/auth/verifyEmailToken";

const VERIFICATION_CODE_TTL_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 60;

function generateSixDigitCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

async function issueVerificationCode(userId: string, email: string): Promise<void> {
  const code = generateSixDigitCode();
  const expiresAt = new Date(Date.now() + VERIFICATION_CODE_TTL_MINUTES * 60_000);
  await prisma.verificationCode.create({
    data: { userId, code, expiresAt, lastSentAt: new Date() },
  });
  await sendEmail(email, verificationCodeEmail(code));
}

// PRD v3 5.1.5: while a still-valid code exists, don't mint a new one --
// re-send the same code, but only once the resend cooldown has elapsed.
async function resendOrIssueVerificationCode(userId: string, email: string): Promise<void> {
  const now = new Date();
  const existingCode = await prisma.verificationCode.findFirst({
    where: { userId, consumedAt: null },
    orderBy: { expiresAt: "desc" },
  });

  if (existingCode && existingCode.expiresAt > now) {
    const cooldownEndsAt = new Date(
      existingCode.lastSentAt.getTime() + RESEND_COOLDOWN_SECONDS * 1000,
    );
    if (cooldownEndsAt > now) {
      return; // Still within cooldown -- response stays identical either way.
    }
    await prisma.verificationCode.update({
      where: { id: existingCode.id },
      data: { lastSentAt: now },
    });
    await sendEmail(email, verificationCodeEmail(existingCode.code));
    return;
  }

  await issueVerificationCode(userId, email);
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const json = await request.json().catch(() => null);
  const parsed = signupSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { email, password } = parsed.data;

  const rateLimit = await checkRateLimit("signup", ip, email);
  if (!rateLimit.success) {
    return rateLimitedResponse(rateLimit);
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  let userId: string;

  if (!existingUser) {
    const passwordHash = await hashPassword(password);
    try {
      const user = await prisma.user.create({
        data: { email, passwordHash, emailVerified: null },
      });
      userId = user.id;
      await issueVerificationCode(userId, email);
    } catch (error) {
      if (!isUniqueConstraintViolation(error)) {
        throw error;
      }
      // Lost a race with a concurrent signup for the same email (PRD v3
      // 5.1.6's "fired twice quickly" case). The unique constraint on
      // User.email is what makes a duplicate row structurally impossible;
      // fall back to the existing-user path below.
      const racedUser = await prisma.user.findUniqueOrThrow({ where: { email } });
      userId = racedUser.id;
      if (!racedUser.emailVerified) {
        await resendOrIssueVerificationCode(userId, email);
      }
    }
  } else if (existingUser.emailVerified) {
    // PRD v3 5.1.4: generic response, nothing sent -- prevents account
    // enumeration via the signup endpoint.
    userId = existingUser.id;
  } else {
    userId = existingUser.id;
    await resendOrIssueVerificationCode(userId, email);
  }

  const token = await createVerifyEmailToken(userId);
  const response = NextResponse.json({ redirectTo: "/verify-email" });
  response.cookies.set(VERIFY_EMAIL_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: VERIFY_EMAIL_COOKIE_MAX_AGE_SECONDS,
  });
  return response;
}
