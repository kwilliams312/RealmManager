"use client";

import { useState, useCallback } from "react";
import { useRealms } from "@/hooks/useRealms";
import { RealmSidebar } from "@/components/RealmSidebar";
import { RealmDetailPanel } from "@/components/RealmDetailPanel";
import { Spinner } from "@/components/Spinner";
import { Toast, type ToastType } from "@/components/Toast";
import type { Realm, RealmTab } from "@/types/realm";
import { AddRealmModal } from "@/components/AddRealmModal";

import { SettingsTab } from "@/components/realm-tabs/SettingsTab";
import { WorldserverConfigTab } from "@/components/realm-tabs/WorldserverConfigTab";
import { ConfigTab } from "@/components/realm-tabs/ConfigTab";
import { ConsoleTab } from "@/components/realm-tabs/ConsoleTab";
import { LogsTab } from "@/components/realm-tabs/LogsTab";

import { useEffect, useRef } from "react";


function useUser() {
  const [user, setUser] = useState<{ username: string; gmlevel: number } | null>(null);
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then(setUser)
      .catch(() => {});
  }, []);
  return user;
}

export default function RealmsPage() {
  const { realms, realmStatus, loading, refresh, setRealmState } = useRealms();
  const user = useUser();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<RealmTab>("settings");
  const [showAddModal, setShowAddModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [errorDetail, setErrorDetail] = useState<{ title: string; logs: string } | null>(null);
  const prevRealmsLen = useRef(0);

  const showToast = useCallback((message: string, type: ToastType = "success") => {
    setToast({ message, type });
  }, []);

  // Auto-select first realm when list loads
  useEffect(() => {
    if (!selectedId && realms.length > 0) {
      setSelectedId(realms[0].id);
    }
    // Auto-select newly created realm
    if (realms.length > prevRealmsLen.current && prevRealmsLen.current > 0) {
      const newest = realms[realms.length - 1];
      setSelectedId(newest.id);
    }
    prevRealmsLen.current = realms.length;
  }, [realms, selectedId]);

  const selectedRealm: Realm | undefined = realms.find((r) => r.id === selectedId);
  const selectedStatus = realmStatus.find((s) => s.id === selectedId);
  const isAdmin = (user?.gmlevel ?? 0) >= 3;

  const handleRealmAction = useCallback(
    async (action: "start" | "stop" | "restart") => {
      if (!selectedId) return;
      if (action === "start" || action === "restart")
        setRealmState(selectedId, "starting");
      try {
        const res = await fetch(`/api/realms/${selectedId}/${action}`, { method: "POST" });
        const data = await res.json();
        if (res.ok) {
          showToast(`${action.charAt(0).toUpperCase() + action.slice(1)}ed`, "success");
          refresh();
        } else {
          if (action === "start") setRealmState(selectedId, "stopped");
          if (data.logs) {
            showToast(data.error || `${action} failed`, "error");
            setErrorDetail({ title: `${action} failed`, logs: data.logs });
          } else {
            showToast(data.error || `${action} failed`, "error");
          }
        }
      } catch {
        if (action === "start") setRealmState(selectedId, "stopped");
        showToast("Failed to connect", "error");
      }
    },
    [selectedId, setRealmState, showToast, refresh]
  );

  if (loading) {
    return (
      <div style={{ textAlign: "center", marginTop: 60 }}>
        <Spinner size={32} />
        <p style={{ marginTop: 12, color: "var(--text-secondary)" }}>
          Loading realms...
        </p>
      </div>
    );
  }

  function renderTabContent() {
    if (!selectedRealm) {
      return (
        <div
          style={{
            textAlign: "center",
            padding: 40,
            color: "var(--text-secondary)",
          }}
        >
          Select a realm from the sidebar
        </div>
      );
    }

    const props = {
      realm: selectedRealm,
      realmStatus: selectedStatus ?? null,
      onToast: showToast,
      onRefresh: refresh,
    };

    switch (activeTab) {
      case "settings":
        return <SettingsTab {...props} />;
      case "worldserver":
        return <WorldserverConfigTab {...props} />;
      case "config":
        return <ConfigTab {...props} />;
      case "console":
        return <ConsoleTab {...props} />;
      case "logs":
        return <LogsTab {...props} />;
      default:
        return null;
    }
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Realm Management</h2>
      </div>

      <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
        <RealmSidebar
          realms={realms}
          realmStatus={realmStatus}
          selectedId={selectedId}
          onSelect={(id) => {
            setSelectedId(id);
            setActiveTab("settings");
          }}
          onAddRealm={() => setShowAddModal(true)}
          onToast={showToast}
          onRefresh={refresh}
          onRealmStateChange={setRealmState}
          onErrorDetail={setErrorDetail}
        />

        {realms.length > 0 && selectedRealm ? (
          <RealmDetailPanel
            activeTab={activeTab}
            onTabChange={setActiveTab}
            isAdmin={isAdmin}
            online={selectedStatus?.online ?? false}
            state={selectedStatus?.state}
            isRemote={selectedRealm?.is_remote}
            hasBuild={selectedRealm?.active_build_id != null}
            onAction={handleRealmAction}
          >
            {renderTabContent()}
          </RealmDetailPanel>
        ) : realms.length > 0 ? (
          <div
            style={{
              flex: 1,
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: 40,
              textAlign: "center",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-secondary)",
              fontSize: 14,
            }}
          >
            Select a realm from the sidebar
          </div>
        ) : (
          <div
            style={{
              flex: 1,
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: 40,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 16 }}>🌐</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
              No Realms Yet
            </h3>
            <p
              style={{
                color: "var(--text-secondary)",
                fontSize: 14,
                marginBottom: 24,
              }}
            >
              Create your first realm to get started. Each realm runs in its own
              Docker container with a separate worldserver and databases.
            </p>
            {isAdmin && (
              <button
                onClick={() => setShowAddModal(true)}
                style={{
                  padding: "10px 24px",
                  background: "linear-gradient(135deg, #f59e0b, #d97706)",
                  color: "#0f1117",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                + Create First Realm
              </button>
            )}
          </div>
        )}
      </div>

      {showAddModal && (
        <AddRealmModal
          onClose={() => setShowAddModal(false)}
          onCreated={() => {
            setShowAddModal(false);
            showToast("Realm created successfully", "success");
            refresh();
          }}
        />
      )}

      {errorDetail && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200,
          }}
          onClick={() => setErrorDetail(null)}
        >
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 24,
              width: 640,
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
              animation: "slideIn 0.2s ease",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <h3
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "var(--red)",
                }}
              >
                {errorDetail.title}
              </h3>
              <button
                onClick={() => setErrorDetail(null)}
                style={{
                  padding: "4px 12px",
                  background: "transparent",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  color: "var(--text-secondary)",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
            <div
              style={{
                background: "#0d0f14",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: 12,
                fontFamily: "'Fira Code', monospace",
                fontSize: 11,
                color: "var(--text-secondary)",
                overflow: "auto",
                flex: 1,
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {errorDetail.logs}
            </div>
          </div>
        </div>
      )}

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
