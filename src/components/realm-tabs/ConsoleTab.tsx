"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { TabProps } from "./types";
import { Spinner } from "@/components/Spinner";
import { ConsoleIcon } from "@/components/Icons";

interface HistoryEntry {
  text: string;
  type: "input" | "output" | "error" | "system";
  time: Date;
}

export function ConsoleTab({ realm }: TabProps) {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [sending, setSending] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [history]);

  // Focus input when authenticated
  useEffect(() => {
    if (authenticated && inputRef.current) {
      inputRef.current.focus();
    }
  }, [authenticated]);

  const addEntry = (text: string, type: HistoryEntry["type"]) => {
    setHistory((h) => [...h, { text, type, time: new Date() }]);
  };

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setAuthenticated(true);
    addEntry(`Connected to Realm ${realm.id} (${realm.name}) via RA`, "system");
    addEntry("Type 'help' for available commands.", "system");
  };

  const sendCommand = useCallback(async (cmd: string) => {
    if (!cmd.trim()) return;

    addEntry(`AC> ${cmd}`, "input");
    setCmdHistory((h) => [cmd, ...h.slice(0, 49)]);
    setHistoryIdx(-1);
    setInput("");
    setSending(true);

    try {
      const res = await fetch(`/api/realms/${realm.id}/console`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: cmd, password }),
      });
      const data = await res.json();
      if (res.ok) {
        addEntry(data.output || "(no output)", "output");
      } else {
        addEntry(data.error || "Command failed", "error");
        // If login failed, reset auth
        if (res.status === 401) {
          setAuthenticated(false);
          setPassword("");
          setHistory([]);
        }
      }
    } catch {
      addEntry("Failed to connect to server", "error");
    }
    setSending(false);
    inputRef.current?.focus();
  }, [realm.id, password]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendCommand(input);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (cmdHistory.length > 0) {
        const idx = Math.min(historyIdx + 1, cmdHistory.length - 1);
        setHistoryIdx(idx);
        setInput(cmdHistory[idx]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIdx > 0) {
        const idx = historyIdx - 1;
        setHistoryIdx(idx);
        setInput(cmdHistory[idx]);
      } else {
        setHistoryIdx(-1);
        setInput("");
      }
    }
  };

  if (!authenticated) {
    return (
      <div>
        <div
          style={{
            display: "flex", alignItems: "center", gap: 10,
            marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid var(--border)",
          }}
        >
          <ConsoleIcon />
          <span style={{ fontWeight: 600, fontSize: 14 }}>Remote Console — Realm {realm.id}</span>
        </div>
        <div style={{ maxWidth: 400 }}>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16, lineHeight: 1.6 }}>
            Enter your account password to connect to the AzerothCore remote administration console for <strong>{realm.name}</strong>.
          </p>
          <form onSubmit={handleAuth}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Account password"
              autoFocus
              style={{
                width: "100%", padding: "8px 12px", borderRadius: 6,
                border: "1px solid var(--border)", background: "var(--bg-secondary)",
                color: "var(--text-primary)", fontSize: 13, marginBottom: 12, boxSizing: "border-box" as const,
              }}
            />
            <button
              type="submit"
              disabled={!password}
              style={{
                padding: "8px 20px", borderRadius: 6, border: "none",
                background: "var(--accent)", color: "#000", fontSize: 13,
                fontWeight: 600, cursor: password ? "pointer" : "not-allowed",
                opacity: password ? 1 : 0.5,
              }}
            >
              Connect
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ConsoleIcon active />
          <span style={{ fontWeight: 600, fontSize: 14 }}>Remote Console</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600, background: "rgba(74, 222, 128, 0.15)", color: "var(--green)" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green)", display: "inline-block" }} />
            Connected to {realm.name}
          </span>
        </div>
        <button
          onClick={() => { setAuthenticated(false); setPassword(""); setHistory([]); }}
          style={{ padding: "4px 12px", background: "transparent", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-secondary)", fontSize: 12, cursor: "pointer" }}
        >
          Disconnect
        </button>
      </div>

      {/* Output */}
      <div
        ref={outputRef}
        style={{
          flex: 1, minHeight: 300, maxHeight: 400,
          background: "#0a0d10", borderRadius: 8, padding: 12,
          fontFamily: "'Fira Code', 'Cascadia Code', monospace",
          fontSize: 12, lineHeight: 1.7, overflowY: "auto",
          border: "1px solid var(--border)",
        }}
      >
        {history.map((entry, i) => (
          <div
            key={i}
            style={{
              color: entry.type === "input" ? "var(--accent)"
                : entry.type === "error" ? "var(--red)"
                : entry.type === "system" ? "var(--text-secondary)"
                : "var(--text-primary)",
              whiteSpace: "pre-wrap",
            }}
          >
            {entry.text}
          </div>
        ))}
        {sending && <div style={{ color: "var(--text-secondary)" }}>...</div>}
      </div>

      {/* Input */}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <span style={{ color: "var(--accent)", fontFamily: "monospace", fontSize: 13, lineHeight: "34px" }}>AC&gt;</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={sending}
          placeholder="Enter command..."
          style={{
            flex: 1, padding: "6px 10px", background: "var(--bg-secondary)",
            border: "1px solid var(--border)", borderRadius: 6,
            color: "var(--text-primary)", fontFamily: "monospace", fontSize: 13,
            outline: "none",
          }}
        />
        <button
          onClick={() => sendCommand(input)}
          disabled={sending || !input.trim()}
          style={{
            padding: "6px 16px", background: "var(--accent)", color: "#000",
            border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700,
            cursor: sending || !input.trim() ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", gap: 6,
          }}
        >
          {sending ? <Spinner size={14} /> : "Send"}
        </button>
      </div>
    </div>
  );
}
