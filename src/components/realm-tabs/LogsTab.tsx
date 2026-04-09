"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { TabProps } from "./types";
import { Spinner } from "@/components/Spinner";
import { RefreshIcon } from "@/components/Icons";

const ANSI_COLORS: Record<string, string> = {
  "30": "#4d4d4d", "31": "#f87171", "32": "#4ade80", "33": "#facc15",
  "34": "#60a5fa", "35": "#c084fc", "36": "#22d3ee", "37": "#e5e5e5",
  "90": "#737373", "91": "#fca5a5", "92": "#86efac", "93": "#fde68a",
  "94": "#93c5fd", "95": "#d8b4fe", "96": "#67e8f9", "97": "#ffffff",
};

function AnsiText({ text }: { text: string }) {
  const parts = useMemo(() => {
    const result: Array<{ text: string; color?: string; bold?: boolean }> = [];
    // Match ANSI: ESC[ ... m
    const re = /\x1b\[([0-9;]*)m/g;
    let lastIndex = 0;
    let color: string | undefined;
    let bold = false;
    let match;

    while ((match = re.exec(text)) !== null) {
      if (match.index > lastIndex) {
        result.push({ text: text.slice(lastIndex, match.index), color, bold });
      }
      const codes = match[1].split(";").filter(Boolean);
      for (const code of codes) {
        if (code === "0") { color = undefined; bold = false; }
        else if (code === "1") { bold = true; }
        else if (ANSI_COLORS[code]) { color = ANSI_COLORS[code]; }
      }
      lastIndex = re.lastIndex;
    }
    if (lastIndex < text.length) {
      result.push({ text: text.slice(lastIndex), color, bold });
    }
    return result;
  }, [text]);

  return (
    <>
      {parts.map((p, i) => (
        <span key={i} style={{
          color: p.color,
          fontWeight: p.bold ? 700 : undefined,
        }}>
          {p.text}
        </span>
      ))}
    </>
  );
}

export function LogsTab({ realm }: TabProps) {
  const [logs, setLogs] = useState("");
  const [startupError, setStartupError] = useState<string | null>(null);
  const [showStartupError, setShowStartupError] = useState(false);
  const [tail, setTail] = useState(200);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const startupRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const shownStartupError = useRef(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/realms/${realm.id}/logs?tail=${tail}`);
      const data = await res.json();
      if (data.logs !== undefined) {
        setLogs(data.logs);
        // Auto-scroll
        setTimeout(() => {
          if (logRef.current) {
            logRef.current.scrollTop = logRef.current.scrollHeight;
          }
        }, 50);
      }
      if (data.startupError !== undefined) {
        setStartupError(data.startupError);
        // Auto-expand on first load if there's an error
        if (data.startupError && !shownStartupError.current) {
          shownStartupError.current = true;
          setShowStartupError(true);
        }
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [realm.id, tail]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchLogs, 5000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, fetchLogs]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <select
          value={tail}
          onChange={(e) => setTail(parseInt(e.target.value))}
          style={{
            padding: "6px 10px", background: "var(--bg-secondary)", border: "1px solid var(--border)",
            borderRadius: 6, color: "var(--text-primary)", fontSize: 12, cursor: "pointer",
          }}
        >
          {[50, 100, 200, 500, 1000].map((n) => (
            <option key={n} value={n}>Last {n} lines</option>
          ))}
        </select>

        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
          />
          Auto-refresh (5s)
        </label>

        <button
          onClick={fetchLogs}
          disabled={loading}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 12px", background: "var(--bg-hover)", border: "1px solid var(--border)",
            borderRadius: 6, color: "var(--text-secondary)", fontSize: 12,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? <Spinner size={12} /> : <RefreshIcon />}
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {/* Startup error banner */}
      {startupError && (
        <div style={{ marginBottom: 12 }}>
          <button
            onClick={() => {
              setShowStartupError((v) => !v);
              if (!showStartupError) {
                setTimeout(() => startupRef.current?.scrollTo(0, startupRef.current.scrollHeight), 50);
              }
            }}
            style={{
              width: "100%",
              padding: "10px 14px",
              background: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: showStartupError ? "8px 8px 0 0" : 8,
              color: "var(--red)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              textAlign: "left",
            }}
          >
            <span>Last startup failed — click to {showStartupError ? "hide" : "view"} error logs</span>
            <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>
              {showStartupError ? "▲" : "▼"}
            </span>
          </button>
          {showStartupError && (
            <div
              ref={startupRef}
              style={{
                background: "#0d0f14",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                borderTop: "none",
                borderRadius: "0 0 8px 8px",
                padding: 12,
                fontFamily: "'Fira Code', 'Cascadia Code', monospace",
                fontSize: 11,
                color: "var(--text-secondary)",
                maxHeight: 300,
                overflowY: "auto",
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {startupError}
            </div>
          )}
        </div>
      )}

      <div
        ref={logRef}
        style={{
          background: "#0a0d10", border: "1px solid var(--border)", borderRadius: 8,
          padding: 12, fontFamily: "'Fira Code', 'Cascadia Code', monospace",
          fontSize: 11, color: "var(--text-secondary)", height: startupError && showStartupError ? 320 : 480,
          overflowY: "auto", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-all",
          transition: "height 0.2s",
        }}
      >
        {logs ? <AnsiText text={logs} /> : (loading ? "Loading..." : "No logs available. Is the worldserver running?")}
      </div>
    </div>
  );
}
