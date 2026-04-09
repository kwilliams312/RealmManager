import { NavBar } from "@/components/NavBar";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function AccountsLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session.userId) redirect("/login");
  if ((session.gmlevel ?? 0) < 3) redirect("/dashboard");

  return (
    <>
      <NavBar user={{ username: session.username!, gmlevel: session.gmlevel ?? 0 }} />
      <main>{children}</main>
    </>
  );
}
