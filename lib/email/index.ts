import { Resend } from "resend";
import type { EmailContent } from "./templates";

// AGENTS.md: "Resend for transactional email, with a console-log
// fallback for local dev." No RESEND_API_KEY configured -> log the
// email instead of sending it, so local development never requires a
// real Resend account.
const resendApiKey = process.env.RESEND_API_KEY;
const resendClient = resendApiKey ? new Resend(resendApiKey) : null;
const emailFrom =
  process.env.EMAIL_FROM ?? "Application Manager Track <onboarding@resend.dev>";

export async function sendEmail(to: string, content: EmailContent): Promise<void> {
  if (!resendClient) {
    console.log(
      `[email:console-fallback] to=${to} subject="${content.subject}"\n${content.text}`,
    );
    return;
  }

  // By the time this is called, the state that actually matters (the
  // User row, the verification code, the reset token) is already
  // durably written to the database. Email delivery is a best-effort
  // side effect on top of that -- a provider failure (rejected
  // recipient, outage, etc.) must not crash the request and hide an
  // otherwise-successful signup/resend/reset behind a 500. The resend
  // and forgot-password endpoints already give the user a way to try
  // again if a message never arrives.
  try {
    const { error } = await resendClient.emails.send({
      from: emailFrom,
      to,
      subject: content.subject,
      html: content.html,
      text: content.text,
    });

    if (error) {
      throw new Error(error.message);
    }
  } catch (error) {
    console.error(`[email] Failed to send to ${to}:`, error);
  }
}

export * from "./templates";
