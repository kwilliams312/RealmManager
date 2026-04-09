import mysql from "mysql2/promise";
import { readSettingsSync } from "./settings";

// Settings.json takes priority over env vars (so DB Config UI changes take effect)
// Env vars serve as defaults when settings.json doesn't exist or is missing fields
const fileSettings = readSettingsSync();

const DB_HOST = fileSettings.db.host;
const DB_PORT = fileSettings.db.port;
const DB_USER = fileSettings.db.user;
const DB_PASS = fileSettings.db.password;

export const DB_REALMD = fileSettings.db.authDb;
export const DB_WORLD = fileSettings.db.worldDb;
export const DB_CHARACTERS = fileSettings.db.charactersDb;

// Shared connection pool for the auth database
const pool = mysql.createPool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASS,
  database: DB_REALMD,
  waitForConnections: true,
  connectionLimit: 10,
  connectTimeout: 5000,
});

/** Execute a query against the default auth database pool. */
export async function query<T = Record<string, unknown>>(
  sql: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params?: any[]
): Promise<T[]> {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(sql, params);
  return rows as T[];
}

/** Execute a query against a specific database by creating a temporary connection. */
export async function queryDb<T = Record<string, unknown>>(
  database: string,
  sql: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params?: any[]
): Promise<T[]> {
  const conn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASS,
    database,
    connectTimeout: 5000,
  });
  try {
    const [rows] = await conn.query<mysql.RowDataPacket[]>(sql, params);
    return rows as T[];
  } finally {
    await conn.end();
  }
}

/** Execute a write query (INSERT/UPDATE/DELETE) against a specific database. */
export async function executeDb(
  database: string,
  sql: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params?: any[]
): Promise<mysql.ResultSetHeader> {
  const conn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASS,
    database,
    connectTimeout: 5000,
  });
  try {
    const [result] = await conn.query<mysql.ResultSetHeader>(sql, params);
    return result;
  } finally {
    await conn.end();
  }
}

/** Check if the database is reachable. */
export async function checkDbHealth(): Promise<boolean> {
  try {
    await query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}
