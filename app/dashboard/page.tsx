import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SignOutButton } from "./sign-out-button";

// PRD v3 5.5 / AGENTS.md rule 3: session checked server-side via Auth.js's
// auth() helper before any content renders -- not a client-side redirect
// after the page has already painted. PRD v3 Section 10 forbids anything
// on this screen beyond the user's name (this data model has no name
// field -- email is the only identifying info ever collected, see PRD v3
// Section 6) and a sign-out button.
export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.email) {
    redirect("/signin");
  }

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <h1>{session.user.email}</h1>
        <SignOutButton />
      </div>
    </main>
  );
}
