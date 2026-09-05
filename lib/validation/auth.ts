import { z } from "zod";

// Single source of truth for every auth form's validation rules
// (RULES-security-validation.md "Validation rules": one Zod rule per
// field, in this file, imported by both the client form's resolver and
// the server route handler -- never redefined inline in either place).

// PRD v3 does not specify a password complexity policy beyond "hash with
// bcrypt at cost 12". A minimum length is the one property that must be
// enforced before hashing (bcrypt truncates/ignores extremely long
// inputs, and an empty or trivial password defeats the point of hashing
// at all), so an 8-character minimum is applied as a standard default.
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Email is required")
  .email("Enter a valid email address");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters");

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});
export type SignupInput = z.infer<typeof signupSchema>;

export const signinSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});
export type SigninInput = z.infer<typeof signinSchema>;

export const verifyEmailCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code"),
});
export type VerifyEmailCodeInput = z.infer<typeof verifyEmailCodeSchema>;

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Missing reset token"),
  password: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
