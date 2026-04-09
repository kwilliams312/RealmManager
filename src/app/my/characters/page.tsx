"use client";

import { useState, useEffect, useCallback } from "react";
import { Spinner } from "@/components/Spinner";
import { Toast, type ToastType } from "@/components/Toast";
import type { MyCharacter } from "@/app/api/my/characters/route";

const AT_LOGIN_CUSTOMIZE = 0x08;
const AT_LOGIN_CHANGE_FACTION = 0x40;
const AT_LOGIN_CHANGE_RACE = 0x80;

interface ServiceDef {
  id: "faction_change" | "race_change" | "sex_change";
  label: string;
  flag: number;
  description: string;
}

const SERVICES: ServiceDef[] = [
  {
    id: "faction_change",
    label: "Faction",
    flag: AT_LOGIN_CHANGE_FACTION,
    description: "will be prompted to change faction (and race) at next login",
  },
  {
    id: "race_change",
    label: "Race",
    flag: AT_LOGIN_CHANGE_RACE,
    description: "will be prompted to change race at next login",
  },
  {
    id: "sex_change",
    label: "Sex",
    flag: AT_LOGIN_CUSTOMIZE,
    description:
      "will be prompted to customize appearance (including sex) at next login",
  },
];

function FactionBadge({ faction }: { faction: "Alliance" | "Horde" }) {
  const isAlliance = faction === "Alliance";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 700,
        color: isAlliance ? "#4a9eff" : "#e05050",
        background: isAlliance
          ? "rgba(74, 158, 255, 0.12)"
          : "rgba(224, 80, 80, 0.12)",
        border: `1px solid ${isAlliance ? "rgba(74, 158, 255, 0.25)" : "rgba(224, 80, 80, 0.25)"}`,
      }}
    >
      {faction}
    </span>
  );
}

