"use client";

interface FactionBarProps {
  alliance: number | null;
  horde: number | null;
}

export function FactionBar({ alliance, horde }: FactionBarProps) {
  const total = (alliance ?? 0) + (horde ?? 0);
  if (total === 0) return null;

  const alliancePct = Math.round(((alliance ?? 0) / total) * 100);
  const hordePct = 100 - alliancePct;

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 8,
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        <span style={{ color: "#3b82f6" }}>
          Alliance {alliance?.toLocaleString() ?? 0} ({alliancePct}%)
        </span>
        <span style={{ color: "#ef4444" }}>
          Horde {horde?.toLocaleString() ?? 0} ({hordePct}%)
        </span>
      </div>
      <div
        style={{
          height: 8,
          borderRadius: 4,
          background: `linear-gradient(to right, #3b82f6 ${alliancePct}%, #ef4444 ${alliancePct}%)`,
          overflow: "hidden",
        }}
      />
    </div>
  );
}
