"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  resetPasswordSchema,
  getUnmetPasswordRequirements,
  type ResetPasswordInput,
} from "@/lib/validation/auth";
import { PasswordInput } from "@/components/PasswordInput";
import { PasswordRequirementsList } from "@/components/PasswordRequirementsList";

export default function ResetPasswordPage({ params }: { params: { token: string } }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token: params.token },
  });

  const passwordValue = watch("password") ?? "";
  const isFormComplete =
    passwordValue.length > 0 && getUnmetPasswordRequirements(passwordValue).length === 0;

  async function onSubmit(data: ResetPasswordInput) {
    setServerError(null);

    const response = await fetch("/api/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const body = await response.json();
      setServerError(body.error ?? "Something went wrong. Please try again.");
      return;
    }

    const body: { redirectTo: string } = await response.json();
    router.push(body.redirectTo);
  }

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <h1>Reset password</h1>
        {serverError ? <p className="form-message error">{serverError}</p> : null}
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <input type="hidden" {...register("token")} />
          <div className="field">
            <label htmlFor="password">New password</label>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              ariaInvalid={!!errors.password}
              value={passwordValue}
              registration={register("password")}
            />
            <PasswordRequirementsList value={passwordValue} />
          </div>
          <button
            className="primary-button"
            type="submit"
            disabled={isSubmitting || !isFormComplete}
          >
            {isSubmitting ? "Resetting…" : "Reset password"}
          </button>
        </form>
      </div>
    </main>
  );
}
