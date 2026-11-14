import mariadb, { type PoolConnection } from "mariadb";
import { config } from "../config.js";
export type Row = Record<string, any>;
export interface Sql {
  query<T = Row[]>(sql: string, values?: any[]): Promise<T>;
}
export const pool = mariadb.createPool({
  host: config.DB_HOST,
  port: config.DB_PORT,
  database: config.DB_NAME,
  user: config.DB_USER,
  password: config.DB_PASSWORD,
  connectionLimit: 8,
  timezone: "Z",
  dateStrings: true,
  bigIntAsNumber: true,
  decimalAsNumber: true,
  insertIdAsNumber: true,
  charset: "utf8mb4",
  initSql: "SET time_zone = '+00:00'",
  acquireTimeout: 10000,
});
export function camel(row: Row): Row {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()),
      value,
    ]),
  );
}
export async function rows(
  db: Sql,
  sql: string,
  values: any[] = [],
): Promise<Row[]> {
  return (await db.query<Row[]>(sql, values)).map(camel);
}
export async function one(
  db: Sql,
  sql: string,
  values: any[] = [],
): Promise<Row | undefined> {
  return (await rows(db, sql, values))[0];
}
export async function transaction<T>(
  work: (db: PoolConnection) => Promise<T>,
): Promise<T> {
  const db = await pool.getConnection();
  try {
    await db.beginTransaction();
    const value = await work(db);
    await db.commit();
    return value;
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    db.release();
  }
}
export function json<T>(value: string | T | null, fallback: T): T {
  if (value == null) return fallback;
  return typeof value === "string" ? JSON.parse(value) : value;
}
export const dateSql = (value: string | Date) =>
  new Date(value).toISOString().slice(0, 23).replace("T", " ");
export const dateIso = (value: string) =>
  value.includes("T") ? value : value.replace(" ", "T") + "Z";
