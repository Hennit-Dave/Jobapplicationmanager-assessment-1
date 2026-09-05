"use client";

import { useState } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";

function EyeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M1 10s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M2.5 2.5l15 15M8.4 8.5a2.5 2.5 0 0 0 3.1 3.1M6 4.7C7.2 4.2 8.5 4 10 4c5.5 0 9 6 9 6a15.6 15.6 0 0 1-3.3 3.9M4.3 6.1A15.9 15.9 0 0 0 1 10s3.5 6 9 6c1 0 1.9-.1 2.8-.4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface PasswordInputProps {
  id: string;
  autoComplete: string;
  ariaInvalid: boolean;
  /** Current field value, used only to decide whether the toggle button
   * should render -- the input itself stays uncontrolled via `registration`. */
  value: string;
  registration: UseFormRegisterReturn;
}

// Shared by the signup, signin, and reset-password forms: a password
// input whose show/hide toggle button only appears once the user has
// started typing.
export function PasswordInput({ id, autoComplete, ariaInvalid, value, registration }: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="password-input-wrapper">
      <input
        id={id}
        type={showPassword ? "text" : "password"}
        autoComplete={autoComplete}
        aria-invalid={ariaInvalid ? "true" : "false"}
        {...registration}
      />
      {value.length > 0 ? (
        <button
          type="button"
          className="password-toggle-button"
          onClick={() => setShowPassword((current) => !current)}
          aria-label={showPassword ? "Hide password" : "Show password"}
          aria-pressed={showPassword}
        >
          {showPassword ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      ) : null}
    </div>
  );
}
