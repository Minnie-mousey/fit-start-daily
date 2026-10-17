import type { Database } from "sql.js";
import { MIGRATIONS } from "./schema";

/**
 * On-device SQLite (sql.js / WebAssembly). The database file is persisted to
 * IndexedDB after every write. Browser-only: call from effects/handlers.
 */
const IDB_NAME = "little-by-little";
const IDB_STORE = "sqlite";
const IDB_KEY = "main.db";

let dbPromise: Promise<Database> | null = null;

export function getDatabase(): Promise<Database> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Database is only available in the browser"));
  }
  if (!dbPromise) {
    dbPromise = openDatabase().catch((err) => {
      dbPromise = null; // allow retry
      throw err;
    });
  }
  return dbPromise;
}

async function openDatabase(): Promise<Database> {
  const [{ default: initSqlJs }, { default: wasmUrl }] = await Promise.all([
    import("sql.js"),
    import("sql.js/dist/sql-wasm.wasm?url"),
  ]);
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const saved = await idbGet();
  const db = saved ? new SQL.Database(saved) : new SQL.Database();
  db.exec("PRAGMA foreign_keys = ON;");
  const changed = runMigrations(db);
  if (changed || !saved) await persistDatabase(db);
  return db;
}

export function runMigrations(db: Database): boolean {
  const res = db.exec("PRAGMA user_version;");
  const current = Number(res[0]?.values[0]?.[0] ?? 0);
  let version = current;
  for (const m of MIGRATIONS) {
    if (m.version > version) {
      db.exec("BEGIN;");
      try {
        db.exec(m.sql);
        db.exec(`PRAGMA user_version = ${m.version};`);
        db.exec("COMMIT;");
      } catch (e) {
        db.exec("ROLLBACK;");
        throw e;
      }
      version = m.version;
    }
  }
  return version !== current;
}

export async function persistDatabase(db: Database): Promise<void> {
  await idbPut(db.export());
}

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(): Promise<Uint8Array | null> {
  const idb = await openIdb();
  return new Promise((resolve, reject) => {
    const req = idb.transaction(IDB_STORE, "readonly").objectStore(IDB_STORE).get(IDB_KEY);
    req.onsuccess = () => resolve((req.result as Uint8Array | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(data: Uint8Array): Promise<void> {
  const idb = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(data, IDB_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
