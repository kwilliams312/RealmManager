/**
 * Global build pipeline — operates on sources, not realms.
 *
 * Steps:
 * 1. Checkout/pull source to realms/sources/{sourceId}/
 * 2. Docker build worldserver image
 * 3. Tag with versioned tag
 * 4. Extract config template from image
 * 5. Record in DB, prune old builds
 */

import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, writeFile, access, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  initBuildState,
  appendBuildLog,
  updateBuildStatus as updateMemStatus,
  getBuildLog,
  isSourceBuilding,
  markBuilding,
  clearBuilding,
} from "./build-state";
import { getSourceBySlug, updateSource } from "./build-sources-db";
import { getTokenSecret } from "./github-tokens-db";
import {
  createBuild,
  updateBuildStatus,
  pruneOldBuilds,
} from "./builds-db";
import { type RealmManifest, parseManifest } from "./manifest";

const exec = promisify(execFile);

const DATA_DIR = process.env.REALM_DATA_DIR ?? "/data/realms";
const IMAGE_REPO = "ac-worldserver";
const DB_IMPORT_REPO = "ac-db-import";

function sourcesDir(sourceId: string): string {
  return join(DATA_DIR, "sources", sourceId);
}

function sourceCheckoutDir(sourceId: string): string {
  return join(sourcesDir(sourceId), "source");
}

function configTemplateDir(sourceId: string): string {
  return join(sourcesDir(sourceId), "config-template");
}

function generateTag(sourceId: string): string {
  const d = new Date();
  const pad = (n: number): string => String(n).padStart(2, "0");
  const ts = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `${sourceId}-${ts}`;
}

/** Full image reference: ac-worldserver:{sourceId}-{timestamp} */
export function imageRef(tag: string): string {
  return `${IMAGE_REPO}:${tag}`;
}

/** Full db-import image reference: ac-db-import:{sourceId}-{timestamp} */
export function dbImportRef(tag: string): string {
  return `${DB_IMPORT_REPO}:${tag}`;
}

/** Latest tag for a source: ac-worldserver:{sourceId}-latest */
export function latestTag(sourceId: string): string {
  return `${IMAGE_REPO}:${sourceId}-latest`;
}

/** Latest db-import tag for a source: ac-db-import:{sourceId}-latest */
export function dbImportLatestTag(sourceId: string): string {
  return `${DB_IMPORT_REPO}:${sourceId}-latest`;
}

async function run(
  cmd: string,
  args: string[],
  options: { cwd?: string } = {}
): Promise<{ stdout: string; stderr: string }> {
  return exec(cmd, args, { cwd: options.cwd, maxBuffer: 50 * 1024 * 1024 });
}

/**
 * Run a command and stream each line of stdout/stderr to a callback.
 * Returns a promise that resolves on exit code 0, rejects otherwise.
 */
function runStreaming(
  cmd: string,
  args: string[],
  options: { cwd?: string; onLine: (line: string) => void }
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: options.cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderrBuf = "";

    const processData = (data: Buffer): void => {
      const text = data.toString();
      const lines = text.split("\n");
      for (const line of lines) {
        const trimmed = line.trimEnd();
        if (trimmed) options.onLine(trimmed);
      }
    };

    child.stdout.on("data", processData);
    child.stderr.on("data", (data: Buffer) => {
      stderrBuf += data.toString();
      processData(data);
    });

    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(
        `${cmd} exited with code ${code}\n${stderrBuf.slice(-2000)}`
      ));
    });

    child.on("error", reject);
  });
}

async function exists(path: string): Promise<boolean> {
  try { await access(path); return true; } catch { return false; }
}

/**
 * Inject a GitHub PAT into a clone URL for private repo access.
 * https://github.com/owner/repo → https://x-access-token:{token}@github.com/owner/repo
 */
