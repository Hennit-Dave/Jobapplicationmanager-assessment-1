"use client";

import { getUnmetPasswordRequirements } from "@/lib/validation/auth";

// Hidden by default; shows only the currently-unmet requirements (each on
// its own line, minimum-length last), disappearing item by item as the
// user satisfies them. Shared by the signup and reset-password forms so
// both stay in sync with lib/validation/auth.ts's PASSWORD_REQUIREMENTS.
export function PasswordRequirementsList({ value }: { value: string }) {
  if (value.length === 0) {
    return null;
  }

  const unmet = getUnmetPasswordRequirements(value);
  if (unmet.length === 0) {
    return null;
  }

  return (
    <ul className="password-requirements">
      {unmet.map((requirement) => (
        <li key={requirement.id}>{requirement.label}</li>
      ))}
    </ul>
  );
}
