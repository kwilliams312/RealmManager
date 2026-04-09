"use client";

import { useState, useEffect, useCallback } from "react";
import type { TabProps } from "./types";
import { Spinner } from "@/components/Spinner";

interface GuildMember {
  name: string;
  level: number;
  race: string;
  class: string;
  online: boolean;
  faction: string;
}

interface Guild {
  id: number;
  name: string;
  leader: string;
  motd: string;
  info: string;
  members: GuildMember[];
  member_count: number;
  bank_gold: number;
  created: number;
}

export function GuildsTab({ realm }: TabProps) {
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const fetchGuilds = useCallback(async () => {
    try {
      const res = await fetch(`/api/realms/${realm.id}/guilds`);
      const data = await res.json();
      if (data.guilds) setGuilds(data.guilds);
    } catch { /* ignore */ }
    setLoading(false);
  }, [realm.id]);

  useEffect(() => {
    setLoading(true);
    fetchGuilds();
  }, [fetchGuilds]);

  if (loading) return <div style={{ textAlign: "center", padding: 40 }}><Spinner size={24} /></div>;

  const filtered = guilds.filter((g) =>
    !search || g.name.toLowerCase().includes(search.toLowerCase()) || g.leader.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center" }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by guild or leader name..."
          style={{
            flex: 1, padding: "7px 12px", background: "var(--bg-secondary)",
            border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-primary)",
            fontSize: 13, outline: "none",
          }}
        />
        <span style={{ fontSize: 13, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
          {filtered.length} guilds
        </span>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)" }}>
          {guilds.length === 0 ? "No guilds on this realm" : "No guilds match your search"}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((guild) => {
            const isOpen = expanded === guild.id;
            const online = guild.members.filter((m) => m.online).length;
            return (
              <div
                key={guild.id}
                style={{
                  background: "var(--bg-secondary)", border: "1px solid var(--border)",
                  borderRadius: 8, overflow: "hidden",
                }}
              >
                <button
                  onClick={() => setExpanded(isOpen ? null : guild.id)}
                  style={{
                    width: "100%", padding: "12px 16px", display: "flex", alignItems: "center",
                    gap: 12, background: "none", border: "none", cursor: "pointer",
                    textAlign: "left", color: "var(--text-primary)",
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: 700, flex: 1 }}>{guild.name}</span>
                  <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    Leader: <strong>{guild.leader}</strong>
                  </span>
                  <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {guild.member_count} members
                    {online > 0 && (
                      <span style={{ color: "var(--green)", marginLeft: 6 }}>({online} online)</span>
                    )}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--yellow)" }}>
                    {guild.bank_gold > 0 ? `${guild.bank_gold.toLocaleString()}g` : ""}
                  </span>
                  <span style={{ color: "var(--text-secondary)", fontSize: 14 }}>{isOpen ? "▲" : "▼"}</span>
                </button>

                {isOpen && (
                  <div style={{ padding: "0 16px 16px" }}>
                    {guild.motd && (
                      <p style={{ fontSize: 12, color: "var(--accent)", marginBottom: 12, fontStyle: "italic" }}>
                        &ldquo;{guild.motd}&rdquo;
                      </p>
                    )}
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid var(--border)" }}>
                            {["Name", "Level", "Class", "Race", "Online"].map((h) => (
                              <th key={h} style={{ padding: "6px 10px", textAlign: "left", color: "var(--text-secondary)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {guild.members.map((m) => (
                            <tr key={m.name} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                              <td style={{ padding: "5px 10px" }}>{m.name}</td>
                              <td style={{ padding: "5px 10px", color: "var(--accent)", fontWeight: 700 }}>{m.level}</td>
                              <td style={{ padding: "5px 10px" }}>{m.class}</td>
                              <td style={{ padding: "5px 10px" }}>{m.race}</td>
                              <td style={{ padding: "5px 10px" }}>
                                <span style={{ width: 8, height: 8, borderRadius: "50%", background: m.online ? "var(--green)" : "var(--text-secondary)", display: "inline-block" }} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
