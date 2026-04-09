"use client";

import { useState, useEffect, useCallback } from "react";
import { Spinner } from "@/components/Spinner";
import { SaveIcon } from "@/components/Icons";

interface DbConfigTabProps {
  onToast: (message: string, type?: "success" | "error" | "info") => void;
}

interface DbSettings {
  host: string;
  port: number;
  user: string;
  password: string;
  rootPassword: string;
  authDb: string;
  worldDb: string;
  charactersDb: string;
}

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
  marginBottom: 4,
};

function PasswordField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={{ position: "relative" }}>
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={inputStyle}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          style={{
            position: "absolute",
            right: 8,
            top: "50%",
            transform: "translateY(-50%)",
            background: "none",
            border: "none",
            color: "var(--text-secondary)",
            fontSize: 11,
            cursor: "pointer",
          }}
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}

export function DbConfigTab({ onToast }: DbConfigTabProps) {
  const [db, setDb] = useState<DbSettings | null>(null);
  const [original, setOriginal] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings/db-config")
      .then((r) => r.json())
      .then((data) => {
        if (data.db) {
          setDb(data.db);
          setOriginal(JSON.stringify(data.db));
        }
      })
      .catch(() => {});
  }, []);

  const hasChanges = db ? JSON.stringify(db) !== original : false;

  const handleSave = useCallback(async () => {
    if (!db) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings/db-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ db }),
      });
      const data = await res.json();
      if (res.ok) {
        setOriginal(JSON.stringify(data.db ?? db));
        onToast("DB configuration saved", "success");
        setSaved(true);
      } else {
        onToast(data.error || "Save failed", "error");
      }
    } catch {
      onToast("Failed to save", "error");
    }
    setSaving(false);
  }, [db, onToast]);

  if (!db) {
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        <Spinner size={24} />
      </div>
    );
  }

  const update = (key: keyof DbSettings, value: string | number) => {
    setDb((p) => (p ? { ...p, [key]: value } : p));
  };

  return (
    <div>
      {saved && (
        <div
          style={{
            padding: "10px 14px",
            marginBottom: 20,
            background: "rgba(248, 113, 113, 0.1)",
            border: "1px solid rgba(248, 113, 113, 0.3)",
            borderRadius: 8,
            fontSize: 13,
            color: "var(--red)",
            fontWeight: 600,
          }}
        >
          Restart Required — The WebUI container must be restarted for
          database connection changes to take effect.
        </div>
      )}

      {/* WebUI Database */}
      <div style={{ marginBottom: 28 }}>
        <h3
          style={{
            fontSize: 14,
            fontWeight: 700,
            marginBottom: 14,
            paddingBottom: 8,
            borderBottom: "1px solid var(--border)",
          }}
        >
          WebUI Database Connection
        </h3>
        <p
          style={{
            fontSize: 12,
            color: "var(--text-secondary)",
            marginBottom: 14,
          }}
        >
          Connection settings for the WebUI to access the AzerothCore
          databases. Changes require a container restart.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 14,
          }}
        >
          <div>
            <label style={labelStyle}>Host</label>
            <input
              type="text"
              value={db.host}
              onChange={(e) => update("host", e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Port</label>
            <input
              type="number"
              value={db.port}
              onChange={(e) => update("port", parseInt(e.target.value) || 3306)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Username</label>
            <input
              type="text"
              value={db.user}
              onChange={(e) => update("user", e.target.value)}
              style={inputStyle}
            />
          </div>
          <PasswordField
            label="Password"
            value={db.password}
            onChange={(v) => update("password", v)}
          />
          <div>
            <label style={labelStyle}>Auth Database</label>
            <input
              type="text"
              value={db.authDb}
              onChange={(e) => update("authDb", e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>World Database</label>
            <input
              type="text"
              value={db.worldDb}
              onChange={(e) => update("worldDb", e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Characters Database</label>
            <input
              type="text"
              value={db.charactersDb}
              onChange={(e) => update("charactersDb", e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>
      </div>

      {/* Per-Realm Defaults */}
      <div style={{ marginBottom: 28 }}>
        <h3
          style={{
            fontSize: 14,
            fontWeight: 700,
            marginBottom: 14,
            paddingBottom: 8,
            borderBottom: "1px solid var(--border)",
          }}
        >
          Per-Realm Database Defaults
        </h3>
        <p
          style={{
            fontSize: 12,
            color: "var(--text-secondary)",
            marginBottom: 14,
          }}
        >
          Default database root password used when creating new realm
          containers. Applied to new realms only.
        </p>
        <div style={{ maxWidth: 400 }}>
          <PasswordField
            label="DB Root Password"
            value={db.rootPassword}
            onChange={(v) => update("rootPassword", v)}
          />
        </div>
      </div>

      {/* Save */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 18px",
            background: !hasChanges ? "var(--bg-hover)" : "var(--accent)",
            color: !hasChanges ? "var(--text-secondary)" : "#0f1117",
            border: "none",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 700,
            cursor: !hasChanges ? "not-allowed" : "pointer",
          }}
        >
          {saving ? <Spinner size={14} /> : <SaveIcon />}
          {saving ? "Saving..." : "Save DB Config"}
        </button>
      </div>
    </div>
  );
}
