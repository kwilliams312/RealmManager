"use client";

import { useState, useCallback } from "react";
import { Spinner } from "@/components/Spinner";

interface SearchResult {
  guid: number;
  name: string;
  level: number;
  race: string;
  class: string;
  faction: "Alliance" | "Horde";
  online: boolean;
  is_bot: boolean;
  realm_id: number;
}

interface CharacterDetail {
  guid: number;
  name: string;
  level: number;
  race: string;
  class: string;
  faction: string;
  online: boolean;
  total_kills: number;
  honor_points: number;
  arena_points: number;
  is_bot: boolean;
  guild: { name: string; rank: string } | null;
}

const FACTION_COLORS = { Alliance: "#3b82f6", Horde: "#ef4444" };

export default function ArmoryPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<CharacterDetail | null>(null);
  const [loadingChar, setLoadingChar] = useState(false);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`/api/armory/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (data.results) setResults(data.results);
    } catch { /* ignore */ }
    setSearching(false);
  }, []);

  const loadCharacter = async (name: string, realmId: number) => {
    setLoadingChar(true);
    setSelected(null);
    try {
      const res = await fetch(`/api/armory/character/${encodeURIComponent(name)}?realm=${realmId}`);
      const data = await res.json();
      if (res.ok) setSelected(data);
    } catch { /* ignore */ }
    setLoadingChar(false);
  };

  const statCard = (label: string, value: number | string) => (
    <div key={label} style={{ background: "var(--bg-secondary)", borderRadius: 8, padding: "12px 16px", textAlign: "center" }}>
      <div style={{ fontSize: 11, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700 }}>{value.toLocaleString()}</div>
    </div>
  );

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Armory</h2>

      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); search(e.target.value); }}
          placeholder="Search for a character (min. 2 characters)..."
          style={{
            flex: 1, padding: "10px 14px", background: "var(--bg-card)",
            border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)",
            fontSize: 14, outline: "none",
          }}
        />
        {searching && <Spinner size={20} />}
      </div>

      <div style={{ display: "flex", gap: 20 }}>
        {/* Search results */}
        {results.length > 0 && (
          <div style={{ width: 300, flexShrink: 0 }}>
            {results.map((r) => (
              <button
                key={r.guid}
                onClick={() => loadCharacter(r.name, r.realm_id)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 14px", background: selected?.name === r.name ? "var(--bg-hover)" : "var(--bg-card)",
                  border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer",
                  textAlign: "left", marginBottom: 8, transition: "all 0.15s",
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    {r.name}
                    {r.is_bot && <span style={{ marginLeft: 6, fontSize: 10, background: "var(--bg-hover)", borderRadius: 4, padding: "1px 5px", color: "var(--text-secondary)" }}>BOT</span>}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    Level {r.level} {r.race} {r.class}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ color: FACTION_COLORS[r.faction] ?? "inherit", fontSize: 11, fontWeight: 600 }}>{r.faction}</span>
                  {r.online && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--green)", display: "inline-block", marginLeft: 6 }} />}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Character detail */}
        {loadingChar ? (
          <div style={{ flex: 1, textAlign: "center", padding: 40 }}><Spinner size={32} /></div>
        ) : selected ? (
          <div style={{ flex: 1, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: 24 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 20, marginBottom: 20 }}>
              <div>
                <h3 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>
                  {selected.name}
                  {selected.online && <span style={{ marginLeft: 10, fontSize: 12, color: "var(--green)" }}>● Online</span>}
                </h3>
                <div style={{ color: "var(--text-secondary)", fontSize: 14 }}>
                  Level {selected.level} {selected.race} {selected.class}
                </div>
                {selected.guild && (
                  <div style={{ fontSize: 13, color: "var(--accent)", marginTop: 4 }}>
                    &lt;{selected.guild.name}&gt; — {selected.guild.rank}
                  </div>
                )}
                <div style={{ marginTop: 4 }}>
                  <span style={{ color: FACTION_COLORS[selected.faction as keyof typeof FACTION_COLORS] ?? "inherit", fontSize: 13, fontWeight: 600 }}>{selected.faction}</span>
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {statCard("Total Kills", selected.total_kills)}
              {statCard("Honor Points", selected.honor_points)}
              {statCard("Arena Points", selected.arena_points)}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
