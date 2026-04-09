"use client";

import { useState, useEffect } from "react";
import { DEFAULT_BRANDING, type BrandingSettings } from "@/lib/branding";

let cachedBranding: BrandingSettings | null = null;

export function invalidateBrandingCache(): void {
  cachedBranding = null;
}

export function useBranding(): BrandingSettings {
  const [branding, setBranding] = useState<BrandingSettings>(
    cachedBranding ?? DEFAULT_BRANDING
  );

  useEffect(() => {
    if (cachedBranding) return;
    fetch("/api/settings/branding")
      .then((r) => r.json())
      .then((data) => {
        if (data.branding) {
          cachedBranding = data.branding;
          setBranding(data.branding);
        }
      })
      .catch(() => {});
  }, []);

  return branding;
}

/**
 * Split a server name into base + accent parts.
 * E.g., serverName="RealmManager", serverNameAccent="Manager" → { base: "Realm", accent: "Manager" }
 */
export function splitServerName(branding: BrandingSettings): {
  base: string;
  accent: string;
} {
  const { serverName, serverNameAccent } = branding;
  if (!serverNameAccent || !serverName.endsWith(serverNameAccent)) {
    return { base: serverName, accent: "" };
  }
  return {
    base: serverName.slice(0, serverName.length - serverNameAccent.length),
    accent: serverNameAccent,
  };
}
