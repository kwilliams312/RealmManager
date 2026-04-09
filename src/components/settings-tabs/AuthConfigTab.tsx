"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { StreamLanguage } from "@codemirror/language";
import { properties } from "@codemirror/legacy-modes/mode/properties";
import { Spinner } from "@/components/Spinner";
import { SaveIcon } from "@/components/Icons";

const CodeMirror = dynamic(() => import("@uiw/react-codemirror"), { ssr: false });
const confLanguage = StreamLanguage.define(properties);

interface AuthConfigTabProps {
  onToast: (message: string, type?: "success" | "error" | "info") => void;
}

export function AuthConfigTab({ onToast }: AuthConfigTabProps) {
  const [content, setContent] = useState("");
  const [original, setOriginal] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/settings/auth-config")
      .then((r) => r.json())
      .then((data) => {
        if (data.content) {
          setContent(data.content);
          setOriginal(data.content);
        } else if (data.error) {
          setError(data.error);
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load authserver.conf");
        setLoading(false);
      });
  }, []);

  const hasChanges = content !== original;

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/auth-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (res.ok) {
        setOriginal(content);
        onToast("Auth server config saved", "success");
        setSaved(true);
      } else {
        onToast(data.error || "Save failed", "error");
      }
    } catch {
      onToast("Failed to save", "error");
    }
    setSaving(false);
  }, [content, onToast]);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        <Spinner size={24} />
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: 40,
          color: "var(--text-secondary)",
        }}
      >
        <p>{error}</p>
        <p style={{ fontSize: 12, marginTop: 8 }}>
          The auth server config file may not exist yet. Build and start the
          auth server first.
        </p>
      </div>
    );
  }

  return (
    <div>
      {saved && (
        <div
          style={{
            padding: "10px 14px",
            marginBottom: 16,
            background: "rgba(251, 191, 36, 0.1)",
            border: "1px solid rgba(251, 191, 36, 0.3)",
            borderRadius: 8,
            fontSize: 13,
            color: "var(--yellow)",
          }}
        >
          Restart the auth server to apply configuration changes.
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700 }}>authserver.conf</h3>
          <p
            style={{
              fontSize: 12,
              color: "var(--text-secondary)",
              marginTop: 2,
            }}
          >
            Global authentication server configuration (shared across all
            realms).
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 14px",
            background: !hasChanges ? "var(--bg-hover)" : "var(--green)",
            color: !hasChanges ? "var(--text-secondary)" : "#000",
            border: "none",
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            cursor: !hasChanges ? "not-allowed" : "pointer",
          }}
        >
          {saving ? <Spinner size={12} /> : <SaveIcon />}
          {saving ? "Saving..." : "Save"}
        </button>
      </div>

      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        <CodeMirror
          value={content}
          height="550px"
          theme="dark"
          extensions={[confLanguage]}
          onChange={(value) => setContent(value)}
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            highlightActiveLine: true,
          }}
          style={{ fontSize: 12 }}
        />
      </div>
    </div>
  );
}
