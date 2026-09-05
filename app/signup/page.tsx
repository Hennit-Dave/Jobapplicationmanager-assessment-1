"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  signupSchema,
  PASSWORD_REQUIREMENTS,
  type SignupInput,
} from "@/lib/validation/auth";

function EyeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M1 10s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M2.5 2.5l15 15M8.4 8.5a2.5 2.5 0 0 0 3.1 3.1M6 4.7C7.2 4.2 8.5 4 10 4c5.5 0 9 6 9 6a15.6 15.6 0 0 1-3.3 3.9M4.3 6.1A15.9 15.9 0 0 0 1 10s3.5 6 9 6c1 0 1.9-.1 2.8-.4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Loose heuristic used only for the live "keep typing" nudge below --
// distinct from (and looser than) the actual email validity check the
// shared Zod schema runs on submit.
function hasContentAfterAt(value: string): boolean {
  const atIndex = value.indexOf("@");
  return atIndex !== -1 && atIndex < value.length - 1;
}

export default function SignupPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({ resolver: zodResolver(signupSchema) });

  const emailValue = watch("email") ?? "";
  const passwordValue = watch("password") ?? "";

  const showEmailHint = emailValue.length > 0 && !hasContentAfterAt(emailValue);
  const unmetPasswordRequirements = PASSWORD_REQUIREMENTS.filter(
    (requirement) => !requirement.test(passwordValue),
  );
  const isFormComplete =
    emailValue.trim().length > 0 &&
    passwordValue.length > 0 &&
    unmetPasswordRequirements.length === 0;

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
            {showEmailHint ? (
              <p className="field-error">Enter A Valid Email Address.</p>
            ) : errors.email ? (
              <p className="field-error">{errors.email.message}</p>
            ) : null}
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <div className="password-input-wrapper">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                aria-invalid={errors.password ? "true" : "false"}
                {...register("password")}
              />
              {passwordValue.length > 0 ? (
                <button
                  type="button"
                  className="password-toggle-button"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              ) : null}
            </div>
            {passwordValue.length > 0 && unmetPasswordRequirements.length > 0 ? (
              <ul className="password-requirements">
                {unmetPasswordRequirements.map((requirement) => (
                  <li key={requirement.id}>{requirement.label}</li>
                ))}
              </ul>
            ) : null}
          </div>
          <button
            className="primary-button"
            type="submit"
            disabled={isSubmitting || !isFormComplete}
          >
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
