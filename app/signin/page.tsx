"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signinSchema, type SigninInput } from "@/lib/validation/auth";
import { PasswordInput } from "@/components/PasswordInput";

export default function SigninPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SigninInput>({ resolver: zodResolver(signinSchema) });

  const passwordValue = watch("password") ?? "";

  async function onSubmit(data: SigninInput) {
    setServerError(null);

    const response = await fetch("/api/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (response.status === 429) {
      const body = await response.json();
      setServerError(`Too many attempts. Try again in ${body.retryAfterSeconds} seconds.`);
      return;
    }

    if (response.status === 403) {
      const body = await response.json();
      if (body.code === "email-not-verified") {
        router.push("/verify-email");
        return;
      }
      setServerError(body.error);
      return;
    }

    if (!response.ok) {
      const body = await response.json();
      setServerError(body.error ?? "Invalid email or password.");
      return;
    }

    const body: { redirectTo: string } = await response.json();
    router.push(body.redirectTo);
    router.refresh();
  }

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <h1>Sign in</h1>
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
            <PasswordInput
              id="password"
              autoComplete="current-password"
              ariaInvalid={!!errors.password}
              value={passwordValue}
              registration={register("password")}
            />
            {errors.password ? (
              <p className="field-error">{errors.password.message}</p>
            ) : null}
          </div>
          <button className="primary-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <div className="auth-links">
          <a href="/signup">Need an account? Sign up</a>
          <a href="/forgot-password">Forgot password?</a>
        </div>
      </div>
    </main>
  );
}
