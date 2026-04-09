"use client";

import { useState } from "react";
import { Toast, type ToastType } from "@/components/Toast";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  background: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  color: "var(--text-primary)",
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  color: "var(--text-secondary)",
  textTransform: "uppercase",
  letterSpacing: 0.5,
  marginBottom: 6,
};

export default function MySettingsPage() {
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: ToastType;
  } | null>(null);

  const passwordMismatch = confirmPw.length > 0 && newPw !== confirmPw;
  const canSubmit = currentPw && newPw && confirmPw && !passwordMismatch && !saving;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: currentPw,
          newPassword: newPw,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setToast({ message: "Password changed successfully", type: "success" });
        setCurrentPw("");
        setNewPw("");
        setConfirmPw("");
      } else {
        setToast({
          message: data.error || "Failed to change password",
          type: "error",
        });
      }
    } catch {
      setToast({ message: "Failed to connect", type: "error" });
    }
    setSaving(false);
  };

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>
        My Settings
      </h2>

      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: 28,
          maxWidth: 480,
        }}
      >
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>
          Change Password
        </h3>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Current Password</label>
            <input
              type="password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              style={inputStyle}
              autoFocus
            />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>New Password</label>
            <input
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Confirm New Password</label>
            <input
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              style={{
                ...inputStyle,
                borderColor: passwordMismatch
                  ? "var(--red)"
                  : "var(--border)",
              }}
            />
            {passwordMismatch && (
              <div
                style={{
                  fontSize: 12,
                  color: "var(--red)",
                  marginTop: 4,
                }}
              >
                Passwords do not match
              </div>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="submit"
              disabled={!canSubmit}
              style={{
                padding: "8px 18px",
                background: canSubmit ? "var(--accent)" : "var(--bg-hover)",
                color: canSubmit ? "#0f1117" : "var(--text-secondary)",
                border: "none",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 700,
                cursor: canSubmit ? "pointer" : "not-allowed",
              }}
            >
              {saving ? "Saving..." : "Change Password"}
            </button>
          </div>
        </form>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
