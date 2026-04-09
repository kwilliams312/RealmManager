"use client";

interface DistributionItem {
  class?: string;
  race?: string;
  count: number;
}

interface DistributionListProps {
  title: string;
  items: DistributionItem[] | null;
  colorFn?: (name: string) => string;
}

export function DistributionList({ title, items, colorFn }: DistributionListProps) {
  if (!items || items.length === 0) return null;

  const total = items.reduce((s, i) => s + i.count, 0);

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
          fontSize: 13,
          fontWeight: 700,
          marginBottom: 12,
          color: "var(--text-secondary)",
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((item) => {
          const name = item.class ?? item.race ?? "Unknown";
          const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
          const color = colorFn ? colorFn(name) : "var(--accent)";
          return (
            <div key={name}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                  marginBottom: 4,
                }}
              >
                <span style={{ color: "var(--text-primary)" }}>{name}</span>
                <span style={{ color: "var(--text-secondary)" }}>
                  {item.count.toLocaleString()} ({pct}%)
                </span>
              </div>
              <div
                style={{
                  height: 4,
                  borderRadius: 2,
                  background: "var(--bg-hover)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${pct}%`,
                    background: color,
                    borderRadius: 2,
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
