// Puts the database (and, for rate limiting, Redis) into the exact states
// PRD v3 Section 9 / AGENTS.md "Evidence obligations" ask for
// screenshots of, on demand -- rather than waiting on real 10-minute code
// expiries or firing 6 real requests by hand every time.
//
// Run with: npm run seed:evidence
import { prisma } from "../lib/prisma";
import { hashPassword } from "../lib/auth/password";
import { checkRateLimit } from "../lib/auth/rateLimit";

const EVIDENCE_PASSWORD = "evidence-password-123";

async function ensureUser(email: string, verified: boolean) {
  const passwordHash = await hashPassword(EVIDENCE_PASSWORD);
  return prisma.user.upsert({
    where: { email },
    update: { emailVerified: verified ? new Date() : null },
    create: {
      email,
      passwordHash,
      emailVerified: verified ? new Date() : null,
    },
  });
}

async function seedExpiredVerificationCode() {
  const user = await ensureUser("evidence-expired-code@example.com", false);
  await prisma.verificationCode.deleteMany({ where: { userId: user.id } });
  await prisma.verificationCode.create({
    data: {
      userId: user.id,
      code: "123456",
      expiresAt: new Date(Date.now() - 60_000), // already expired
      lastSentAt: new Date(Date.now() - 11 * 60_000),
    },
  });
  console.log(`[expired code]  ${user.email} -- verification_codes row with expiresAt in the past`);
}

async function seedUsedResetToken() {
  const user = await ensureUser("evidence-used-token@example.com", true);
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      token: `evidence-used-token-${Date.now()}`,
      expiresAt: new Date(Date.now() + 30 * 60_000),
      usedAt: new Date(), // already consumed
    },
  });
  console.log(`[used token]    ${user.email} -- password_reset_tokens row with usedAt set`);
}

async function seedRateLimitedAccount() {
  const email = "evidence-rate-limited@example.com";
  await ensureUser(email, true);
  const ip = "203.0.113.10"; // TEST-NET-3 (RFC 5737) -- never a real client IP.

  let result;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    result = await checkRateLimit("signin", ip, email);
  }
  console.log(
    `[rate limited]  signin from ip=${ip} email=${email} -- ${
      result?.success ? "NOT limited (unexpected)" : `limited, retry after ${result?.retryAfterSeconds}s`
    }`,
  );
}

async function main() {
  await seedExpiredVerificationCode();
  await seedUsedResetToken();
  await seedRateLimitedAccount();
  console.log(`\nAll evidence users share the password: ${EVIDENCE_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
