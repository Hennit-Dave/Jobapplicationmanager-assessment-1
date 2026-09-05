export interface EmailContent {
  subject: string;
  text: string;
  html: string;
}

export function verificationCodeEmail(code: string): EmailContent {
  const subject = "Verify your email";
  const text = `Your verification code is ${code}. It expires in 10 minutes.`;
  const html = `<p>Your verification code is <strong>${code}</strong>.</p><p>It expires in 10 minutes. If you didn't request this, you can ignore this email.</p>`;
  return { subject, text, html };
}

export function passwordResetEmail(resetUrl: string): EmailContent {
  const subject = "Reset your password";
  const text = `Reset your password by visiting: ${resetUrl}\nThis link expires in 30 minutes and can only be used once.`;
  const html = `<p><a href="${resetUrl}">Reset your password</a></p><p>This link expires in 30 minutes and can only be used once. If you didn't request this, you can ignore this email.</p>`;
  return { subject, text, html };
}
