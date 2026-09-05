import bcrypt from "bcryptjs";

// RULES-security-validation.md "Password rules": bcrypt at cost 12,
// everywhere a password touches the database. This module is the only
// place that constant is defined. It is used from exactly three call
// sites: the Credentials provider's authorize() (comparison), the signup
// route (creation), and the reset-password route (creation) -- no
// fourth spot should ever call bcrypt directly.
const BCRYPT_COST = 12;

export async function hashPassword(plainTextPassword: string): Promise<string> {
  return bcrypt.hash(plainTextPassword, BCRYPT_COST);
}

export async function verifyPassword(
  plainTextPassword: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(plainTextPassword, passwordHash);
}
