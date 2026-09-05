"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/validation/auth";

export default function ForgotPasswordPage() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [submittedMessage, setSubmittedMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  async function onSubmit(data: ForgotPasswordInput) {
    setServerError(null);
    setSubmittedMessage(null);

    const response = await fetch("/api/forgot-password", {
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
      setServerError("Something went wrong. Please try again.");
      return;
    }

    const body: { message: string } = await response.json();
    // PRD v3 5.4.1: the same generic message is shown whether or not the
    // account exists, so this screen can't be used to enumerate accounts.
    setSubmittedMessage(body.message);
  }

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <h1>Forgot password</h1>
        {serverError ? <p className="form-message error">{serverError}</p> : null}
        {submittedMessage ? (
          <p className="form-message success">{submittedMessage}</p>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                aria-invalid={errors.email ? "true" : "false"}
                {...register("email")}
              />
              {errors.email ? <p className="field-error">{errors.email.message}</p> : null}
            </div>
            <button className="primary-button" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}
        <div className="auth-links">
          <a href="/signin">Back to sign in</a>
        </div>
      </div>
    </main>
  );
}
