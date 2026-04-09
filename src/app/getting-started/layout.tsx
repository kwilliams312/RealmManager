import { NavBar } from "@/components/NavBar";
import { getSession } from "@/lib/session";

export default async function GettingStartedLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  // This page works both authenticated and unauthenticated
  if (!session.userId) {
    return <main>{children}</main>;
  }

  return (
    <>
      <NavBar user={{ username: session.username!, gmlevel: session.gmlevel ?? 0 }} />
      <main>{children}</main>
    </>
  );
}
