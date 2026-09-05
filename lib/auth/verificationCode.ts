import { randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sendEmail, verificationCodeEmail } from "@/lib/email";

const VERIFICATION_CODE_TTL_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 60;

function generateSixDigitCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export async function issueVerificationCode(userId: string, email: string): Promise<void> {
  const code = generateSixDigitCode();
  const expiresAt = new Date(Date.now() + VERIFICATION_CODE_TTL_MINUTES * 60_000);
  await prisma.verificationCode.create({
    data: { userId, code, expiresAt, lastSentAt: new Date() },
  });
  await sendEmail(email, verificationCodeEmail(code));
}

export interface ResendResult {
  sent: boolean;
  /** Set when skipped because the resend cooldown hasn't elapsed yet. */
  cooldownRemainingSeconds?: number;
}

// Shared by /api/signup (re-signing-up with an unverified email) and
// /api/verify-email/resend. PRD v3 5.1.5 / 5.2.5: don't mint a new code
// while a still-valid one exists; re-send it, but only once the
// server-enforced 60s cooldown (read from the database, never client
// state) has elapsed.
export async function resendOrIssueVerificationCode(
  userId: string,
  email: string,
): Promise<ResendResult> {
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
      return {
        sent: false,
        cooldownRemainingSeconds: Math.ceil(
          (cooldownEndsAt.getTime() - now.getTime()) / 1000,
        ),
      };
    }
    await prisma.verificationCode.update({
      where: { id: existingCode.id },
      data: { lastSentAt: now },
    });
    await sendEmail(email, verificationCodeEmail(existingCode.code));
    return { sent: true };
  }

  await issueVerificationCode(userId, email);
  return { sent: true };
}
