"use client";

import { useState, useEffect, useCallback } from "react";
import { Spinner } from "@/components/Spinner";
import { SaveIcon } from "@/components/Icons";
import type { RealmSourceConfig } from "@/types/realm";

interface SourcesTabProps {
  onToast: (message: string, type?: "success" | "error" | "info") => void;
}

interface SourceFormData {
  id: string;
  name: string;
  url: string;
  defaultBranch: string;
  token: string;
}

const emptyForm: SourceFormData = {
  id: "",
  name: "",
  url: "",
  defaultBranch: "master",
  token: "",
};

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

function SourceModal({
  source,
  onClose,
  onSaved,
  onToast,
}: {
  source: RealmSourceConfig | null;
  onClose: () => void;
  onSaved: () => void;
  onToast: SourcesTabProps["onToast"];
}) {
  const isEdit = !!source;
  const [form, setForm] = useState<SourceFormData>(
    source
      ? {
          id: source.id,
          name: source.name,
          url: source.url,
          defaultBranch: source.defaultBranch,
          token: "",
        }
      : { ...emptyForm }
  );
  const [changeToken, setChangeToken] = useState(!isEdit);
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = isEdit
        ? `/api/settings/sources/${encodeURIComponent(source!.id)}`
        : "/api/settings/sources";

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body: any = isEdit
        ? { name: form.name, url: form.url, defaultBranch: form.defaultBranch }
        : { id: form.id, name: form.name, url: form.url, defaultBranch: form.defaultBranch };

      if (changeToken) body.token = form.token;

      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        onToast(isEdit ? "Source updated" : "Source created", "success");
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
          width: 480,
          animation: "slideIn 0.2s ease",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
          {isEdit ? "Edit Source" : "Add Source"}
        </h3>

        <form onSubmit={handleSubmit}>
          {!isEdit && (
            <>
              <label style={labelStyle}>Source ID</label>
              <input
                type="text"
                value={form.id}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    id: e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9-]/g, "-"),
                  }))
                }
                style={inputStyle}
                placeholder="my-custom-fork"
                required
                autoFocus
              />
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-secondary)",
                  marginTop: 2,
                }}
              >
                Lowercase letters, numbers, and hyphens only
              </div>
            </>
          )}

          <label style={labelStyle}>Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            style={inputStyle}
            placeholder="AzerothCore WotLK (Custom)"
            required
            autoFocus={isEdit}
          />

          <label style={labelStyle}>Repository URL</label>
          <input
            type="url"
            value={form.url}
            onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))}
            style={inputStyle}
            placeholder="https://github.com/owner/repo"
            required
          />

          <label style={labelStyle}>Default Branch</label>
          <input
            type="text"
            value={form.defaultBranch}
            onChange={(e) =>
              setForm((p) => ({ ...p, defaultBranch: e.target.value }))
            }
            style={inputStyle}
            placeholder="master"
            required
          />

          <label style={labelStyle}>GitHub Token (for private repos)</label>
          {isEdit && source?.hasToken && !changeToken ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 4,
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  color: "var(--text-secondary)",
                  fontFamily: "monospace",
                }}
              >
                {source.tokenMasked}
              </span>
              <button
                type="button"
                onClick={() => setChangeToken(true)}
                style={{
                  padding: "4px 10px",
                  background: "transparent",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  color: "var(--text-secondary)",
                  fontSize: 11,
                  cursor: "pointer",
                }}
              >
                Change
              </button>
              <button
                type="button"
                onClick={() => {
                  setChangeToken(true);
                  setForm((p) => ({ ...p, token: "" }));
                }}
                style={{
                  padding: "4px 10px",
                  background: "transparent",
                  border: "1px solid var(--red)",
                  borderRadius: 4,
                  color: "var(--red)",
                  fontSize: 11,
                  cursor: "pointer",
                }}
              >
                Clear
              </button>
            </div>
          ) : (
            <div style={{ position: "relative" }}>
              <input
                type={showToken ? "text" : "password"}
                value={form.token}
                onChange={(e) =>
                  setForm((p) => ({ ...p, token: e.target.value }))
                }
                style={inputStyle}
                placeholder="ghp_xxxxxxxxxxxx (optional)"
              />
              <button
                type="button"
                onClick={() => setShowToken((v) => !v)}
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
                {showToken ? "Hide" : "Show"}
              </button>
            </div>
          )}

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
              disabled={saving || !form.name || !form.url}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 18px",
                background:
                  saving || !form.name || !form.url
                    ? "var(--bg-hover)"
                    : "var(--accent)",
                color:
                  saving || !form.name || !form.url
                    ? "var(--text-secondary)"
                    : "#0f1117",
                border: "none",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 700,
                cursor:
                  saving || !form.name || !form.url
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

export function SourcesTab({ onToast }: SourcesTabProps) {
  const [sources, setSources] = useState<RealmSourceConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editSource, setEditSource] = useState<RealmSourceConfig | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchSources = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/sources");
      const data = await res.json();
      if (data.sources) setSources(data.sources);
    } catch {
      // ignore
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  const handleDelete = useCallback(
    async (id: string) => {
      setDeleting(true);
      try {
        const res = await fetch(
          `/api/settings/sources/${encodeURIComponent(id)}`,
          { method: "DELETE" }
        );
        const data = await res.json();
        if (res.ok) {
          onToast("Source deleted", "success");
          fetchSources();
        } else {
          onToast(data.error || "Delete failed", "error");
        }
      } catch {
        onToast("Failed to connect", "error");
      }
      setDeleting(false);
      setDeleteId(null);
    },
    [onToast, fetchSources]
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
            Repository Sources
          </h3>
          <p
            style={{
              fontSize: 12,
              color: "var(--text-secondary)",
              marginTop: 2,
            }}
          >
            GitHub repositories that can be used to build realm servers.
          </p>
        </div>
        <button
          onClick={() => {
            setEditSource(null);
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
          }}
        >
          + Add Source
        </button>
      </div>

      {sources.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: 40,
            color: "var(--text-secondary)",
            fontSize: 14,
          }}
        >
          No sources configured. Add one to get started.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sources.map((src) => (
            <div
              key={src.id}
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
                  {src.name}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    fontFamily: "monospace",
                  }}
                >
                  {src.url} ({src.defaultBranch})
                </div>
                {src.hasToken && (
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--green)",
                      marginTop: 4,
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "var(--green)",
                        display: "inline-block",
                      }}
                    />
                    Token configured
                    {src.tokenMasked && (
                      <span style={{ color: "var(--text-secondary)" }}>
                        ({src.tokenMasked})
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => {
                    setEditSource(src);
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
                  onClick={() => setDeleteId(src.id)}
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
        <SourceModal
          source={editSource}
          onClose={() => setShowModal(false)}
          onSaved={fetchSources}
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
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
              Delete Source
            </h3>
            <p
              style={{
                fontSize: 13,
                color: "var(--text-secondary)",
                marginBottom: 20,
              }}
            >
              Are you sure you want to delete this source? Existing realms
              using it will not be affected but new builds will fail.
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
                  cursor: deleting ? "not-allowed" : "pointer",
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
