"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Realm, RealmStatus } from "@/types/realm";

interface UseRealmsReturn {
  realms: Realm[];
  realmStatus: RealmStatus[];
  version: string;
  loading: boolean;
  refresh: () => void;
  /** Optimistically override a realm's state (e.g. after clicking Start). */
  setRealmState: (realmId: number, state: "starting" | "stopped") => void;
}

export function useRealms(): UseRealmsReturn {
  const [realms, setRealms] = useState<Realm[]>([]);
  const [realmStatus, setRealmStatus] = useState<RealmStatus[]>([]);
  const [version, setVersion] = useState("");
  const [loading, setLoading] = useState(true);
  // Optimistic overrides: realmId → { state, expiry }
  const optimistic = useRef<Map<number, { state: "starting" | "stopped"; expiry: number }>>(new Map());

  const applyOptimistic = useCallback((statuses: RealmStatus[]): RealmStatus[] => {
    const now = Date.now();
    const overrides = optimistic.current;
    // Expire stale overrides
    for (const [id, o] of overrides) {
      if (now > o.expiry) overrides.delete(id);
    }
    return statuses.map((s) => {
      const o = overrides.get(s.id);
      if (!o) return s;
      // Clear override once server confirms the expected state or a terminal state
      if (s.state === o.state || (o.state === "starting" && (s.state === "running" || s.state === "crashed"))) {
        overrides.delete(s.id);
        return s;
      }
      return { ...s, state: o.state, online: o.state === "starting" ? s.online : s.online };
    });
  }, []);

  const fetchRealms = useCallback(async () => {
    try {
      const res = await fetch("/api/realms");
      const data = await res.json();
      if (data.realms) setRealms(data.realms);
    } catch {
      // ignore
    }
    setLoading(false);
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/realms/status");
      const data = await res.json();
      if (data.realms) setRealmStatus(applyOptimistic(data.realms));
      if (data.version) setVersion(data.version);
    } catch {
      // ignore
    }
  }, [applyOptimistic]);

  const refresh = useCallback(() => {
    fetchRealms();
    fetchStatus();
  }, [fetchRealms, fetchStatus]);

  const setRealmState = useCallback((realmId: number, state: "starting" | "stopped") => {
    // Override lasts up to 60s — cleared sooner once server catches up
    optimistic.current.set(realmId, { state, expiry: Date.now() + 60_000 });
    // Immediately update local state
    setRealmStatus((prev) => applyOptimistic(prev));
  }, [applyOptimistic]);

  useEffect(() => {
    fetchRealms();
    fetchStatus();
    const interval = setInterval(() => {
      fetchRealms();
      fetchStatus();
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchRealms, fetchStatus]);

  return { realms, realmStatus, version, loading, refresh, setRealmState };
}
