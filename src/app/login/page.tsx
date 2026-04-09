"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { HiveIconSmall } from "@/components/Icons";
import { Spinner } from "@/components/Spinner";
import { useBranding, splitServerName } from "@/hooks/useBranding";

export default function LoginPage() {
  const router = useRouter();

  // Redirect to setup if initial build is still running
  useEffect(() => {
    fetch("/api/setup/status")
      .then((r) => r.json())
      .then((data) => {
        if (data.needsSetup || data.initialBuildInProgress) {
          router.replace("/setup");
        }
      })
      .catch(() => {});
  }, [router]);
  const branding = useBranding();
  const brandName = splitServerName(branding);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (res.ok) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setError(data.error || "Login failed");
      }
    } catch {
      setError("Failed to connect to server");
    }
    setLoading(false);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    marginBottom: 16,
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    color: "var(--text-primary)",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    color: "var(--text-secondary)",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "80vh",
        padding: 24,
      }}
    >
      {/* Hex background pattern */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          opacity: 0.02,
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='52' viewBox='0 0 60 52'%3E%3Cpolygon fill='%23f59e0b' points='30,0 60,15 60,37 30,52 0,37 0,15'/%3E%3C/svg%3E")`,
          backgroundSize: "60px 52px",
          pointerEvents: "none",
          zIndex: -1,
        }}
      />

      <div
        style={{
          width: "100%",
          maxWidth: 380,
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 32,
          animation: "slideIn 0.3s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <HiveIconSmall />
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>
            <span style={{ color: "var(--text-primary)" }}>{brandName.base}</span>
            {brandName.accent && (
              <span style={{ color: "var(--accent)" }}>{brandName.accent}</span>
            )}
          </h1>
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 28 }}>
          Sign in with your game account
        </p>

        <form onSubmit={handleSubmit}>
          <label style={labelStyle}>Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            required
            style={inputStyle}
          />

          <label style={labelStyle}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ ...inputStyle, marginBottom: 24 }}
          />

          {error && (
            <div
              style={{
                padding: "10px 14px",
                marginBottom: 16,
                background: "var(--red-bg)",
                border: "1px solid rgba(248,113,113,0.3)",
                borderRadius: 6,
                color: "var(--red)",
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "10px 0",
              background: loading
                ? "var(--bg-hover)"
                : "linear-gradient(135deg, #f59e0b, #d97706)",
              color: loading ? "var(--text-secondary)" : "#0f1117",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {loading && <Spinner size={14} />}
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 20, fontSize: 14 }}>
          <Link
            href="/signup"
            style={{ color: "var(--text-secondary)", textDecoration: "none" }}
          >
            Need an account? Create one
          </Link>
          <div style={{ marginTop: 8 }}>
            <Link
              href="/"
              style={{
                color: "var(--text-secondary)",
                textDecoration: "none",
                fontSize: 13,
              }}
            >
              Back to {branding.serverName}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
