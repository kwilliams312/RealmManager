"use client";

import { useState, useEffect, useCallback } from "react";
import { Spinner } from "@/components/Spinner";
import { SaveIcon } from "@/components/Icons";

interface GitHubTokensTabProps {
    onToast: (message: string, type?: "success" | "error" | "info") => void;
}

interface TokenEntry {
    id: number;
    name: string;
    tokenMasked: string;
    createdAt: string;
}

const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 12px",
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    color: "var(--text-primary)",
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 11,
    fontWeight: 700,
    color: "var(--text-secondary)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
    marginTop: 14,
};

function TokenModal({
    token,
    onClose,
    onSaved,
    onToast,
}: {
    token: TokenEntry | null;
    onClose: () => void;
    onSaved: () => void;
    onToast: GitHubTokensTabProps["onToast"];
}) {
    const isEdit = !!token;
    const [name, setName] = useState(token?.name ?? "");
    const [value, setValue] = useState("");
    const [showValue, setShowValue] = useState(false);
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent): Promise<void> => {
        e.preventDefault();
        setSaving(true);
        try {
            const url = isEdit
                ? `/api/settings/github-tokens/${token!.id}`
                : "/api/settings/github-tokens";

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const body: any = { name };
            if (!isEdit || value) body.token = value;

            const res = await fetch(url, {
                method: isEdit ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (res.ok) {
                onToast(
                    isEdit ? "Token updated" : "Token added",
                    "success"
                );
                onSaved();
                onClose();
            } else {
                onToast(data.error || "Failed to save", "error");
            }
        } catch {
            onToast("Failed to connect", "error");
        }
        setSaving(false);
    };

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 200,
            }}
            onClick={onClose}
        >
            <div
                style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    padding: 28,
                    width: 440,
                    animation: "slideIn 0.2s ease",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
                    {isEdit ? "Edit Token" : "Add GitHub Token"}
                </h3>
                <p
                    style={{
                        fontSize: 12,
                        color: "var(--text-secondary)",
                        marginBottom: 8,
                    }}
                >
                    {isEdit
                        ? "Update the name or replace the token value."
                        : "Add a GitHub Personal Access Token for pulling private repos."}
                </p>

                <form onSubmit={handleSubmit}>
                    <label style={labelStyle}>Name</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        style={inputStyle}
                        placeholder="e.g. My Org PAT"
                        required
                        autoFocus
                    />

                    <label style={labelStyle}>
                        {isEdit ? "New Token Value (leave blank to keep)" : "Token"}
                    </label>
                    <div style={{ position: "relative" }}>
                        <input
                            type={showValue ? "text" : "password"}
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            style={inputStyle}
                            placeholder={
                                isEdit
                                    ? `Current: ${token!.tokenMasked}`
                                    : "ghp_xxxxxxxxxxxx"
                            }
                            required={!isEdit}
                        />
                        <button
                            type="button"
                            onClick={() => setShowValue((v) => !v)}
                            style={{
                                position: "absolute",
                                right: 8,
                                top: "50%",
                                transform: "translateY(-50%)",
                                background: "none",
                                border: "none",
                                color: "var(--text-secondary)",
                                fontSize: 11,
                                cursor: "pointer",
                            }}
                        >
                            {showValue ? "Hide" : "Show"}
                        </button>
                    </div>

                    <div
                        style={{
                            display: "flex",
                            gap: 10,
                            justifyContent: "flex-end",
                            marginTop: 24,
                        }}
                    >
                        <button
                            type="button"
                            onClick={onClose}
                            style={{
                                padding: "8px 18px",
                                background: "transparent",
                                border: "1px solid var(--border)",
                                borderRadius: 6,
                                color: "var(--text-secondary)",
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: "pointer",
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving || !name}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "8px 18px",
                                background:
                                    saving || !name
                                        ? "var(--bg-hover)"
                                        : "var(--accent)",
                                color:
                                    saving || !name
                                        ? "var(--text-secondary)"
                                        : "#0f1117",
                                border: "none",
                                borderRadius: 6,
                                fontSize: 13,
                                fontWeight: 700,
                                cursor:
                                    saving || !name
                                        ? "not-allowed"
                                        : "pointer",
                            }}
                        >
                            {saving ? <Spinner size={14} /> : <SaveIcon />}
                            {saving ? "Saving..." : "Save"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export function GitHubTokensTab({ onToast }: GitHubTokensTabProps) {
    const [tokens, setTokens] = useState<TokenEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editToken, setEditToken] = useState<TokenEntry | null>(null);
    const [deleteId, setDeleteId] = useState<number | null>(null);
    const [deleting, setDeleting] = useState(false);

    const fetchTokens = useCallback(async () => {
        try {
            const res = await fetch("/api/settings/github-tokens");
            const data = await res.json();
            if (data.tokens) setTokens(data.tokens);
        } catch {
            // ignore
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchTokens();
    }, [fetchTokens]);

    const handleDelete = useCallback(
        async (id: number) => {
            setDeleting(true);
            try {
                const res = await fetch(
                    `/api/settings/github-tokens/${id}`,
                    { method: "DELETE" }
                );
                const data = await res.json();
                if (res.ok) {
                    onToast("Token deleted", "success");
                    fetchTokens();
                } else {
                    onToast(data.error || "Delete failed", "error");
                }
            } catch {
                onToast("Failed to connect", "error");
            }
            setDeleting(false);
            setDeleteId(null);
        },
        [onToast, fetchTokens]
    );

    if (loading) {
        return (
            <div style={{ textAlign: "center", padding: 40 }}>
                <Spinner size={24} />
            </div>
        );
    }

    return (
        <div>
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 16,
                }}
            >
                <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700 }}>
                        GitHub Tokens
                    </h3>
                    <p
                        style={{
                            fontSize: 12,
                            color: "var(--text-secondary)",
                            marginTop: 2,
                        }}
                    >
                        Personal Access Tokens for pulling private repositories
                        during builds. Tokens are encrypted at rest.
                    </p>
                </div>
                <button
                    onClick={() => {
                        setEditToken(null);
                        setShowModal(true);
                    }}
                    style={{
                        padding: "8px 16px",
                        background: "var(--accent)",
                        color: "#0f1117",
                        border: "none",
                        borderRadius: 6,
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                    }}
                >
                    + Add Token
                </button>
            </div>

            {tokens.length === 0 ? (
                <div
                    style={{
                        textAlign: "center",
                        padding: 40,
                        color: "var(--text-secondary)",
                        fontSize: 14,
                    }}
                >
                    No tokens configured. Add one to enable pulling private
                    repos.
                </div>
            ) : (
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                    }}
                >
                    {tokens.map((tok) => (
                        <div
                            key={tok.id}
                            style={{
                                background: "var(--bg-secondary)",
                                border: "1px solid var(--border)",
                                borderRadius: 8,
                                padding: "14px 18px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                            }}
                        >
                            <div style={{ flex: 1 }}>
                                <div
                                    style={{
                                        fontSize: 14,
                                        fontWeight: 600,
                                        marginBottom: 2,
                                    }}
                                >
                                    {tok.name}
                                </div>
                                <div
                                    style={{
                                        fontSize: 12,
                                        color: "var(--text-secondary)",
                                        fontFamily: "monospace",
                                    }}
                                >
                                    {tok.tokenMasked}
                                </div>
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                                <button
                                    onClick={() => {
                                        setEditToken(tok);
                                        setShowModal(true);
                                    }}
                                    style={{
                                        padding: "6px 12px",
                                        background: "transparent",
                                        border: "1px solid var(--border)",
                                        borderRadius: 6,
                                        color: "var(--text-secondary)",
                                        fontSize: 12,
                                        fontWeight: 600,
                                        cursor: "pointer",
                                    }}
                                >
                                    Edit
                                </button>
                                <button
                                    onClick={() => setDeleteId(tok.id)}
                                    style={{
                                        padding: "6px 12px",
                                        background: "transparent",
                                        border: "1px solid var(--red)",
                                        borderRadius: 6,
                                        color: "var(--red)",
                                        fontSize: 12,
                                        fontWeight: 600,
                                        cursor: "pointer",
                                    }}
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showModal && (
                <TokenModal
                    token={editToken}
                    onClose={() => setShowModal(false)}
                    onSaved={fetchTokens}
                    onToast={onToast}
                />
            )}

            {deleteId && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(0,0,0,0.6)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 200,
                    }}
                >
                    <div
                        style={{
                            background: "var(--bg-card)",
                            border: "1px solid var(--border)",
                            borderRadius: 12,
                            padding: 28,
                            width: 380,
                            animation: "slideIn 0.2s ease",
                        }}
                    >
                        <h3
                            style={{
                                fontSize: 16,
                                fontWeight: 700,
                                marginBottom: 12,
                            }}
                        >
                            Delete Token
                        </h3>
                        <p
                            style={{
                                fontSize: 13,
                                color: "var(--text-secondary)",
                                marginBottom: 20,
                            }}
                        >
                            Are you sure? Sources using this token will no
                            longer be able to pull from private repos.
                        </p>
                        <div
                            style={{
                                display: "flex",
                                gap: 10,
                                justifyContent: "flex-end",
                            }}
                        >
                            <button
                                onClick={() => setDeleteId(null)}
                                style={{
                                    padding: "8px 16px",
                                    background: "transparent",
                                    border: "1px solid var(--border)",
                                    borderRadius: 6,
                                    color: "var(--text-secondary)",
                                    fontSize: 13,
                                    fontWeight: 600,
                                    cursor: "pointer",
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDelete(deleteId)}
                                disabled={deleting}
                                style={{
                                    padding: "8px 16px",
                                    background: "var(--red)",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: 6,
                                    fontSize: 13,
                                    fontWeight: 700,
                                    cursor: deleting
                                        ? "not-allowed"
                                        : "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                }}
                            >
                                {deleting && <Spinner size={14} />}
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
