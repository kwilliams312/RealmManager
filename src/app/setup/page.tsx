"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type Step = "welcome" | "account" | "building" | "done";

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [alreadySetup, setAlreadySetup] = useState(false);
  const [buildSourceId, setBuildSourceId] = useState<string | null>(null);
  const [buildLog, setBuildLog] = useState<string[]>([]);
  const [buildStatus, setBuildStatus] = useState<string>("idle");
  const logRef = useRef<HTMLDivElement>(null);

  // Check if setup is needed or if initial build is still running
  useEffect(() => {
    fetch("/api/setup/status")
      .then((r) => r.json())
      .then((data) => {
        if (!data.needsSetup) {
          if (data.initialBuildInProgress && data.initialBuildSourceId) {
            // Setup done but build still running — show build progress
            setBuildSourceId(data.initialBuildSourceId);
            setStep("building");
          } else {
            setAlreadySetup(true);
            router.replace("/");
          }
        }
      })
      .catch(() => {});
  }, [router]);

  // Poll build status during "building" step
  useEffect(() => {
    if (step !== "building" || !buildSourceId) return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/setup/build-status?sourceId=${encodeURIComponent(buildSourceId)}`);
        const data = await res.json();
        if (data.log?.length > 0) setBuildLog(data.log);
        setBuildStatus(data.status ?? "idle");
        if (!data.building && data.status !== "building" && data.status !== "cloning" && data.status !== "extracting") {
          // Build finished (success or failed)
          return true;
        }
      } catch { /* ignore */ }
      return false;
    };
    // Immediate first poll
    poll();
    const interval = setInterval(async () => {
      const done = await poll();
      if (done) clearInterval(interval);
    }, 2000);
    return () => clearInterval(interval);
  }, [step, buildSourceId]);

  // Auto-scroll build log
  useEffect(() => {
    logRef.current?.scrollTo(0, logRef.current.scrollHeight);
  }, [buildLog]);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 4) {
      setError("Password must be at least 4 characters");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/setup/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.buildSourceId) {
          setBuildSourceId(data.buildSourceId);
          setStep("building");
        } else {
          setStep("done");
        }
      } else {
        setError(data.error || "Failed to create account");
      }
    } catch {
      setError("Failed to connect to server");
    }
    setCreating(false);
  };

  if (alreadySetup) return null;

  const containerStyle: React.CSSProperties = {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--bg-primary, #0c0e14)",
    color: "var(--text-primary, #f5f0e6)",
    fontFamily: "'Inter', -apple-system, sans-serif",
  };

  const cardStyle: React.CSSProperties = {
    background: "var(--bg-card, #1a1e2a)",
    border: "1px solid var(--border, #2a2e3a)",
    borderRadius: 16,
    padding: 40,
    width: 560,
    maxWidth: "90vw",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    background: "var(--bg-secondary, #14171f)",
    border: "1px solid var(--border, #2a2e3a)",
    borderRadius: 8,
    color: "var(--text-primary, #f5f0e6)",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
    marginTop: 6,
  };

  const btnStyle: React.CSSProperties = {
    padding: "10px 24px",
    background: "linear-gradient(135deg, #f59e0b, #d97706)",
    color: "#0f1117",
    border: "none",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  };

  const steps: Step[] = ["welcome", "account", "building", "done"];
  const stepIndicator = (
    <div style={{ display: "flex", gap: 8, marginBottom: 32, justifyContent: "center" }}>
      {steps.map((s, i) => (
        <div key={s} style={{
          width: 32, height: 4, borderRadius: 2,
          background: steps.indexOf(step) >= i
            ? "var(--accent, #f59e0b)" : "var(--border, #2a2e3a)",
          transition: "background 0.3s",
        }} />
      ))}
    </div>
  );

  const buildDone = buildStatus === "idle" || buildStatus === "success" || buildStatus === "failed";

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        {stepIndicator}

        {step === "welcome" && (
          <div style={{ textAlign: "center" }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>
              Welcome to <span style={{ color: "var(--accent, #f59e0b)" }}>RealmManager</span>
            </h1>
            <p style={{ color: "var(--text-secondary, #8b8fa8)", fontSize: 14, lineHeight: 1.6, marginBottom: 32 }}>
              Let&apos;s get your server management dashboard set up.
              This will create your admin account and start building the
              default AzerothCore server.
            </p>
            <button onClick={() => setStep("account")} style={btnStyle}>
              Get Started
            </button>
          </div>
        )}

        {step === "account" && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Create Admin Account</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 20 }}>
              This account will have full admin access to RealmManager and can log into the game server.
            </p>
            <form onSubmit={handleCreateAccount}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                Username
              </label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                style={inputStyle} required autoFocus />

              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 16, display: "block" }}>
                Password
              </label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                style={inputStyle} required minLength={4} />

              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 16, display: "block" }}>
                Confirm Password
              </label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                style={inputStyle} required minLength={4} />

              {error && (
                <div style={{ padding: "10px 14px", marginTop: 12, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 6, color: "#f87171", fontSize: 13 }}>
                  {error}
                </div>
              )}

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
                <button type="button" onClick={() => setStep("welcome")}
                  style={{ ...btnStyle, background: "transparent", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                  Back
                </button>
                <button type="submit" disabled={creating}
                  style={{ ...btnStyle, opacity: creating ? 0.6 : 1, cursor: creating ? "not-allowed" : "pointer" }}>
                  {creating ? "Creating..." : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        )}

        {step === "building" && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
              {buildDone
                ? buildStatus === "failed" ? "Build Failed" : "Build Complete!"
                : "Building Server..."}
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 16 }}>
              {buildDone
                ? buildStatus === "failed"
                  ? "The build encountered errors. You can retry from the Builds page after logging in."
                  : "Your AzerothCore server image has been built and assigned to the default realm. Log in to start your server."
                : "Building the default AzerothCore server image. This may take several minutes."}
            </p>

            {/* Status badge */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{
                width: 8, height: 8, borderRadius: "50%",
                background: buildDone
                  ? buildStatus === "failed" ? "var(--red, #f87171)" : "var(--green, #22c55e)"
                  : "var(--yellow, #f59e0b)",
                animation: buildDone ? undefined : "pulse 1.5s infinite",
              }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                {buildStatus}
              </span>
            </div>

            {/* Build log */}
            <div ref={logRef} style={{
              background: "#0d0f14", border: "1px solid var(--border, #2a2e3a)", borderRadius: 8,
              padding: 12, fontFamily: "'Fira Code', monospace", fontSize: 11,
              color: "var(--text-secondary)", height: 200, overflowY: "auto", lineHeight: 1.6,
            }}>
              {buildLog.length === 0 ? (
                <div style={{ color: "var(--text-secondary)", opacity: 0.5 }}>Waiting for build to start...</div>
              ) : (
                buildLog.map((line, i) => {
                  const lower = line.toLowerCase();
                  const color = lower.includes("complete") || lower.includes("success")
                    ? "var(--green, #22c55e)"
                    : lower.includes("error") || lower.includes("fail")
                      ? "var(--red, #f87171)"
                      : lower.includes("warning") || lower.includes("skipping")
                        ? "var(--yellow, #f59e0b)"
                        : "var(--text-secondary)";
                  return <div key={i} style={{ color }}>{line}</div>;
                })
              )}
            </div>

            {buildDone && (
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
                <button onClick={() => router.push("/login")} style={btnStyle}>
                  {buildStatus === "failed" ? "Continue to Login" : "Go to Login"}
                </button>
              </div>
            )}
          </div>
        )}

        {step === "done" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>&#10003;</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Setup Complete</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.6, marginBottom: 32 }}>
              Your admin account has been created. You can now log in and start managing your realms.
            </p>
            <button onClick={() => router.push("/login")} style={btnStyle}>
              Go to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
