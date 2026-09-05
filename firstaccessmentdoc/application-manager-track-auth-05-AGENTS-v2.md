# AGENTS.md — Application Manager Track Auth Slice (v2)
*(supersedes v1: stack updated to NextAuth.js; see PRD v3 for full reasoning)*

## Scope discipline
- Build only what PRD v3 Sections 4 to 5 describe. Do not add anything from the Avoid list in PRD v3 Section 10, even if it would be quick.
- This repository is Assessment 1 of four. Do not install or reference Flutterwave, Inngest, Deepseek, Google AI, or Cloudflare R2 — those belong to later assessments and have no place here.

## Stack (fixed, do not substitute)
- Next.js 14, App Router, TypeScript strict.
- Prisma + PostgreSQL.
- **NextAuth.js (Auth.js v5)** with `@auth/prisma-adapter`, database session strategy, and a Credentials provider for sign-in.
- bcrypt (or bcryptjs), cost factor 12, for password hashing — done manually inside the Credentials provider's `authorize()` callback and inside the custom signup/reset routes. Auth.js does not hash passwords for you.
- Zod for all validation schemas, defined once in `lib/validation/auth.ts`.
- Upstash Redis for rate limiting.
- Resend for transactional email, with a console-log fallback for local dev.

## What NextAuth.js handles vs. what stays custom
- **Handled by Auth.js:** sign-in session creation, the session cookie, sign-out, dashboard protection via the `auth()` helper.
- **Stays fully custom, outside any Auth.js provider:** signup, email verification (6-digit code), password reset. These write directly to Prisma and, on success, either hand off to sign-in or create a session directly via the adapter (verification does this — see PRD v3 Section 5.2).

## Non-negotiable engineering rules
1. Every password is hashed with bcrypt before it touches the database, inside the Credentials provider's `authorize()` and the custom signup/reset routes. No plaintext password is ever logged, stored, or returned in any API response.
2. Every verification code and reset token check happens against the database, inside a transaction that also consumes it.
3. Dashboard access is checked server-side via Auth.js's `auth()` helper before any content is rendered. A client-side redirect after render is not acceptable.
4. Signup is idempotent: a duplicate request for the same new email returns the same 200 response, and the database ends up with exactly one row.
5. Rate limiting keys combine IP and account identifier, applied to signup, the Credentials provider's `authorize()` callback, forgot-password, and verification resend.
6. The session cookie is Auth.js's own database-session cookie — never a custom JWT, never extra claims layered in.
7. Password reset deletes every `Session` row for that user, forcing re-authentication everywhere.
8. `.env` is in `.gitignore` from the first commit. `.env.example` is committed with placeholder values and a comment on where each real value comes from.
9. Every form input has a label programmatically bound via `htmlFor`/`id`, and every interactive element has a visible focus state.

## The "still a failure if broken?" test
Every rule above passes it: if an agent violates one silently, the assessment fails. A stylistic preference that wouldn't cause a failure belongs in a separate style note, not here.

## Evidence obligations
The build is not complete until these can be produced without extra work:
- A way to view the `User` table and see a bcrypt hash, not plaintext.
- The exact curl command for direct signup, documented in the repo.
- A way to trigger and observe the rate limiter's response.
- A way to view a verification code before and after its expiry.
- A way to view the `Session` table before and after sign out and before and after a password reset.

## File structure expectations
- `lib/validation/auth.ts` — shared Zod schemas.
- `auth.config.ts` / `auth.ts` — Auth.js configuration: Prisma adapter, database session strategy, Credentials provider.
- `lib/auth/password.ts` — hashing and verification, used by the Credentials provider and custom routes.
- `lib/auth/rateLimit.ts` — Upstash Redis limiter wrapper.
- `lib/email/` — Resend client and templates, with a local console fallback.
- `scripts/seed-auth-evidence.ts` — puts the database into states needed for screenshots.
- `prisma/schema.prisma` — Auth.js's User, Account, Session models (Account unused but present for adapter compatibility), plus the custom `verification_codes` and `password_reset_tokens` tables. Auth.js's `VerificationToken` model is omitted.

## Commit hygiene
Commit incrementally as each flow is completed, not in one commit at the end.
