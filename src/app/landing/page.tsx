"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { HiveIconSmall } from "@/components/Icons";
import { useBranding, splitServerName } from "@/hooks/useBranding";

interface ServerInfo {
  total_accounts?: number;
  total_characters?: number;
  players_online?: number;
  peak_players?: number;
  realm_name?: string;
  realm_address?: string;
}

function StatPill({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 32, fontWeight: 800, color: "#f5f0e6", lineHeight: 1 }}>
        {value.toLocaleString()}
      </div>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, color: "var(--text-secondary)", marginTop: 4 }}>
        {label}
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div style={{
      background: "rgba(245, 158, 11, 0.04)", border: "1px solid rgba(245, 158, 11, 0.15)",
      borderRadius: 12, padding: "28px 24px", display: "flex", flexDirection: "column", gap: 12,
    }}>
      <div style={{ fontSize: 28 }}>{icon}</div>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: "#f5f0e6" }}>{title}</h3>
      <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>{desc}</p>
    </div>
  );
}

export default function LandingPage() {
  const [serverInfo, setServerInfo] = useState<ServerInfo>({});
  const branding = useBranding();
  const brandName = splitServerName(branding);

  useEffect(() => {
    fetch("/api/server-info")
      .then((r) => r.json())
      .then(setServerInfo)
      .catch(() => {});
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", padding: "60px 24px" }}>
      {/* Brand */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <HiveIconSmall />
        <h1 style={{ fontSize: 42, fontWeight: 900, letterSpacing: -2 }}>
          <span style={{ color: "var(--text-primary)" }}>{brandName.base}</span>
          {brandName.accent && (
            <span style={{ color: "var(--accent)" }}>{brandName.accent}</span>
          )}
        </h1>
      </div>

      <p style={{ fontSize: 18, color: "var(--text-secondary)", textAlign: "center", maxWidth: 500, marginBottom: 40, lineHeight: 1.6 }}>
        {serverInfo.realm_name
          ? `${serverInfo.realm_name} — Private WoW 3.3.5a Server`
          : "AzerothCore Wrath of the Lich King Private Server"}
      </p>

      {/* Stats */}
      <div style={{ display: "flex", gap: 60, marginBottom: 48 }}>
        <StatPill label="Accounts" value={serverInfo.total_accounts ?? 0} />
        <StatPill label="Characters" value={serverInfo.total_characters ?? 0} />
        <StatPill label="Online Now" value={serverInfo.players_online ?? 0} />
        {(serverInfo.peak_players ?? 0) > 0 && (
          <StatPill label="Peak Players" value={serverInfo.peak_players!} />
        )}
      </div>

      {/* CTA buttons */}
      <div style={{ display: "flex", gap: 16, marginBottom: 80 }}>
        <Link href="/login" style={{
          padding: "12px 28px", background: "linear-gradient(135deg, #f59e0b, #d97706)",
          color: "#0f1117", borderRadius: 8, fontSize: 15, fontWeight: 700, textDecoration: "none",
        }}>
          Sign In
        </Link>
        <Link href="/signup" style={{
          padding: "12px 28px", background: "transparent",
          border: "1px solid rgba(245, 158, 11, 0.4)", color: "#f59e0b",
          borderRadius: 8, fontSize: 15, fontWeight: 700, textDecoration: "none",
        }}>
          Create Account
        </Link>
        <Link href="/getting-started" style={{
          padding: "12px 28px", background: "transparent",
          border: "1px solid var(--border)", color: "var(--text-secondary)",
          borderRadius: 8, fontSize: 15, fontWeight: 600, textDecoration: "none",
        }}>
          Getting Started
        </Link>
      </div>

      {/* Features */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, maxWidth: 900, width: "100%" }}>
        <FeatureCard icon="⚔️" title="Wrath of the Lich King" desc="Full 3.3.5a content with all classes, dungeons, raids, and battlegrounds." />
        <FeatureCard icon="🤖" title="AI-Powered Bots" desc="Playerbots module brings the world to life with intelligent player-like bots." />
        <FeatureCard icon="🌐" title="Web Dashboard" desc="Manage your server, realms, accounts, and players from any browser." />
        <FeatureCard icon="🏰" title="Multiple Realms" desc="Launch multiple game servers from the same dashboard, each in its own container." />
      </div>
    </div>
  );
}
