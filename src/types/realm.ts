export interface Realm {
  id: number;
  name: string;
  address: string;
  localAddress: string;
  localSubnetMask: string;
  port: number;
  icon: number;
  flag: number;
  timezone: number;
  allowedSecurityLevel: number;
  population: number;
  gamebuild: number;
  // Build reference — which shared build this realm uses
  active_build_id?: number | null;
  // Remote realm flag
  is_remote?: boolean;
  // RA credentials (remote realms)
  ra_host?: string | null;
  ra_port?: number | null;
  ra_user?: string | null;
  ra_pass?: string | null;
  // Legacy fields (kept for transition)
  sourceId?: string;
  sourceBranch?: string;
  buildStatus?: BuildStatus;
}

export type BuildStatus =
  | "pending"
  | "cloning"
  | "building"
  | "importing"
  | "starting"
  | "running"
  | "stopped"
  | "failed"
  | "crashed"
  | "not_built";

export interface RealmStatus {
  id: number;
  name: string;
  address: string;
  port: number;
  online: boolean;
  state?: "running" | "starting" | "stopped" | "crashed";
  players_online: number;
  bots_online: number;
  total_characters: number;
  bot_characters: number;
}

export type RealmTab =
  | "settings"
  | "config"
  | "console"
  | "logs";

export interface RealmBuild {
  id: number;
  realmid: number;
  image_tag: string;
  source_id: string;
  source_branch: string;
  status: "building" | "success" | "failed";
  is_active: boolean;
  build_log: string[] | null;
  created_at: string;
}

export interface RealmSource {
  id: string;
  name: string;
  url: string;
  defaultBranch: string;
}

/** Manifest metadata for UI display (subset of RealmManifest — no full type import in client code). */
export interface SourceManifestSummary {
  preset?: string;
  metadata?: { name?: string; description?: string };
  databases?: Array<{ name: string }>;
  modules?: Array<{ name: string; url: string; path: string }>;
  environment?: { worldserver?: Record<string, string>; dbImport?: Record<string, string> };
  build?: { submodules?: boolean };
  steps?: { preBuild?: Array<{ run: string }>; postBuild?: Array<{ run: string }>; postImport?: Array<{ run: string }> };
}

/** Global build source — Docker image or git repository. */
export interface BuildSource {
  id: number;
  sourceId: string;
  name: string;
  url: string;
  defaultBranch: string;
  githubTokenId: number | null;
  sourceType: "image" | "git";
  imageName: string | null;
  imageTag: string;
  sourceManifest: SourceManifestSummary | null;
  createdAt: string;
}

/** GitHub token (masked — for UI display). */
export interface GitHubToken {
  id: number;
  name: string;
  tokenMasked: string;
  createdAt: string;
}

/** Global build — shared Docker image built from a source. */
export interface GlobalBuild {
  id: number;
  source_id: string;
  image_tag: string;
  source_branch: string;
  status: "building" | "success" | "failed";
  build_log: string[] | null;
  created_at: string;
}

/** Internal type with decrypted token — never sent to client. */
export interface RealmSourceConfig extends RealmSource {
  token?: string;
  hasToken?: boolean;
  tokenMasked?: string;
}
