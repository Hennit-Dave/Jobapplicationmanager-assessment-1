# PRD — Application Manager Track Authentication Slice (Assessment 1) — Revised v3
*(supersedes v2: stack updated to NextAuth.js per your confirmed stack; adds an explicit avoid/do-not-build section and master stack context)*

## 0. What changed from v2
v2 assumed hand-rolled sessions. This version uses **NextAuth.js (Auth.js v5)** with the Prisma adapter and database session strategy instead, per your confirmed stack. The security properties from the v2 debate — an opaque session ID in the cookie, trivial revocation, no embedded claims — are preserved, since Auth.js's database session strategy delivers the same guarantees natively. Signup, email verification, and password reset stay fully custom, since Auth.js's Credentials provider only covers sign-in.

## 1. Overview
Application Manager Track is a working-title AI-powered job application manager. This repository delivers only the authentication slice required by Assessment 1: a complete signup-to-dashboard flow, with nothing else built around it. Assessments 2 through 4 will be separate repositories that reuse this authentication code.

## 2. Master stack context
This repository is Assessment 1 of four. The confirmed stack across all four slices is: Next.js 14, Prisma, PostgreSQL, NextAuth.js (built here, reused in 2 to 4), Inngest (Assessment 3 only), Flutterwave with NGN as the currency (Assessment 2 only), Deepseek and Google AI (Assessment 3 only), Cloudflare R2 (Assessment 3 only). See the master stack reference document for the full breakdown.

**This repository uses only:** Next.js 14, Prisma, PostgreSQL, NextAuth.js, bcrypt, Zod, Upstash Redis, Resend. It does not install or reference Flutterwave, Inngest, Deepseek, Google AI, or Cloudflare R2.

## 3. Users
A single user role. No admin, no teams, no organizations.

## 4. Screens
| Screen | Route | Purpose |
|---|---|---|
| Create account | /signup | Collect email + password, create unverified account |
| Sign in | /signin | Authenticate returning users |
| Forgot password | /forgot-password | Request a reset link |
| Reset password | /reset-password/[token] | Set a new password from a valid, unused token |
| Email verification | /verify-email | Enter emailed code; resend control with cooldown |
| Dashboard (placeholder) | /dashboard | Signed-in user's name + sign out button. Nothing else. |

## 5. User flows

### 5.1 Sign up (custom, outside NextAuth)
1. User submits email + password on /signup, via a custom API route, not an Auth.js provider.
2. Server validates via the shared schema, checks for an existing email (case-insensitive).
3. Email doesn't exist: create a `User` row (`emailVerified: null`), hash the password (bcrypt, cost 12) into `passwordHash`, generate a 6-digit code (10-minute expiry) in `verification_codes`, send via Resend, record `lastSentAt`.
4. Email exists and is verified: return a generic success response without sending anything, to prevent account enumeration.
5. Email exists and is unverified: do not create a new code while the existing one is still valid; re-send the existing code once, respecting the cooldown.
6. A duplicate signup request for the same new email within the idempotency window returns the same 200 response as the first, and the database ends up with exactly one row.
7. User is redirected to /verify-email with a short-lived, signed token scoped only to that screen. No Auth.js session yet.

### 5.2 Email verification (custom, then hands off to Auth.js's session store)
1. User enters the 6-digit code, authenticated by the verification-scoped token.
2. Server checks the code against `verification_codes` and its database expiry.
3. On success: mark the code consumed, set `User.emailVerified = now()`, and create a session **directly via the Auth.js Prisma adapter** rather than re-running the Credentials provider, since that would require the plaintext password again. The resulting session cookie is set using Auth.js's own cookie name and format, so the rest of the app treats this exactly like a normal Auth.js sign-in.
4. Redirect to /dashboard.
5. Resend is gated by a server-enforced 60-second cooldown from `lastSentAt`.

### 5.3 Sign in (via Auth.js's Credentials provider)
1. User submits email + password on /signin.
2. The Credentials provider's `authorize()` callback runs: rate-limit check (IP + email) first, then look up the user, reject if `emailVerified` is null (directing them to verify), then bcrypt-compare the password.
3. On success, Auth.js's adapter creates the session row and cookie automatically via the database session strategy.

### 5.4 Forgot / reset password (custom)
1. User requests a reset by email; server always returns the same generic response whether or not the account exists.
2. If the account exists, generate a single-use, 30-minute reset token in `password_reset_tokens` and email it as a link.
3. On /reset-password/[token], one atomic transaction checks the token is unexpired and unused, marks it used, and accepts the new password in the same operation.
4. The new password is hashed and saved. All `Session` rows for that user are deleted directly, forcing re-authentication everywhere.

