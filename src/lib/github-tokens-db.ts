/**
 * GitHub tokens DB — centrally managed PATs for pulling private repos.
 * Tokens are AES-256-GCM encrypted at rest.
 * Creates the table on first use.
 */

import { query, executeDb, DB_REALMD } from "./db";
import { encrypt, decrypt } from "./crypto";

let tableCreated = false;

async function ensureTable(): Promise<void> {
    if (tableCreated) return;
    try {
        await executeDb(
            DB_REALMD,
            `CREATE TABLE IF NOT EXISTS github_tokens (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(128) NOT NULL,
                token_enc TEXT NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY idx_name (name)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
            []
        );
        tableCreated = true;
    } catch {
        tableCreated = true;
    }
}

export interface GitHubToken {
    id: number;
    name: string;
    tokenMasked: string;
    createdAt: string;
}

export interface GitHubTokenWithSecret extends GitHubToken {
    token: string;
}

interface TokenRow {
    id: number;
    name: string;
    token_enc: string;
    created_at: string;
}

function maskToken(plain: string): string {
    if (plain.length > 6)
        return plain.slice(0, 4) + "••••" + plain.slice(-4);
    return "••••";
}

function rowToPublic(row: TokenRow): GitHubToken {
    const plain = decrypt(row.token_enc);
    return {
        id: row.id,
        name: row.name,
        tokenMasked: plain ? maskToken(plain) : "••••",
        createdAt: row.created_at,
    };
}

function rowToSecret(row: TokenRow): GitHubTokenWithSecret | null {
    const plain = decrypt(row.token_enc);
    if (!plain) return null;
    return {
        id: row.id,
        name: row.name,
        tokenMasked: maskToken(plain),
        token: plain,
        createdAt: row.created_at,
    };
}

/** List all tokens (masked — never exposes plaintext). */
export async function getAllTokens(): Promise<GitHubToken[]> {
    await ensureTable();
    const rows = await query<TokenRow>(
        `SELECT * FROM ${DB_REALMD}.github_tokens ORDER BY name`
    );
    return rows.map(rowToPublic);
}

/** Get a single token with decrypted secret (for build pipeline). */
export async function getTokenSecret(
    id: number
): Promise<GitHubTokenWithSecret | null> {
    await ensureTable();
    const rows = await query<TokenRow>(
        `SELECT * FROM ${DB_REALMD}.github_tokens WHERE id = ?`,
        [id]
    );
    if (!rows.length) return null;
    return rowToSecret(rows[0]);
}

/** Create a new token. Returns the inserted ID. */
export async function createToken(
    name: string,
    token: string
): Promise<number> {
    await ensureTable();
    const enc = encrypt(token);
    const result = await executeDb(
        DB_REALMD,
        `INSERT INTO ${DB_REALMD}.github_tokens (name, token_enc) VALUES (?, ?)`,
        [name, enc]
    );
    return result.insertId;
}

/** Update a token's name and/or value. */
export async function updateToken(
    id: number,
    updates: { name?: string; token?: string }
): Promise<boolean> {
    await ensureTable();
    const fields: string[] = [];
    const params: unknown[] = [];
    if (updates.name !== undefined) {
        fields.push("name = ?");
        params.push(updates.name);
    }
    if (updates.token !== undefined) {
        fields.push("token_enc = ?");
        params.push(encrypt(updates.token));
    }
    if (fields.length === 0) return false;
    params.push(id);
    const result = await executeDb(
        DB_REALMD,
        `UPDATE ${DB_REALMD}.github_tokens SET ${fields.join(", ")} WHERE id = ?`,
        params
    );
    return result.affectedRows > 0;
}

/** Delete a token by ID. */
export async function deleteToken(id: number): Promise<boolean> {
    await ensureTable();
    const result = await executeDb(
        DB_REALMD,
        `DELETE FROM ${DB_REALMD}.github_tokens WHERE id = ?`,
        [id]
    );
    return result.affectedRows > 0;
}

/** Check if any build sources reference this token. Returns source names. */
export async function getTokenUsageBySources(
    tokenId: number
): Promise<string[]> {
    await ensureTable();
    try {
        const rows = await query<{ name: string }>(
            `SELECT name FROM ${DB_REALMD}.build_sources WHERE github_token_id = ?`,
            [tokenId]
        );
        return rows.map((r) => r.name);
    } catch {
        return [];
    }
}
