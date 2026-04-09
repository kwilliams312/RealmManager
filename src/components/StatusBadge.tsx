"use client";

interface StatusBadgeProps {
  state: string;
}

export function StatusBadge({ state }: StatusBadgeProps) {
  const lower = state?.toLowerCase() ?? "";
  const isRunning = lower.includes("running") || lower.includes("healthy") || lower.includes("listening");
  const isBuilding = lower.includes("build") || lower.includes("cloning") || lower.includes("importing") || lower.includes("starting");

  let color: string;
  let bg: string;

  if (isRunning) {
    color = "var(--green)";
    bg = "var(--green-bg)";
  } else if (isBuilding) {
    color = "var(--yellow)";
    bg = "var(--yellow-bg)";
  } else {
    color = "var(--red)";
    bg = "var(--red-bg)";
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 10px",
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 600,
        background: bg,
        color,
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: color,
          display: "inline-block",
          animation: isBuilding ? "pulse 1.5s infinite" : undefined,
        }}
      />
      {state || "Unknown"}
    </span>
  );
}
