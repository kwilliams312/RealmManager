import { describe, expect, test } from "bun:test";
import { isCrashLoop, isStartupTimedOut, type ContainerStatus } from "../docker-status";

function makeStatus(overrides: Partial<ContainerStatus> = {}): ContainerStatus {
  return {
    exists: true,
    state: "running",
    exitCode: 0,
    restartCount: 0,
    startedAt: new Date().toISOString(),
    error: "",
    ...overrides,
  };
}

describe("isCrashLoop", () => {
  test("not a crash loop when container does not exist", () => {
    expect(isCrashLoop(makeStatus({ exists: false }))).toBe(false);
  });

  test("not a crash loop with 0 restarts", () => {
    expect(isCrashLoop(makeStatus({ state: "running", restartCount: 0 }))).toBe(false);
  });

  test("crash loop when restarting with 3+ restarts", () => {
    expect(isCrashLoop(makeStatus({ state: "restarting", restartCount: 3 }))).toBe(true);
    expect(isCrashLoop(makeStatus({ state: "restarting", restartCount: 10 }))).toBe(true);
  });

  test("crash loop when exited with non-zero code and 3+ restarts", () => {
    expect(
      isCrashLoop(makeStatus({ state: "exited", exitCode: 1, restartCount: 3 }))
    ).toBe(true);
  });

  test("not a crash loop when exited cleanly (exit code 0)", () => {
    expect(
      isCrashLoop(makeStatus({ state: "exited", exitCode: 0, restartCount: 3 }))
    ).toBe(false);
  });

  test("crash loop when running with 3+ restarts", () => {
    expect(isCrashLoop(makeStatus({ state: "running", restartCount: 3 }))).toBe(true);
  });

  test("not a crash loop with fewer than 3 restarts", () => {
    expect(
      isCrashLoop(makeStatus({ state: "restarting", restartCount: 2 }))
    ).toBe(false);
  });
});

describe("isStartupTimedOut", () => {
  test("false when container does not exist", () => {
    expect(isStartupTimedOut(makeStatus({ exists: false }))).toBe(false);
  });

  test("false when container is not running", () => {
    expect(isStartupTimedOut(makeStatus({ state: "exited" }))).toBe(false);
  });

  test("false when recently started", () => {
    expect(
      isStartupTimedOut(
        makeStatus({ startedAt: new Date().toISOString(), restartCount: 0 })
      )
    ).toBe(false);
  });

  test("true when running longer than timeout (120s)", () => {
    const old = new Date(Date.now() - 130_000).toISOString(); // 130s ago
    expect(isStartupTimedOut(makeStatus({ startedAt: old }))).toBe(true);
  });

  test("true when running with 3+ restarts regardless of elapsed time", () => {
    expect(
      isStartupTimedOut(
        makeStatus({ startedAt: new Date().toISOString(), restartCount: 3 })
      )
    ).toBe(true);
  });

  test("false when startedAt is empty", () => {
    expect(isStartupTimedOut(makeStatus({ startedAt: "" }))).toBe(false);
  });

  test("false when startedAt is invalid", () => {
    expect(isStartupTimedOut(makeStatus({ startedAt: "not-a-date" }))).toBe(false);
  });
});
