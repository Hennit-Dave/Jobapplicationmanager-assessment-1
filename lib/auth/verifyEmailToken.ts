import { SignJWT, jwtVerify } from "jose";

// PRD v3 5.1.7: after signup, the user is redirected to /verify-email with
// "a short-lived, signed token scoped only to that screen. No Auth.js
// session yet." This token is delivered as an httpOnly cookie (never a URL
// query param, never client-readable) so it can't leak via referrers,
// browser history, or script injection, and it is verified independently
// of any Auth.js session.

const ISSUER = "application-manager-track";
const AUDIENCE = "verify-email";
const TOKEN_TTL = "15m";
export const VERIFY_EMAIL_COOKIE_NAME = "verify_email_token";
export const VERIFY_EMAIL_COOKIE_MAX_AGE_SECONDS = 15 * 60;

function getSecretKey(): Uint8Array {
  const secret = process.env.VERIFY_EMAIL_TOKEN_SECRET;
  if (!secret) {
    throw new Error("VERIFY_EMAIL_TOKEN_SECRET is not set");
  }
  return new TextEncoder().encode(secret);
}

export async function createVerifyEmailToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(userId)
    .setExpirationTime(TOKEN_TTL)
    .sign(getSecretKey());
}

/** Returns the userId the token is scoped to, or null if invalid/expired. */
export async function verifyEmailToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}
