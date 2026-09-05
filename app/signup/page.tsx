"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signupSchema, type SignupInput } from "@/lib/validation/auth";

export default function SignupPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({ resolver: zodResolver(signupSchema) });

  async function onSubmit(data: SignupInput) {
    setServerError(null);

    // Client-side validation (via zodResolver above) is a UX convenience
    // only. The server re-validates with the same schema and is the
    // check that actually matters (RULES-security-validation.md).
    const response = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (response.status === 429) {
      const body = await response.json();
      setServerError(
        `Too many attempts. Try again in ${body.retryAfterSeconds} seconds.`,
      );
      return;
    }

    if (!response.ok) {
      setServerError("Something went wrong. Please try again.");
      return;
    }

    const body: { redirectTo: string } = await response.json();
    router.push(body.redirectTo);
  }

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <h1>Create your account</h1>
        {serverError ? <p className="form-message error">{serverError}</p> : null}
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
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              aria-invalid={errors.password ? "true" : "false"}
              {...register("password")}
            />
            {errors.password ? (
              <p className="field-error">{errors.password.message}</p>
            ) : null}
          </div>
          <button className="primary-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating account…" : "Create account"}
          </button>
        </form>
        <div className="auth-links">
          <a href="/signin">Already have an account? Sign in</a>
        </div>
      </div>
    </main>
  );
}
