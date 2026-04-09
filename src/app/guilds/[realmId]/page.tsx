"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { GuildsTab } from "@/components/realm-tabs/GuildsTab";
import { Spinner } from "@/components/Spinner";
import type { Realm, RealmStatus } from "@/types/realm";

export default function GuildsPage() {
  const { realmId } = useParams<{ realmId: string }>();
  const id = Number(realmId);
  const [realm, setRealm] = useState<Realm | null>(null);
  const [status, setStatus] = useState<RealmStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [realmsRes, statusRes] = await Promise.all([
        fetch("/api/realms"),
        fetch("/api/realms/status"),
      ]);
      const realmsData = await realmsRes.json();
      const statusData = await statusRes.json();
      const r = realmsData.realms?.find((r: Realm) => r.id === id);
      if (r) setRealm(r);
      const s = statusData.realms?.find((s: RealmStatus) => s.id === id);
      if (s) setStatus(s);
    } catch { /* ignore */ }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 60 }}>
        <Spinner size={24} />
      </div>
    );
  }

  if (!realm) {
    return (
      <div style={{ textAlign: "center", padding: 60, color: "var(--text-secondary)" }}>
        Realm not found.
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>
        Guilds — {realm.name}
      </h2>
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: 24,
        }}
      >
        <GuildsTab
          realm={realm}
          realmStatus={status}
          onToast={() => {}}
          onRefresh={fetchData}
        />
      </div>
    </div>
  );
}
