"use client";

import { useState } from "react";
import type { RealmTab } from "@/types/realm";
import {
  FileIcon,
  ConsoleIcon,
  LogsIcon,
  SettingsIcon,
} from "./Icons";
import { Spinner } from "./Spinner";

interface RealmDetailPanelProps {
  activeTab: RealmTab;
  onTabChange: (tab: RealmTab) => void;
  children: React.ReactNode;
  isAdmin: boolean;
  online: boolean;
  state?: "running" | "starting" | "stopped" | "crashed";
  isRemote?: boolean;
  hasBuild?: boolean;
  onAction?: (action: "start" | "stop" | "restart") => Promise<void>;
}

const TABS: Array<{
  id: RealmTab;
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: React.ComponentType<any>;
  adminOnly?: boolean;
  requiresRunning?: boolean;
  localOnly?: boolean;
}> = [
  { id: "settings", label: "Settings", icon: FileIcon, adminOnly: true },
  { id: "worldserver", label: "Worldserver", icon: SettingsIcon, adminOnly: true, localOnly: true },
  { id: "config", label: "Config", icon: FileIcon, adminOnly: true, localOnly: true },
  { id: "console", label: "Console", icon: ConsoleIcon, adminOnly: true, requiresRunning: true },
  { id: "logs", label: "Logs", icon: LogsIcon, adminOnly: true, localOnly: true },
];

export function RealmDetailPanel({
  activeTab,
  onTabChange,
  children,
  isAdmin,
  online,
  state,
  isRemote,
  hasBuild,
  onAction,
}: RealmDetailPanelProps) {
  const [actioning, setActioning] = useState(false);
  const containerActive = online || state === "starting" || state === "running";
  const visibleTabs = TABS.filter((t) =>
    (!t.adminOnly || isAdmin) && (!t.localOnly || !isRemote)
  );

  const handleAction = async (action: "start" | "stop" | "restart"): Promise<void> => {
    if (!onAction) return;
    setActioning(true);
    try {
      await onAction(action);
    } finally {
      setActioning(false);
    }
  };

  const showActions = onAction && !isRemote;

  const actionBtnStyle = (
    bg: string,
    color: string
  ): React.CSSProperties => ({
    padding: "6px 14px",
    fontSize: 12,
    fontWeight: 600,
    background: bg,
    color,
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 6,
    transition: "all 0.15s",
  });

  return (
    <div
      style={{
        flex: 1,
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Action buttons above tabs */}
      {showActions && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 16px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          {actioning ? (
            <Spinner size={14} />
          ) : (
            <>
              {(state === "stopped" || state === "crashed") && hasBuild && (
                <button
                  onClick={() => handleAction("start")}
                  style={actionBtnStyle(
                    "rgba(34, 197, 94, 0.12)",
                    "var(--green)"
                  )}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--green)">
                    <polygon points="5,3 19,12 5,21" />
                  </svg>
                  Start
                </button>
              )}
              {state === "running" && (
                <>
                  <button
                    onClick={() => handleAction("restart")}
                    style={actionBtnStyle(
                      "rgba(234, 179, 8, 0.12)",
                      "var(--yellow)"
                    )}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--yellow)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 4v6h6" /><path d="M23 20v-6h-6" /><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
                    </svg>
                    Restart
                  </button>
                  <button
                    onClick={() => handleAction("stop")}
                    style={actionBtnStyle(
                      "rgba(239, 68, 68, 0.12)",
                      "var(--red)"
                    )}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="var(--red)">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                    </svg>
                    Stop
                  </button>
                </>
              )}
              {state === "starting" && (
                <span style={{
                  fontSize: 12,
                  color: "var(--yellow)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}>
                  <Spinner size={12} />
                  Starting...
                </span>
              )}
              {state === "crashed" && (
                <span style={{
                  fontSize: 12,
                  color: "var(--red)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}>
                  Startup failed — check Logs tab
                </span>
              )}
            </>
          )}
        </div>
      )}

      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid var(--border)",
          overflowX: "auto",
        }}
      >
        {visibleTabs.map((tab) => {
          const active = activeTab === tab.id;
          const disabled = tab.requiresRunning && !containerActive;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => !disabled && onTabChange(tab.id)}
              disabled={disabled}
              style={{
                padding: "12px 16px",
                fontSize: 13,
                fontWeight: active ? 600 : 500,
                color: disabled
                  ? "var(--text-secondary)"
                  : active
                    ? "var(--accent)"
                    : "var(--text-secondary)",
                opacity: disabled ? 0.4 : 1,
                background: "none",
                border: "none",
                borderBottom: active && !disabled
                  ? "2px solid var(--accent)"
                  : "2px solid transparent",
                cursor: disabled ? "not-allowed" : "pointer",
                transition: "all 0.15s",
                display: "flex",
                alignItems: "center",
                gap: 6,
                whiteSpace: "nowrap",
              }}
            >
              <Icon active={active && !disabled} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, padding: 24, overflow: "auto" }}>{children}</div>
    </div>
  );
}
