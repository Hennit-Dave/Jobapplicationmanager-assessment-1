# Rules — Security & Validation (Application Manager Track Auth Slice, v2)
*(updated for NextAuth.js — see PRD v3 and AGENTS.md v2)*

## Validation rules
- [ ] Every form field has a Zod rule in `lib/validation/auth.ts`, not inline in a component or route handler.
- [ ] The client form's resolver imports the same schema object used server-side.
- [ ] Server-side validation runs even though client-side validation exists. Confirmed by hitting the API directly with curl and a bad payload.

## Password rules
- [ ] Passwords are hashed with bcrypt at cost 12 before any database write.
- [ ] No code path logs, stores, or returns a plaintext password.
- [ ] Password hashing happens in exactly three places: the Credentials provider's `authorize()` callback (comparison), the signup route (creation), and the reset route (creation) — confirmed no fourth spot exists.

## Session rules (updated for Auth.js)
- [ ] Session strategy is set to `"database"` in the Auth.js config, not `"jwt"`.
- [ ] The session cookie is Auth.js's default cookie, inspected once in dev tools to confirm it holds an opaque token, not a decodable JWT with claims.
- [ ] Sign-in via the Credentials provider results in exactly one new `Session` row.
- [ ] Email verification creates a session by calling the adapter directly, not by re-running the Credentials provider with a stored password.
- [ ] Password reset deletes all `Session` rows for that user in one operation, confirmed by checking the table directly after a reset.
- [ ] Sign out (Auth.js's `signOut()`) removes the corresponding `Session` row, confirmed by checking the table.

## Token / code rules
- [ ] Verification codes and reset tokens have a database `expiresAt` checked on every use.
- [ ] Reset tokens have a `usedAt` column checked and set inside the same transaction as the password change.
- [ ] The resend cooldown is read from a database timestamp (`lastSentAt`), not from client state.

## Rate limiting rules
- [ ] Signup, forgot-password, and verification-resend endpoints are all covered.
- [ ] The Credentials provider's `authorize()` callback checks the rate limiter before doing any bcrypt comparison, so a rate-limited request never touches the password check.
- [ ] Rate limit keys combine IP and account identifier where one is available.
- [ ] A rate-limited response returns 429 with a retry indication.

## Access control rules
- [ ] The dashboard route's session check uses Auth.js's `auth()` helper, called server-side before render.
- [ ] Confirmed by requesting /dashboard with curl and no cookie — the result is a redirect, never page content.

## Data integrity rules
- [ ] `User.email` has a real database-level unique constraint.
- [ ] Foreign keys from `Session`, `verification_codes`, and `password_reset_tokens` to `User` cascade on delete.
- [ ] A duplicate signup for the same new email, fired twice quickly, results in exactly one row in `User`.

## Stack boundary rule
- [ ] `package.json` contains no reference to Flutterwave, Inngest, Deepseek, Google AI SDKs, or an S3/R2 client. Anything from that list is removed — it belongs to a later assessment.
