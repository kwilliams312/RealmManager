import { NavBar } from "@/components/NavBar";
import { getSession, isAdmin } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session.userId) redirect("/login");
  if (!isAdmin(session)) redirect("/dashboard");

  return (
    <>
      <NavBar
        user={{
          username: session.username!,
          gmlevel: session.gmlevel ?? 0,
        }}
      />
      <main>{children}</main>
    </>
  );
}
