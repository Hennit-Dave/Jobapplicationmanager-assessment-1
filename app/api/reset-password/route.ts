import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resetPasswordSchema } from "@/lib/validation/auth";
import { hashPassword } from "@/lib/auth/password";

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = resetPasswordSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { token, password } = parsed.data;
  const now = new Date();

  // Hashed before the transaction starts so the (relatively slow) bcrypt
  // work doesn't hold a database transaction open.
  const passwordHash = await hashPassword(password);

  // PRD v3 5.4.3-4: one atomic transaction checks the token is unexpired
  // and unused, marks it used, saves the new password, and deletes every
  // Session row for that user -- all together, so there's no window
  // where the old password's sessions outlive the change, and no way for
  // a concurrent request to reuse the same token.
  const userId = await prisma.$transaction(async (tx) => {
    const resetToken = await tx.passwordResetToken.findFirst({
      where: { token, usedAt: null, expiresAt: { gt: now } },
    });

    if (!resetToken) {
      return null;
    }

    await tx.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: now },
    });

    await tx.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    });

    await tx.session.deleteMany({ where: { userId: resetToken.userId } });

    return resetToken.userId;
  });

  if (!userId) {
    return NextResponse.json({ error: "Invalid or expired reset link." }, { status: 400 });
  }

  return NextResponse.json({ redirectTo: "/signin" });
}
