import type { Database } from "sql.js";

export const USER_DATA_BACKUP_FORMAT = "little-by-little";
export const USER_DATA_BACKUP_VERSION = 3;

export const BACKUP_TABLES = [
  "player_settings",
  "workout_sessions",
  "workout_exercise_performance",
  "reward_ledger",
  "challenge_progress",
  "qualifying_activity_days",
  "streak_recoveries",
  "unlocked_achievements",
  "cosmetic_inventory",
  "equipped_cosmetics",
  "avatar_profile",
  "workout_plans",
  "calendar_events",
  "weight_entries",
  "fitness_preferences",
  "recurring_reminders",
  "reminder_runtime_state",
  "reminder_deliveries",
  "audio_tracks",
  "playlists",
  "playlist_tracks",
] as const;

export type BackupTable = (typeof BACKUP_TABLES)[number];
export type BackupValue = string | number | null;
export type BackupRecord = Record<string, BackupValue>;
export type UserDataBackup = {
  format: typeof USER_DATA_BACKUP_FORMAT;
  version: typeof USER_DATA_BACKUP_VERSION;
  exportedAt: string;
  tables: Record<BackupTable, BackupRecord[]>;
};

export interface BackupRecordIssue {
  table: BackupTable;
  index: number;
  reason: string;
}

export interface BackupValidation {
  backup: UserDataBackup;
  migratedFrom: number | null;
  includedCounts: Record<BackupTable, number>;
  invalidRecords: BackupRecordIssue[];
  duplicateRecords: BackupRecordIssue[];
}

export interface UserDataBackupProvider {
  exportBackup(): UserDataBackup;
  previewBackup(input: unknown): BackupValidation;
  restoreBackup(input: unknown): Promise<{
    safetyBackup: UserDataBackup;
    validation: BackupValidation;
  }>;
}

export type PersistBackupSafetyCopy = (json: string) => Promise<void>;
export type PersistDatabase = (db: Database) => Promise<void>;

type ColumnInfo = { name: string; type: string; primaryKeyOrder: number };

function emptyTables(): Record<BackupTable, BackupRecord[]> {
  return Object.fromEntries(BACKUP_TABLES.map((table) => [table, [] as BackupRecord[]])) as Record<
    BackupTable,
    BackupRecord[]
  >;
}

export function createUserDataBackup(
  db: Database,
  exportedAt = new Date().toISOString(),
): UserDataBackup {
  const tables = emptyTables();
  for (const table of BACKUP_TABLES) {
    const result = db.exec(`SELECT * FROM "${table}"`)[0];
    if (!result) continue;
    tables[table] = result.values.map((values) =>
      Object.fromEntries(
        result.columns.map((column, index) => [column, values[index] as BackupValue]),
      ),
    );
  }
  return {
    format: USER_DATA_BACKUP_FORMAT,
    version: USER_DATA_BACKUP_VERSION,
    exportedAt,
    tables,
  };
}

export function parseUserDataBackupJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("The selected backup file is not valid JSON.");
  }
}

