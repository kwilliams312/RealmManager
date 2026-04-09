"use client";

import { useState } from "react";
import type { Realm, RealmStatus } from "@/types/realm";
import { Spinner } from "./Spinner";

interface RealmSidebarProps {
  realms: Realm[];
  realmStatus: RealmStatus[];
  selectedId: number | null;
  onSelect: (realmId: number) => void;
  onAddRealm: () => void;
  onToast: (message: string, type: "success" | "error" | "info") => void;
  onRefresh: () => void;
  onRealmStateChange: (realmId: number, state: "starting" | "stopped") => void;
  onErrorDetail?: (detail: { title: string; logs: string }) => void;
}

export function RealmSidebar({
  realms,
  realmStatus,
  selectedId,
  onSelect,
  onAddRealm,
  onToast,
  onRefresh,
  onRealmStateChange,
  onErrorDetail,
}: RealmSidebarProps) {
  const [actionRealmId, setActionRealmId] = useState<number | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  const doAction = async (realmId: number, action: "start" | "stop" | "restart") => {
    setActionRealmId(realmId);
    // Optimistic: show "Starting" immediately for start/restart
    if (action === "start" || action === "restart")
      onRealmStateChange(realmId, "starting");
    try {
      const res = await fetch(`/api/realms/${realmId}/${action}`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        onToast(`${action.charAt(0).toUpperCase() + action.slice(1)}ed`, "success");
        onRefresh();
      } else {
        // Revert optimistic state on failure
        if (action === "start") onRealmStateChange(realmId, "stopped");
        onToast(data.error || `${action} failed`, "error");
        if (data.logs && onErrorDetail) {
          onErrorDetail({ title: `${action} failed`, logs: data.logs });
        }
      }
    } catch {
      if (action === "start") onRealmStateChange(realmId, "stopped");
      onToast("Failed to connect", "error");
    }
    setActionRealmId(null);
  };

  const iconBtnStyle: React.CSSProperties = {
    width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center",
    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 4, cursor: "pointer", padding: 0, transition: "all 0.1s",
  };

  return (
    <div style={{ width: 260, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5 }}>
          Realms
        </span>
        <button onClick={onAddRealm} style={{ padding: "4px 10px", background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#0f1117", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          + Add
        </button>
      </div>

      {realms.length === 0 ? (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: 16, textAlign: "center", color: "var(--text-secondary)", fontSize: 13 }}>
          No realms yet.<br />Click <strong>+ Add</strong> to create one.
        </div>
      ) : (
        realms.map((realm) => {
          const rs = realmStatus.find((s) => s.id === realm.id);
          const state = rs?.state ?? (rs?.online ? "running" : "stopped");
          const isActive = selectedId === realm.id;
          const isHovered = hoveredId === realm.id;
          const isActioning = actionRealmId === realm.id;
          const hasBuild = realm.active_build_id != null;
          const isRemote = realm.is_remote === true;

          const dotColor = state === "running" ? "var(--green)" : state === "starting" ? "var(--yellow)" : "var(--red)";
          const label = state === "running" ? "Running" : state === "starting" ? "Starting..." : state === "crashed" ? "Crashed" : isRemote ? "Remote" : "Stopped";

          return (
            <div
              key={realm.id}
              onMouseEnter={() => setHoveredId(realm.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{ position: "relative" }}
            >
              <button
                onClick={() => onSelect(realm.id)}
                style={{
                  background: isActive ? "rgba(99, 102, 241, 0.08)" : "var(--bg-card)",
                  border: `1px solid ${isActive ? "#6366f1" : "var(--border)"}`,
                  borderRadius: 10, padding: 14, cursor: "pointer", textAlign: "left",
                  width: "100%", transition: "all 0.15s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)" }}>
                    {realm.name}
                  </div>
                  {/* Action buttons — hidden for remote realms */}
                  {!isActioning && !isRemote && (
                    <div style={{ display: "flex", gap: 4 }} onClick={(e) => e.stopPropagation()}>
                      {(state === "stopped" || state === "crashed") && hasBuild && (
                        <button onClick={() => doAction(realm.id, "start")} style={iconBtnStyle} title="Start">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--green)"><polygon points="5,3 19,12 5,21" /></svg>
                        </button>
                      )}
                      {state === "running" && (
                        <>
                          <button onClick={() => doAction(realm.id, "restart")} style={iconBtnStyle} title="Restart">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--yellow)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M1 4v6h6" /><path d="M23 20v-6h-6" /><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
                            </svg>
                          </button>
                          <button onClick={() => doAction(realm.id, "stop")} style={iconBtnStyle} title="Stop">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="var(--red)"><rect x="3" y="3" width="18" height="18" rx="2" /></svg>
                          </button>
                        </>
                      )}
                    </div>
                  )}
                  {isActioning && <Spinner size={14} />}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor, display: "inline-block", flexShrink: 0, animation: state === "starting" ? "pulse 1.5s infinite" : undefined }} />
                  <span>{label}</span>
                  {rs && rs.players_online > 0 && (
                    <span style={{ marginLeft: "auto" }}>{rs.players_online} online</span>
                  )}
                </div>
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}
