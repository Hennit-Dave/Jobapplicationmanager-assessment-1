import { redirect } from "next/navigation";

// PRD Section 10 forbids a landing/marketing page. "/" is not a screen in
// PRD Section 4, so it exists only to route into the real flow.
export default function RootPage() {
  redirect("/signin");
}
