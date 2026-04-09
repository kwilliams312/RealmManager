import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

// Root page: show landing or redirect to dashboard if logged in
export default async function RootPage() {
  const session = await getSession();
  if (session.userId) {
    redirect("/dashboard");
  }
  // Redirect to the actual landing page
  redirect("/landing");
}
