import { describe, expect, it } from "vitest";
import initSqlJs from "sql.js";
import { resolve } from "node:path";
import { runMigrations } from "@/lib/db/database";
import { cosmeticUnlockDescription, COSMETICS } from "@/lib/data/gamification";
import { SqliteGamificationRepository } from "@/lib/repositories/gamificationRepository";
import { SqliteWorkoutSessionRepository } from "@/lib/repositories/workoutSessionRepository";
import {
  addLocalDays,
  calculateStreak,
  localDateKey,
  nextLocalDayStart,
  secondsUntilNextLocalDay,
} from "@/lib/services/streakService";
import type { NewWorkoutSession } from "@/lib/types";

describe("cosmetic catalog", () => {
  it("keeps each Sprout unique and explains how it can be unlocked", () => {
    const sprouts = COSMETICS.filter((item) => item.slot === "avatar");
    const findSprout = (id: string) => {
      const item = sprouts.find((candidate) => candidate.id === id);
      if (!item) throw new Error(`Missing Sprout ${id}`);
      return item;
    };

    expect(new Set(sprouts.map((item) => item.id)).size).toBe(sprouts.length);
    expect(new Set(sprouts.map((item) => item.name)).size).toBe(sprouts.length);
    expect(new Set(sprouts.map((item) => item.asset)).size).toBe(sprouts.length);
    expect(cosmeticUnlockDescription(findSprout("avatar-sprout"))).toBe(
      "Available from the start.",
    );
    expect(cosmeticUnlockDescription(findSprout("avatar-bounce"))).toBe(
      "Reach Level 2 and spend 45 coins.",
    );
    expect(cosmeticUnlockDescription(findSprout("avatar-sunbeam"))).toBe(
      "Earn automatically: Finish your first qualifying session.",
    );
  });
});

async function makeRepositories() {
  const SQL = await initSqlJs({
    locateFile: (file) => resolve(process.cwd(), "node_modules/sql.js/dist", file),
  });
  const db = new SQL.Database();
  db.exec("PRAGMA foreign_keys = ON;");
  runMigrations(db);
  const persist = async () => {};
  return {
    SQL,
    db,
    sessions: new SqliteWorkoutSessionRepository(db, persist),
    gamification: new SqliteGamificationRepository(db, persist),
  };
}

function qualifyingSession(overrides: Partial<NewWorkoutSession> = {}): NewWorkoutSession {
  return {
    routineId: "gentle-start",
    routineName: "Gentle Start",
    startedAt: "2026-10-17T10:00:00.000Z",
    completedAt: "2026-10-17T10:05:00.000Z",
    durationSeconds: 300,
    exercisesCompleted: 3,
    totalExercises: 3,
    status: "completed",
    ...overrides,
  };
}

