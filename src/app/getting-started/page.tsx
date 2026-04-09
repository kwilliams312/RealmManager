"use client";

import Link from "next/link";
import { useBranding } from "@/hooks/useBranding";

function StepCard({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 28, position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#0f1117", fontSize: 16, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {number}
        </div>
        <h3 style={{ fontSize: 17, fontWeight: 700, color: "#f5f0e6" }}>{title}</h3>
      </div>
      <div style={{ paddingLeft: 50, color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.7 }}>
        {children}
      </div>
    </div>
  );
}

function Code({ children }: { children: string }) {
  return (
    <code style={{ background: "var(--bg-hover)", border: "1px solid var(--border)", borderRadius: 4, padding: "2px 6px", fontFamily: "monospace", fontSize: 13, color: "var(--text-primary)" }}>
      {children}
    </code>
  );
}

export default function GettingStartedPage() {
  const branding = useBranding();
  const gs = branding.gettingStarted;
  const serverAddr = gs.serverAddress || "YOUR_SERVER_ADDRESS";

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px" }}>
      <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Getting Started</h2>
      <p style={{ color: "var(--text-secondary)", fontSize: 15, marginBottom: gs.customMessage ? 16 : 40, lineHeight: 1.6 }}>
        Follow these steps to connect your WoW 3.3.5a client to the server.
      </p>
      {gs.customMessage && (
        <div style={{ padding: "12px 16px", marginBottom: 40, background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.2)", borderRadius: 8, fontSize: 14, color: "var(--text-primary)", lineHeight: 1.6 }}>
          {gs.customMessage}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <StepCard number={1} title="Download the WoW 3.3.5a Client">
          <p>You need the World of Warcraft 3.3.5a (build 12340) client. This version is required to connect.</p>
          <p style={{ marginTop: 8 }}>If you already have a WoW client, check your version in the bottom left corner of the login screen. It should read <strong>3.3.5 (12340)</strong>.</p>
          {gs.downloadLink && (
            <div style={{ marginTop: 12 }}>
              <a
                href={gs.downloadLink}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-block", padding: "8px 18px",
                  background: "linear-gradient(135deg, var(--accent), var(--accent-hover))", color: "#0f1117",
                  borderRadius: 6, fontSize: 13, fontWeight: 700, textDecoration: "none",
                }}
              >
                {gs.downloadText || "Download Client"}
              </a>
            </div>
          )}
        </StepCard>

        <StepCard number={2} title="Configure Your Realmlist">
          <p>You need to tell your WoW client where to find the server by editing the realmlist file.</p>
          <p style={{ marginTop: 8 }}>Find the file at: <Code>Data/enUS/realmlist.wtf</Code> (or your locale)</p>
          <p style={{ marginTop: 8 }}>Change the contents to:</p>
          <div style={{ background: "#0a0d10", border: "1px solid var(--border)", borderRadius: 6, padding: 12, marginTop: 8, fontFamily: "monospace", fontSize: 13 }}>
            set realmlist {serverAddr}
          </div>
        </StepCard>

        <StepCard number={3} title="Automatic Setup (Windows)">
          <p>For Windows users, we provide a PowerShell setup script that automatically configures your client:</p>
          <div style={{ marginTop: 12 }}>
            <a
              href="/api/setup-script"
              download="setup-client.ps1"
              style={{
                display: "inline-block", padding: "8px 18px",
                background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#0f1117",
                borderRadius: 6, fontSize: 13, fontWeight: 700, textDecoration: "none",
              }}
            >
              Download setup-client.ps1
            </a>
          </div>
          <p style={{ marginTop: 12, fontSize: 13 }}>
            Place the .ps1 file in your WoW folder, right-click it, and select &ldquo;Run with PowerShell&rdquo;.
          </p>
        </StepCard>

        <StepCard number={4} title="Create an Account">
          <p>Use the web interface to create your game account. Your credentials will work in both the game client and this dashboard.</p>
          <div style={{ marginTop: 12 }}>
            <Link href="/signup" style={{ display: "inline-block", padding: "8px 18px", background: "transparent", border: "1px solid var(--accent)", color: "var(--accent)", borderRadius: 6, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
              Create Account
            </Link>
          </div>
        </StepCard>

        <StepCard number={5} title="Launch the Game">
          <p>Start <Code>WoW.exe</Code> (not the launcher), enter your credentials, and select the realm from the list.</p>
          <p style={{ marginTop: 8 }}>If you have issues connecting, double-check that:</p>
          <ul style={{ marginTop: 8, paddingLeft: 20 }}>
            <li>Your realmlist.wtf points to the correct server address</li>
            <li>Your WoW version is exactly 3.3.5a (12340)</li>
            <li>You&apos;re using <Code>WoW.exe</Code> directly, not the Blizzard launcher</li>
          </ul>
        </StepCard>
      </div>
    </div>
  );
}
