"use client";

import { useState, useEffect, useCallback } from "react";
import { Spinner } from "@/components/Spinner";
import { SaveIcon } from "@/components/Icons";
import type { BrandingSettings } from "@/lib/branding";

interface BrandingTabProps {
  onToast: (message: string, type?: "success" | "error" | "info") => void;
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

const sectionStyle: React.CSSProperties = {
  marginBottom: 28,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  marginBottom: 14,
  paddingBottom: 8,
  borderBottom: "1px solid var(--border)",
};

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: 36,
            height: 36,
            padding: 2,
            border: "1px solid var(--border)",
            borderRadius: 6,
            background: "var(--bg-secondary)",
            cursor: "pointer",
          }}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ ...inputStyle, flex: 1, fontFamily: "monospace" }}
          placeholder="#000000"
        />
      </div>
    </div>
  );
}

export function BrandingTab({ onToast }: BrandingTabProps) {
  const [branding, setBranding] = useState<BrandingSettings | null>(null);
  const [original, setOriginal] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings/branding")
      .then((r) => r.json())
      .then((data) => {
        if (data.branding) {
          setBranding(data.branding);
          setOriginal(JSON.stringify(data.branding));
        }
      })
      .catch(() => {});
  }, []);

  const hasChanges = branding
    ? JSON.stringify(branding) !== original
    : false;

  const handleSave = useCallback(async () => {
    if (!branding) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings/branding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branding }),
      });
      const data = await res.json();
      if (res.ok) {
        setOriginal(JSON.stringify(data.branding ?? branding));
        onToast("Branding saved", "success");
        setSaved(true);
      } else {
        onToast(data.error || "Save failed", "error");
      }
    } catch {
      onToast("Failed to connect", "error");
    }
    setSaving(false);
  }, [branding, onToast]);

  if (!branding) {
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        <Spinner size={24} />
      </div>
    );
  }

  const updateColor = (key: keyof BrandingSettings["colors"], val: string) => {
    setBranding((p) =>
      p ? { ...p, colors: { ...p.colors, [key]: val } } : p
    );
  };

  const updateGS = (
    key: keyof BrandingSettings["gettingStarted"],
    val: string
  ) => {
    setBranding((p) =>
      p
        ? { ...p, gettingStarted: { ...p.gettingStarted, [key]: val } }
        : p
    );
  };

  return (
    <div>
      {saved && (
        <div
          style={{
            padding: "10px 14px",
            marginBottom: 20,
            background: "rgba(74, 222, 128, 0.1)",
            border: "1px solid rgba(74, 222, 128, 0.3)",
            borderRadius: 8,
            fontSize: 13,
            color: "var(--green)",
          }}
        >
          Branding saved. Reload the page to see changes across the site.
        </div>
      )}

      {/* Identity */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>Identity</h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 14,
          }}
        >
          <div>
            <label style={labelStyle}>Server Name</label>
            <input
              type="text"
              value={branding.serverName}
              onChange={(e) =>
                setBranding((p) =>
                  p ? { ...p, serverName: e.target.value } : p
                )
              }
              style={inputStyle}
              placeholder="RealmManager"
            />
          </div>
          <div>
            <label style={labelStyle}>Accent Suffix</label>
            <input
              type="text"
              value={branding.serverNameAccent}
              onChange={(e) =>
                setBranding((p) =>
                  p ? { ...p, serverNameAccent: e.target.value } : p
                )
              }
              style={inputStyle}
              placeholder="Manager"
            />
            <div
              style={{
                fontSize: 11,
                color: "var(--text-secondary)",
                marginTop: 2,
              }}
            >
              End of server name rendered in accent color
            </div>
          </div>
          <div>
            <label style={labelStyle}>Page Title</label>
            <input
              type="text"
              value={branding.pageTitle}
              onChange={(e) =>
                setBranding((p) =>
                  p ? { ...p, pageTitle: e.target.value } : p
                )
              }
              style={inputStyle}
              placeholder="RealmManager"
            />
          </div>
          <div>
            <label style={labelStyle}>Server URL</label>
            <input
              type="text"
              value={branding.serverUrl}
              onChange={(e) =>
                setBranding((p) =>
                  p ? { ...p, serverUrl: e.target.value } : p
                )
              }
              style={inputStyle}
              placeholder="https://yourserver.com"
            />
          </div>
        </div>
      </div>

      {/* Colors */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>Colors</h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 14,
          }}
        >
          <ColorField
            label="Accent"
            value={branding.colors.accent}
            onChange={(v) => updateColor("accent", v)}
          />
          <ColorField
            label="Accent Hover"
            value={branding.colors.accentHover}
            onChange={(v) => updateColor("accentHover", v)}
          />
          <ColorField
            label="Background Primary"
            value={branding.colors.bgPrimary}
            onChange={(v) => updateColor("bgPrimary", v)}
          />
          <ColorField
            label="Background Secondary"
            value={branding.colors.bgSecondary}
            onChange={(v) => updateColor("bgSecondary", v)}
          />
          <ColorField
            label="Card Background"
            value={branding.colors.bgCard}
            onChange={(v) => updateColor("bgCard", v)}
          />
          <ColorField
            label="Text Primary"
            value={branding.colors.textPrimary}
            onChange={(v) => updateColor("textPrimary", v)}
          />
          <ColorField
            label="Text Secondary"
            value={branding.colors.textSecondary}
            onChange={(v) => updateColor("textSecondary", v)}
          />
        </div>
      </div>

      {/* Images */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>Images</h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 14,
          }}
        >
          <div>
            <label style={labelStyle}>Favicon URL</label>
            <input
              type="text"
              value={branding.faviconUrl}
              onChange={(e) =>
                setBranding((p) =>
                  p ? { ...p, faviconUrl: e.target.value } : p
                )
              }
              style={inputStyle}
              placeholder="https://example.com/favicon.ico"
            />
          </div>
          <div>
            <label style={labelStyle}>Logo URL</label>
            <input
              type="text"
              value={branding.logoUrl}
              onChange={(e) =>
                setBranding((p) =>
                  p ? { ...p, logoUrl: e.target.value } : p
                )
              }
              style={inputStyle}
              placeholder="https://example.com/logo.png"
            />
          </div>
          <div>
            <label style={labelStyle}>Icon URL</label>
            <input
              type="text"
              value={branding.iconUrl}
              onChange={(e) =>
                setBranding((p) =>
                  p ? { ...p, iconUrl: e.target.value } : p
                )
              }
              style={inputStyle}
              placeholder="https://example.com/icon.svg"
            />
          </div>
        </div>
      </div>

      {/* Getting Started */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>Getting Started Page</h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 14,
          }}
        >
          <div>
            <label style={labelStyle}>Server Address (Realmlist)</label>
            <input
              type="text"
              value={branding.gettingStarted.serverAddress}
              onChange={(e) => updateGS("serverAddress", e.target.value)}
              style={inputStyle}
              placeholder="play.yourserver.com"
            />
          </div>
          <div>
            <label style={labelStyle}>Client Download Link</label>
            <input
              type="text"
              value={branding.gettingStarted.downloadLink}
              onChange={(e) => updateGS("downloadLink", e.target.value)}
              style={inputStyle}
              placeholder="https://example.com/download"
            />
          </div>
          <div>
            <label style={labelStyle}>Download Button Text</label>
            <input
              type="text"
              value={branding.gettingStarted.downloadText}
              onChange={(e) => updateGS("downloadText", e.target.value)}
              style={inputStyle}
              placeholder="Download WoW 3.3.5a Client"
            />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>Custom Message</label>
            <textarea
              value={branding.gettingStarted.customMessage}
              onChange={(e) => updateGS("customMessage", e.target.value)}
              rows={3}
              style={{
                ...inputStyle,
                resize: "vertical",
              }}
              placeholder="Optional message shown at the top of the Getting Started page"
            />
          </div>
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
          {saving ? "Saving..." : "Save Branding"}
        </button>
      </div>
    </div>
  );
}
