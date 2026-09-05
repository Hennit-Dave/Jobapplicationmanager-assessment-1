"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { verifyEmailCodeSchema, type VerifyEmailCodeInput } from "@/lib/validation/auth";

export default function VerifyEmailPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<VerifyEmailCodeInput>({ resolver: zodResolver(verifyEmailCodeSchema) });

  async function onSubmit(data: VerifyEmailCodeInput) {
    setServerError(null);
    setResendMessage(null);

    const response = await fetch("/api/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (response.status === 429) {
      const body = await response.json();
      setServerError(`Too many attempts. Try again in ${body.retryAfterSeconds} seconds.`);
      return;
    }

    if (!response.ok) {
      const body = await response.json();
      setServerError(body.error ?? "That code didn't work. Please try again.");
      return;
    }

    const body: { redirectTo: string } = await response.json();
    router.push(body.redirectTo);
  }

  async function onResend() {
    setServerError(null);
    setResendMessage(null);
    setIsResending(true);
    try {
      const response = await fetch("/api/verify-email/resend", { method: "POST" });
      const body = await response.json();
      if (!response.ok) {
        setServerError(
          body.retryAfterSeconds
            ? `${body.error} (${body.retryAfterSeconds}s)`
            : body.error ?? "Couldn't resend the code. Please try again.",
        );
        return;
      }
      setResendMessage("A new code has been sent if one was needed.");
    } finally {
      setIsResending(false);
    }
  }

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <h1>Verify your email</h1>
        <p>Enter the 6-digit code we emailed you. It expires in 10 minutes.</p>
        {serverError ? <p className="form-message error">{serverError}</p> : null}
        {resendMessage ? <p className="form-message success">{resendMessage}</p> : null}
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="field">
            <label htmlFor="code">Verification code</label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              aria-invalid={errors.code ? "true" : "false"}
              {...register("code")}
            />
            {errors.code ? <p className="field-error">{errors.code.message}</p> : null}
          </div>
          <button className="primary-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Verifying…" : "Verify email"}
          </button>
        </form>
        <button
          className="link-button"
          type="button"
          onClick={onResend}
          disabled={isResending}
        >
          {isResending ? "Sending…" : "Resend code"}
        </button>
      </div>
    </main>
  );
}
