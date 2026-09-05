"use client";

import { signOut } from "next-auth/react";

// Auth.js's own signOut() (PRD v3 5.6): deletes the Session row via the
// adapter and clears the cookie. This is unaffected by dropping the
// Credentials provider (see auth.ts) -- sign-out isn't provider-specific.
export function SignOutButton() {
  return (
    <button
      className="primary-button"
      type="button"
      onClick={() => signOut({ redirectTo: "/signin" })}
    >
      Sign out
    </button>
  );
}
