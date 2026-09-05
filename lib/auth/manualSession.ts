import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { authAdapter, SESSION_MAX_AGE_SECONDS } from "@/auth";

// PRD v3 5.2.3: email verification creates a session "directly via the
// Auth.js Prisma adapter rather than re-running the Credentials provider,
// since that would require the plaintext password again." This calls the
// same adapter instance Auth.js itself uses (see auth.ts), so the
// resulting Session row is indistinguishable from one Auth.js created.
export async function createSessionForUser(userId: string): Promise<{
  sessionToken: string;
  expires: Date;
}> {
  if (!authAdapter.createSession) {
    throw new Error("Auth.js adapter does not implement createSession");
  }
  const sessionToken = randomUUID();
  const expires = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  const session = await authAdapter.createSession({ sessionToken, userId, expires });
  return { sessionToken: session.sessionToken, expires: session.expires };
}

// Mirrors @auth/core's defaultCookies() exactly (name, httpOnly, sameSite,
// path, secure) so a manually-created session is set using "Auth.js's own
// cookie name and format" (PRD v3 5.2.3) and auth() reads it identically
// to a cookie Auth.js set itself via sign-in.
export function attachSessionCookie(
  response: NextResponse,
  request: Request,
  sessionToken: string,
  expires: Date,
): void {
  const isSecure = new URL(request.url).protocol === "https:";
  const cookieName = isSecure ? "__Secure-authjs.session-token" : "authjs.session-token";
  response.cookies.set(cookieName, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: isSecure,
    expires,
  });
}
