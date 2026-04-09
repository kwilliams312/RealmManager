import { NavBar } from "@/components/NavBar";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session.userId) redirect("/login");

  const user = {
    username: session.username!,
    gmlevel: session.gmlevel ?? 0,
  };

  return (
    <>
      <NavBar user={user} />
      <main>{children}</main>
    </>
  );
}