export default function MyCharactersPage() {
  const [characters, setCharacters] = useState<MyCharacter[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: ToastType;
  } | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    character: MyCharacter;
    service: ServiceDef;
  } | null>(null);
  const [applying, setApplying] = useState(false);

  const fetchCharacters = useCallback(async () => {
    setFetchError(false);
    try {
      const res = await fetch("/api/my/characters");
      const data = await res.json();
      if (data.characters) setCharacters(data.characters);
      else setFetchError(true);
    } catch {
      setFetchError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCharacters();
  }, [fetchCharacters]);

  const handleApplyService = useCallback(async () => {
    if (!confirmAction) return;
    setApplying(true);
    try {
      const res = await fetch("/api/my/characters/service", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guid: confirmAction.character.guid,
          realmId: confirmAction.character.realmId,
          service: confirmAction.service.id,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setToast({
          message: `${confirmAction.service.label} change queued for ${confirmAction.character.name}`,
          type: "success",
        });
        fetchCharacters();
      } else {
        setToast({
          message: data.error || "Failed to apply service",
          type: "error",
        });
      }
    } catch {
      setToast({ message: "Failed to connect", type: "error" });
    }
    setApplying(false);
    setConfirmAction(null);
  }, [confirmAction, fetchCharacters]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && confirmAction && !applying)
        setConfirmAction(null);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [confirmAction, applying]);

  if (loading) {
    return (
      <div style={{ textAlign: "center", marginTop: 60 }}>
        <Spinner size={32} />
        <p style={{ marginTop: 12, color: "var(--text-secondary)" }}>
          Loading characters...
        </p>
      </div>
    );
  }

  // Group by realm
  const byRealm = new Map<number, { name: string; chars: MyCharacter[] }>();
  for (const c of characters) {
    if (!byRealm.has(c.realmId))
      byRealm.set(c.realmId, { name: c.realmName, chars: [] });
    byRealm.get(c.realmId)!.chars.push(c);
  }

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>
        My Characters
      </h2>

      {fetchError ? (
        <div
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: 40,
            textAlign: "center",
            color: "var(--text-secondary)",
          }}
        >
          <p style={{ fontSize: 14, color: "var(--red)" }}>
            Failed to load characters.
          </p>
          <button
            onClick={() => { setLoading(true); fetchCharacters(); }}
            style={{
              marginTop: 12,
              padding: "6px 16px",
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: 6,
              color: "var(--text-secondary)",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      ) : characters.length === 0 ? (
        <div
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: 40,
            textAlign: "center",
            color: "var(--text-secondary)",
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 12 }}>&#9876;</div>
          <p style={{ fontSize: 14 }}>
            You don&apos;t have any characters yet.
          </p>
          <p style={{ fontSize: 12, marginTop: 4 }}>
            Create a character in-game to see it here.
          </p>
        </div>
      ) : (
        Array.from(byRealm.entries()).map(([realmId, { name, chars }]) => (
          <div key={realmId} style={{ marginBottom: 24 }}>
            {byRealm.size > 1 && (
              <h3
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "var(--text-secondary)",
                  marginBottom: 10,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                {name}
              </h3>
            )}

            <div
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                overflow: "hidden",
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr 1fr 1fr 60px 1fr",
                  padding: "10px 16px",
                  borderBottom: "1px solid var(--border)",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--text-secondary)",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                <div>Character</div>
                <div>Race</div>
                <div>Class</div>
                <div>Faction</div>
                <div>Level</div>
                <div style={{ textAlign: "right" }}>Change Services</div>
              </div>

              {/* Rows */}
              {chars.map((c) => (
                <div
                  key={`${realmId}-${c.guid}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr 1fr 1fr 60px 1fr",
                    padding: "12px 16px",
                    borderBottom: "1px solid var(--border)",
                    alignItems: "center",
                    fontSize: 13,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{c.name}</span>
                    {c.online && (
                      <span
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: "50%",
                          background: "var(--green)",
                          display: "inline-block",
                          flexShrink: 0,
                        }}
                        title="Online"
                      />
                    )}
                  </div>
                  <div style={{ color: "var(--text-secondary)" }}>
                    {c.raceName}
                  </div>
                  <div style={{ color: "var(--text-secondary)" }}>
                    {c.className}
                  </div>
                  <div>
                    <FactionBadge faction={c.faction} />
                  </div>
                  <div style={{ fontWeight: 600 }}>{c.level}</div>
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      justifyContent: "flex-end",
                      flexWrap: "wrap",
                    }}
                  >
                    {SERVICES.map((svc) => {
                      const isPending = (c.atLogin & svc.flag) !== 0;
                      const isOnline = c.online;
                      return (
                        <button
                          key={svc.id}
                          onClick={() =>
                            setConfirmAction({ character: c, service: svc })
                          }
                          disabled={isOnline || isPending}
                          aria-disabled={isOnline || isPending}
                          aria-label={`${svc.label} Change for ${c.name}`}
                          title={
                            isOnline
                              ? "Character must be offline"
                              : isPending
                                ? "Already pending"
                                : `${svc.label} Change`
                          }
                          style={{
                            padding: "3px 8px",
                            fontSize: 11,
                            fontWeight: 600,
                            borderRadius: 4,
                            cursor:
                              isOnline || isPending
                                ? "not-allowed"
                                : "pointer",
                            border: isPending
                              ? "1px solid var(--yellow)"
                              : "1px solid var(--border)",
                            background: isPending
                              ? "rgba(251, 191, 36, 0.1)"
                              : "transparent",
                            color: isPending
                              ? "var(--yellow)"
                              : isOnline
                                ? "var(--text-secondary)"
                                : "var(--text-primary)",
                            opacity: isOnline && !isPending ? 0.4 : 1,
                          }}
                        >
                          {isPending ? `${svc.label} ✓` : svc.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Confirmation Modal */}
      {confirmAction && (
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
          onClick={() => !applying && setConfirmAction(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="service-modal-title"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 28,
              width: 420,
              animation: "slideIn 0.2s ease",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="service-modal-title" style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
              {confirmAction.service.label} Change
            </h3>
            <p
              style={{
                fontSize: 13,
                color: "var(--text-secondary)",
                lineHeight: 1.6,
                marginBottom: 20,
              }}
            >
              <strong style={{ color: "var(--text-primary)" }}>
                {confirmAction.character.name}
              </strong>{" "}
              {confirmAction.service.description}.
            </p>
            <div
              style={{
                display: "flex",
                gap: 10,
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => setConfirmAction(null)}
                disabled={applying}
                style={{
                  padding: "8px 18px",
                  background: "transparent",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  color: "var(--text-secondary)",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleApplyService}
                disabled={applying}
                style={{
                  padding: "8px 18px",
                  background: "var(--accent)",
                  color: "#0f1117",
                  border: "none",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: applying ? "not-allowed" : "pointer",
                  opacity: applying ? 0.6 : 1,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {applying && <Spinner size={14} />}
                {applying ? "Applying..." : "Confirm"}
              </button>
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
