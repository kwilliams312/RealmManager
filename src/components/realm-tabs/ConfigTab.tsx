"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import type { TabProps } from "./types";
import { Spinner } from "@/components/Spinner";
import { SaveIcon, FileIcon } from "@/components/Icons";

// CodeMirror is client-only
const CodeMirror = dynamic(() => import("@uiw/react-codemirror"), { ssr: false });

interface ConfigState {
  content: string;
  original: string;
  loading: boolean;
}

export function ConfigTab({ realm, onToast }: TabProps) {
  const [configs, setConfigs] = useState<Record<string, ConfigState>>({});
  const [activeConfig, setActiveConfig] = useState<string>("worldserver");
  const [saving, setSaving] = useState(false);
  const loadedRealm = useRef<number | null>(null);

  const loadConfigs = useCallback(async () => {
    if (loadedRealm.current === realm.id) return;
    loadedRealm.current = realm.id;

    setConfigs({ _loading: { content: "", original: "", loading: true } });

    try {
      const res = await fetch(`/api/realms/${realm.id}/config`);
      const data = await res.json();
      if (data.configs) {
        const loaded: Record<string, ConfigState> = {};
        for (const [name, content] of Object.entries(data.configs as Record<string, string>)) {
          loaded[name] = { content, original: content, loading: false };
        }
        setConfigs(loaded);
        const names = Object.keys(loaded);
        if (names.length > 0 && !names.includes(activeConfig)) {
          setActiveConfig(names[0]);
        }
      } else {
        setConfigs({});
      }
    } catch {
      setConfigs({});
    }
  }, [realm.id]);

  useEffect(() => {
    loadedRealm.current = null;
    loadConfigs();
  }, [realm.id, loadConfigs]);

  const saveConfig = useCallback(async () => {
    const cfg = configs[activeConfig];
    if (!cfg || cfg.content === cfg.original) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/realms/${realm.id}/config/${activeConfig}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: cfg.content }),
      });
      const data = await res.json();
      if (res.ok) {
        setConfigs((prev) => ({
          ...prev,
          [activeConfig]: { ...prev[activeConfig], original: cfg.content },
        }));
        onToast("Configuration saved — restart the realm for changes to take effect", "success");
      } else {
        onToast(data.error || "Save failed", "error");
      }
    } catch {
      onToast("Failed to save", "error");
    }
    setSaving(false);
  }, [activeConfig, configs, realm.id, onToast]);

  const configNames = Object.keys(configs).filter((k) => k !== "_loading");
  const isLoading = configs["_loading"]?.loading;
  const activeCfg = configs[activeConfig];
  const hasChanges = activeCfg ? activeCfg.content !== activeCfg.original : false;

  if (isLoading) {
    return <div style={{ textAlign: "center", padding: 40 }}><Spinner size={24} /></div>;
  }

  if (configNames.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)" }}>
        <p style={{ fontSize: 14, marginBottom: 8 }}>No configuration files found</p>
        <p style={{ fontSize: 12 }}>
          Run a build first from the <strong>Builds</strong> tab — configuration files are generated during the Docker build.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid var(--border)",
          marginBottom: 0,
        }}
      >
        <div style={{ display: "flex" }}>
          {configNames.map((name) => {
            const isActive = name === activeConfig;
            const modified = configs[name]?.content !== configs[name]?.original;
            return (
              <button
                key={name}
                onClick={() => setActiveConfig(name)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "10px 14px", background: "none", border: "none",
                  borderBottom: isActive ? "2px solid var(--yellow)" : "2px solid transparent",
                  color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                  fontSize: 12, fontWeight: isActive ? 600 : 400,
                  cursor: "pointer", transition: "all 0.15s",
                }}
              >
                <FileIcon active={isActive} />
                {name}.conf
                {modified && (
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--yellow)", display: "inline-block" }} />
                )}
              </button>
            );
          })}
        </div>
        <button
          onClick={saveConfig}
          disabled={saving || !hasChanges}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 14px", marginRight: 8,
            background: !hasChanges ? "var(--bg-hover)" : "var(--green)",
            color: !hasChanges ? "var(--text-secondary)" : "#000",
            border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600,
            cursor: !hasChanges ? "not-allowed" : "pointer",
          }}
        >
          {saving ? <Spinner size={12} /> : <SaveIcon />}
          {saving ? "Saving..." : "Save"}
        </button>
      </div>

      {activeCfg?.loading ? (
        <div style={{ textAlign: "center", padding: 40 }}>
          <Spinner size={24} />
        </div>
      ) : activeCfg?.content ? (
        <CodeMirror
          value={activeCfg.content}
          height="550px"
          theme="dark"
          onChange={(value) => {
            setConfigs((prev) => ({
              ...prev,
              [activeConfig]: { ...prev[activeConfig], content: value },
            }));
          }}
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            highlightActiveLine: true,
          }}
          style={{ fontSize: 12 }}
        />
      ) : (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)" }}>
          <p>No config file found for {activeConfig}.conf</p>
          <p style={{ fontSize: 12, marginTop: 8 }}>Build the realm first to generate default configuration.</p>
        </div>
      )}
    </div>
  );
}