function injectTokenIntoUrl(url: string, token: string): string {
  try {
    const parsed = new URL(url);
    parsed.username = "x-access-token";
    parsed.password = token;
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Validate that a git repo URL is reachable and the branch exists.
 * Uses `git ls-remote` which works with any git host.
 * Pass a token for private repo authentication.
 */
export async function validateRepoUrl(
  url: string,
  branch: string,
  token?: string
): Promise<{ valid: boolean; error?: string }> {
  const checkUrl = token ? injectTokenIntoUrl(url, token) : url;
  try {
    const { stdout } = await exec("git", [
      "ls-remote", "--heads", "--exit-code", checkUrl,
      `refs/heads/${branch}`,
    ], { timeout: 15_000 });
    // --exit-code makes git exit 2 if no matching refs found
    if (!stdout.trim()) {
      return { valid: false, error: `Branch '${branch}' not found in repository` };
    }
    return { valid: true };
  } catch (err: unknown) {
    const e = err as { code?: number; stderr?: string; message?: string };
    const msg = redactSecrets(e.stderr ?? e.message ?? String(err));
    if (msg.includes("not found") || msg.includes("does not appear to be a git repository"))
      return { valid: false, error: "Repository not found (check URL and token for private repos)" };
    if (msg.includes("Authentication failed") || msg.includes("could not read Username"))
      return { valid: false, error: "Authentication failed (check token for private repos)" };
    if (e.code === 2)
      return { valid: false, error: `Branch '${branch}' not found in repository` };
    return { valid: false, error: `Cannot reach repository: ${msg}` };
  }
}

/**
 * Strip credentials from any string (error messages, log lines).
 * Matches https://user:token@host patterns and ghp_/gho_/github_pat_ tokens.
 */
function redactSecrets(text: string): string {
  return text
    .replace(/:\/\/[^@\s]+@/g, "://***@")
    .replace(/\bgh[ps]_[A-Za-z0-9_]+/g, "***")
    .replace(/\bgithub_pat_[A-Za-z0-9_]+/g, "***");
}

async function safeRmi(ref: string): Promise<void> {
  try { await run("docker", ["rmi", ref]); } catch { /* ignore */ }
}

/**
 * Get the full image reference for an image-type source.
 * e.g., "acore/ac-wotlk-worldserver:master"
 */
export function imageSourceRef(source: { imageName: string | null; imageTag: string }): string {
  return `${source.imageName ?? ""}:${source.imageTag ?? "latest"}`;
}

/**
 * Start a build (git source) or pull (image source). Returns the DB build ID.
 * Throws if a build is already in progress for this source.
 */
export async function startBuild(
  sourceId: string,
  branch?: string
): Promise<number> {
  if (isSourceBuilding(sourceId)) {
    throw new Error("Build already in progress for this source");
  }

  const source = await getSourceBySlug(sourceId);
  if (!source) throw new Error(`Unknown source: ${sourceId}`);

  markBuilding(sourceId);
  const log = (line: string) => appendBuildLog(sourceId, redactSecrets(line));

  try {
    if (source.sourceType === "image") {
      return await pullImageSource(sourceId, source, log);
    }

    const useBranch = branch ?? source.defaultBranch;

    // Resolve GitHub token for private repo auth
    let cloneUrl = source.url;
    if (source.githubTokenId) {
      const tok = await getTokenSecret(source.githubTokenId);
      if (tok) {
        cloneUrl = injectTokenIntoUrl(source.url, tok.token);
      }
    }

    // Resolve token secret for module cloning
    let tokenSecret: string | undefined;
    if (source.githubTokenId) {
      const tok = await getTokenSecret(source.githubTokenId);
      if (tok) tokenSecret = tok.token;
    }

    initBuildState(sourceId, "cloning", `Build started for ${source.name} (${useBranch})`, useBranch);
    const buildId = await buildSource(sourceId, cloneUrl, useBranch, log, {
      dockerfilePath: source.dockerfilePath,
      worldserverTarget: source.worldserverTarget,
      dbImportTarget: source.dbImportTarget,
      buildArgs: source.buildArgs,
      refConfigPath: source.refConfigPath,
      manifest: source.sourceManifest ?? undefined,
      token: tokenSecret,
    });
    return buildId;
  } catch (err) {
    log(`Build failed: ${redactSecrets(String(err))}`);
    updateMemStatus(sourceId, "failed");
    throw err;
  } finally {
    clearBuilding(sourceId);
  }
}

/**
 * Pull an image-type source from a registry.
 * Records the pull as a "build" in the DB for consistency.
 */
async function pullImageSource(
  sourceId: string,
  source: { name: string; imageName: string | null; imageTag: string },
  log: (line: string) => void
): Promise<number> {
  const fullRef = `${source.imageName}:${source.imageTag}`;
  initBuildState(sourceId, "building", `Pulling image for ${source.name}`, source.imageTag);

  const buildId = await createBuild(sourceId, fullRef, source.imageTag);
  log(`Pull #${buildId} started (image: ${fullRef})`);

  try {
    updateMemStatus(sourceId, "building");
    log(`Pulling ${fullRef}...`);
    await runStreaming("docker", ["pull", fullRef], {
      onLine: log,
    });
    log("Pull complete.");

    // Record success
    const { log: buildLog } = getBuildLog(sourceId);
    await updateBuildStatus(buildId, "success", buildLog);
    updateMemStatus(sourceId, "idle");
    log(`Pull #${buildId} complete (image: ${fullRef}).`);

    return buildId;
  } catch (err) {
    const { log: failLog } = getBuildLog(sourceId);
    await updateBuildStatus(buildId, "failed", failLog).catch(() => {});
    throw err;
  }
}

interface SourceBuildConfig {
  dockerfilePath: string;
  worldserverTarget: string;
  dbImportTarget: string | null;
  buildArgs: Record<string, string> | null;
  refConfigPath: string;
  manifest?: RealmManifest;
  token?: string;
}

async function buildSource(
  sourceId: string,
  url: string,
  branch: string,
  log: (line: string) => void,
  config?: SourceBuildConfig
): Promise<number> {
  const tag = generateTag(sourceId);
  const fullRef = imageRef(tag);
  const dockerfile = config?.dockerfilePath ?? "apps/docker/Dockerfile";
  const wsTarget = config?.worldserverTarget ?? "worldserver";
  const dbTarget = config?.dbImportTarget ?? "db-import";
  const refCfg = config?.refConfigPath ?? "/azerothcore/env/ref/etc";
  const extraArgs = config?.buildArgs ?? {};
  let manifest = config?.manifest ?? null;
  const token = config?.token;

  // Step 1: Record build in DB
  const buildId = await createBuild(sourceId, tag, branch);
  log(`Build #${buildId} started (tag: ${tag})`);

  try {
    // Step 2: Checkout/pull source
    updateMemStatus(sourceId, "cloning");
    const srcDir = sourceCheckoutDir(sourceId);
    await mkdir(srcDir, { recursive: true });

    // Redact token from URL for log display
    const safeUrl = url.replace(/:\/\/[^@]+@/, "://***@");
    const cloneSubmodules = manifest?.build?.submodules ?? false;

    const alreadyCloned = await exists(join(srcDir, ".git"));
    if (!alreadyCloned) {
      log(`Cloning ${safeUrl} (branch: ${branch})${cloneSubmodules ? " with submodules" : ""}...`);
      const cloneArgs = ["clone", "--depth=1", "--branch", branch];
      if (cloneSubmodules) cloneArgs.push("--recurse-submodules", "--shallow-submodules");
      cloneArgs.push(url, srcDir);
      await run("git", cloneArgs);
      log("Clone complete.");
    } else {
      log("Updating source...");
      await run("git", ["remote", "set-url", "origin", url], { cwd: srcDir });
      await run("git", ["fetch", "origin", branch], { cwd: srcDir });
      await run("git", ["reset", "--hard", `origin/${branch}`], { cwd: srcDir });
      if (cloneSubmodules) {
        await run("git", ["submodule", "update", "--init", "--recursive", "--depth=1"], { cwd: srcDir });
      }
      log("Source updated.");
    }

    // Step 2b: Auto-detect realmmanager.yaml if no stored manifest
    if (!manifest) {
      const manifestPath = join(srcDir, "realmmanager.yaml");
      if (await exists(manifestPath)) {
        try {
          const yamlContent = await readFile(manifestPath, "utf-8");
          manifest = parseManifest(yamlContent);
          await updateSource(sourceId, { sourceManifest: manifest });
          log("Auto-detected realmmanager.yaml from repo — manifest imported.");
        } catch (err) {
          log(`Warning: could not parse realmmanager.yaml: ${err}`);
        }
      }
    } else {
      // Check if repo also has one but don't override stored manifest
      if (await exists(join(srcDir, "realmmanager.yaml"))) {
        log("Using stored manifest (repo realmmanager.yaml ignored).");
      }
    }

    // Step 2c: Clone extra module repos declared in manifest
    if (manifest?.modules && manifest.modules.length > 0) {
      log(`Cloning ${manifest.modules.length} module(s)...`);
      for (const mod of manifest.modules) {
        const modDir = join(srcDir, mod.path);
        const modExists = await exists(join(modDir, ".git"));
        let modUrl = mod.url;
        if (mod.useToken && token) {
          modUrl = injectTokenIntoUrl(mod.url, token);
        }
        const safeModUrl = modUrl.replace(/:\/\/[^@]+@/, "://***@");
        if (!modExists) {
          log(`  Cloning module ${mod.name} from ${safeModUrl}...`);
          const modArgs = ["clone", "--depth=1"];
          if (mod.branch) modArgs.push("--branch", mod.branch);
          modArgs.push(modUrl, modDir);
          try {
            await run("git", modArgs);
            log(`  Module ${mod.name} cloned.`);
          } catch (err) {
            log(`  Warning: failed to clone module ${mod.name}: ${redactSecrets(String(err))}`);
          }
        } else {
          log(`  Updating module ${mod.name}...`);
          try {
            if (mod.useToken && token) {
              await run("git", ["remote", "set-url", "origin", modUrl], { cwd: modDir });
            }
            await run("git", ["fetch", "origin"], { cwd: modDir });
            const refBranch = mod.branch ?? "HEAD";
            await run("git", ["reset", "--hard", `origin/${refBranch}`], { cwd: modDir });
            log(`  Module ${mod.name} updated.`);
          } catch (err) {
            log(`  Warning: failed to update module ${mod.name}: ${redactSecrets(String(err))}`);
          }
        }
      }
    }

    // Step 2d: Pre-build steps
    if (manifest?.steps?.preBuild && manifest.steps.preBuild.length > 0) {
      log("Running pre-build steps...");
      for (const step of manifest.steps.preBuild) {
        log(`  $ ${step.run}`);
        try {
          await run("sh", ["-c", step.run], { cwd: srcDir });
        } catch (err) {
          log(`  Warning: pre-build step failed: ${redactSecrets(String(err))}`);
        }
      }
    }

    // Step 3: Docker build (streamed so logs appear in real-time)
    updateMemStatus(sourceId, "building");
    log(`Building Docker image (${dockerfile} → ${wsTarget})...`);

    const buildCmd = [
      "build",
      "-f", dockerfile,
      "--target", wsTarget,
      "-t", fullRef,
    ];
    for (const [k, v] of Object.entries(extraArgs)) {
      buildCmd.push("--build-arg", `${k}=${v}`);
    }
    buildCmd.push(".");

    try {
      await runStreaming("docker", buildCmd, { cwd: srcDir, onLine: log });
      log("Docker build complete.");
    } catch (err: unknown) {
      const e = err as { message?: string };
      log(`Build failed: ${redactSecrets(e.message ?? String(err))}`);
      throw err;
    }

    // Step 3b: Build db-import image (if target is configured)
    if (dbTarget) {
      const dbImportFullRef = dbImportRef(tag);
      log(`Building db-import image (target: ${dbTarget})...`);
      try {
        const dbBuildCmd = [
          "build",
          "-f", dockerfile,
          "--target", dbTarget,
          "-t", dbImportFullRef,
          ".",
        ];
        for (const [k, v] of Object.entries(extraArgs)) {
          dbBuildCmd.push("--build-arg", `${k}=${v}`);
        }
        await runStreaming("docker", dbBuildCmd, { cwd: srcDir, onLine: log });
        log("db-import image built.");
        await run("docker", ["tag", dbImportFullRef, dbImportLatestTag(sourceId)]);
      } catch (err: unknown) {
        const e = err as { message?: string };
        log(`Warning: db-import build failed: ${redactSecrets(e.message ?? String(err))}`);
      }
    } else {
      log("Skipping db-import build (no target configured).");
    }

    // Step 3c: Also tag as latest for this source
    log(`Tagging as ${latestTag(sourceId)}...`);
    await run("docker", ["tag", fullRef, latestTag(sourceId)]);

    // Step 3d: Post-build steps
    if (manifest?.steps?.postBuild && manifest.steps.postBuild.length > 0) {
      log("Running post-build steps...");
      for (const step of manifest.steps.postBuild) {
        log(`  $ ${step.run}`);
        try {
          await run("sh", ["-c", step.run], { cwd: srcDir });
        } catch (err) {
          log(`  Warning: post-build step failed: ${redactSecrets(String(err))}`);
        }
      }
    }

    // Step 4: Extract config template
    updateMemStatus(sourceId, "extracting");
    log("Extracting default configuration files...");
    const templateDir = configTemplateDir(sourceId);
    await mkdir(templateDir, { recursive: true });

    const hostDir = process.env.REALM_HOST_DIR ?? "./data/realms";
    const hostTemplateDir = `${hostDir}/sources/${sourceId}/config-template`;

    try {
      await run("docker", [
        "run", "--rm",
        "--user", "root",
        "-v", `${hostTemplateDir}:/out`,
        "--entrypoint", "sh",
        fullRef,
        "-c", `cp -r ${refCfg}/* /out/ && [ -f /out/worldserver.conf.dist ] && cp -n /out/worldserver.conf.dist /out/worldserver.conf; true`,
      ]);
      log("Configuration template extracted.");
    } catch (extractErr) {
      log(`Warning: could not extract config template: ${extractErr}`);
    }

    // Step 5: Mark success, prune
    log(`Build #${buildId} complete (image: ${fullRef}).`);
    const { log: buildLog } = getBuildLog(sourceId);
    await updateBuildStatus(buildId, "success", buildLog);
    updateMemStatus(sourceId, "idle");

    // Step 5b: Auto-assign build to realms that have no active build
    try {
      await autoAssignBuildToRealms(sourceId, buildId, tag, log);
    } catch (err) {
      log(`Warning: auto-assign failed: ${err}`);
    }

    // Auto-prune to 5 builds per source
    try {
      const prunedTags = await pruneOldBuilds(sourceId, 5);
      for (const prunedTag of prunedTags) {
        log(`Pruning old build: ${imageRef(prunedTag)}`);
        await safeRmi(imageRef(prunedTag));
      }
      if (prunedTags.length > 0) log(`Pruned ${prunedTags.length} old build(s).`);
    } catch { /* non-critical */ }

    return buildId;
  } catch (err) {
    // Failure: mark in DB, clean up image
    const { log: failLog } = getBuildLog(sourceId);
    await updateBuildStatus(buildId, "failed", failLog).catch(() => {});
    log(`Cleaning up failed build image ${fullRef}...`);
    await safeRmi(fullRef);
    throw err;
  }
}

/**
 * After a successful build, check if any realm needs this build assigned.
 * Assigns to realms that have no active build (e.g., realm 1 after first-boot setup).
 * Also generates the compose file and copies config templates.
 */
async function autoAssignBuildToRealms(
  sourceId: string,
  buildId: number,
  tag: string,
  log: (line: string) => void
): Promise<void> {
  const { query } = await import("./db");
  const DB_REALMD = (await import("./db")).DB_REALMD;
  const { setRealmActiveBuild, getSourceBySlug } = await import("./build-sources-db");
  const { getBuild } = await import("./builds-db");

  // Find realms with no active build
  const realms = await query<{ id: number; name: string }>(
    `SELECT r.id, r.name FROM ${DB_REALMD}.realmlist r
     LEFT JOIN ${DB_REALMD}.realm_source rs ON r.id = rs.realmid
     WHERE rs.active_build_id IS NULL OR rs.realmid IS NULL`
  );

  if (realms.length === 0) return;

  const build = await getBuild(buildId);
  const source = await getSourceBySlug(sourceId);
  if (!build || !source) return;

  const { generateRealmCompose, buildManifestEnv } = await import("./realm-compose");

  for (const realm of realms) {
    try {
      log(`Auto-assigning build #${buildId} to realm ${realm.id} (${realm.name})...`);
      await setRealmActiveBuild(realm.id, buildId);

      // Generate compose and config for this realm
      const realmDir = join(DATA_DIR, String(realm.id));
      await mkdir(join(realmDir, "etc", "modules"), { recursive: true });
      await mkdir(join(realmDir, "logs"), { recursive: true });

      const manifestEnv = buildManifestEnv(source.sourceManifest, realm.id, sourceId);
      const compose = generateRealmCompose(realm.id, imageRef(tag), {
        configPath: source.configPath,
        dataPath: source.dataPath,
        logsPath: source.logsPath,
      }, manifestEnv);
      await writeFile(join(realmDir, "docker-compose.yml"), compose);

      await copyConfigToRealm(sourceId, realm.id);
      log(`Realm ${realm.id} configured with build #${buildId}.`);
    } catch (err) {
      log(`Warning: failed to auto-assign build to realm ${realm.id}: ${err}`);
    }
  }
}

/**
 * Clean up all filesystem and Docker artifacts for a deleted source.
 * Called after removing the source from the DB.
 */
export async function cleanupSourceArtifacts(
  sourceId: string,
  imageTags: string[]
): Promise<void> {
  // Remove Docker images for each build
  for (const tag of imageTags) {
    await safeRmi(imageRef(tag));
    await safeRmi(dbImportRef(tag));
  }
  // Remove :latest tags
  await safeRmi(latestTag(sourceId));
  await safeRmi(dbImportLatestTag(sourceId));

  // Remove source directory (clone + config template)
  const srcDir = sourcesDir(sourceId);
  try {
    const { rm } = await import("node:fs/promises");
    await rm(srcDir, { recursive: true, force: true });
  } catch { /* may not exist */ }
}

/**
 * Copy config template from a source to a realm's etc dir.
 * Called during realm creation. Falls back to extracting from
 * the image directly if the template dir is empty.
 */
export async function copyConfigToRealm(sourceId: string, realmId: number): Promise<void> {
  const templateDir = configTemplateDir(sourceId);
  const realmEtcDir = join(DATA_DIR, String(realmId), "etc");
  await mkdir(realmEtcDir, { recursive: true });

  try {
    // Use cp to copy all files from template to realm etc
    await run("cp", ["-r", `${templateDir}/.`, realmEtcDir]);
  } catch {
    // Template may not exist yet if no build has completed
  }

  // Create worldserver.conf from .dist if only .dist exists
  const confDist = join(realmEtcDir, "worldserver.conf.dist");
  const conf = join(realmEtcDir, "worldserver.conf");
  if (await exists(confDist) && !(await exists(conf))) {
    try { await run("cp", [confDist, conf]); } catch { /* ignore */ }
  }
}
