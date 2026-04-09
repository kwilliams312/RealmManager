"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/Spinner";

export default function GuildsIndex() {
  const router = useRouter();
  const [noRealms, setNoRealms] = useState(false);

  useEffect(() => {
    fetch("/api/realms")
      .then((r) => r.json())
      .then((data) => {
        if (data.realms?.length > 0) {
          router.replace(`/guilds/${data.realms[0].id}`);
        } else {
          setNoRealms(true);
        }
      })
      .catch(() => setNoRealms(true));
  }, [router]);

  if (noRealms) {
    return (
      <div style={{ textAlign: "center", padding: 60, color: "var(--text-secondary)" }}>
        No realms available yet.
      </div>
    );
  }

  return (
    <div style={{ textAlign: "center", padding: 60 }}>
      <Spinner size={24} />
    </div>
  );
}