function migrateInput(input: unknown): {
  backup: UserDataBackup;
  migratedFrom: number | null;
} {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("The selected file is not a Little by Little backup.");
  const candidate = input as Record<string, unknown>;
  if (candidate["format"] !== USER_DATA_BACKUP_FORMAT)
    throw new Error("This file is not a Little by Little backup.");
  const version = candidate["version"];
  if (
    !Number.isInteger(version) ||
    Number(version) < 1 ||
    Number(version) > USER_DATA_BACKUP_VERSION
  )
    throw new Error(`Unsupported backup version: ${String(version)}.`);
  if (
    !candidate["tables"] ||
    typeof candidate["tables"] !== "object" ||
    Array.isArray(candidate["tables"])
  )
    throw new Error("The backup is missing its data tables.");

  const sourceTables = candidate["tables"] as Record<string, unknown>;
  const tables = emptyTables();
  for (const table of BACKUP_TABLES) {
    const rows = sourceTables[table];
    if (rows === undefined && Number(version) <= 2) continue;
    if (!Array.isArray(rows)) throw new Error(`The backup table "${table}" is malformed.`);
    tables[table] = rows as BackupRecord[];
  }

  if (Number(version) <= 2) {
    tables["recurring_reminders"] = tables["recurring_reminders"].map((row) => ({
      quiet_hours_start: "22:00",
      quiet_hours_end: "07:00",
      ...row,
    }));
    if (tables["reminder_runtime_state"].length === 0)
      tables["reminder_runtime_state"] = [{ id: 1, last_occurrence: null, snooze_until: null }];
    if (tables["reminder_deliveries"].length === 0) tables["reminder_deliveries"] = [];
    if (tables["audio_tracks"].length === 0) tables["audio_tracks"] = [];
    if (tables["playlists"].length === 0) tables["playlists"] = [];
    if (tables["playlist_tracks"].length === 0) tables["playlist_tracks"] = [];
    if (tables["player_settings"].length === 0)
      tables["player_settings"] = [
        {
          id: 1,
          time_zone: "UTC",
          time_zone_source: "device",
          planned_rest_weekdays: "0,6",
          planned_rest_start_date: "1970-01-01",
          recovery_tokens: 0,
        },
      ];
    if (tables["fitness_preferences"].length === 0)
      tables["fitness_preferences"] = [{ id: 1, weight_goal_kg: null, weight_unit: "kg" }];
    if (tables["recurring_reminders"].length === 0)
      tables["recurring_reminders"] = [
        {
          id: 1,
          enabled: 0,
          weekdays_json: "[]",
          reminder_time: "09:00",
          quiet_hours_start: "22:00",
          quiet_hours_end: "07:00",
        },
      ];
    if (tables["cosmetic_inventory"].length === 0)
      tables["cosmetic_inventory"] = [
        {
          item_id: "avatar-sprout",
          unlocked_at: "1970-01-01T00:00:00.000Z",
          source_type: "starter",
          source_id: "starter",
        },
        {
          item_id: "theme-meadow",
          unlocked_at: "1970-01-01T00:00:00.000Z",
          source_type: "starter",
          source_id: "starter",
        },
      ];
    if (tables["equipped_cosmetics"].length === 0)
      tables["equipped_cosmetics"] = [
        { slot: "avatar", item_id: "avatar-sprout" },
        { slot: "theme", item_id: "theme-meadow" },
      ];
    if (!tables["cosmetic_inventory"].some((row) => row["item_id"] === "frame-meadow")) {
      tables["cosmetic_inventory"].push({
        item_id: "frame-meadow",
        unlocked_at: "1970-01-01T00:00:00.000Z",
        source_type: "starter",
        source_id: "starter",
      });
    }
    if (tables["avatar_profile"].length === 0)
      tables["avatar_profile"] = [{ id: 1, frame_id: "frame-meadow", badge_id: null }];
  }
  if (!tables["cosmetic_inventory"].some((row) => row["item_id"] === "frame-meadow")) {
    tables["cosmetic_inventory"].push({
      item_id: "frame-meadow",
      unlocked_at: "1970-01-01T00:00:00.000Z",
      source_type: "starter",
      source_id: "starter",
    });
  }
  if (tables["avatar_profile"].length === 0)
    tables["avatar_profile"] = [{ id: 1, frame_id: "frame-meadow", badge_id: null }];

  return {
    backup: {
      format: USER_DATA_BACKUP_FORMAT,
      version: USER_DATA_BACKUP_VERSION,
      exportedAt:
        typeof candidate["exportedAt"] === "string"
          ? candidate["exportedAt"]
          : new Date(0).toISOString(),
      tables,
    },
    migratedFrom: Number(version) === USER_DATA_BACKUP_VERSION ? null : Number(version),
  };
}

function columnsFor(db: Database, table: BackupTable): ColumnInfo[] {
  const result = db.exec(`PRAGMA table_info("${table}")`)[0];
  if (!result) throw new Error(`The local database is missing the "${table}" table.`);
  return result.values.map((row) => ({
    name: String(row[1]),
    type: String(row[2]).toUpperCase(),
    primaryKeyOrder: Number(row[5]),
  }));
}

