"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import type { TabProps } from "./types";
import { Spinner } from "@/components/Spinner";
import { SaveIcon } from "@/components/Icons";
import {
  WORLDSERVER_SCHEMA,
  type Directive,
  type Category,
} from "@/data/worldserver-schema";

type FormValues = Record<string, string>;

interface FlatDirective {
  directive: Directive;
  category: Category;
}

/** Flatten schema into a search-indexed array of (directive, parent category). */
const FLAT_DIRECTIVES: FlatDirective[] = WORLDSERVER_SCHEMA.categories.flatMap(
  (category) => category.directives.map((directive) => ({ directive, category })),
);

export function WorldserverConfigTab({ realm, onToast }: TabProps) {
  const [values, setValues] = useState<FormValues>({});
  const [original, setOriginal] = useState<FormValues>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<string>(
    WORLDSERVER_SCHEMA.categories[0]?.id ?? "",
  );
  const [search, setSearch] = useState("");

  // Always re-fetch when the tab mounts or the realm changes. The parent only
  // renders the active tab (switch statement in realms/page.tsx), so this
  // effect runs on every tab activation — ensuring edits from the raw Config
  // tab are reflected without caching stale values.
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/realms/${realm.id}/worldserver-config`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Failed to load config");
          setValues({});
          setOriginal({});
          return;
        }
        // Fill in any missing curated keys with their schema defaults so every
        // field has a value to display.
        const loaded: FormValues = { ...(data.values as FormValues) };
        for (const cat of WORLDSERVER_SCHEMA.categories) {
          for (const d of cat.directives) {
            if (loaded[d.key] === undefined) loaded[d.key] = d.default;
          }
        }
        setValues(loaded);
        setOriginal(loaded);
      })
      .catch(() => {
        setError("Failed to connect");
        setValues({});
        setOriginal({});
      })
      .finally(() => setLoading(false));
  }, [realm.id]);

  const hasChanges = useMemo(() => {
    for (const key of Object.keys(values)) {
      if (values[key] !== original[key]) return true;
    }
    return false;
  }, [values, original]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      // Only send directives that differ from the original. The server merges
      // with the existing conf, so we don't need to send unchanged keys.
      const diff: FormValues = {};
      for (const key of Object.keys(values)) {
        if (values[key] !== original[key]) diff[key] = values[key];
      }
      const res = await fetch(`/api/realms/${realm.id}/worldserver-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: diff }),
      });
      const data = await res.json();
      if (res.ok) {
        setOriginal(values);
        onToast("Configuration saved — restart the realm for changes to take effect", "success");
      } else {
        const msg = data.details ? `${data.error}: ${data.details.join(", ")}` : data.error ?? "Save failed";
        onToast(msg, "error");
      }
    } catch {
      onToast("Failed to save", "error");
    } finally {
      setSaving(false);
    }
  }, [values, original, realm.id, onToast]);

  // Filter directives for display. When search has text, search across ALL
  // categories. Otherwise, show the active category's directives.
  const displayed = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q) {
      const matches = FLAT_DIRECTIVES.filter(({ directive }) =>
        directive.key.toLowerCase().includes(q) ||
        directive.label.toLowerCase().includes(q) ||
        directive.description.toLowerCase().includes(q),
      );
      // Group matches by category for sectioned rendering
      const byCategory = new Map<string, { category: Category; directives: Directive[] }>();
      for (const { directive, category } of matches) {
        const entry = byCategory.get(category.id) ?? { category, directives: [] };
        entry.directives.push(directive);
        byCategory.set(category.id, entry);
      }
      return Array.from(byCategory.values());
    }
    const activeCategory = WORLDSERVER_SCHEMA.categories.find((c) => c.id === activeCategoryId);
    return activeCategory ? [{ category: activeCategory, directives: activeCategory.directives }] : [];
  }, [search, activeCategoryId]);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        <Spinner size={24} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)" }}>
        <p style={{ fontSize: 14, marginBottom: 8 }}>{error}</p>
        <p style={{ fontSize: 12 }}>
          Run a build first from the <strong>Builds</strong> tab — configuration files are generated during the Docker build.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 500 }}>
      {/* Header with search and save button */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          paddingBottom: 12,
          borderBottom: "1px solid var(--border)",
          marginBottom: 16,
        }}
      >
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search all settings..."
          style={{
            flex: 1,
            padding: "8px 12px",
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            color: "var(--text-primary)",
            fontSize: 13,
            outline: "none",
          }}
        />
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 18px",
            background: !hasChanges ? "var(--bg-hover)" : "var(--accent)",
            color: !hasChanges ? "var(--text-secondary)" : "#0f1117",
            border: "none",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 700,
            cursor: !hasChanges ? "not-allowed" : "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {saving ? <Spinner size={14} /> : <SaveIcon />}
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>

      {/* Body: sidebar + form */}
      <div style={{ display: "flex", gap: 20, flex: 1, minHeight: 0 }}>
        {/* Sidebar */}
        {!search.trim() && (
          <nav
            style={{
              width: 200,
              flexShrink: 0,
              borderRight: "1px solid var(--border)",
              paddingRight: 12,
              overflowY: "auto",
            }}
            aria-label="Config categories"
          >
            {WORLDSERVER_SCHEMA.categories.map((category) => {
              const active = category.id === activeCategoryId;
              return (
                <button
                  key={category.id}
                  onClick={() => setActiveCategoryId(category.id)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 12px",
                    marginBottom: 2,
                    background: active ? "rgba(99, 102, 241, 0.12)" : "transparent",
                    border: "none",
                    borderLeft: active ? "2px solid var(--accent)" : "2px solid transparent",
                    borderRadius: 4,
                    color: active ? "var(--accent)" : "var(--text-secondary)",
                    fontSize: 13,
                    fontWeight: active ? 600 : 500,
                    cursor: "pointer",
                    transition: "all 0.12s",
                  }}
                >
                  {category.label}
                </button>
              );
            })}
          </nav>
        )}

        {/* Form area */}
        <div style={{ flex: 1, overflowY: "auto", paddingRight: 8 }}>
          {displayed.length === 0 && (
            <div style={{ color: "var(--text-secondary)", fontSize: 13, textAlign: "center", padding: 24 }}>
              No settings match your search.
            </div>
          )}
          {displayed.map(({ category, directives }) => (
            <section key={category.id} style={{ marginBottom: 24 }}>
              {search.trim() && (
                <h3
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--text-secondary)",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    marginBottom: 12,
                    paddingBottom: 6,
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  {category.label}
                </h3>
              )}
              {!search.trim() && (
                <h3
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    marginBottom: 12,
                  }}
                >
                  {category.label}
                </h3>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
                {directives.map((directive) => (
                  <DirectiveField
                    key={directive.key}
                    directive={directive}
                    value={values[directive.key] ?? directive.default}
                    onChange={(newValue) =>
                      setValues((prev) => ({ ...prev, [directive.key]: newValue }))
                    }
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── DirectiveField ──────────────────────────────────────────────────────────

interface DirectiveFieldProps {
  directive: Directive;
  value: string;
  onChange: (newValue: string) => void;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "7px 10px",
  background: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  color: "var(--text-primary)",
  fontSize: 12,
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

function DirectiveField({ directive, value, onChange }: DirectiveFieldProps) {
  const isDefault = value === directive.default;
  const [showTip, setShowTip] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 4,
        }}
      >
        <label
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--text-secondary)",
            textTransform: "uppercase",
            letterSpacing: 0.3,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          {directive.label}
          <span
            onMouseEnter={() => setShowTip(true)}
            onMouseLeave={() => setShowTip(false)}
            onFocus={() => setShowTip(true)}
            onBlur={() => setShowTip(false)}
            tabIndex={0}
            style={{
              position: "relative",
              display: "inline-flex",
              alignItems: "center",
              fontSize: 11,
              color: "var(--text-secondary)",
              opacity: 0.7,
              fontWeight: 400,
              cursor: "help",
              outline: "none",
            }}
          >
            ⓘ
            {showTip && (
              <span
                role="tooltip"
                style={{
                  position: "absolute",
                  bottom: "calc(100% + 6px)",
                  left: "50%",
                  transform: "translateX(-50%)",
                  padding: "6px 10px",
                  background: "#0c0e14",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  color: "var(--text-primary)",
                  fontSize: 11,
                  fontWeight: 500,
                  letterSpacing: 0,
                  textTransform: "none",
                  whiteSpace: "nowrap",
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)",
                  zIndex: 10,
                  pointerEvents: "none",
                }}
              >
                <span style={{ fontFamily: "'Fira Code', monospace", color: "var(--accent)" }}>
                  {directive.key}
                </span>
                <span style={{ color: "var(--text-secondary)", marginLeft: 8 }}>
                  default: {directive.default || '""'}
                </span>
              </span>
            )}
          </span>
        </label>
        {!isDefault && (
          <button
            onClick={() => onChange(directive.default)}
            title={`Reset to default (${directive.default})`}
            style={{
              padding: "2px 6px",
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: 4,
              color: "var(--text-secondary)",
              fontSize: 10,
              cursor: "pointer",
            }}
          >
            Reset
          </button>
        )}
      </div>

      {renderInput(directive, value, onChange)}

      <div
        style={{
          fontSize: 11,
          color: "var(--text-secondary)",
          marginTop: 4,
          opacity: 0.8,
          lineHeight: 1.4,
        }}
      >
        {directive.description}
      </div>
    </div>
  );
}

function renderInput(
  directive: Directive,
  value: string,
  onChange: (newValue: string) => void,
): React.ReactElement {
  switch (directive.type) {
    case "boolean": {
      const checked = value === "1" || value === "true";
      return (
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked ? "1" : "0")}
            style={{ width: 16, height: 16, cursor: "pointer" }}
          />
          <span style={{ fontSize: 12, color: "var(--text-primary)" }}>
            {checked ? "Enabled" : "Disabled"}
          </span>
        </label>
      );
    }
    case "number":
      return (
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          min={directive.min}
          max={directive.max}
          step={directive.step ?? 1}
          style={inputStyle}
        />
      );
    case "select":
      return (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ ...inputStyle, cursor: "pointer", appearance: "auto" }}
        >
          {directive.options?.map((option) => (
            <option key={String(option.value)} value={String(option.value)}>
              {option.label}
            </option>
          ))}
        </select>
      );
    case "string":
    default:
      return (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={inputStyle}
        />
      );
  }
}
