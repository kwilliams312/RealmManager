"use client";

import { useState, useCallback } from "react";
import { Toast, type ToastType } from "@/components/Toast";
import {
  GlobeIcon,
  FileIcon,
  SettingsIcon,
  KeyIcon,
} from "@/components/Icons";
import { SourcesTab } from "@/components/settings-tabs/SourcesTab";
import { GitHubTokensTab } from "@/components/settings-tabs/GitHubTokensTab";
import { BrandingTab } from "@/components/settings-tabs/BrandingTab";
import { AuthConfigTab } from "@/components/settings-tabs/AuthConfigTab";
import { DbConfigTab } from "@/components/settings-tabs/DbConfigTab";

type SettingsTab = "sources" | "github-tokens" | "branding" | "auth-config" | "db-config";

interface TabDef {
  id: SettingsTab;
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: React.ComponentType<any>;
}

const TABS: TabDef[] = [
  { id: "sources", label: "Sources", icon: GlobeIcon },
  { id: "github-tokens", label: "GitHub Tokens", icon: KeyIcon },
  { id: "branding", label: "Branding", icon: SettingsIcon },
  { id: "auth-config", label: "Auth Config", icon: FileIcon },
  { id: "db-config", label: "DB Config", icon: SettingsIcon },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("sources");
  const [toast, setToast] = useState<{
    message: string;
    type: ToastType;
  } | null>(null);

  const showToast = useCallback(
    (message: string, type: ToastType = "success") => {
      setToast({ message, type });
    },
    []
  );

  function renderTabContent(): React.ReactNode {
    switch (activeTab) {
      case "sources":
        return <SourcesTab onToast={showToast} />;
      case "github-tokens":
        return <GitHubTokensTab onToast={showToast} />;
      case "branding":
        return <BrandingTab onToast={showToast} />;
      case "auth-config":
        return <AuthConfigTab onToast={showToast} />;
      case "db-config":
        return <DbConfigTab onToast={showToast} />;
      default:
        return null;
    }
  }

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>
        Settings
      </h2>

      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          overflow: "hidden",
        }}
      >
        {/* Tab bar */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid var(--border)",
          }}
        >
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "12px 20px",
                  background: "none",
                  border: "none",
                  borderBottom: active
                    ? "2px solid var(--accent)"
                    : "2px solid transparent",
                  color: active
                    ? "var(--text-primary)"
                    : "var(--text-secondary)",
                  fontSize: 13,
                  fontWeight: active ? 600 : 500,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                <Icon active={active} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div style={{ padding: 24 }}>{renderTabContent()}</div>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