### 5.5 Protected dashboard
1. /dashboard is checked via Auth.js's `auth()` helper in a server component or middleware, before any content renders.
2. No valid session: redirect to /signin.

### 5.6 Sign out
1. Auth.js's built-in `signOut()` deletes the session row via the adapter and clears the cookie.

## 6. Data model (Auth.js Prisma adapter schema + custom tables)

**User** (Auth.js standard model, extended) — id, email (unique), emailVerified (DateTime, nullable — null means unverified), passwordHash (custom addition), createdAt

**Account** — Auth.js standard model, required by the Prisma adapter's schema contract. Unused in this slice since there's no OAuth provider, kept rather than forking a custom adapter schema to remove one unused table.

**Session** — Auth.js standard model: id, sessionToken, userId (FK, cascade delete), expires. This is what the cookie's opaque value maps to.

**verification_codes** (custom) — id, userId (FK), code, expiresAt, consumedAt (nullable), lastSentAt

**password_reset_tokens** (custom) — id, userId (FK), token (unique), expiresAt, usedAt (nullable)

Auth.js's own `VerificationToken` model is **omitted** — it exists for Auth.js's Email (magic-link) provider, which this slice doesn't use.

**Which constraints make an invalid state impossible:**
- Unique constraint on `User.email` — two accounts with the same email is structurally impossible regardless of a signup-handler bug.
- Cascade-delete foreign keys on `Session`, `verification_codes`, `password_reset_tokens` — an orphaned row pointing at a deleted user is impossible.
- `usedAt` / `consumedAt`, checked and set inside the same transaction as the state change — token or code replay is impossible even under concurrent requests.

## 7. Engineering requirements
- Password hashing: bcrypt, cost 12, entirely custom — Auth.js's Credentials provider doesn't hash for you.
- Shared Zod schemas in `lib/validation/auth.ts`, imported by client forms and every custom API route.
- Rate limiting (Upstash Redis), keyed on IP + email, applied to: /api/signup, /api/forgot-password, /api/verify-email/resend, and inside the Credentials provider's `authorize()` callback for sign-in.
- Session cookie: Auth.js's default database-session cookie — httpOnly, secure, sameSite=lax by default; confirm and document the exact config in `auth.config.ts`.
- Verification codes and reset tokens expire in the database and are checked there on every use, inside a transaction that also consumes them.
- Unique constraint on `User.email`.
- Idempotent signup returning identical 200 responses for duplicate submissions.
- Dashboard protection via Auth.js's `auth()` helper, checked server-side before render.
- Labels programmatically bound to inputs and visible focus states, built into each screen as it's developed.
- A seed/reset script that can reach the states needed for the required screenshots (expired code, used token, rate-limited account) on demand.

## 8. Concepts to document
Password hashing, rate limiting, client-side vs. server-side validation, session management (specifically why database sessions via Auth.js's adapter rather than JWT), token/code expiry, idempotency, database constraints as a last line of defense, protected routes, and why signup, verification, and reset are built outside Auth.js's provider system while sign-in and sign-out use it directly — this last one is a genuine architecture decision worth its own Section 5 subheading.

## 9. Evidence to capture during build
- Screenshot of the `User` table showing a bcrypt hash, no plaintext password.
- The exact curl command hitting /api/signup directly, and the response.
- A triggered rate limit response (status code + retry indication).
- A verification code row before and after expiry.
- A screenshot showing the same signup request submitted twice producing one user row.
- A screenshot of the `Session` table before and after sign out, and before and after a password reset.

## 10. Avoid / Do not build
Directly from the assessment brief. Treat every line here as a hard boundary, not a suggestion:
- No landing page or marketing page.
- No dashboard content beyond the user's name and a sign-out button.
- No profile editing, no settings screen, no social sign-in (no OAuth providers added to Auth.js), no two-factor authentication.
- No validating only on the client and treating that as sufficient — every rule must also be enforced server-side.
- No verification code or reset token whose only expiry is a countdown in the UI — the database check is what counts.
- No committing `.env` — verify in a private browser window before submission, not from memory.
- No rate limiting signin while forgetting the resend endpoint.
- No installing or referencing Flutterwave, Inngest, Deepseek, Google AI, or Cloudflare R2 in this repository — those belong to Assessments 2 and 3.

## 11. Open questions
None blocking.
