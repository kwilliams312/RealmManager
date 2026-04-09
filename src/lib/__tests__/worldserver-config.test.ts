import { describe, expect, test } from "bun:test";
import { parseConf, renderConf, mergeWithDefaults } from "../worldserver-config";

// ─── parseConf ───────────────────────────────────────────────────────────────

describe("parseConf", () => {
  test("extracts simple key=value pairs", () => {
    const content = "Rate.XP.Kill = 1\nMaxPlayerLevel = 80\n";
    const result = parseConf(content);
    expect(result["Rate.XP.Kill"]).toBe("1");
    expect(result["MaxPlayerLevel"]).toBe("80");
  });

  test("preserves quoted string values", () => {
    const content = 'BindIP = "0.0.0.0"\nPlayerStart.String = "Welcome!"\n';
    const result = parseConf(content);
    expect(result["BindIP"]).toBe('"0.0.0.0"');
    expect(result["PlayerStart.String"]).toBe('"Welcome!"');
  });

  test("handles empty values", () => {
    const content = "LogsDir = \nTempDir =\n";
    const result = parseConf(content);
    expect(result["LogsDir"]).toBe("");
    expect(result["TempDir"]).toBe("");
  });

  test("skips comment lines", () => {
    const content =
      "# This is a comment with Rate.XP.Kill = 99\n" +
      "#Rate.XP.Kill = 42\n" +
      "Rate.XP.Kill = 1\n";
    const result = parseConf(content);
    expect(result["Rate.XP.Kill"]).toBe("1");
    expect(Object.keys(result)).toHaveLength(1);
  });

  test("skips lines that start with whitespace+hash", () => {
    const content = "    # indented comment = 5\nRealKey = 3\n";
    const result = parseConf(content);
    expect(result["RealKey"]).toBe("3");
    expect(Object.keys(result)).toHaveLength(1);
  });

  test("handles dotted keys", () => {
    const content = "Rate.Creature.Elite.WORLDBOSS.HP = 1.5\n";
    const result = parseConf(content);
    expect(result["Rate.Creature.Elite.WORLDBOSS.HP"]).toBe("1.5");
  });

  test("handles extra whitespace around =", () => {
    const content = "MaxPlayerLevel    =    80\n";
    const result = parseConf(content);
    expect(result["MaxPlayerLevel"]).toBe("80");
  });

  test("ignores section headers like [worldserver]", () => {
    const content = "[worldserver]\nMaxPlayerLevel = 80\n";
    const result = parseConf(content);
    expect(result["MaxPlayerLevel"]).toBe("80");
    expect(result["[worldserver]"]).toBeUndefined();
  });
});

// ─── renderConf ──────────────────────────────────────────────────────────────

describe("renderConf", () => {
  const sampleDist = `# Comment block
# Rate.XP.Kill
#     Description: XP rate

Rate.XP.Kill = 1

#
# MaxPlayerLevel
#     Default: 80

MaxPlayerLevel = 80

BindIP = "0.0.0.0"
`;

  test("renders values from user input", () => {
    const result = renderConf(sampleDist, { "Rate.XP.Kill": "5" });
    expect(result).toContain("Rate.XP.Kill = 5");
    expect(result).toContain("MaxPlayerLevel = 80"); // unchanged default
  });

  test("preserves comments and structure from .dist", () => {
    const result = renderConf(sampleDist, {});
    expect(result).toContain("# Comment block");
    expect(result).toContain("# Rate.XP.Kill");
    expect(result).toContain("#     Description: XP rate");
  });

  test("falls back to .dist default for missing values", () => {
    const result = renderConf(sampleDist, { "Rate.XP.Kill": "10" });
    expect(result).toContain("MaxPlayerLevel = 80");
  });

  test("does NOT substitute values inside comment lines", () => {
    const distWithCommentExample = "# Example: Rate.XP.Kill = 99\nRate.XP.Kill = 1\n";
    const result = renderConf(distWithCommentExample, { "Rate.XP.Kill": "5" });
    expect(result).toContain("# Example: Rate.XP.Kill = 99"); // comment unchanged
    expect(result).toContain("Rate.XP.Kill = 5"); // actual directive updated
  });

  test("handles all ~300 directives from a real dist file without data loss", () => {
    // Simulate multiple directives
    const lines: string[] = [];
    for (let i = 0; i < 100; i++) {
      lines.push(`Key.Number.${i} = ${i}`);
    }
    const dist = lines.join("\n") + "\n";
    const result = renderConf(dist, { "Key.Number.50": "999" });
    const parsed = parseConf(result);
    expect(parsed["Key.Number.0"]).toBe("0");
    expect(parsed["Key.Number.50"]).toBe("999");
    expect(parsed["Key.Number.99"]).toBe("99");
    expect(Object.keys(parsed)).toHaveLength(100);
  });

  test("handles quoted string values on write", () => {
    const dist = 'BindIP = "0.0.0.0"\n';
    const result = renderConf(dist, { BindIP: '"127.0.0.1"' });
    expect(result).toContain('BindIP = "127.0.0.1"');
  });

  test("handles empty values on write", () => {
    const dist = "LogsDir = \n";
    const result = renderConf(dist, { LogsDir: '"/var/log"' });
    expect(result).toContain('LogsDir = "/var/log"');
  });

  test("handles indented directive lines consistently with parseConf", () => {
    const dist = "  IndentedKey = 5\nNormalKey = 10\n";
    const result = renderConf(dist, { IndentedKey: "99", NormalKey: "20" });
    // Both should be updated — indented lines must not be silently skipped
    const parsed = parseConf(result);
    expect(parsed["IndentedKey"]).toBe("99");
    expect(parsed["NormalKey"]).toBe("20");
  });
});

// ─── mergeWithDefaults ───────────────────────────────────────────────────────

describe("mergeWithDefaults", () => {
  const sampleSchema = {
    categories: [
      {
        id: "test",
        label: "Test",
        directives: [
          { key: "A", label: "A", type: "number" as const, default: "1", description: "" },
          { key: "B", label: "B", type: "number" as const, default: "2", description: "" },
          { key: "C", label: "C", type: "number" as const, default: "3", description: "" },
        ],
      },
    ],
  };

  test("fills in schema defaults for missing keys", () => {
    const current = { A: "10" };
    const result = mergeWithDefaults(current, sampleSchema);
    expect(result["A"]).toBe("10");
    expect(result["B"]).toBe("2");
    expect(result["C"]).toBe("3");
  });

  test("preserves existing values over defaults", () => {
    const current = { A: "10", B: "20", C: "30" };
    const result = mergeWithDefaults(current, sampleSchema);
    expect(result).toEqual({ A: "10", B: "20", C: "30" });
  });
});