describe("timezone and streak rules", () => {
  it("assigns activity to the user's local date around UTC midnight", () => {
    expect(localDateKey(new Date("2026-10-17T23:30:00.000Z"), "Asia/Tokyo")).toBe("2026-10-18");
    expect(localDateKey(new Date("2026-10-17T23:30:00.000Z"), "America/Los_Angeles")).toBe(
      "2026-10-17",
    );
  });

  it("uses Barbados local time for daily activity and midnight boundaries", () => {
    const now = new Date("2026-10-18T03:30:00.000Z");
    expect(localDateKey(now, "America/Barbados")).toBe("2026-10-17");
    expect(nextLocalDayStart(now, "America/Barbados").toISOString()).toBe(
      "2026-10-18T04:00:00.000Z",
    );
    expect(secondsUntilNextLocalDay(now, "America/Barbados")).toBe(30 * 60);
  });

  it("counts down to local midnight across a daylight-saving boundary", () => {
    const now = new Date("2026-03-08T06:30:00.000Z");
    const next = nextLocalDayStart(now, "America/New_York");
    expect(next.toISOString()).toBe("2026-03-09T04:00:00.000Z");
    expect(secondsUntilNextLocalDay(now, "America/New_York")).toBe(21.5 * 60 * 60);
  });

  it("preserves activity streaks on planned rest days and breaks them on unplanned misses", () => {
    const activity = ["2026-10-02", "2026-10-05"];
    expect(calculateStreak("2026-10-05", activity, [0, 6], [], "2026-10-01")).toBe(2);
    expect(calculateStreak("2026-10-05", activity, [], [], "2026-10-01")).toBe(1);
  });

  it("gives today until local midnight but resets after a missed unplanned day", () => {
    expect(calculateStreak("2026-10-03", ["2026-10-02"], [], [])).toBe(1);
    expect(calculateStreak("2026-10-04", ["2026-10-02"], [], [])).toBe(0);
  });

  it("uses recovery dates to bridge one missed day and advances calendar dates safely", () => {
    expect(calculateStreak("2026-10-17", ["2026-10-15"], [], ["2026-10-16"])).toBe(1);
    expect(addLocalDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("transactional rewards and challenge state", () => {
  it("awards session and challenge rewards once across completion retries", async () => {
    const { SQL, db, sessions, gamification } = await makeRepositories();
    const input = qualifyingSession();
    const id = "stable-completion-id";
    const performance = [
      {
        sequence: 0,
        exerciseId: "bodyweight-squat",
        exerciseName: "Bodyweight Squat",
        target: { kind: "reps" as const, reps: 8 },
        actualReps: 8,
        actualSeconds: 0,
        status: "completed" as const,
      },
    ];
    const first = await sessions.save(input, performance, id);
    const retry = await sessions.save(input, performance, id);
    const state = await gamification.snapshot(new Date("2026-10-17T10:06:00.000Z"), "UTC");

    expect(retry.id).toBe(first.id);
    expect(await sessions.list()).toHaveLength(1);
    expect(await sessions.listPerformance(id)).toEqual(performance);
    expect(state.profile.xpTotal).toBe(165);
    expect(state.profile.coins).toBe(67);
    expect(state.profile.level).toBe(2);
    expect(
      state.challenges.find((challenge) => challenge.id === "daily-three-moves"),
    ).toMatchObject({
      progress: 3,
      claimed: true,
    });
    expect(
      state.achievements.find((achievement) => achievement.id === "first-workout")?.unlockedAt,
    ).not.toBeNull();
    expect(state.inventory).toContain("avatar-sunbeam");
    expect(
      Number(
        db.exec("SELECT COUNT(*) FROM reward_ledger WHERE source_type='session'")[0]
          ?.values[0]?.[0],
      ),
    ).toBe(1);
    expect(
      Number(
        db.exec("SELECT COUNT(*) FROM reward_ledger WHERE source_type='challenge'")[0]
          ?.values[0]?.[0],
      ),
    ).toBe(3);
    const restoredDb = new SQL.Database(db.export());
    restoredDb.exec("PRAGMA foreign_keys = ON;");
    const restoredSessions = new SqliteWorkoutSessionRepository(restoredDb, async () => {});
    await restoredSessions.save(input, performance, id);
    expect(
      Number(
        restoredDb.exec("SELECT COUNT(*) FROM reward_ledger WHERE source_type='session'")[0]
          ?.values[0]?.[0],
      ),
    ).toBe(1);
    expect(
      Number(restoredDb.exec("SELECT COUNT(*) FROM workout_sessions")[0]?.values[0]?.[0]),
    ).toBe(1);
  });

  it("does not advance challenges or award rewards for partial and cancelled sessions", async () => {
    const { db, sessions, gamification } = await makeRepositories();
    await sessions.save(qualifyingSession({ status: "partial" }), [], "partial-1");
    await sessions.save(qualifyingSession({ status: "cancelled" }), [], "cancelled-1");
    const state = await gamification.snapshot(new Date("2026-10-17T10:06:00.000Z"), "UTC");

    expect(state.challenges.every((challenge) => challenge.progress === 0)).toBe(true);
    expect(state.profile.xpTotal).toBe(0);
    expect(state.profile.coins).toBe(0);
    expect(Number(db.exec("SELECT COUNT(*) FROM reward_ledger")[0]?.values[0]?.[0])).toBe(0);
  });

  it("persists weekly challenge progress across local dates and completion reloads", async () => {
    const { sessions, gamification } = await makeRepositories();
    for (const day of [19, 20, 21]) {
      const date = `2026-10-${day}`;
      await sessions.save(
        qualifyingSession({
          startedAt: `${date}T10:00:00.000Z`,
          completedAt: `${date}T10:05:00.000Z`,
        }),
        [],
        `weekly-${day}`,
      );
    }
    const snapshot = await gamification.snapshot(new Date("2026-10-21T12:00:00.000Z"), "UTC");
    expect(
      snapshot.challenges.find((challenge) => challenge.id === "weekly-three-sessions"),
    ).toMatchObject({
      periodKey: "2026-10-19",
      progress: 3,
      claimed: true,
    });
  });

  it("awards the five-day trailblazer badge for completing its special weekly challenge", async () => {
    const { sessions, gamification } = await makeRepositories();
    for (const day of [19, 20, 21, 22, 23]) {
      const date = `2026-10-${day}`;
      await sessions.save(
        qualifyingSession({
          startedAt: `${date}T10:00:00.000Z`,
          completedAt: `${date}T10:05:00.000Z`,
        }),
        [],
        `five-day-${day}`,
      );
    }

    const snapshot = await gamification.snapshot(new Date("2026-10-23T12:00:00.000Z"), "UTC");
    expect(
      snapshot.challenges.find((challenge) => challenge.id === "weekly-five-days"),
    ).toMatchObject({ progress: 5, claimed: true });
    expect(
      snapshot.achievements.find((badge) => badge.id === "five-day-challenge")?.unlockedAt,
    ).not.toBeNull();
    expect(snapshot.inventory).toContain("frame-trailblazer");
    expect(
      snapshot.achievements.find((badge) => badge.id === "ten-challenges")?.unlockedAt,
    ).not.toBeNull();
  });

  it("awards milestone badges when their workout thresholds are reached", async () => {
    const { sessions, gamification } = await makeRepositories();
    for (let session = 0; session < 25; session += 1) {
      await sessions.save(qualifyingSession(), [], `milestone-session-${session}`);
    }

    const snapshot = await gamification.snapshot(new Date("2026-10-17T12:00:00.000Z"), "UTC");
    expect(
      snapshot.achievements.find((badge) => badge.id === "twenty-five-sessions")?.unlockedAt,
    ).not.toBeNull();
  });

  it("earns animated frame rewards at the fifty and one-hundred workout milestones", async () => {
    const { sessions, gamification } = await makeRepositories();
    for (let session = 0; session < 100; session += 1) {
      await sessions.save(qualifyingSession(), [], `high-tier-session-${session}`);
    }

    const snapshot = await gamification.snapshot(new Date("2026-10-17T12:00:00.000Z"), "UTC");
    expect(snapshot.inventory).toContain("frame-stardust");
    expect(snapshot.inventory).toContain("frame-legend");
    expect(snapshot.achievements.find((badge) => badge.id === "hundred-sessions")).toMatchObject({
      rarity: "legendary",
      unlockedAt: expect.any(String),
    });
    expect(snapshot.cosmetics.find((frame) => frame.id === "frame-legend")?.frameBanner).toBe(
      "LEGEND",
    );
  });

  it("earns the animated aurora frame after a fourteen-day activity streak", async () => {
    const { sessions, gamification } = await makeRepositories();
    for (let day = 1; day <= 14; day += 1) {
      const date = `2026-10-${String(day).padStart(2, "0")}`;
      await sessions.save(
        qualifyingSession({
          startedAt: `${date}T10:00:00.000Z`,
          completedAt: `${date}T10:05:00.000Z`,
        }),
        [],
        `streak-day-${day}`,
      );
    }

    const snapshot = await gamification.snapshot(new Date("2026-10-14T12:00:00.000Z"), "UTC");
    expect(snapshot.profile.streak).toBe(14);
    expect(snapshot.inventory).toContain("frame-aurora");
    expect(snapshot.cosmetics.find((frame) => frame.id === "frame-aurora")?.frameBanner).toBe(
      "AURORA",
    );
  });

  it("prevents duplicate cosmetic charges on purchase retries and persists equipment", async () => {
    const { SQL, db, gamification } = await makeRepositories();
    db.run(
      `INSERT INTO reward_ledger (id,source_type,source_id,reward_key,xp_delta,coins_delta,created_at)
       VALUES ('seed','test','seed','seed',100,100,'2026-10-17T00:00:00.000Z')`,
    );
    await gamification.purchaseCosmetic("avatar-bounce", "purchase-1");
    await gamification.purchaseCosmetic("avatar-bounce", "purchase-1");
    await gamification.equipCosmetic("avatar-bounce");
    const state = await gamification.snapshot(new Date("2026-10-17T10:00:00.000Z"), "UTC");

    expect(state.profile.coins).toBe(55);
    expect(state.profile.equippedAvatarId).toBe("avatar-bounce");
    expect(state.inventory.filter((item) => item === "avatar-bounce")).toHaveLength(1);
    expect(
      Number(
        db.exec("SELECT COUNT(*) FROM reward_ledger WHERE source_type='purchase'")[0]
          ?.values[0]?.[0],
      ),
    ).toBe(1);
    await expect(gamification.purchaseCosmetic("theme-sky", "purchase-1")).rejects.toThrow(
      "already used",
    );
    const restoredDb = new SQL.Database(db.export());
    restoredDb.exec("PRAGMA foreign_keys = ON;");
    const restoredGamification = new SqliteGamificationRepository(restoredDb, async () => {});
    await restoredGamification.purchaseCosmetic("avatar-bounce", "purchase-1");
    const restored = await restoredGamification.snapshot(
      new Date("2026-10-17T10:00:00.000Z"),
      "UTC",
    );
    expect(restored.profile.coins).toBe(55);
    expect(restored.profile.equippedAvatarId).toBe("avatar-bounce");
  });

  it("equips an earned frame and unlocked badge and persists both selections", async () => {
    const { SQL, db, sessions, gamification } = await makeRepositories();
    await sessions.save(qualifyingSession(), [], "first-workout-for-frame");
    await gamification.purchaseCosmetic("frame-sunrise", "frame-purchase");
    await gamification.equipCosmetic("frame-sunrise");
    await gamification.equipBadge("first-workout");

    const state = await gamification.snapshot(new Date("2026-10-17T10:06:00.000Z"), "UTC");
    expect(state.profile.equippedFrameId).toBe("frame-sunrise");
    expect(state.profile.equippedBadgeId).toBe("first-workout");

    const restoredDb = new SQL.Database(db.export());
    restoredDb.exec("PRAGMA foreign_keys = ON;");
    const restored = new SqliteGamificationRepository(restoredDb, async () => {});
    const restoredState = await restored.snapshot(new Date("2026-10-17T10:06:00.000Z"), "UTC");
    expect(restoredState.profile.equippedFrameId).toBe("frame-sunrise");
    expect(restoredState.profile.equippedBadgeId).toBe("first-workout");
  });

  it("rejects locked cosmetics, invalid time zones, and invalid challenge-related settings", async () => {
    const { gamification } = await makeRepositories();
    await expect(gamification.equipCosmetic("avatar-bounce")).rejects.toThrow("Unlock");
    await expect(gamification.equipBadge("first-workout")).rejects.toThrow("Earn this badge");
    await expect(gamification.equipBadge("not-a-badge")).rejects.toThrow("does not exist");
    await expect(gamification.purchaseCosmetic("missing-item", "purchase-x")).rejects.toThrow(
      "does not exist",
    );
    await expect(gamification.setTimeZone("Mars/Olympus_Mons")).rejects.toThrow("valid time zone");
    await expect(gamification.setPlannedRestWeekdays([7])).rejects.toThrow("weekdays");
    await expect(
      gamification.recoverStreak("2026-02-30", new Date("2026-10-17T12:00:00.000Z")),
    ).rejects.toThrow("valid date");
  });

  it("persists selected timezone and future-effective planned rest days", async () => {
    const { gamification } = await makeRepositories();
    const now = new Date("2026-10-17T12:00:00.000Z");
    await gamification.setTimeZone("America/Barbados", now);
    await gamification.setPlannedRestWeekdays([0, 6], now);
    const snapshot = await gamification.snapshot(now, "UTC");
    expect(snapshot.profile.timeZone).toBe("America/Barbados");
    expect(snapshot.profile.plannedRestWeekdays).toEqual([0, 6]);
    expect(snapshot.profile.nextLocalDayAt).toBe("2026-10-18T04:00:00.000Z");
  });

  it("spends one recovery token to restore a single missed day and rejects reuse", async () => {
    const { db, sessions, gamification } = await makeRepositories();
    db.run(
      "UPDATE player_settings SET time_zone='UTC', time_zone_source='user', planned_rest_weekdays='', planned_rest_start_date='2026-10-01', recovery_tokens=1 WHERE id=1",
    );
    await sessions.save(
      qualifyingSession({
        startedAt: "2026-10-15T10:00:00.000Z",
        completedAt: "2026-10-15T10:05:00.000Z",
      }),
      [],
      "recovery-anchor",
    );
    const now = new Date("2026-10-17T12:00:00.000Z");

    expect(await gamification.latestRecoverableDate(now)).toBe("2026-10-16");
    await gamification.recoverStreak("2026-10-16", now);
    await expect(gamification.recoverStreak("2026-10-16", now)).rejects.toThrow(
      "No recovery tokens",
    );
    const state = await gamification.snapshot(now, "UTC");
    expect(state.profile.recoveryTokens).toBe(0);
    expect(state.profile.streak).toBe(1);
  });
});