function validScalar(value: unknown, column: ColumnInfo): value is BackupValue {
  if (value === null) return true;
  if (typeof value === "boolean" || typeof value === "object" || typeof value === "undefined")
    return false;
  if (column.type.includes("INT")) return typeof value === "number" && Number.isSafeInteger(value);
  if (
    column.type.includes("REAL") ||
    column.type.includes("FLOA") ||
    column.type.includes("DOUB") ||
    column.type.includes("NUM")
  )
    return typeof value === "number" && Number.isFinite(value);
  return typeof value === "string";
}

function recordValidationError(table: BackupTable, row: BackupRecord): string | null {
  const jsonFields: Partial<Record<BackupTable, string[]>> = {
    workout_plans: ["preferences_json"],
    calendar_events: ["routine_json"],
    recurring_reminders: ["weekdays_json"],
  };
  for (const field of jsonFields[table] ?? []) {
    const value = row[field];
    if (value === null && table === "calendar_events") continue;
    try {
      const parsed = JSON.parse(String(value)) as unknown;
      if (
        field !== "weekdays_json" &&
        (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      )
        return `Field "${field}" must contain a JSON object.`;
    } catch {
      return `Field "${field}" is not valid JSON.`;
    }
  }

  if (table === "recurring_reminders") {
    const weekdays = JSON.parse(String(row["weekdays_json"])) as unknown;
    if (
      !Array.isArray(weekdays) ||
      weekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)
    )
      return 'Field "weekdays_json" must contain weekday numbers from 0 to 6.';
    const validTime = (value: unknown) =>
      typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
    if (
      !validTime(row["reminder_time"]) ||
      !validTime(row["quiet_hours_start"]) ||
      !validTime(row["quiet_hours_end"])
    )
      return "Reminder and quiet-hour values must be valid local times.";
  }

  if (table === "player_settings") {
    const days = String(row["planned_rest_weekdays"]).split(",").filter(Boolean).map(Number);
    if (days.some((day) => !Number.isInteger(day) || day < 0 || day > 6))
      return 'Field "planned_rest_weekdays" contains an invalid weekday.';
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: String(row["time_zone"]) });
    } catch {
      return 'Field "time_zone" is not a valid time zone.';
    }
  }
  return null;
}

function insertRow(db: Database, table: BackupTable, row: BackupRecord): void {
  const columns = Object.keys(row);
  const names = columns.map((column) => `"${column}"`).join(",");
  const placeholders = columns.map(() => "?").join(",");
  db.run(
    `INSERT INTO "${table}" (${names}) VALUES (${placeholders})`,
    columns.map((column) => row[column] ?? null),
  );
}

function primaryKeyFor(db: Database, table: BackupTable): string[] {
  return columnsFor(db, table)
    .filter((column) => column.primaryKeyOrder > 0)
    .sort((a, b) => a.primaryKeyOrder - b.primaryKeyOrder)
    .map((column) => column.name);
}

function withReplacementSavepoint<T>(db: Database, operation: () => T): T {
  db.run("SAVEPOINT backup_validation");
  try {
    return operation();
  } finally {
    db.run("ROLLBACK TO backup_validation");
    db.run("RELEASE backup_validation");
  }
}

