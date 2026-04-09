"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Redirects all routes to /setup when initial setup hasn't been completed.
 * Skips check on /setup itself and public pages that work without setup.
 */
export function SetupGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Don't check on setup page itself or setup API routes
    if (pathname.startsWith("/setup")) {
      setChecked(true);
      return;
    }

    fetch("/api/setup/status")
      .then((r) => r.json())
      .then((data) => {
        if (data.needsSetup) {
          router.replace("/setup");
        } else {
          setChecked(true);
        }
      })
      .catch(() => {
        // If the API fails, let the page load normally
        setChecked(true);
      });
  }, [pathname, router]);

  if (!checked && !pathname.startsWith("/setup")) return null;
  return <>{children}</>;
}
