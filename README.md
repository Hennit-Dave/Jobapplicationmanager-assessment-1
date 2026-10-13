# Application Manager Track — Authentication Slice

The complete authentication system for **Application Manager Track**, an AI-powered job application manager that helps tailor your CV to a specific job description. This repo is **Assessment 1 of 4**: it contains auth and nothing else, so the auth logic can be judged on its own.

Users can sign up, verify their email with a 6-digit code, sign in, reset a forgotten password, and sign out. The flow ends at a deliberately bare dashboard: the signed-in user's email and a sign-out button.

> For the full write-up — every flow step by step, design decisions, what went wrong, and evidence screenshots — see **[DOCUMENTATION.md](DOCUMENTATION.md)**.

---

## Features

- **Sign up** with email + password, with a live password-requirements checklist
- **Email verification** via a 6-digit code (10-minute expiry, 60-second resend cooldown)
- **Sign in** through a custom route backed by Auth.js database sessions
- **Forgot / reset password** with single-use, 30-minute reset links
- **Protected dashboard** checked on the server before anything renders
- **Sign out** that deletes the session row, not just the cookie
- Password visibility toggle on sign-in

## Security highlights

| Concern | How it's handled |
|---|---|
| Password storage | bcrypt (`bcryptjs`), cost factor 12. Plaintext is never stored. |
| Sessions | Auth.js **database** strategy. The cookie holds an opaque ID; deleting the `Session` row revokes access instantly. |
| Password reset | Token check, token use, password update, and deleting **every** session for that user happen in one transaction. |
| Rate limiting | Upstash Redis sliding windows keyed on IP + email, on signup, sign-in, forgot-password, verification resend **and** code submission. Returns `429` with `Retry-After`. |
| Account enumeration | Signup and forgot-password return the same response whether or not the account exists. |
| Duplicate signups | Enforced by the `User.email` unique constraint; a concurrent duplicate catches `P2002` and falls back gracefully. |
| Validation | One set of Zod schemas in `lib/validation/auth.ts`, shared by client forms and server routes. |
| Code replay / expiry | `expiresAt` and `consumedAt` checked inside the same transaction that consumes the code. |
| Email failures | A Resend outage is logged, not thrown, so it can't turn a successful signup into a 500. |

### Rate limits

| Endpoint | Limit |
|---|---|
| `POST /api/signup` | 5 / 10 min |
| `POST /api/signin` | 5 / 5 min |
| `POST /api/forgot-password` | 5 / 15 min |
| `POST /api/verify-email/resend` | 5 / 10 min |
| `POST /api/verify-email` | 5 / 10 min |

### Password rules

At least 8 characters, with a lowercase letter, an uppercase letter, a number, and one of `# @ > ^`. Defined once in `PASSWORD_REQUIREMENTS` and used by both the schema and the UI checklist.

## Tech stack

- **Next.js 14** (App Router) + **TypeScript**
- **Auth.js v5** (`next-auth` beta) with the **Prisma adapter**
- **Prisma** + **PostgreSQL**
- **Upstash Redis** (`@upstash/ratelimit`) for rate limiting
- **Resend** for transactional email (console fallback in dev)
- **Zod** + **react-hook-form** for validation
- **jose** for the short-lived verify-email token
- Design tokens (`tokens.json` → `tokens.css`) with Fraunces, Inter and JetBrains Mono

## Getting started

### Prerequisites

- Node.js 20+
- A PostgreSQL database (local, Neon, Supabase, etc.)
- An Upstash Redis database (required — rate limiting runs on every auth endpoint)
- A Resend API key (optional — without one, emails are printed to the server console)

### Setup

```bash
git clone https://github.com/Hennit-Dave/Jobapplicationmanager-assessment-1.git
cd Jobapplicationmanager-assessment-1
npm install
cp .env.example .env
```

Fill in `.env`:

