"use client";

import { useEffect } from "react";
import { useBranding } from "@/hooks/useBranding";

const HEX_COLOR_RE = /^#[0-9a-fA-F]{3,8}$/;

function sanitizeColor(value: string, fallback: string): string {
  return HEX_COLOR_RE.test(value) ? value : fallback;
}

/**
 * Client component that applies dynamic branding:
 * - Sets document.title from branding
 * - Injects favicon link
 * - Overrides CSS custom properties from branding colors
 */
export function DynamicBranding() {
  const branding = useBranding();

  useEffect(() => {
    if (branding.pageTitle) {
      document.title = branding.pageTitle;
    }
  }, [branding.pageTitle]);

  useEffect(() => {
    if (branding.faviconUrl) {
      let link = document.querySelector(
        'link[rel="icon"]'
      ) as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = branding.faviconUrl;
    }
  }, [branding.faviconUrl]);

  const c = branding.colors;
  const cssVars = `
    :root {
      --accent: ${sanitizeColor(c.accent, "#f59e0b")};
      --accent-hover: ${sanitizeColor(c.accentHover, "#d97706")};
      --bg-primary: ${sanitizeColor(c.bgPrimary, "#0c0e14")};
      --bg-secondary: ${sanitizeColor(c.bgSecondary, "#14171f")};
      --bg-card: ${sanitizeColor(c.bgCard, "#1a1e2a")};
      --text-primary: ${sanitizeColor(c.textPrimary, "#f5f0e6")};
      --text-secondary: ${sanitizeColor(c.textSecondary, "#8b8fa8")};
    }
  `;

  return <style dangerouslySetInnerHTML={{ __html: cssVars }} />;
}
