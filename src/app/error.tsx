"use client";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      style={{
        padding: 40,
        textAlign: "center",
        maxWidth: 600,
        margin: "60px auto",
      }}
    >
      <h2
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: "var(--red, #f87171)",
          marginBottom: 16,
        }}
      >
        Something went wrong
      </h2>
      <pre
        style={{
          textAlign: "left",
          background: "var(--bg-secondary, #1a1a2e)",
          border: "1px solid var(--border, #333)",
          borderRadius: 8,
          padding: 16,
          fontSize: 13,
          overflow: "auto",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          color: "var(--text-primary, #eee)",
          marginBottom: 20,
        }}
      >
        {error.message}
        {"\n\n"}
        {error.stack}
      </pre>
      <button
        onClick={reset}
        style={{
          padding: "10px 24px",
          background: "var(--accent, #f59e0b)",
          color: "#0f1117",
          border: "none",
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        Try Again
      </button>
    </div>
  );
}
