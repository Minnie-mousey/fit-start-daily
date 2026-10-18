import { describe, expect, it } from "vitest";
import initSqlJs, { type Database } from "sql.js";
import { resolve } from "node:path";
import { runMigrations } from "@/lib/db/database";
import {
  BACKUP_TABLES,
  createUserDataBackup,
  parseUserDataBackupJson,
  restoreUserDataBackup,
  validateUserDataBackup,
} from "@/lib/services/userDataBackup";

async function makeDatabase(): Promise<Database> {
  const SQL = await initSqlJs({
    locateFile: (file) => resolve(process.cwd(), "node_modules/sql.js/dist", file),
  });
  const db = new SQL.Database();
  db.exec("PRAGMA foreign_keys = ON;");
  runMigrations(db);
  return db;
}

function scalar(db: Database, sql: string): unknown {
  return db.exec(sql)[0]?.values[0]?.[0];
}

describe("manual user-data backups", () => {
  it("exports all user data categories and restores them after creating a safety copy", async () => {
    const db = await makeDatabase();
    db.run("UPDATE player_settings SET time_zone = 'America/Denver' WHERE id = 1");
    db.run(
      `INSERT INTO workout_sessions VALUES
       ('session-1','gentle-start','Gentle Start','2026-10-01T08:00:00.000Z',
        '2026-10-01T08:10:00.000Z',600,2,2,'completed','2026-10-01T08:10:00.000Z')`,
    );
    db.run(
      `INSERT INTO workout_exercise_performance
       VALUES ('session-1',0,'march-in-place','March in place','time',60,NULL,60,'completed')`,
    );
    db.run(
      `INSERT INTO workout_plans VALUES
       ('plan-1','My plan','{}',1,'2026-10-01T00:00:00.000Z')`,
    );
    db.run(
      `INSERT INTO calendar_events
       (id,plan_id,event_date,event_type,status,routine_id,routine_name,routine_json,updated_at)
       VALUES ('event-1','plan-1','2026-10-01','workout','completed','gentle-start',
       'Gentle Start',NULL,'2026-10-01T00:00:00.000Z')`,
    );
    db.run(`INSERT INTO weight_entries VALUES ('weight-1','2026-10-01',70.5,'test','2026-10-01')`);
    db.run(
      `INSERT INTO reward_ledger VALUES
       ('reward-1','session','session-1','complete',25,10,'2026-10-01T00:00:00.000Z')`,
    );
    db.run(`INSERT INTO challenge_progress VALUES ('daily-show-up','2026-10-01',1,'2026-10-01')`);
    db.run(`INSERT INTO unlocked_achievements VALUES ('first-workout','2026-10-01T00:00:00.000Z')`);
    db.run("UPDATE avatar_profile SET badge_id='first-workout' WHERE id=1");
    db.run(
      `INSERT INTO audio_tracks VALUES
       ('track-1','movement.mp3','audio/mpeg',10,0,'2026-10-01T00:00:00.000Z')`,
    );
    db.run("INSERT INTO playlists VALUES ('playlist-1','Movement','2026-10-01T00:00:00.000Z')");
    db.run("INSERT INTO playlist_tracks VALUES ('playlist-1','track-1',0)");

    const backup = createUserDataBackup(db, "2026-10-17T00:00:00.000Z");
    expect(Object.keys(backup.tables)).toEqual(BACKUP_TABLES);
    expect(backup.tables["audio_tracks"]).toHaveLength(1);
    expect(JSON.stringify(backup)).not.toContain("audioBytes");

    db.run("UPDATE player_settings SET time_zone = 'UTC' WHERE id = 1");
    db.run("DELETE FROM weight_entries");
    let safety: string | undefined;
    const { validation } = await restoreUserDataBackup(
      db,
      JSON.parse(JSON.stringify(backup)),
      async () => {},
      async (json) => {
        safety = json;
      },
    );
    expect(JSON.parse(safety!).tables.player_settings[0]?.["time_zone"]).toBe("UTC");
    expect(validation.invalidRecords).toHaveLength(0);
    expect(scalar(db, "SELECT time_zone FROM player_settings WHERE id=1")).toBe("America/Denver");
    expect(scalar(db, "SELECT COUNT(*) FROM weight_entries")).toBe(1);
    expect(scalar(db, "SELECT COUNT(*) FROM workout_exercise_performance")).toBe(1);
    expect(scalar(db, "SELECT COUNT(*) FROM calendar_events WHERE plan_id='plan-1'")).toBe(1);
    expect(scalar(db, "SELECT COUNT(*) FROM playlist_tracks")).toBe(1);
    expect(scalar(db, "SELECT frame_id FROM avatar_profile WHERE id=1")).toBe("frame-meadow");
    expect(scalar(db, "SELECT badge_id FROM avatar_profile WHERE id=1")).toBe("first-workout");
  });

  it("migrates version 1 reminders and accepts missing newer data tables", async () => {
    const db = await makeDatabase();
    const exported = createUserDataBackup(db);
    const legacy = JSON.parse(JSON.stringify(exported)) as {
      format: string;
      version: number;
      exportedAt: string;
      tables: Record<string, Record<string, unknown>[]>;
    };
    legacy.version = 1;
    for (const row of legacy.tables["recurring_reminders"] ?? []) {
      delete row["quiet_hours_start"];
      delete row["quiet_hours_end"];
    }
    delete legacy.tables["audio_tracks"];
    delete legacy.tables["playlists"];
    delete legacy.tables["playlist_tracks"];
    delete legacy.tables["reminder_runtime_state"];
    delete legacy.tables["reminder_deliveries"];

    const result = validateUserDataBackup(db, legacy);
    expect(result.migratedFrom).toBe(1);
    expect(result.backup.tables.recurring_reminders[0]).toMatchObject({
      quiet_hours_start: "22:00",
      quiet_hours_end: "07:00",
    });
    expect(result.backup.tables.reminder_runtime_state).toHaveLength(1);
    expect(result.invalidRecords).toHaveLength(0);
  });

  it("migrates version 2 backups with the default frame and no equipped badge", async () => {
    const db = await makeDatabase();
    const backup = createUserDataBackup(db);
    const legacy = {
      ...backup,
      version: 2,
      tables: { ...backup.tables },
    };
    delete (legacy.tables as Partial<typeof legacy.tables>)["avatar_profile"];

    const result = validateUserDataBackup(db, legacy);
    expect(result.migratedFrom).toBe(2);
    expect(result.backup.tables.avatar_profile).toEqual([
      { id: 1, frame_id: "frame-meadow", badge_id: null },
    ]);
    expect(result.backup.tables.cosmetic_inventory).toContainEqual(
      expect.objectContaining({ item_id: "frame-meadow" }),
    );
    expect(result.invalidRecords).toHaveLength(0);
  });

  it("falls back to default appearance if restored avatar selections are invalid", async () => {
    const db = await makeDatabase();
    const backup = createUserDataBackup(db);
    backup.tables.avatar_profile = [{ id: 1, frame_id: "missing-frame", badge_id: null }];

    const result = validateUserDataBackup(db, backup);
    expect(result.invalidRecords).toEqual([
      expect.objectContaining({
        table: "avatar_profile",
        reason: expect.stringContaining("FOREIGN KEY"),
      }),
    ]);
    expect(result.backup.tables.avatar_profile).toEqual([
      { id: 1, frame_id: "frame-meadow", badge_id: null },
    ]);
  });

  it("reports malformed files without changing local data", async () => {
    const db = await makeDatabase();
    db.run("UPDATE player_settings SET time_zone = 'America/Chicago' WHERE id=1");
    expect(() => parseUserDataBackupJson("{not json")).toThrow("not valid JSON");
    expect(() => validateUserDataBackup(db, parseUserDataBackupJson("{}"))).toThrow();
    expect(() => validateUserDataBackup(db, { format: "other", version: 2, tables: {} })).toThrow(
      "not a Little by Little backup",
    );
    expect(scalar(db, "SELECT time_zone FROM player_settings WHERE id=1")).toBe("America/Chicago");
  });

  it("skips malformed rows and resolves duplicate primary keys by keeping the first valid row", async () => {
    const db = await makeDatabase();
    const backup = createUserDataBackup(db);
    const original = {
      id: "weight-1",
      measured_date: "2026-10-01",
      weight_kg: 70,
      note: "first valid",
      updated_at: "2026-10-01T00:00:00.000Z",
    };
    const malformedInput = {
      ...backup,
      tables: {
        ...backup.tables,
        weight_entries: [
          original,
          { ...original, note: "duplicate" },
          { ...original, id: "weight-invalid", weight_kg: "not a number" },
        ],
      },
    };
    const result = validateUserDataBackup(db, malformedInput);
    expect(result.duplicateRecords).toHaveLength(1);
    expect(result.invalidRecords).toHaveLength(1);
    expect(result.backup.tables.weight_entries).toEqual([original]);
    expect(scalar(db, "SELECT COUNT(*) FROM weight_entries")).toBe(0);
  });

  it("keeps the first unique reward and rejects records with broken foreign keys", async () => {
    const db = await makeDatabase();
    const backup = createUserDataBackup(db);
    const reward = {
      id: "reward-first",
      source_type: "session",
      source_id: "session-1",
      reward_key: "complete",
      xp_delta: 25,
      coins_delta: 10,
      created_at: "2026-10-01T00:00:00.000Z",
    };
    backup.tables.reward_ledger = [reward, { ...reward, id: "reward-duplicate" }];
    backup.tables.workout_exercise_performance = [
      {
        session_id: "missing-session",
        sequence: 0,
        exercise_id: "move",
        exercise_name: "Move",
        target_kind: "time",
        target_value: 30,
        actual_reps: null,
        actual_seconds: 30,
        status: "completed",
      },
    ];
    const result = validateUserDataBackup(db, backup);
    expect(result.duplicateRecords).toEqual([
      expect.objectContaining({
        table: "reward_ledger",
        reason: expect.stringContaining("unique"),
      }),
    ]);
    expect(result.invalidRecords).toEqual([
      expect.objectContaining({
        table: "workout_exercise_performance",
        reason: expect.stringContaining("FOREIGN KEY"),
      }),
    ]);
    expect(result.backup.tables.reward_ledger).toEqual([reward]);
  });

  it("recovers the pre-restore database when persisting restored data fails", async () => {
    const db = await makeDatabase();
    db.run(
      `INSERT INTO weight_entries VALUES
       ('local-weight','2026-10-01',72,'local','2026-10-01T00:00:00.000Z')`,
    );
    const incoming = createUserDataBackup(db);
    incoming.tables.weight_entries = [
      {
        id: "imported-weight",
        measured_date: "2026-10-02",
        weight_kg: 68,
        note: "imported",
        updated_at: "2026-10-02T00:00:00.000Z",
      },
    ];
    let persistAttempts = 0;
    let safety: string | undefined;
    await expect(
      restoreUserDataBackup(
        db,
        incoming,
        async () => {
          persistAttempts += 1;
          if (persistAttempts === 1) throw new Error("disk write failed");
        },
        async (json) => {
          safety = json;
        },
      ),
    ).rejects.toThrow("previous data was recovered");
    expect(persistAttempts).toBe(2);
    expect(JSON.parse(safety!).tables.weight_entries[0]?.["id"]).toBe("local-weight");
    expect(scalar(db, "SELECT id FROM weight_entries")).toBe("local-weight");
  });
});
