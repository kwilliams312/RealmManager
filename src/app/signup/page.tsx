"use client";

import { useState } from "react";
import Link from "next/link";
import { HiveIconSmall } from "@/components/Icons";
import { Spinner } from "@/components/Spinner";

export default function SignupPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (username.length < 3 || username.length > 16) {
      setError("Username must be 3-16 characters");
      return;
    }
    if (!/^[a-zA-Z0-9]+$/.test(username)) {
      setError("Username must be alphanumeric");
      return;
    }
    if (password.length < 4) {
      setError("Password must be at least 4 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(true);
      } else {
        setError(data.error || "Registration failed");
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
    transition: "border-color 0.15s",
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

  if (success) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "80vh",
        }}
      >
        <div
          style={{
            textAlign: "center",
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 40,
            maxWidth: 380,
            animation: "slideIn 0.3s ease",
          }}
        >
          <div
            style={{
              fontSize: 40,
              marginBottom: 16,
            }}
          >
            ✓
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
            Account created!
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 24 }}>
            You can now sign in with your credentials.
          </p>
          <Link
            href="/login"
            style={{
              display: "inline-block",
              padding: "10px 24px",
              background: "linear-gradient(135deg, #f59e0b, #d97706)",
              color: "#0f1117",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

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
            <span style={{ color: "#f5f0e6" }}>Hive</span>
            <span style={{ color: "#f59e0b" }}>WOW</span>
          </h1>
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 28 }}>
          Create a new game account
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
            placeholder="3-16 alphanumeric characters"
          />

          <label style={labelStyle}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={inputStyle}
          />

          <label style={labelStyle}>Confirm Password</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
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
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 20, fontSize: 14 }}>
          <Link href="/login" style={{ color: "var(--text-secondary)", textDecoration: "none" }}>
            Already have an account? Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