export function validateUserDataBackup(db: Database, input: unknown): BackupValidation {
  const { backup, migratedFrom } = migrateInput(input);
  const invalidRecords: BackupRecordIssue[] = [];
  const duplicateRecords: BackupRecordIssue[] = [];
  const includedCounts = Object.fromEntries(BACKUP_TABLES.map((table) => [table, 0])) as Record<
    BackupTable,
    number
  >;
  for (const table of BACKUP_TABLES) includedCounts[table] = 0;
  const normalized = emptyTables();

  withReplacementSavepoint(db, () => {
    for (const table of [...BACKUP_TABLES].reverse()) db.run(`DELETE FROM "${table}"`);

    for (const table of BACKUP_TABLES) {
      const columns = columnsFor(db, table);
      const expected = new Set(columns.map((column) => column.name));
      const primaryKey = primaryKeyFor(db, table);
      const seenKeys = new Set<string>();
      backup.tables[table].forEach((candidate, index) => {
        if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
          invalidRecords.push({ table, index, reason: "Record must be an object." });
          return;
        }
        const row = candidate as BackupRecord;
        const keys = Object.keys(row);
        if (keys.length !== columns.length || keys.some((key) => !expected.has(key))) {
          invalidRecords.push({
            table,
            index,
            reason: "Record fields do not match this backup version.",
          });
          return;
        }
        const invalidColumn = columns.find((column) => !validScalar(row[column.name], column));
        const invalidRecord =
          invalidColumn === undefined ? recordValidationError(table, row) : null;
        if (invalidColumn || invalidRecord) {
          invalidRecords.push({
            table,
            index,
            reason: invalidColumn
              ? `Field "${invalidColumn.name}" has an invalid value.`
              : invalidRecord!,
          });
          return;
        }
        const key = JSON.stringify(primaryKey.map((column) => row[column]));
        if (primaryKey.length > 0 && seenKeys.has(key)) {
          duplicateRecords.push({
            table,
            index,
            reason: "Duplicate primary key; the first valid record is kept.",
          });
          return;
        }
        try {
          insertRow(db, table, row);
          if (primaryKey.length > 0) seenKeys.add(key);
          normalized[table].push(row);
          includedCounts[table] += 1;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (message.includes("UNIQUE constraint failed")) {
            duplicateRecords.push({
              table,
              index,
              reason: "Duplicate unique value; the first valid record is kept.",
            });
          } else {
            invalidRecords.push({ table, index, reason: message });
          }
        }
      });
    }
  });

  if (normalized["avatar_profile"].length === 0) {
    if (!normalized["cosmetic_inventory"].some((row) => row["item_id"] === "frame-meadow")) {
      normalized["cosmetic_inventory"].push({
        item_id: "frame-meadow",
        unlocked_at: "1970-01-01T00:00:00.000Z",
        source_type: "starter",
        source_id: "starter",
      });
      includedCounts["cosmetic_inventory"] += 1;
    }
    normalized["avatar_profile"] = [{ id: 1, frame_id: "frame-meadow", badge_id: null }];
    includedCounts["avatar_profile"] = 1;
  }

  return {
    backup: { ...backup, tables: normalized },
    migratedFrom,
    includedCounts,
    invalidRecords,
    duplicateRecords,
  };
}

function replaceData(db: Database, backup: UserDataBackup): void {
  db.run("BEGIN TRANSACTION");
  try {
    for (const table of [...BACKUP_TABLES].reverse()) db.run(`DELETE FROM "${table}"`);
    for (const table of BACKUP_TABLES)
      for (const row of backup.tables[table]) insertRow(db, table, row);
    db.run("COMMIT");
  } catch (error) {
    db.run("ROLLBACK");
    throw error;
  }
}

export async function restoreUserDataBackup(
  db: Database,
  input: unknown,
  persist: PersistDatabase,
  persistSafetyCopy: PersistBackupSafetyCopy,
): Promise<{ safetyBackup: UserDataBackup; validation: BackupValidation }> {
  const validation = validateUserDataBackup(db, input);
  const safetyBackup = createUserDataBackup(db);
  await persistSafetyCopy(JSON.stringify(safetyBackup));
  let committed = false;
  try {
    replaceData(db, validation.backup);
    committed = true;
    await persist(db);
  } catch (restoreError) {
    if (committed) {
      try {
        replaceData(db, safetyBackup);
        await persist(db);
      } catch (recoveryError) {
        throw new AggregateError(
          [restoreError, recoveryError],
          "Restore failed and automatic recovery could not complete. The safety backup remains stored locally.",
        );
      }
      throw new Error(
        `Restore failed. Your previous data was recovered from the safety backup. ${restoreError instanceof Error ? restoreError.message : String(restoreError)}`,
      );
    }
    throw restoreError;
  }
  return { safetyBackup, validation };
}

export class LocalSqliteBackupProvider implements UserDataBackupProvider {
  constructor(
    private readonly db: Database,
    private readonly persist: PersistDatabase,
    private readonly persistSafetyCopy: PersistBackupSafetyCopy,
  ) {}

  exportBackup(): UserDataBackup {
    return createUserDataBackup(this.db);
  }

  previewBackup(input: unknown): BackupValidation {
    return validateUserDataBackup(this.db, input);
  }

  restoreBackup(input: unknown) {
    return restoreUserDataBackup(this.db, input, this.persist, this.persistSafetyCopy);
  }
}
