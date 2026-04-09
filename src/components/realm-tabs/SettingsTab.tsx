"use client";

import { useState, useCallback, useEffect } from "react";
import type { TabProps } from "./types";
import type { GlobalBuild } from "@/types/realm";
import { Spinner } from "@/components/Spinner";
import { SaveIcon } from "@/components/Icons";

const REALM_TYPES = [
  { value: 0, label: "Normal (PvE)" },
  { value: 1, label: "PvP" },
  { value: 4, label: "RP" },
  { value: 6, label: "RP-PvP" },
];

const TIMEZONES = [
  { value: 1, label: "1 — US" },
  { value: 2, label: "2 — Oceanic" },
  { value: 5, label: "5 — Korea" },
  { value: 8, label: "8 — English (EU)" },
  { value: 9, label: "9 — German (EU)" },
  { value: 10, label: "10 — French (EU)" },
  { value: 11, label: "11 — Spanish (EU)" },
];

const SECURITY_LEVELS = [
  { value: 0, label: "0 — Player (Public)" },
  { value: 1, label: "1 — Moderator" },
  { value: 2, label: "2 — Game Master" },
  { value: 3, label: "3 — Administrator" },
];

export function SettingsTab({ realm, realmStatus, onToast, onRefresh }: TabProps) {
  const [edits, setEdits] = useState({ ...realm });
  const [builds, setBuilds] = useState<GlobalBuild[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Reset edits when switching to a different realm
  useEffect(() => {
    setEdits({ ...realm });
  }, [realm.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch("/api/builds")
      .then((r) => r.json())
      .then((data) => { if (data.builds) setBuilds(data.builds.filter((b: GlobalBuild) => b.status === "success")); })
      .catch(() => {});
  }, []);

  const isRemote = realm.is_remote === true;
  const isRunning = !isRemote && (realmStatus?.state === "running" || realmStatus?.state === "starting");
  const hasChanges = JSON.stringify(edits) !== JSON.stringify(realm);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const changed: Record<string, unknown> = {};
      for (const key of ["name", "address", "icon", "timezone", "allowedSecurityLevel"] as const) {
        if (String(edits[key]) !== String(realm[key])) changed[key] = edits[key];
      }
      // Handle build change (local realms only) — treat null/undefined as equivalent
      if (!isRemote && (edits.active_build_id ?? null) !== (realm.active_build_id ?? null)) changed.buildId = edits.active_build_id ?? null;
      // Handle RA credential changes (remote realms)
      if (isRemote) {
        for (const key of ["ra_host", "ra_port", "ra_user", "ra_pass"] as const) {
          if (String(edits[key] ?? "") !== String(realm[key] ?? "")) changed[key] = edits[key];
        }
      }
      if (!Object.keys(changed).length) { setSaving(false); return; }
      const res = await fetch(`/api/realms/${realm.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changed),
      });
      const data = await res.json();
      res.ok ? onToast("Settings saved — restart the realm for changes to take effect", "success") : onToast(data.error || "Save failed", "error");
      if (res.ok) onRefresh();
    } catch { onToast("Failed to connect", "error"); }
    setSaving(false);
  }, [edits, realm, onToast, onRefresh]);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/realms/${realm.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm_name: deleteInput }),
      });
      const data = await res.json();
      if (res.ok) { onToast("Realm deleted", "success"); onRefresh(); }
      else onToast(data.error || "Delete failed", "error");
    } catch { onToast("Failed to connect", "error"); }
    setDeleting(false);
    setDeleteConfirm(false);
  }, [deleteInput, realm, onToast, onRefresh]);

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "8px 12px", background: "var(--bg-secondary)",
    border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-primary)",
    fontSize: 13, outline: "none", boxSizing: "border-box",
    opacity: isRunning ? 0.5 : 1,
  };
  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-secondary)",
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4,
  };
  const selectStyle: React.CSSProperties = { ...inputStyle, cursor: isRunning ? "not-allowed" : "pointer", appearance: "auto" };

  return (
    <div>
      <div style={{ background: "var(--bg-secondary)", borderRadius: 8, padding: "10px 14px", marginBottom: 20, fontSize: 13, color: "var(--text-secondary)" }}>
        <span style={{ fontWeight: 600 }}>Realm ID:</span> {realm.id}
      </div>

      {/* Network info (port/build are auto-managed, address is editable) */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
        <div style={{ background: "var(--bg-secondary)", borderRadius: 6, padding: "10px 14px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>World Port (auto)</div>
          <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{realm.port}</div>
        </div>
        <div style={{ background: "var(--bg-secondary)", borderRadius: 6, padding: "10px 14px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Game Build</div>
          <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{realm.gamebuild}</div>
        </div>
      </div>

      {isRunning && (
        <div style={{ background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.3)", borderRadius: 8, padding: "10px 14px", marginBottom: 20, fontSize: 13, color: "var(--yellow)" }}>
          Stop the realm before changing settings.
        </div>
      )}

      {/* Editable settings */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>Realm Name</label>
          <input type="text" value={edits.name} onChange={(e) => setEdits((p) => ({ ...p, name: e.target.value }))} disabled={isRunning} style={inputStyle} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>Server Address</label>
          <input type="text" value={edits.address} onChange={(e) => setEdits((p) => ({ ...p, address: e.target.value }))} disabled={isRunning} style={inputStyle} placeholder="192.168.1.100" />
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>
            IP or hostname clients use to connect. Use your LAN IP for local play, or public IP/domain for internet access.
          </div>
        </div>
        {isRemote ? (
          <div style={{ gridColumn: "1 / -1", padding: "12px 14px", background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>RA Console Credentials</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <label style={{ ...labelStyle, fontSize: 10 }}>RA Host</label>
                <input type="text" value={edits.ra_host ?? ""} onChange={(e) => setEdits((p) => ({ ...p, ra_host: e.target.value }))} style={inputStyle} placeholder={edits.address} />
              </div>
              <div>
                <label style={{ ...labelStyle, fontSize: 10 }}>RA Port</label>
                <input type="number" value={edits.ra_port ?? 3443} onChange={(e) => setEdits((p) => ({ ...p, ra_port: parseInt(e.target.value) || 3443 }))} style={inputStyle} />
              </div>
              <div>
                <label style={{ ...labelStyle, fontSize: 10 }}>RA Username</label>
                <input type="text" value={edits.ra_user ?? ""} onChange={(e) => setEdits((p) => ({ ...p, ra_user: e.target.value }))} style={inputStyle} placeholder="admin" />
              </div>
              <div>
                <label style={{ ...labelStyle, fontSize: 10 }}>RA Password</label>
                <input type="password" value={edits.ra_pass ?? ""} onChange={(e) => setEdits((p) => ({ ...p, ra_pass: e.target.value }))} style={inputStyle} placeholder="Enter new password" />
              </div>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 6 }}>
              RA credentials are used for the Console tab and player count stats.
            </div>
          </div>
        ) : (
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>Active Build</label>
            <select
              value={edits.active_build_id ?? ""}
              onChange={(e) => setEdits((p) => ({ ...p, active_build_id: e.target.value ? parseInt(e.target.value) : null }))}
              disabled={isRunning}
              style={selectStyle}
            >
              <option value="">— No build —</option>
              {builds.map((b) => {
                const m = b.image_tag.match(/(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/);
                const label = m
                  ? new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]), parseInt(m[4]), parseInt(m[5]), parseInt(m[6]))
                      .toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
                  : b.image_tag;
                return <option key={b.id} value={b.id}>{b.source_id} — {label} ({b.source_branch})</option>;
              })}
            </select>
          </div>
        )}
        <div>
          <label style={labelStyle}>Realm Type</label>
          <select value={edits.icon} onChange={(e) => setEdits((p) => ({ ...p, icon: parseInt(e.target.value) }))} disabled={isRunning} style={selectStyle}>
            {REALM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Region / Timezone</label>
          <select value={edits.timezone} onChange={(e) => setEdits((p) => ({ ...p, timezone: parseInt(e.target.value) }))} disabled={isRunning} style={selectStyle}>
            {TIMEZONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>Min. Security Level</label>
          <select value={edits.allowedSecurityLevel} onChange={(e) => setEdits((p) => ({ ...p, allowedSecurityLevel: parseInt(e.target.value) }))} disabled={isRunning} style={selectStyle}>
            {SECURITY_LEVELS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "space-between" }}>
        <button onClick={() => setDeleteConfirm(true)} disabled={isRunning} style={{ padding: "8px 18px", background: "transparent", border: isRunning ? "1px solid var(--border)" : "1px solid var(--red)", borderRadius: 6, color: isRunning ? "var(--text-secondary)" : "var(--red)", fontSize: 13, fontWeight: 600, cursor: isRunning ? "not-allowed" : "pointer", opacity: isRunning ? 0.5 : 1 }}>
          Delete Realm
        </button>
        <button onClick={handleSave} disabled={saving || !hasChanges || isRunning} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", background: (!hasChanges || isRunning) ? "var(--bg-hover)" : "var(--accent)", color: (!hasChanges || isRunning) ? "var(--text-secondary)" : "#0f1117", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: (!hasChanges || isRunning) ? "not-allowed" : "pointer" }}>
          {saving ? <Spinner size={14} /> : <SaveIcon />}
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>

      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 28, width: 380 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Delete Realm</h3>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
              Type <strong>{realm.name}</strong> to confirm deletion.
            </p>
            <input type="text" value={deleteInput} onChange={(e) => setDeleteInput(e.target.value)} placeholder={realm.name} autoFocus style={{ ...inputStyle, borderColor: deleteInput === realm.name ? "var(--green)" : "var(--border)", marginBottom: 16 }} />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => { setDeleteConfirm(false); setDeleteInput(""); }} style={{ padding: "8px 16px", background: "transparent", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleDelete} disabled={deleting || deleteInput !== realm.name} style={{ padding: "8px 16px", background: "var(--red)", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: deleteInput !== realm.name ? "not-allowed" : "pointer", opacity: deleteInput !== realm.name ? 0.5 : 1, display: "flex", alignItems: "center", gap: 6 }}>
                {deleting && <Spinner size={14} />} Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