| Variable | What it is |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | Auth.js secret — `openssl rand -base64 32` |
| `NEXTAUTH_URL` | App base URL, e.g. `http://localhost:3000` |
| `VERIFY_EMAIL_TOKEN_SECRET` | Signs the post-signup verify-email token — `openssl rand -base64 32` |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | From the Upstash console (REST API section) |
| `RESEND_API_KEY` | From the Resend dashboard. Leave empty to log emails to the console instead. |
| `EMAIL_FROM` | Sender address. `onboarding@resend.dev` works in Resend's sandbox, but only delivers to your own account email. |

Then run the migrations and start the app:

```bash
npx prisma migrate dev
npm run dev
```

Open **http://localhost:3000/signup**. (`/` simply redirects to `/signin` — there's no landing page by design.)

### Scripts

| Command | Does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run prisma:migrate` | Run Prisma migrations |
| `npm run seed:evidence` | Seed the states needed for evidence screenshots (expired code, used reset token, rate-limited account) without waiting on real timers |

## Routes

### Pages

| Route | Purpose |
|---|---|
| `/signup` | Create an account |
| `/verify-email` | Enter the emailed code; resend with cooldown |
| `/signin` | Sign in |
| `/forgot-password` | Request a reset link |
| `/reset-password/[token]` | Set a new password |
| `/dashboard` | Protected placeholder: email + sign out |

### API

| Method & path | Purpose |
|---|---|
| `POST /api/signup` | Create an unverified user and send a code |
| `POST /api/verify-email` | Check the code, verify the user, start a session |
| `POST /api/verify-email/resend` | Resend the code (60s cooldown) |
| `POST /api/signin` | Verify credentials and start a session |
| `POST /api/forgot-password` | Issue a reset link (generic response) |
| `POST /api/reset-password` | Set a new password and revoke all sessions |
| `/api/auth/[...nextauth]` | Auth.js handlers (session reads, sign-out) |

## Project structure

```
app/
  api/                  Route handlers (signup, signin, verify-email, forgot/reset password, Auth.js)
  signup/ signin/ verify-email/ forgot-password/ reset-password/[token]/
  dashboard/            Server-protected page + sign-out button
components/             PasswordInput, PasswordRequirementsList
lib/
  auth/                 password hashing, rate limiting, verification codes,
                        verify-email token, manual session creation
  email/                Resend client + templates
  validation/auth.ts    Shared Zod schemas
  prisma.ts             Prisma client
prisma/                 Schema + migrations
scripts/                seed-auth-evidence.ts
screenshots/            Evidence screenshots used in DOCUMENTATION.md
firstaccessmentdoc/     PRD, AGENTS, rules and skill docs that governed the build
auth.ts                 Auth.js config (database sessions, no providers)
tokens.json / tokens.css / convert-tokens.js   Design tokens
```

## Data model

- **User** — `email` (unique), `passwordHash`, `emailVerified` (null = unverified)
- **Session** — Auth.js database sessions, cascade-deleted with the user
- **verification_codes** — 6-digit codes with `expiresAt`, `consumedAt`, `lastSentAt`
- **password_reset_tokens** — single-use tokens with `expiresAt`, `usedAt`
- **Account** — required by the Prisma adapter; unused (no OAuth)

## A note on sign-in

Sign-in is a custom route rather than Auth.js's Credentials provider. Auth.js v5 rejects Credentials combined with the database session strategy (`UnsupportedStrategy`), and database sessions were non-negotiable because a password reset must revoke every session immediately. So `/api/signin` does the rate limit → `emailVerified` check → bcrypt compare itself, then calls the same Prisma adapter's `createSession()` and sets a cookie identical to Auth.js's own. `auth()` and `signOut()` work as normal. Full story in [DOCUMENTATION.md](DOCUMENTATION.md) under "What Went Wrong".

## Out of scope

By design: social login, 2FA, magic links, profile editing, settings, account deletion, and a landing page. Known gaps for production: an audit log of sign-in attempts, background email sending, branded email templates, and a strength meter beyond the rule checklist.
