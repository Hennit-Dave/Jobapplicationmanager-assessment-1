# SKILL: Build Application Manager Track Auth Slice (v2)
*(updated for NextAuth.js)*

Use this skill when asked to build, extend, or fix code in this repository. Grounded entirely in PRD v3, AGENTS.md v2, and RULES-security-validation v2 — not on generic Auth.js tutorials found elsewhere. If a decision isn't covered by those three documents, stop and ask.

## When to use this skill
- Any request to implement a screen, flow, or engineering requirement from PRD v3.
- Any request to fix a bug in signup, signin, verification, reset, session handling, or dashboard protection.
- Any request to prepare evidence for DOCUMENTATION.md.

## Build order
1. Prisma schema — Auth.js's User (extended with `passwordHash`), Account, Session models, plus custom `verification_codes` and `password_reset_tokens` tables, exactly as specified in PRD v3 Section 6.
2. Auth.js configuration (`auth.ts` / `auth.config.ts`) — Prisma adapter, database session strategy, Credentials provider skeleton (no logic yet).
3. `lib/validation/auth.ts` — shared schemas.
4. `lib/auth/password.ts`.
5. `lib/auth/rateLimit.ts`.
6. `lib/email/` with the Resend client and a console fallback.
7. Signup flow (custom API route), including idempotency and duplicate-email behavior.
8. Email verification flow, including the direct adapter session creation.
9. Fill in the Credentials provider's `authorize()` callback for sign-in: rate limit check, `emailVerified` check, bcrypt comparison.
10. Forgot/reset password flow, including the atomic check-and-consume transaction and the bulk session delete.
11. Dashboard protection (Auth.js's `auth()` helper) and confirm `signOut()` works as expected.
12. `scripts/seed-auth-evidence.ts`.

## Before marking any flow "done"
Check it against the relevant items in RULES-security-validation.md. A flow isn't done because it works in the browser — it's done when the checklist items are all checked, including the ones that require hitting the API directly with curl.

## When producing evidence for documentation
Use the seed script to reach the required database states rather than waiting on real timers.

## What this skill does not cover
Anything from Assessments 2 to 4 (payments, AI integration, records/access). Those get their own PRDs, AGENTS.md files, and skill files. Do not install Flutterwave, Inngest, Deepseek, Google AI, or R2 dependencies in this repository under any circumstance.
