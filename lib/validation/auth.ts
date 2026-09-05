import { z } from "zod";

// Single source of truth for every auth form's validation rules
// (RULES-security-validation.md "Validation rules": one Zod rule per
// field, in this file, imported by both the client form's resolver and
// the server route handler -- never redefined inline in either place).

// PRD v3 does not specify a password complexity policy beyond "hash with
// bcrypt at cost 12". The requirements below were added per product
// request. Defined once here -- rather than as separate client-only
// checks -- so the signup form's live checklist and this schema can
// never drift apart, and so the server independently rejects a weak
// password even if a request bypasses the client entirely (RULES-
// security-validation.md: "server-side validation runs even though
// client-side validation exists").
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Email is required")
  .email("Enter a valid email address");

export interface PasswordRequirement {
  id: string;
  label: string;
  test: (value: string) => boolean;
}

export const PASSWORD_MIN_LENGTH = 8;

// Order matters only for schema error ordering; the signup form decides
// its own display order independently.
export const PASSWORD_REQUIREMENTS: readonly PasswordRequirement[] = [
  {
    id: "lowercase",
    label: "Password must contain a lowercase letter",
    test: (value) => /[a-z]/.test(value),
  },
  {
    id: "uppercase",
    label: "Password must contain an uppercase letter",
    test: (value) => /[A-Z]/.test(value),
  },
  {
    id: "number",
    label: "Password must contain a number",
    test: (value) => /[0-9]/.test(value),
  },
  {
    id: "special",
    label: "Password must contain a special character (#@>^).",
    test: (value) => /[#@>^]/.test(value),
  },
  {
    id: "length",
    label: "Minimum Of 8 Characters",
    test: (value) => value.length >= PASSWORD_MIN_LENGTH,
  },
];

export const passwordSchema = z.string().superRefine((value, ctx) => {
  for (const requirement of PASSWORD_REQUIREMENTS) {
    if (!requirement.test(value)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: requirement.label });
    }
  }
});

// Shared by every form with a live password-requirements checklist
// (signup, reset-password) so they can never drift from each other or
// from passwordSchema above.
export function getUnmetPasswordRequirements(value: string): PasswordRequirement[] {
  return PASSWORD_REQUIREMENTS.filter((requirement) => !requirement.test(value));
}

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
