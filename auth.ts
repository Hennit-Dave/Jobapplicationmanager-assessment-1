import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

// Pinned explicitly (matches Auth.js's own 30-day default) so the manual
// session creation used by both sign-in and email verification
// (lib/auth/manualSession.ts) issues sessions with the same lifetime Auth.js
// would use natively.
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

// Exported so the sign-in and email-verification routes can call
// `authAdapter.createSession` directly -- the same adapter instance Auth.js
// itself would use.
export const authAdapter = PrismaAdapter(prisma);

// Auth.js (v5) configuration.
//
// Session strategy is explicitly "database" (RULES-security-validation.md
// "Session rules"): the cookie holds an opaque session id that maps to a
// row in `Session`, never a self-contained JWT. This is what makes
// server-side sign-out and the bulk session invalidation on password
// reset (PRD v3 5.4.4) actually work -- there is nothing to "revoke" in a
// stateless JWT.
//
// No Credentials provider is registered here. @auth/core hard-rejects that
// combination: when a Credentials provider is the *only* configured
// provider and session.strategy is "database", every Auth.js endpoint
// (sign-in, session reads, sign-out) throws UnsupportedStrategy --
// confirmed by actually running it, not just reading the source
// (node_modules/@auth/core/lib/utils/assert.js:113-118, "Signing in with
// credentials only supported if JWT strategy is enabled"). AGENTS.md's
// rule 6 rules out switching to JWT sessions, so /api/signin instead
// re-implements exactly what the Credentials provider's authorize() would
// have done (rate limit -> emailVerified check -> bcrypt compare) and
// creates the session the same way email verification already does: by
// calling this adapter's createSession() directly. `auth()`, `signOut()`,
// and the database session strategy itself are unaffected by this --
// only the (non-functional, under this strategy) Credentials provider is
// gone.
export const { handlers, auth, signOut } = NextAuth({
  adapter: authAdapter,
  session: {
    strategy: "database",
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
  pages: {
    signIn: "/signin",
  },
  // Auth.js's defaults for the database-session cookie already satisfy
  // RULES-security-validation.md's session rules: httpOnly always on,
  // sameSite=lax, and secure whenever the app is served over https (which
  // Auth.js derives from the request URL, switching the cookie name to the
  // `__Secure-` prefixed variant automatically). Left un-overridden
  // deliberately so auth() keeps reading whatever cookie name/shape
  // lib/auth/manualSession.ts wrote, which mirrors this exactly.
  providers: [],
});
