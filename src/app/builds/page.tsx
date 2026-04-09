"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Spinner } from "@/components/Spinner";
import { Toast, type ToastType } from "@/components/Toast";
import type { BuildSource, GlobalBuild, GitHubToken } from "@/types/realm";

function formatBuildDate(tag: string): string {
  // tag format: {sourceId}-YYYYMMDD-HHmmss
  const m = tag.match(/(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/);
  if (!m) return tag;
  const d = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]), parseInt(m[4]), parseInt(m[5]), parseInt(m[6]));
  return d.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function StatusBadge({ status }: { status: string }) {
  const isSuccess = status === "success";
  const isBuilding = status === "building";
  const color = isSuccess ? "var(--green)" : isBuilding ? "var(--yellow)" : "var(--red)";
  const bg = isSuccess ? "var(--green-bg)" : isBuilding ? "var(--yellow-bg)" : "var(--red-bg)";
  const label = isSuccess ? "Success" : isBuilding ? "Building..." : "Failed";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 10px", borderRadius: 10, fontSize: 11, fontWeight: 600, background: bg, color }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, animation: isBuilding ? "pulse 1.5s infinite" : undefined }} />
      {label}
    </span>
  );
}

export default function BuildsPage() {
  const [sources, setSources] = useState<BuildSource[]>([]);
  const [builds, setBuilds] = useState<GlobalBuild[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddSource, setShowAddSource] = useState(false);
  const [addForm, setAddForm] = useState({ sourceId: "", name: "", url: "", defaultBranch: "master", githubTokenId: "" as string, sourceType: "git" as "image" | "git", imageName: "", imageTag: "latest" });
  const [adding, setAdding] = useState(false);
  const [tokens, setTokens] = useState<GitHubToken[]>([]);
  const [editSource, setEditSource] = useState<BuildSource | null>(null);
  const [editForm, setEditForm] = useState({ name: "", url: "", defaultBranch: "", githubTokenId: "" as string, sourceType: "git" as "image" | "git", imageName: "", imageTag: "latest" });
  const [saving, setSaving] = useState(false);
  const [buildingSource, setBuildingSource] = useState<string | null>(null);
  const [liveLog, setLiveLog] = useState<string[]>([]);
  const [liveLogSourceId, setLiveLogSourceId] = useState<string | null>(null);
  const [selectedBuildLog, setSelectedBuildLog] = useState<GlobalBuild | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const fetchSources = useCallback(async () => {
    try {
      const res = await fetch("/api/builds/sources");
      const data = await res.json();
      if (data.sources) setSources(data.sources);
    } catch { /* ignore */ }
  }, []);

  const fetchBuilds = useCallback(async () => {
    try {
      const res = await fetch("/api/builds");
      const data = await res.json();
      if (data.builds) setBuilds(data.builds);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  const pollLiveLog = useCallback(async (sourceId: string) => {
    try {
      const res = await fetch(`/api/builds/live/${sourceId}`);
      const data = await res.json();
      if (data.log?.length > 0) setLiveLog(data.log);
    } catch { /* ignore */ }
  }, []);

  const fetchTokens = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/github-tokens");
      const data = await res.json();
      if (data.tokens) setTokens(data.tokens);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchSources(); fetchBuilds(); fetchTokens(); }, [fetchSources, fetchBuilds, fetchTokens]);

  // Auto-detect which source is building and show its live log
  const buildingSourceId = builds.find(
    (b) => b.status === "building"
  )?.source_id ?? null;

  useEffect(() => {
    if (buildingSourceId) setLiveLogSourceId(buildingSourceId);
  }, [buildingSourceId]);

  // Poll during active builds — fetch both build list and live log
  const hasActiveBuilds = buildingSourceId !== null;
  useEffect(() => {
    if (!hasActiveBuilds) return;
    const interval = setInterval(() => {
      fetchBuilds();
      if (liveLogSourceId) pollLiveLog(liveLogSourceId);
    }, 2000);
    // Immediate first poll
    if (liveLogSourceId) pollLiveLog(liveLogSourceId);
    return () => clearInterval(interval);
  }, [hasActiveBuilds, fetchBuilds, pollLiveLog, liveLogSourceId]);

  // Clear live log when build finishes
  useEffect(() => {
    if (!hasActiveBuilds && liveLog.length > 0 && !liveLogSourceId) {
      setLiveLog([]);
    }
  }, [hasActiveBuilds, liveLog.length, liveLogSourceId]);

  useEffect(() => { logRef.current?.scrollTo(0, logRef.current.scrollHeight); }, [liveLog]);

  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    try {
      const payload = addForm.sourceType === "image"
        ? {
            sourceId: addForm.sourceId,
            name: addForm.name,
            sourceType: "image" as const,
            imageName: addForm.imageName,
            imageTag: addForm.imageTag || "latest",
          }
        : {
            sourceId: addForm.sourceId,
            name: addForm.name,
            sourceType: "git" as const,
            url: addForm.url,
            defaultBranch: addForm.defaultBranch,
            githubTokenId: addForm.githubTokenId ? parseInt(addForm.githubTokenId) : null,
          };
      const res = await fetch("/api/builds/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setToast({ message: "Source added", type: "success" });
        setShowAddSource(false);
        setAddForm({ sourceId: "", name: "", url: "", defaultBranch: "master", githubTokenId: "", sourceType: "git", imageName: "", imageTag: "latest" });
        fetchSources();
      } else {
        setToast({ message: data.error || "Failed to add source", type: "error" });
      }
    } catch { setToast({ message: "Failed to connect", type: "error" }); }
    setAdding(false);
  };

  const openEditSource = (src: BuildSource) => {
    setEditSource(src);
    setEditForm({
      name: src.name,
      url: src.url,
      defaultBranch: src.defaultBranch,
      githubTokenId: src.githubTokenId ? String(src.githubTokenId) : "",
      sourceType: src.sourceType ?? "git",
      imageName: src.imageName ?? "",
      imageTag: src.imageTag ?? "latest",
    });
  };

  const handleEditSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSource) return;
    setSaving(true);
    try {
      const payload = editForm.sourceType === "image"
        ? {
            name: editForm.name,
            sourceType: "image" as const,
            imageName: editForm.imageName,
            imageTag: editForm.imageTag || "latest",
          }
        : {
            name: editForm.name,
            url: editForm.url,
            defaultBranch: editForm.defaultBranch,
            githubTokenId: editForm.githubTokenId ? parseInt(editForm.githubTokenId) : null,
          };
      const res = await fetch(`/api/builds/sources/${encodeURIComponent(editSource.sourceId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setToast({ message: "Source updated", type: "success" });
        setEditSource(null);
        fetchSources();
      } else {
        setToast({ message: data.error || "Failed to update source", type: "error" });
      }
    } catch { setToast({ message: "Failed to connect", type: "error" }); }
    setSaving(false);
  };

  const handleBuild = async (sourceId: string) => {
    setBuildingSource(sourceId);
    setLiveLogSourceId(sourceId);
    setLiveLog([]);
    setSelectedBuildLog(null);
    try {
      const res = await fetch("/api/builds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId }),
      });
      const data = await res.json();
      if (res.ok) {
        setToast({ message: "Build started", type: "info" });
        fetchBuilds();
      } else {
        setToast({ message: data.error || "Failed to start build", type: "error" });
      }
    } catch { setToast({ message: "Failed to connect", type: "error" }); }
    setBuildingSource(null);
  };

  const handleDeleteBuild = async (buildId: number) => {
    setDeletingId(buildId);
    try {
      const res = await fetch(`/api/builds/${buildId}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        setToast({ message: "Build deleted", type: "success" });
        fetchBuilds();
      } else {
        setToast({ message: data.error || "Delete failed", type: "error" });
      }
    } catch { setToast({ message: "Failed to connect", type: "error" }); }
    setDeletingId(null);
  };

  const handleDeleteSource = async (sourceId: string) => {
    try {
      const res = await fetch(`/api/builds/sources/${sourceId}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        setToast({ message: "Source removed", type: "success" });
        fetchSources();
        fetchBuilds();
      } else {
        setToast({ message: data.error || "Delete failed", type: "error" });
      }
    } catch { setToast({ message: "Failed to connect", type: "error" }); }
  };

  if (loading) return <div style={{ textAlign: "center", marginTop: 60 }}><Spinner size={32} /></div>;

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "8px 12px", background: "var(--bg-secondary)",
    border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-primary)",
    fontSize: 13, outline: "none", boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-secondary)",
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4, marginTop: 12,
  };

  const displayLog = selectedBuildLog?.build_log ?? liveLog;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Builds</h2>
      </div>

      {/* Sources */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5 }}>Sources</h3>
          <button onClick={() => setShowAddSource(true)} style={{ padding: "6px 14px", background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#0f1117", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            + Add Source
          </button>
        </div>

        {sources.length === 0 ? (
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: 32, textAlign: "center", color: "var(--text-secondary)" }}>
            No sources configured — add one to get started.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sources.map((src) => {
              const srcBuilding = builds.some((b) => b.source_id === src.sourceId && b.status === "building");
              return (
                <div key={src.sourceId} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: 16, display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{src.name}</span>
                      <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: src.sourceType === "image" ? "rgba(96,165,250,0.15)" : "rgba(245,158,11,0.15)", color: src.sourceType === "image" ? "#60a5fa" : "var(--accent)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                        {src.sourceType === "image" ? "Image" : "Git"}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                      {src.sourceType === "image"
                        ? <>{src.imageName}:<span style={{ color: "var(--accent)" }}>{src.imageTag}</span></>
                        : <>{src.url} @ <span style={{ color: "var(--accent)" }}>{src.defaultBranch}</span></>
                      }
                    </div>
                    {src.sourceType === "git" && src.githubTokenId && (() => {
                      const tok = tokens.find((t) => t.id === src.githubTokenId);
                      return tok ? (
                        <div style={{ fontSize: 11, color: "var(--green)", marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green)", display: "inline-block" }} />
                          {tok.name}
                        </div>
                      ) : null;
                    })()}
                  </div>
                  <button
                    onClick={() => handleBuild(src.sourceId)}
                    disabled={srcBuilding || buildingSource === src.sourceId}
                    style={{ padding: "6px 16px", background: srcBuilding ? "var(--bg-hover)" : "var(--accent)", color: srcBuilding ? "var(--text-secondary)" : "#0f1117", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: srcBuilding ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6 }}
                  >
                    {srcBuilding && <Spinner size={12} />}
                    {srcBuilding ? (src.sourceType === "image" ? "Pulling..." : "Building...") : (src.sourceType === "image" ? "Pull" : "Build")}
                  </button>
                  <button
                    onClick={() => openEditSource(src)}
                    style={{ padding: "6px 12px", background: "transparent", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-secondary)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteSource(src.sourceId)}
                    style={{ padding: "6px 12px", background: "transparent", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-secondary)", fontSize: 12, cursor: "pointer" }}
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Source Modal */}
      {showAddSource && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }} onClick={() => setShowAddSource(false)}>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 28, width: 460, animation: "slideIn 0.2s ease" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Add Source</h3>
            <form onSubmit={handleAddSource}>
              <label style={labelStyle}>Source Type</label>
              <div style={{ display: "flex", gap: 0, marginBottom: 4 }}>
                {(["git", "image"] as const).map((t) => (
                  <button key={t} type="button" onClick={() => setAddForm((p) => ({ ...p, sourceType: t }))}
                    style={{ flex: 1, padding: "8px 0", background: addForm.sourceType === t ? "var(--accent)" : "var(--bg-secondary)", color: addForm.sourceType === t ? "#0f1117" : "var(--text-secondary)", border: "1px solid var(--border)", borderRadius: t === "git" ? "6px 0 0 6px" : "0 6px 6px 0", fontSize: 12, fontWeight: 700, cursor: "pointer", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    {t === "git" ? "Git Repository" : "Docker Image"}
                  </button>
                ))}
              </div>
              <label style={labelStyle}>Source ID (slug)</label>
              <input type="text" value={addForm.sourceId} onChange={(e) => setAddForm((p) => ({ ...p, sourceId: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") }))} style={inputStyle} placeholder="my-custom-fork" required autoFocus />
              <label style={labelStyle}>Display Name</label>
              <input type="text" value={addForm.name} onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))} style={inputStyle} placeholder="AzerothCore + Playerbots" required />
              {addForm.sourceType === "image" ? (
                <>
                  <label style={labelStyle}>Image Name</label>
                  <input type="text" value={addForm.imageName} onChange={(e) => setAddForm((p) => ({ ...p, imageName: e.target.value }))} style={inputStyle} placeholder="acore/ac-wotlk-worldserver" required />
                  <label style={labelStyle}>Image Tag</label>
                  <input type="text" value={addForm.imageTag} onChange={(e) => setAddForm((p) => ({ ...p, imageTag: e.target.value }))} style={inputStyle} placeholder="latest" />
                </>
              ) : (
                <>
                  <label style={labelStyle}>Git URL</label>
                  <input type="text" value={addForm.url} onChange={(e) => setAddForm((p) => ({ ...p, url: e.target.value }))} style={inputStyle} placeholder="https://github.com/owner/repo" required />
                  <label style={labelStyle}>Branch</label>
                  <input type="text" value={addForm.defaultBranch} onChange={(e) => setAddForm((p) => ({ ...p, defaultBranch: e.target.value }))} style={inputStyle} placeholder="master" />
                  <label style={labelStyle}>GitHub Token (for private repos)</label>
                  <select
                    value={addForm.githubTokenId}
                    onChange={(e) => setAddForm((p) => ({ ...p, githubTokenId: e.target.value }))}
                    style={{ ...inputStyle, cursor: "pointer" }}
                  >
                    <option value="">None (public repo)</option>
                    {tokens.map((tok) => (
                      <option key={tok.id} value={String(tok.id)}>
                        {tok.name} ({tok.tokenMasked})
                      </option>
                    ))}
                  </select>
                  {tokens.length === 0 && (
                    <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>
                      No tokens configured. Add one in Settings → GitHub Tokens.
                    </div>
                  )}
                </>
              )}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
                <button type="button" onClick={() => setShowAddSource(false)} style={{ padding: "8px 18px", background: "transparent", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                <button type="submit" disabled={adding} style={{ padding: "8px 18px", background: "var(--accent)", color: "#0f1117", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: adding ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                  {adding && <Spinner size={12} />} Add Source
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Source Modal */}
      {editSource && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }} onClick={() => setEditSource(null)}>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 28, width: 460, animation: "slideIn 0.2s ease" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Edit Source</h3>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12, fontFamily: "monospace" }}>{editSource.sourceId}</div>
            <form onSubmit={handleEditSource}>
              <label style={labelStyle}>Display Name</label>
              <input type="text" value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} style={inputStyle} placeholder="AzerothCore + Playerbots" required autoFocus />
              {editForm.sourceType === "image" ? (
                <>
                  <label style={labelStyle}>Image Name</label>
                  <input type="text" value={editForm.imageName} onChange={(e) => setEditForm((p) => ({ ...p, imageName: e.target.value }))} style={inputStyle} placeholder="acore/ac-wotlk-worldserver" required />
                  <label style={labelStyle}>Image Tag</label>
                  <input type="text" value={editForm.imageTag} onChange={(e) => setEditForm((p) => ({ ...p, imageTag: e.target.value }))} style={inputStyle} placeholder="latest" />
                </>
              ) : (
                <>
                  <label style={labelStyle}>Git URL</label>
                  <input type="text" value={editForm.url} onChange={(e) => setEditForm((p) => ({ ...p, url: e.target.value }))} style={inputStyle} placeholder="https://github.com/owner/repo" required />
                  <label style={labelStyle}>Branch</label>
                  <input type="text" value={editForm.defaultBranch} onChange={(e) => setEditForm((p) => ({ ...p, defaultBranch: e.target.value }))} style={inputStyle} placeholder="master" />
                  <label style={labelStyle}>GitHub Token (for private repos)</label>
                  <select
                    value={editForm.githubTokenId}
                    onChange={(e) => setEditForm((p) => ({ ...p, githubTokenId: e.target.value }))}
                    style={{ ...inputStyle, cursor: "pointer" }}
                  >
                    <option value="">None (public repo)</option>
                    {tokens.map((tok) => (
                      <option key={tok.id} value={String(tok.id)}>
                        {tok.name} ({tok.tokenMasked})
                      </option>
                    ))}
                  </select>
                </>
              )}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
                <button type="button" onClick={() => setEditSource(null)} style={{ padding: "8px 18px", background: "transparent", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ padding: "8px 18px", background: "var(--accent)", color: "#0f1117", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                  {saving && <Spinner size={12} />} Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Build History */}
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>Build History</h3>
        {builds.length === 0 ? (
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: 32, textAlign: "center", color: "var(--text-secondary)" }}>
            No builds yet. Click &ldquo;Build&rdquo; on a source to create the first build.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["Date/Time", "Source", "Branch", "Status", "Actions"].map((h) => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {builds.map((build) => (
                  <tr key={build.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "10px 12px" }}>
                      <div>{formatBuildDate(build.image_tag)}</div>
                      <div style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "monospace" }}>{build.image_tag}</div>
                    </td>
                    <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>{build.source_id}</td>
                    <td style={{ padding: "10px 12px", color: "var(--accent)" }}>{build.source_branch}</td>
                    <td style={{ padding: "10px 12px" }}><StatusBadge status={build.status} /></td>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        {build.status === "building" ? (
                          <button onClick={() => { setLiveLogSourceId(build.source_id); setSelectedBuildLog(null); }} style={{ padding: "4px 10px", background: "transparent", border: "1px solid var(--border)", borderRadius: 4, color: "var(--yellow)", fontSize: 11, cursor: "pointer" }}>
                            Live Log
                          </button>
                        ) : build.build_log ? (
                          <button onClick={() => setSelectedBuildLog(selectedBuildLog?.id === build.id ? null : build)} style={{ padding: "4px 10px", background: "transparent", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text-secondary)", fontSize: 11, cursor: "pointer" }}>
                            {selectedBuildLog?.id === build.id ? "Hide Log" : "Log"}
                          </button>
                        ) : null}
                        {build.status !== "building" && (
                          <button onClick={() => handleDeleteBuild(build.id)} disabled={deletingId === build.id} style={{ padding: "4px 10px", background: "transparent", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text-secondary)", fontSize: 11, cursor: deletingId === build.id ? "not-allowed" : "pointer" }}>
                            {deletingId === build.id ? "..." : "Delete"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Build Log Viewer */}
      {displayLog.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <h4 style={{ fontSize: 13, fontWeight: 600, color: selectedBuildLog ? "var(--text-secondary)" : "var(--yellow)" }}>
              {selectedBuildLog ? `Build Log — ${formatBuildDate(selectedBuildLog.image_tag)}` : `Build Log (live — ${liveLogSourceId})`}
            </h4>
            {selectedBuildLog ? (
              <button onClick={() => setSelectedBuildLog(null)} style={{ padding: "3px 10px", fontSize: 11, background: "transparent", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text-secondary)", cursor: "pointer" }}>Close</button>
            ) : (
              <button onClick={() => { setLiveLog([]); setLiveLogSourceId(null); }} style={{ padding: "3px 10px", fontSize: 11, background: "transparent", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text-secondary)", cursor: "pointer" }}>Close</button>
            )}
          </div>
          <div ref={logRef} style={{ background: "#0d0f14", border: "1px solid var(--border)", borderRadius: 8, padding: 12, fontFamily: "'Fira Code', monospace", fontSize: 11, color: "var(--text-secondary)", height: 240, overflowY: "auto", lineHeight: 1.6 }}>
            {displayLog.map((line, i) => {
              const lower = line.toLowerCase();
              const color = lower.includes("complete") || lower.includes("success")
                ? "var(--green)"
                : lower.includes("error") || lower.includes("fail")
                  ? "var(--red)"
                  : lower.includes("warning") || lower.includes("skipping")
                    ? "var(--yellow)"
                    : "var(--text-secondary)";
              return <div key={i} style={{ color }}>{line}</div>;
            })}
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
