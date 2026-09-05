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

  const { error } = await resendClient.emails.send({
    from: emailFrom,
    to,
    subject: content.subject,
    html: content.html,
    text: content.text,
  });

  if (error) {
    throw new Error(`Failed to send email via Resend: ${error.message}`);
  }
}

export * from "./templates";
