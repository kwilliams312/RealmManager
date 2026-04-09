"use client";

import { useState, useEffect, useCallback } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { MetricCard } from "@/components/MetricCard";
import { FactionBar } from "@/components/FactionBar";
import { DistributionList } from "@/components/DistributionList";
import { Spinner } from "@/components/Spinner";
import { Toast, type ToastType } from "@/components/Toast";
import {
  UsersIcon,
  SwordIcon,
  GuildIcon,
  ClockIcon,
  CoinIcon,
} from "@/components/Icons";
import { OnlineTab } from "@/components/realm-tabs/OnlineTab";
import { GuildsTab } from "@/components/realm-tabs/GuildsTab";

const CLASS_COLORS: Record<string, string> = {
  "Death Knight": "#C41E3A",
  Druid: "#FF7C0A",
  Hunter: "#AAD372",
  Mage: "#3FC7EB",
  Paladin: "#F48CBA",
  Priest: "#FFFFFF",
  Rogue: "#FFF468",
  Shaman: "#0070DD",
  Warlock: "#8788EE",
  Warrior: "#C69B3A",
};

function formatUptime(seconds: number | null | undefined): string {
  if (seconds == null || seconds < 0) return "—";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatGold(gold: number | null | undefined): string {
  if (gold == null) return "—";
  if (gold >= 1000000) return `${(gold / 1000000).toFixed(1)}M`;
  if (gold >= 1000) return `${(gold / 1000).toFixed(1)}K`;
  return gold.toString();
}

interface RealmData {
  id: number;
  name: string;
  players_online: number | null;
  bots_online: number | null;
  total_characters: number | null;
  bot_characters: number | null;
  avg_level: number | null;
  peak_players: number | null;
  uptime_seconds: number | null;
  total_gold: number | null;
  total_guilds: number | null;
  alliance_count: number | null;
  horde_count: number | null;
  class_distribution: Array<{ class: string; count: number }> | null;
  race_distribution: Array<{ race: string; count: number }> | null;
}

interface DashboardData {
  shared: { total_accounts: number | null };
  realms: Record<string, RealmData>;
}

interface ServiceStatus {
  Service: string;
  Name?: string;
  State: string;
  Status: string;
  realmId?: number;
}

interface RealmStatusData {
  id: number;
  name: string;
  online: boolean;
  players_online: number;
}

type RealmSubTab = "overview" | "online" | "guilds";

function RealmOverview({ realm }: { realm: RealmData }) {
  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <MetricCard
          label="Players Online"
          value={realm.players_online ?? "N/A"}
          sub={realm.peak_players != null ? `Peak: ${realm.peak_players}` : undefined}
          color="var(--green)"
          icon={UsersIcon}
        />
        <MetricCard
          label="Bots Online"
          value={realm.bots_online ?? "N/A"}
          sub={
            realm.bot_characters != null
              ? `Total: ${realm.bot_characters}`
              : undefined
          }
          color="var(--text-secondary)"
          icon={UsersIcon}
        />
        <MetricCard
          label="Total Characters"
          value={realm.total_characters ?? "N/A"}
          sub={
            realm.avg_level != null ? `Avg level: ${realm.avg_level}` : undefined
          }
          icon={SwordIcon}
        />
        <MetricCard
          label="Guilds"
          value={realm.total_guilds ?? "N/A"}
          icon={GuildIcon}
        />
        <MetricCard
          label="Uptime"
          value={formatUptime(realm.uptime_seconds)}
          icon={ClockIcon}
        />
        <MetricCard
          label="Gold in Circulation"
          value={`${formatGold(realm.total_gold)}g`}
          color="var(--yellow)"
          icon={CoinIcon}
        />
      </div>
      <div style={{ marginBottom: 20 }}>
        <FactionBar
          alliance={realm.alliance_count}
          horde={realm.horde_count}
        />
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 12,
        }}
      >
        <DistributionList
          title="Class Distribution"
          items={realm.class_distribution}
          colorFn={(name) => CLASS_COLORS[name] ?? "var(--accent)"}
        />
        <DistributionList
          title="Race Distribution"
          items={realm.race_distribution}
        />
      </div>
    </>
  );
}

const SUB_TABS: Array<{ key: RealmSubTab; label: string; icon: React.ComponentType<{ active?: boolean; size?: number }> }> = [
  { key: "overview", label: "Overview", icon: SwordIcon },
  { key: "online", label: "Who's Online", icon: UsersIcon },
  { key: "guilds", label: "Guilds", icon: GuildIcon },
];

