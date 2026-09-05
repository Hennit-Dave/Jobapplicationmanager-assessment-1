import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";

// Auth.js (v5) configuration.
//
// Session strategy is explicitly "database" (RULES-security-validation.md
// "Session rules"): the cookie holds an opaque session id that maps to a
// row in `Session`, never a self-contained JWT. This is what makes
// server-side sign-out and the bulk session invalidation on password
// reset (PRD v3 5.4.4) actually work -- there is nothing to "revoke" in a
// stateless JWT.
//
// The Credentials provider's `authorize()` callback is a stub here. Its
// real logic (rate-limit check, emailVerified check, bcrypt comparison)
// is filled in during build step 9, once lib/auth/rateLimit.ts and
// lib/auth/password.ts exist -- see skill.md's build order.
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "database",
  },
  pages: {
    signIn: "/signin",
  },
  // Auth.js's defaults for the database-session cookie already satisfy
  // RULES-security-validation.md's session rules: httpOnly always on,
  // sameSite=lax, and secure whenever the app is served over https (which
  // Auth.js derives from the request/AUTH_URL, switching the cookie name
  // to the `__Secure-` prefixed variant automatically). Left un-overridden
  // deliberately so that automatic detection keeps working; confirmed by
  // inspecting the Set-Cookie header once sign-in exists (build step 9).
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize() {
        // Implemented in build step 9.
        return null;
      },
    }),
  ],
});
