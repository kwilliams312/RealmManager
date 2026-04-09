/**
 * Worldserver config parser and Nunjucks-based renderer.
 *
 * This module handles two core operations for the friendly worldserver.conf editor:
 *
 *  1. `parseConf(content)` — Extracts `KEY = VALUE` pairs from a worldserver.conf
 *     file, skipping comments and section headers. Preserves quoted strings verbatim.
 *
 *  2. `renderConf(distContent, values)` — Treats the `.conf.dist` file as a runtime
 *     Nunjucks template: each non-comment directive line becomes
 *     `KEY = {{ values["KEY"] | default("ORIGINAL_VALUE") }}`, then the whole thing
 *     is rendered with the user's values. The result is a complete worldserver.conf
 *     with the same comments and structure as the .dist, but with user-selected values.
 *
 * This approach means we never maintain a separate template file: the `.conf.dist`
 * shipped with each AzerothCore build IS the template source.
 */

import nunjucks from "nunjucks";
import type { WorldserverSchema } from "@/data/worldserver-schema";

// Configure a single Nunjucks environment with autoescape off — we're generating
// an INI-like config file, not HTML.
const env = new nunjucks.Environment(null, {
  autoescape: false,
  throwOnUndefined: false,
});

/**
 * Matches a directive line: `KEY = VALUE`
 *
 * - `^([^#\s][^\s=]*)` — key starts with a non-comment, non-whitespace char.
 *   This excludes `#comment` lines (`#` is non-whitespace but we explicitly skip it).
 * - `\s*=\s*` — whitespace around the `=`
 * - `(.*)$` — everything to end of line is the value (may be empty or quoted)
 */
const DIRECTIVE_LINE = /^([^#\s][^\s=]*)\s*=\s*(.*)$/;

/**
 * Parse a worldserver.conf content string into a flat key-value map.
 * Comments, blank lines, and section headers (e.g. `[worldserver]`) are skipped.
 * Indented directive lines are supported and agree with `renderConf`.
 */
export function parseConf(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const rawLine of content.split(/\r?\n/)) {
    // Strip trailing whitespace; keep the raw line for nothing-else right now
    const line = rawLine.replace(/\s+$/, "");
    if (!line) continue;

    // Skip comments: lines whose first non-whitespace character is `#`
    const trimmed = line.trimStart();
    if (!trimmed || trimmed.startsWith("#")) continue;

    // Skip section headers like [worldserver]
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) continue;

    // Match against the trimmed line so indented directives are detected.
    const match = DIRECTIVE_LINE.exec(trimmed);
    if (!match) continue;

    const [, key, value] = match;
    result[key] = value;
  }
  return result;
}

/**
 * Render a new worldserver.conf by treating the `.dist` content as a Nunjucks
 * template. Every directive line is rewritten to use a `values["KEY"] | default(...)`
 * expression, then rendered with the supplied values map. Comments, blank lines,
 * and non-directive content are preserved verbatim.
 */
export function renderConf(
  distContent: string,
  values: Record<string, string>,
): string {
  // Convert each directive line into a Nunjucks expression. We operate line-by-line
  // so we can reliably detect comment lines via leading whitespace + `#`, mirroring
  // the detection strategy used by parseConf so both functions agree on what counts
  // as a directive line — including indented directives.
  const templateLines = distContent.split(/\r?\n/).map((line) => {
    const trimmed = line.trimStart();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("[")) {
      return line;
    }
    // Run the regex against the trimmed line so indented directives are detected.
    const match = DIRECTIVE_LINE.exec(trimmed);
    if (!match) return line;

    const [, key, originalValue] = match;
    // Escape any `"` or backslash inside the original default so the Nunjucks
    // `default()` filter string literal stays valid.
    const escaped = originalValue.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    // Preserve the original leading whitespace AND the "key = " alignment by
    // slicing the original line up to where the value starts.
    const indent = line.slice(0, line.length - trimmed.length);
    const prefix = indent + trimmed.slice(0, trimmed.length - originalValue.length);
    return `${prefix}{{ values["${key}"] | default("${escaped}") }}`;
  });

  const template = templateLines.join("\n");
  return env.renderString(template, { values });
}

/**
 * Merge the current conf values with schema defaults so that every curated
 * directive has a value (either the existing one, or the schema default).
 */
export function mergeWithDefaults(
  current: Record<string, string>,
  schema: WorldserverSchema,
): Record<string, string> {
  const result: Record<string, string> = { ...current };
  for (const category of schema.categories) {
    for (const directive of category.directives) {
      if (result[directive.key] === undefined) {
        result[directive.key] = directive.default;
      }
    }
  }
  return result;
}
