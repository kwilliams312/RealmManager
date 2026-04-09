"use client";

import { useState, useEffect, useCallback } from "react";
import type { TabProps } from "./types";
import { Spinner } from "@/components/Spinner";

interface Player {
  name: string;
  level: number;
  race: string;
  class: string;
  faction: "Alliance" | "Horde";
  guild: string | null;
  zone: number;
  is_bot: boolean;
}

type PlayerKey = keyof Player;

const FACTION_COLORS = { Alliance: "#3b82f6", Horde: "#ef4444" };

const COLUMNS: Array<{ key: PlayerKey; label: string }> = [
  { key: "name", label: "Name" },
  { key: "level", label: "Level" },
  { key: "race", label: "Race" },
  { key: "class", label: "Class" },
  { key: "faction", label: "Faction" },
  { key: "guild", label: "Guild" },
];

export function OnlineTab({ realm }: TabProps) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBots, setShowBots] = useState(false);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<PlayerKey>("level");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const fetchPlayers = useCallback(async () => {
    try {
      const res = await fetch(`/api/realms/${realm.id}/online`);
      const data = await res.json();
      if (data.players) setPlayers(data.players);
    } catch { /* ignore */ }
    setLoading(false);
  }, [realm.id]);

  useEffect(() => {
    setLoading(true);
    fetchPlayers();
    const interval = setInterval(fetchPlayers, 15000);
    return () => clearInterval(interval);
  }, [fetchPlayers]);

  const handleSort = (key: PlayerKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  let filtered = players.filter((p) => {
    if (!showBots && p.is_bot) return false;
    if (search) {
      const q = search.toLowerCase();
      return p.name.toLowerCase().includes(q) || (p.guild?.toLowerCase().includes(q) ?? false);
    }
    return true;
  });

  filtered = [...filtered].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (sortKey === "level") {
      return sortDir === "asc" ? Number(av) - Number(bv) : Number(bv) - Number(av);
    }
    const as = (av ?? "").toString().toLowerCase();
    const bs = (bv ?? "").toString().toLowerCase();
    return sortDir === "asc" ? as.localeCompare(bs) : bs.localeCompare(as);
  });

  if (loading) return <div style={{ textAlign: "center", padding: 40 }}><Spinner size={24} /></div>;

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center" }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or guild..."
          style={{
            flex: 1, padding: "7px 12px", background: "var(--bg-secondary)",
            border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-primary)",
            fontSize: 13, outline: "none",
          }}
        />
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>
          <input type="checkbox" checked={showBots} onChange={(e) => setShowBots(e.target.checked)} />
          Show bots
        </label>
        <span style={{ fontSize: 13, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
          {filtered.length} players
        </span>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)" }}>
          {players.length === 0 ? "No players online" : "No players match your search"}
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    style={{
                      padding: "8px 12px", textAlign: "left",
                      color: sortKey === col.key ? "var(--accent)" : "var(--text-secondary)",
                      fontSize: 11, fontWeight: 700, textTransform: "uppercase",
                      letterSpacing: 0.5, cursor: "pointer", userSelect: "none",
                    }}
                  >
                    {col.label} {sortKey === col.key ? (sortDir === "asc" ? "↑" : "↓") : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.name} style={{ borderBottom: "1px solid var(--border)", opacity: p.is_bot ? 0.6 : 1 }}>
                  <td style={{ padding: "8px 12px" }}>
                    {p.name}
                    {p.is_bot && (
                      <span style={{ marginLeft: 6, fontSize: 10, background: "var(--bg-hover)", borderRadius: 4, padding: "1px 5px", color: "var(--text-secondary)" }}>BOT</span>
                    )}
                  </td>
                  <td style={{ padding: "8px 12px", color: "var(--accent)", fontWeight: 700 }}>{p.level}</td>
                  <td style={{ padding: "8px 12px" }}>{p.race}</td>
                  <td style={{ padding: "8px 12px" }}>{p.class}</td>
                  <td style={{ padding: "8px 12px" }}>
                    <span style={{ color: FACTION_COLORS[p.faction] ?? "inherit", fontWeight: 600 }}>
                      {p.faction}
                    </span>
                  </td>
                  <td style={{ padding: "8px 12px", color: "var(--text-secondary)" }}>{p.guild ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
