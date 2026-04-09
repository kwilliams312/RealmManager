"use client";

import { useState, useEffect, useCallback } from "react";
import { Spinner } from "@/components/Spinner";
import { Toast, type ToastType } from "@/components/Toast";

interface Account {
  id: number;
  username: string;
  gmlevel: number;
  last_login: string | null;
  last_ip: string | null;
  expansion: number;
  locked: number;
  can_manage: boolean;
}

const GM_LEVELS = [
  { value: 0, label: "Player", color: "var(--text-secondary)" },
  { value: 1, label: "Moderator", color: "#60a5fa" },
  { value: 2, label: "Game Master", color: "#34d399" },
  { value: 3, label: "Administrator", color: "#f59e0b" },
];

function GmBadge({ level }: { level: number }) {
  const opt = GM_LEVELS.find((o) => o.value === level) ?? GM_LEVELS[0];
  return (
    <span style={{ padding: "2px 10px", borderRadius: 10, fontSize: 12, fontWeight: 600, background: `${opt.color}18`, color: opt.color, border: `1px solid ${opt.color}30` }}>
      {opt.label}
    </span>
  );
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [pendingLevel, setPendingLevel] = useState(0);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/accounts");
      const data = await res.json();
      if (data.accounts) setAccounts(data.accounts);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const showToast = (message: string, type: ToastType = "success") => setToast({ message, type });

  const saveGmLevel = async (accountId: number) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/accounts/${accountId}/gmlevel`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gmlevel: pendingLevel }),
      });
      const data = await res.json();
      if (res.ok) {
        setAccounts((prev) => prev.map((a) => a.id === accountId ? { ...a, gmlevel: pendingLevel } : a));
        showToast("GM level updated");
        setEditing(null);
      } else {
        showToast(data.error || "Update failed", "error");
      }
    } catch { showToast("Failed to connect", "error"); }
    setSaving(false);
  };

  const deleteAccount = async (accountId: number) => {
    try {
      const res = await fetch(`/api/accounts/${accountId}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        setAccounts((prev) => prev.filter((a) => a.id !== accountId));
        showToast("Account deleted");
      } else {
        showToast(data.error || "Delete failed", "error");
      }
    } catch { showToast("Failed to connect", "error"); }
    setDeleting(null);
  };

  const filtered = accounts.filter((a) =>
    !search || a.username.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div style={{ textAlign: "center", marginTop: 60 }}><Spinner size={32} /></div>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Account Management</h2>
        <span style={{ fontSize: 13, color: "var(--text-secondary)", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 14px", fontWeight: 600 }}>
          {accounts.length} account{accounts.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search accounts..."
          style={{
            padding: "8px 14px", width: 300, background: "var(--bg-card)",
            border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-primary)",
            fontSize: 13, outline: "none",
          }}
        />
      </div>

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["ID", "Username", "GM Level", "Last Login", "Last IP", "Actions"].map((h) => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((account) => (
              <tr key={account.id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "10px 16px", color: "var(--text-secondary)" }}>{account.id}</td>
                <td style={{ padding: "10px 16px", fontWeight: 600 }}>{account.username}</td>
                <td style={{ padding: "10px 16px" }}>
                  {editing === account.id ? (
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <select
                        value={pendingLevel}
                        onChange={(e) => setPendingLevel(parseInt(e.target.value))}
                        style={{ padding: "4px 8px", background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text-primary)", fontSize: 12 }}
                      >
                        {GM_LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                      </select>
                      <button onClick={() => saveGmLevel(account.id)} disabled={saving} style={{ padding: "4px 10px", background: "var(--green)", color: "#000", border: "none", borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                        {saving ? "..." : "Save"}
                      </button>
                      <button onClick={() => setEditing(null)} style={{ padding: "4px 8px", background: "transparent", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text-secondary)", fontSize: 11, cursor: "pointer" }}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <GmBadge level={account.gmlevel} />
                  )}
                </td>
                <td style={{ padding: "10px 16px", color: "var(--text-secondary)", fontSize: 12 }}>{account.last_login ?? "Never"}</td>
                <td style={{ padding: "10px 16px", color: "var(--text-secondary)", fontSize: 12 }}>{account.last_ip ?? "—"}</td>
                <td style={{ padding: "10px 16px" }}>
                  {account.can_manage && editing !== account.id && (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => { setEditing(account.id); setPendingLevel(account.gmlevel); }}
                        style={{ padding: "4px 10px", background: "transparent", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text-secondary)", fontSize: 11, cursor: "pointer" }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleting(account.id)}
                        style={{ padding: "4px 10px", background: "transparent", border: "1px solid var(--red)", borderRadius: 4, color: "var(--red)", fontSize: 11, cursor: "pointer" }}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Delete confirm */}
      {deleting !== null && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 28, width: 360 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Delete Account</h3>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>
              This will permanently delete the account <strong>{accounts.find((a) => a.id === deleting)?.username}</strong>. This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setDeleting(null)} style={{ padding: "8px 16px", background: "transparent", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={() => deleteAccount(deleting)} style={{ padding: "8px 16px", background: "var(--red)", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
