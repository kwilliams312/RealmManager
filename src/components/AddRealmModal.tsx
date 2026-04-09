"use client";

import { useState, useEffect } from "react";
import { Spinner } from "./Spinner";
import type { GlobalBuild, BuildSource } from "@/types/realm";

interface AddRealmModalProps {
  onClose: () => void;
  onCreated: () => void;
}

type LocalSelection =
  | { type: "build"; buildId: number }
  | { type: "image"; sourceId: string };

export function AddRealmModal({ onClose, onCreated }: AddRealmModalProps) {
  const [builds, setBuilds] = useState<GlobalBuild[]>([]);
  const [imageSources, setImageSources] = useState<BuildSource[]>([]);
  const [selection, setSelection] = useState<LocalSelection | null>(null);
  const [selectedBuildId, setSelectedBuildId] = useState<number | "">("");
  const [name, setName] = useState("");
  const [realmType, setRealmType] = useState<"local" | "remote">("local");
  const [address, setAddress] = useState("");
  const [port, setPort] = useState("8085");
  const [raHost, setRaHost] = useState("");
  const [raPort, setRaPort] = useState("3443");
  const [raUser, setRaUser] = useState("");
  const [raPass, setRaPass] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [loadingBuilds, setLoadingBuilds] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/builds").then((r) => r.json()),
      fetch("/api/builds/sources").then((r) => r.json()),
    ]).then(([buildsData, sourcesData]) => {
      const successful = (buildsData.builds ?? []).filter((b: GlobalBuild) => b.status === "success");
      setBuilds(successful);
      const imgSources = (sourcesData.sources ?? []).filter((s: BuildSource) => s.sourceType === "image");
      setImageSources(imgSources);
      // Default selection: first image source or first build
      if (imgSources.length > 0) {
        setSelection({ type: "image", sourceId: imgSources[0].sourceId });
      } else if (successful.length > 0) {
        setSelection({ type: "build", buildId: successful[0].id });
        setSelectedBuildId(successful[0].id);
      }
    }).catch(() => {}).finally(() => setLoadingBuilds(false));
  }, []);

  const isRemote = realmType === "remote";
  const canCreate = isRemote
    ? name && address
    : name && selection !== null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setCreating(true);
    try {
      const body = isRemote
        ? { name, isRemote: true, address, port: parseInt(port) || 8085, raHost: raHost || address, raPort: parseInt(raPort) || 3443, raUser: raUser || undefined, raPass: raPass || undefined }
        : selection?.type === "image"
          ? { name, sourceId: selection.sourceId }
          : { name, buildId: selection?.buildId };
      const res = await fetch("/api/realms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        onCreated();
      } else {
        setError(data.error || "Failed to create realm");
      }
    } catch {
      setError("Failed to connect to server");
    }
    setCreating(false);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "8px 12px", background: "var(--bg-secondary)",
    border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-primary)",
    fontSize: 13, outline: "none", boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-secondary)",
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, marginTop: 14,
  };

  const formatTag = (tag: string): string => {
    const m = tag.match(/(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/);
    if (!m) return tag;
    const d = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]), parseInt(m[4]), parseInt(m[5]), parseInt(m[6]));
    return d.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }} onClick={onClose}>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 28, width: 460, animation: "slideIn 0.2s ease" }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Create New Realm</h3>

        <form onSubmit={handleCreate}>
          {/* Local / Remote toggle */}
          <div style={{ display: "flex", marginBottom: 16, borderRadius: 8, overflow: "hidden", border: "1px solid var(--border)" }}>
            {(["local", "remote"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setRealmType(t)}
                style={{
                  flex: 1, padding: "8px 0", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer",
                  background: realmType === t ? "var(--accent)" : "var(--bg-secondary)",
                  color: realmType === t ? "#0f1117" : "var(--text-secondary)",
                  transition: "all 0.15s",
                }}
              >
                {t === "local" ? "Local" : "Remote"}
              </button>
            ))}
          </div>

          <label style={labelStyle}>Realm Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} placeholder="My Realm" required autoFocus />

          {isRemote ? (
            <>
              <label style={labelStyle}>Server Address</label>
              <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} style={inputStyle} placeholder="10.0.0.5 or realm.example.com" required />

              <label style={labelStyle}>World Port</label>
              <input type="number" value={port} onChange={(e) => setPort(e.target.value)} style={inputStyle} placeholder="8085" />

              <div style={{ marginTop: 12, padding: "12px 14px", background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>RA Console (optional)</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div>
                    <label style={{ ...labelStyle, fontSize: 10 }}>RA Host</label>
                    <input type="text" value={raHost} onChange={(e) => setRaHost(e.target.value)} style={inputStyle} placeholder={address || "Same as address"} />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, fontSize: 10 }}>RA Port</label>
                    <input type="number" value={raPort} onChange={(e) => setRaPort(e.target.value)} style={inputStyle} placeholder="3443" />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, fontSize: 10 }}>RA Username</label>
                    <input type="text" value={raUser} onChange={(e) => setRaUser(e.target.value)} style={inputStyle} placeholder="admin" />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, fontSize: 10 }}>RA Password</label>
                    <input type="password" value={raPass} onChange={(e) => setRaPass(e.target.value)} style={inputStyle} placeholder="password" />
                  </div>
                </div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 6 }}>
                  RA credentials enable the Console tab and player count stats. You can add them later in Settings.
                </div>
              </div>
            </>
          ) : loadingBuilds ? (
            <div style={{ textAlign: "center", padding: 20 }}><Spinner size={20} /></div>
          ) : imageSources.length === 0 && builds.length === 0 ? (
            <div style={{ textAlign: "center", padding: 20 }}>
              <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 16 }}>
                No sources available. Add a Docker image or git source and build it first.
              </p>
              <a href="/builds" style={{ color: "var(--accent)", fontWeight: 600, fontSize: 14, textDecoration: "none" }}>
                Go to Builds page →
              </a>
            </div>
          ) : (
            <>
              <label style={labelStyle}>Worldserver Image</label>
              <select
                value={selection ? (selection.type === "image" ? `img:${selection.sourceId}` : `build:${selection.buildId}`) : ""}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v.startsWith("img:")) {
                    setSelection({ type: "image", sourceId: v.slice(4) });
                  } else if (v.startsWith("build:")) {
                    const id = parseInt(v.slice(6));
                    setSelection({ type: "build", buildId: id });
                    setSelectedBuildId(id);
                  }
                }}
                style={{ ...inputStyle, cursor: "pointer", appearance: "auto" }}
              >
                {imageSources.length > 0 && (
                  <optgroup label="Docker Images (pre-built)">
                    {imageSources.map((src) => (
                      <option key={`img:${src.sourceId}`} value={`img:${src.sourceId}`}>
                        {src.name} — {src.imageName}:{src.imageTag}
                      </option>
                    ))}
                  </optgroup>
                )}
                {builds.length > 0 && (
                  <optgroup label="Built from Source">
                    {builds.map((b) => (
                      <option key={`build:${b.id}`} value={`build:${b.id}`}>
                        {b.source_id} — {formatTag(b.image_tag)} ({b.source_branch})
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </>
          )}

          {error && (
            <div style={{ padding: "10px 14px", marginTop: 12, background: "var(--red-bg)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 6, color: "var(--red)", fontSize: 13 }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
            <button type="button" onClick={onClose} style={{ padding: "8px 18px", background: "transparent", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button type="submit" disabled={creating || !canCreate} style={{ padding: "8px 18px", background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#0f1117", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: creating || !canCreate ? "not-allowed" : "pointer", opacity: creating || !canCreate ? 0.6 : 1, display: "flex", alignItems: "center", gap: 8 }}>
              {creating && <Spinner size={14} />}
              {creating ? "Creating..." : "Create Realm"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
