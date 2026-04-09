"use client";

import { useState, useEffect, useCallback } from "react";
import { Toast, type ToastType } from "@/components/Toast";

interface SourceWithManifest {
  sourceId: string;
  name: string;
  sourceType: "git" | "image";
  url: string;
  defaultBranch: string;
  imageName: string | null;
  sourceManifest: { metadata?: { name?: string; description?: string }; databases?: Array<{ name: string }>; modules?: Array<{ name: string }> } | null;
  manifestYaml: string | null;
}

interface Preset {
  name: string;
  description: string;
  yaml: string;
}

const PRESET_BADGE: Record<string, string> = {
  vanilla: "#6b7280",
  playerbots: "#d97706",
};

function PresetBadge({ yaml }: { yaml: string | null }) {
  if (!yaml) return <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "rgba(107,114,128,0.15)", color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>none</span>;
  const match = yaml.match(/^name:\s*(\S+)/m);
  const preset = match?.[1] ?? "custom";
  const color = PRESET_BADGE[preset] ?? "#6b7280";
  return (
    <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: `${color}22`, color, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
      {preset}
    </span>
  );
}

export default function ManifestsPage() {
  const [sources, setSources] = useState<SourceWithManifest[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SourceWithManifest | null>(null);
  const [editorYaml, setEditorYaml] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const fetchSources = useCallback(async () => {
    try {
      const res = await fetch("/api/builds/sources");
      const data = await res.json();
      if (data.sources) setSources(data.sources);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  const fetchPresets = useCallback(async () => {
    try {
      const res = await fetch("/api/manifests/presets");
      const data = await res.json();
      if (data.presets) setPresets(data.presets);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchSources(); fetchPresets(); }, [fetchSources, fetchPresets]);

  const selectSource = (src: SourceWithManifest) => {
    setSelected(src);
    setEditorYaml(src.manifestYaml ?? "");
    setValidationError(null);
  };

  const handleLoadPreset = (preset: Preset) => {
    setEditorYaml(preset.yaml);
    setValidationError(null);
  };

  const handleValidate = async () => {
    if (!editorYaml.trim()) {
      setValidationError("Manifest is empty");
      return;
    }
    // Validate via a dedicated endpoint — does not save
    try {
      const res = await fetch("/api/manifests/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manifest: editorYaml }),
      });
      const data = await res.json();
      if (res.ok) {
        setValidationError(null);
        setToast({ message: "Manifest is valid", type: "success" });
      } else {
        setValidationError(data.error ?? "Validation failed");
      }
    } catch {
      setToast({ message: "Failed to connect", type: "error" });
    }
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    setValidationError(null);
    try {
      const res = await fetch(`/api/builds/sources/${encodeURIComponent(selected.sourceId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manifest: editorYaml }),
      });
      const data = await res.json();
      if (res.ok) {
        setToast({ message: "Manifest saved", type: "success" });
        await fetchSources();
      } else {
        setValidationError(data.error ?? "Failed to save");
      }
    } catch {
      setToast({ message: "Failed to connect", type: "error" });
    }
    setSaving(false);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "8px 12px", background: "var(--bg-secondary)",
    border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-primary)",
    fontSize: 13, outline: "none", boxSizing: "border-box",
  };

  if (loading) {
    return <div style={{ textAlign: "center", marginTop: 60, color: "var(--text-secondary)" }}>Loading...</div>;
  }

  return (
    <div style={{ display: "flex", height: "calc(100vh - 56px)", overflow: "hidden" }}>
      {/* Source list */}
      <div style={{ width: 280, borderRight: "1px solid var(--border)", overflowY: "auto", flexShrink: 0 }}>
        <div style={{ padding: "16px 16px 8px", borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5 }}>Sources</h2>
        </div>
        {sources.length === 0 ? (
          <div style={{ padding: 24, color: "var(--text-secondary)", fontSize: 13 }}>No sources configured.</div>
        ) : (
          sources.map((src) => (
            <button
              key={src.sourceId}
              onClick={() => selectSource(src)}
              style={{
                display: "block", width: "100%", padding: "12px 16px", textAlign: "left",
                background: selected?.sourceId === src.sourceId ? "var(--bg-hover)" : "transparent",
                border: "none", borderBottom: "1px solid var(--border)", cursor: "pointer",
                borderLeft: selected?.sourceId === src.sourceId ? "3px solid var(--accent)" : "3px solid transparent",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)" }}>{src.name}</span>
                <PresetBadge yaml={src.manifestYaml} />
              </div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                {src.sourceManifest?.databases?.length
                  ? `${src.sourceManifest.databases.length} extra DB${src.sourceManifest.databases.length > 1 ? "s" : ""}`
                  : "No extra DBs"
                }
                {src.sourceManifest?.modules?.length
                  ? ` · ${src.sourceManifest.modules.length} module${src.sourceManifest.modules.length > 1 ? "s" : ""}`
                  : ""
                }
              </div>
            </button>
          ))
        )}
      </div>

      {/* Editor panel */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {!selected ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📄</div>
              <div style={{ fontSize: 14 }}>Select a source to edit its manifest</div>
              <div style={{ fontSize: 12, marginTop: 6, color: "var(--text-secondary)", opacity: 0.7 }}>
                Manifests define how a source is built and how realms are configured.
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Editor toolbar */}
            <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{selected.name}</span>
                <span style={{ marginLeft: 8, fontSize: 11, color: "var(--text-secondary)", fontFamily: "monospace" }}>{selected.sourceId}</span>
              </div>

              {/* Preset loader */}
              {presets.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Load preset:</span>
                  <select
                    onChange={(e) => {
                      const preset = presets.find((p) => p.name === e.target.value);
                      if (preset) handleLoadPreset(preset);
                      e.target.value = "";
                    }}
                    defaultValue=""
                    style={{ ...inputStyle, width: "auto", padding: "4px 8px", fontSize: 12, cursor: "pointer" }}
                  >
                    <option value="" disabled>— select —</option>
                    {presets.map((p) => (
                      <option key={p.name} value={p.name}>{p.name} — {p.description}</option>
                    ))}
                  </select>
                </div>
              )}

              <button
                onClick={handleValidate}
                style={{ padding: "6px 14px", background: "transparent", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-secondary)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
              >
                Validate
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{ padding: "6px 14px", background: "var(--accent)", color: "#0f1117", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer" }}
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>

            {/* Validation error */}
            {validationError && (
              <div style={{ padding: "8px 20px", background: "rgba(239,68,68,0.1)", borderBottom: "1px solid rgba(239,68,68,0.2)", color: "var(--red)", fontSize: 12, fontFamily: "monospace" }}>
                {validationError}
              </div>
            )}

            {/* YAML editor */}
            <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", padding: 20 }}>
              <div style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5 }}>realmmanager.yaml</span>
                {!editorYaml && (
                  <span style={{ fontSize: 11, color: "var(--text-secondary)", opacity: 0.6 }}>— no manifest configured</span>
                )}
              </div>
              <textarea
                value={editorYaml}
                onChange={(e) => { setEditorYaml(e.target.value); setValidationError(null); }}
                spellCheck={false}
                placeholder={`apiVersion: v1\nkind: RealmSource\nmetadata:\n  name: my-source\n  description: My custom AzerothCore fork`}
                style={{
                  flex: 1, resize: "none", fontFamily: "'Fira Code', 'Cascadia Code', monospace", fontSize: 12,
                  lineHeight: 1.6, padding: "12px 16px", background: "var(--bg-secondary)",
                  border: `1px solid ${validationError ? "var(--red)" : "var(--border)"}`,
                  borderRadius: 8, color: "var(--text-primary)", outline: "none",
                  tabSize: 2,
                }}
                onKeyDown={(e) => {
                  // Tab inserts 2 spaces
                  if (e.key === "Tab") {
                    e.preventDefault();
                    const el = e.currentTarget;
                    const start = el.selectionStart;
                    const end = el.selectionEnd;
                    const newVal = editorYaml.substring(0, start) + "  " + editorYaml.substring(end);
                    setEditorYaml(newVal);
                    requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = start + 2; });
                  }
                }}
              />
              <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-secondary)", opacity: 0.6 }}>
                Tab inserts 2 spaces · Changes are applied on next build and realm start
              </div>
            </div>
          </>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