function RealmTabContent({
  realm,
  subTab,
  onSubTabChange,
}: {
  realm: RealmData;
  subTab: RealmSubTab;
  onSubTabChange: (tab: RealmSubTab) => void;
}) {
  return (
    <>
      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 20,
          borderBottom: "1px solid var(--border)",
        }}
      >
        {SUB_TABS.map((t) => {
          const active = subTab === t.key;
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => onSubTabChange(t.key)}
              style={{
                padding: "8px 16px",
                marginBottom: -1,
                background: "none",
                border: "none",
                borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
                color: active ? "var(--text-primary)" : "var(--text-secondary)",
                fontSize: 13,
                fontWeight: active ? 700 : 500,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                transition: "all 0.15s",
              }}
            >
              <Icon active={active} size={14} />
              {t.label}
            </button>
          );
        })}
      </div>
      {subTab === "overview" && <RealmOverview realm={realm} />}
      {subTab === "online" && <OnlineTab key={realm.id} realmId={realm.id} />}
      {subTab === "guilds" && <GuildsTab key={realm.id} realmId={realm.id} />}
    </>
  );
}

export default function DashboardPage() {
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [realmStatus, setRealmStatus] = useState<{ realms: RealmStatusData[]; version: string } | null>(null);
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [activeRealmId, setActiveRealmId] = useState<number | null>(null);
  const [subTab, setSubTab] = useState<RealmSubTab>("overview");
  const [loading, setLoading] = useState(true);
  const [realmAction, setRealmAction] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard");
      const data = await res.json();
      setDash(data);
      if (!activeRealmId && data.realms) {
        const ids = Object.keys(data.realms).map(Number).sort((a, b) => a - b);
        if (ids.length > 0) setActiveRealmId(ids[0]);
      }
    } catch {
      // ignore
    }
    setLoading(false);
  }, [activeRealmId]);

  const fetchStatus = useCallback(async () => {
    try {
      const [statusRes, realmRes] = await Promise.all([
        fetch("/api/status"),
        fetch("/api/realms/status"),
      ]);
      const statusData = await statusRes.json();
      const realmData = await realmRes.json();
      if (statusData.services) setServices(statusData.services);
      if (realmData.realms) setRealmStatus(realmData);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    fetchStatus();
    const interval = setInterval(() => {
      fetchDashboard();
      fetchStatus();
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchDashboard, fetchStatus]);

  if (loading) {
    return (
      <div style={{ textAlign: "center", marginTop: 60 }}>
        <Spinner size={32} />
        <p style={{ marginTop: 12, color: "var(--text-secondary)" }}>
          Loading dashboard...
        </p>
      </div>
    );
  }

  const SERVICE_LABELS: Record<string, { label: string; desc: string }> = {
    "ac-database": { label: "Database", desc: "Data storage" },
    "ac-authserver": { label: "Auth Server", desc: "Login & authentication" },
    "ac-webui": { label: "Web Server", desc: "Website & API" },
  };

  const displayServices = services.filter((s) => {
    const key = s.Service.toLowerCase();
    return !key.includes("worldserver");
  });

  const handleRealmAction = async (realmId: number, action: "start" | "stop" | "restart") => {
    setRealmAction(action);
    try {
      const res = await fetch(`/api/realms/${realmId}/${action}`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setToast({ message: `Realm ${action} initiated`, type: "success" });
      } else {
        setToast({ message: data.error || `Failed to ${action} realm`, type: "error" });
      }
    } catch {
      setToast({ message: `Failed to connect`, type: "error" });
    }
    setRealmAction(null);
    // Refresh status after a short delay to let the action take effect
    setTimeout(() => fetchStatus(), 2000);
  };

  const hasRealms = dash && Object.keys(dash.realms).length > 0;
  const activeRealm = activeRealmId ? dash?.realms[activeRealmId] : null;

  return (
    <div>
      {/* Server Overview header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Server Overview</h2>
        {realmStatus?.version && (
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-secondary)",
              background: "var(--bg-hover)",
              padding: "3px 10px",
              borderRadius: 6,
            }}
          >
            v{realmStatus.version}
          </span>
        )}
      </div>

      {/* Service status cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
          marginBottom: 28,
        }}
      >
        {displayServices.length > 0 ? (
          displayServices.map((s) => {
            const info = SERVICE_LABELS[s.Service];
            return (
              <div
                key={s.Service}
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: 16,
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 4,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    color: "var(--text-secondary)",
                  }}
                >
                  {info?.label ?? s.Service}
                </div>
                {info?.desc && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--text-secondary)",
                      opacity: 0.6,
                      marginBottom: 8,
                    }}
                  >
                    {info.desc}
                  </div>
                )}
                <StatusBadge state={s.State} />
              </div>
            );
          })
        ) : (
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: 16,
              color: "var(--text-secondary)",
              fontSize: 14,
            }}
          >
            No service status available
          </div>
        )}
      </div>

      {/* Realm tabs */}
      {hasRealms ? (
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 0,
              marginBottom: 20,
              borderBottom: "1px solid var(--border)",
            }}
          >
            {Object.values(dash!.realms)
              .sort((a, b) => a.id - b.id)
              .map((r) => {
                const active = activeRealmId === r.id;
                const rs = realmStatus?.realms?.find((x) => x.id === r.id);
                const online = rs?.online ?? null;
                return (
                  <button
                    key={r.id}
                    onClick={() => setActiveRealmId(r.id)}
                    style={{
                      padding: "10px 20px",
                      fontSize: 14,
                      fontWeight: active ? 700 : 500,
                      color: active
                        ? "var(--text-primary)"
                        : "var(--text-secondary)",
                      background: active ? "var(--bg-card)" : "transparent",
                      border: "none",
                      borderBottom: active
                        ? "2px solid var(--accent)"
                        : "2px solid transparent",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      transition: "all 0.15s",
                    }}
                  >
                    {online !== null && (
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: online ? "var(--green)" : "var(--red)",
                          display: "inline-block",
                          flexShrink: 0,
                        }}
                      />
                    )}
                    {r.name}
                  </button>
                );
              })}
          </div>
          {activeRealm && activeRealmId && (() => {
            const rs = realmStatus?.realms?.find((x) => x.id === activeRealmId);
            const online = rs?.online ?? false;
            const actionPending = realmAction !== null;
            const controlBtnStyle: React.CSSProperties = {
              padding: "6px 16px", border: "1px solid var(--border)", borderRadius: 6,
              fontSize: 12, fontWeight: 600, cursor: actionPending ? "not-allowed" : "pointer",
              display: "inline-flex", alignItems: "center", gap: 6,
              opacity: actionPending ? 0.5 : 1,
            };
            return (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  {!online ? (
                    <button
                      onClick={() => handleRealmAction(activeRealmId, "start")}
                      disabled={actionPending}
                      style={{ ...controlBtnStyle, background: "rgba(34,197,94,0.15)", color: "var(--green)", borderColor: "rgba(34,197,94,0.3)" }}
                    >
                      {realmAction === "start" && <Spinner size={12} />}
                      Start
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => handleRealmAction(activeRealmId, "stop")}
                        disabled={actionPending}
                        style={{ ...controlBtnStyle, background: "transparent", color: "var(--text-secondary)" }}
                      >
                        {realmAction === "stop" && <Spinner size={12} />}
                        Stop
                      </button>
                      <button
                        onClick={() => handleRealmAction(activeRealmId, "restart")}
                        disabled={actionPending}
                        style={{ ...controlBtnStyle, background: "transparent", color: "var(--text-secondary)" }}
                      >
                        {realmAction === "restart" && <Spinner size={12} />}
                        Restart
                      </button>
                    </>
                  )}
                </div>
                <RealmTabContent
                  realm={activeRealm}
                  subTab={subTab}
                  onSubTabChange={setSubTab}
                />
              </>
            );
          })()}
        </div>
      ) : (
        <div
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 40,
            textAlign: "center",
          }}
        >
          <div
            style={{ fontSize: 40, marginBottom: 16, color: "var(--text-secondary)" }}
          >
            🌐
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            No Realms Yet
          </h3>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 24 }}>
            Create your first realm to get started. Each realm runs in its own
            Docker container.
          </p>
          <a
            href="/realms"
            style={{
              display: "inline-block",
              padding: "10px 24px",
              background: "linear-gradient(135deg, #f59e0b, #d97706)",
              color: "#0f1117",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Create First Realm
          </a>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
