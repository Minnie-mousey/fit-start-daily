import type { Database } from "sql.js";
import { ACHIEVEMENTS, CHALLENGES, COSMETICS, levelForXp } from "@/lib/data/gamification";
import type { CosmeticDefinition, GamificationSnapshot, PlayerAchievement } from "@/lib/types";
import {
  addLocalDays,
  calculateStreak,
  localDateKey,
  nextLocalDayStart,
  weekdayForDateKey,
} from "@/lib/services/streakService";

export interface GamificationRepository {
  snapshot(now?: Date, deviceTimeZone?: string): Promise<GamificationSnapshot>;
  setTimeZone(timeZone: string, now?: Date): Promise<void>;
  setPlannedRestWeekdays(weekdays: number[], now?: Date): Promise<void>;
  purchaseCosmetic(itemId: string, purchaseId: string): Promise<void>;
  equipCosmetic(itemId: string): Promise<void>;
  equipBadge(achievementId: string | null): Promise<void>;
  latestRecoverableDate(now?: Date): Promise<string | null>;
  recoverStreak(localDate: string, now?: Date): Promise<void>;
}

function readOne(
  db: Database,
  sql: string,
  params: (string | number)[] = [],
): Record<string, unknown> | null {
  const statement = db.prepare(sql);
  statement.bind(params);
  const row = statement.step() ? statement.getAsObject() : null;
  statement.free();
  return row;
}

function readStrings(db: Database, sql: string, params: (string | number)[] = []): string[] {
  const statement = db.prepare(sql);
  statement.bind(params);
  const values: string[] = [];
  while (statement.step()) values.push(String(statement.get()[0]));
  statement.free();
  return values;
}

function readWeekdays(raw: unknown): number[] {
  return String(raw ?? "")
    .split(",")
    .filter(Boolean)
    .map(Number)
    .filter((day) => day >= 0 && day <= 6);
}

function validTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export class SqliteGamificationRepository implements GamificationRepository {
  constructor(
    private readonly db: Database,
    private readonly persist: (db: Database) => Promise<void>,
  ) {}

  async snapshot(now = new Date(), deviceTimeZone = "UTC"): Promise<GamificationSnapshot> {
    const settings = readOne(this.db, "SELECT * FROM player_settings WHERE id = 1");
    let timeZone = String(settings?.["time_zone"] ?? "UTC");
    if (
      settings?.["time_zone_source"] === "device" &&
      validTimeZone(deviceTimeZone) &&
      deviceTimeZone !== timeZone
    ) {
      await this.setDeviceTimeZone(deviceTimeZone, now);
      timeZone = deviceTimeZone;
    }
    const refreshed = readOne(this.db, "SELECT * FROM player_settings WHERE id = 1");
    const plannedRestWeekdays = readWeekdays(refreshed?.["planned_rest_weekdays"]);
    const plannedRestStartDate = String(refreshed?.["planned_rest_start_date"] ?? "1970-01-01");
    const recoveryTokens = Number(refreshed?.["recovery_tokens"] ?? 0);
    const xpTotal = Number(
      readOne(this.db, "SELECT COALESCE(SUM(xp_delta),0) AS total FROM reward_ledger")?.["total"] ??
        0,
    );
    const coins = Number(
      readOne(this.db, "SELECT COALESCE(SUM(coins_delta),0) AS total FROM reward_ledger")?.[
        "total"
      ] ?? 0,
    );
    const today = localDateKey(now, timeZone);
    const activityDates = readStrings(
      this.db,
      "SELECT local_date FROM qualifying_activity_days ORDER BY local_date",
    );
    const recoveredDates = readStrings(
      this.db,
      "SELECT local_date FROM streak_recoveries ORDER BY local_date",
    );
    const streak = calculateStreak(
      today,
      activityDates,
      plannedRestWeekdays,
      recoveredDates,
      plannedRestStartDate,
    );
    const progressRows = new Map<string, Record<string, unknown>>();
    for (const row of this.db.exec(
      "SELECT challenge_id, period_key, progress, completed_at FROM challenge_progress",
    )[0]?.values ?? []) {
      progressRows.set(`${String(row[0])}:${String(row[1])}`, {
        progress: row[2],
        completedAt: row[3],
      });
    }
    const challenges = CHALLENGES.map((definition) => {
      const periodKey =
        definition.period === "daily"
          ? today
          : (() => {
              const monday = addLocalDays(today, -((weekdayForDateKey(today) + 6) % 7));
              return monday;
            })();
      const row = progressRows.get(`${definition.id}:${periodKey}`);
      const completedAt = row?.["completedAt"] ? String(row["completedAt"]) : null;
      const claim = readOne(
        this.db,
        "SELECT 1 AS found FROM reward_ledger WHERE source_type='challenge' AND source_id=? AND reward_key='challenge-complete'",
        [`${definition.id}:${periodKey}`],
      );
      return {
        ...definition,
        periodKey,
        progress: Number(row?.["progress"] ?? 0),
        completedAt,
        claimed: Boolean(claim),
      };
    });
    const unlockedRows = new Map<string, string>();
    const unlocked =
      this.db.exec("SELECT achievement_id, unlocked_at FROM unlocked_achievements")[0]?.values ??
      [];
    for (const row of unlocked) unlockedRows.set(String(row[0]), String(row[1]));
    const achievements: PlayerAchievement[] = ACHIEVEMENTS.map((definition) => ({
      id: definition.id,
      title: definition.title,
      description: definition.description,
      unlockedAt: unlockedRows.get(definition.id) ?? null,
      rewardItemId: definition.rewardItemId,
      rarity: definition.rarity ?? "common",
    }));
    const inventory = readStrings(
      this.db,
      "SELECT item_id FROM cosmetic_inventory ORDER BY unlocked_at, item_id",
    );
    const equipped = new Map<string, string>();
    const equipmentRows =
      this.db.exec("SELECT slot, item_id FROM equipped_cosmetics")[0]?.values ?? [];
    for (const row of equipmentRows) equipped.set(String(row[0]), String(row[1]));
    const avatarSettings = readOne(
      this.db,
      "SELECT frame_id, badge_id FROM avatar_profile WHERE id=1",
    );
    const recoverableDate = await this.latestRecoverableDate(now);

    return {
      profile: {
        timeZone,
        plannedRestWeekdays,
        recoveryTokens,
        streak,
        xpTotal,
        level: levelForXp(xpTotal),
        levelProgress: xpTotal % 100,
        xpForNextLevel: 100 - (xpTotal % 100),
        coins,
        equippedAvatarId: equipped.get("avatar") ?? "avatar-sprout",
        equippedFrameId: String(avatarSettings?.["frame_id"] ?? "frame-meadow"),
        equippedBadgeId: avatarSettings?.["badge_id"] ? String(avatarSettings["badge_id"]) : null,
        equippedThemeId: equipped.get("theme") ?? "theme-meadow",
        nextLocalDayAt: nextLocalDayStart(now, timeZone).toISOString(),
        recoverableDate,
      },
      challenges,
      achievements,
      inventory,
      cosmetics: COSMETICS,
    };
  }

  async setTimeZone(timeZone: string, now = new Date()): Promise<void> {
    if (!validTimeZone(timeZone)) throw new Error("Choose a valid time zone");
    await this.transaction(() => {
      this.db.run("UPDATE player_settings SET time_zone=?, time_zone_source='user' WHERE id=1", [
        timeZone,
      ]);
      this.rebuildLocalActivityDays(timeZone);
      this.rebuildRecoveryDates(timeZone);
    });
    void now;
  }

  async setPlannedRestWeekdays(weekdays: number[], now = new Date()): Promise<void> {
    const selected = [...new Set(weekdays)].sort((a, b) => a - b);
    if (selected.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
      throw new Error("Rest days must be weekdays from 0 to 6");
    }
    await this.transaction(() => {
      const settings = readOne(this.db, "SELECT time_zone FROM player_settings WHERE id=1");
      const timeZone = String(settings?.["time_zone"] ?? "UTC");
      const effectiveFrom = addLocalDays(localDateKey(now, timeZone), 1);
      this.db.run(
        "UPDATE player_settings SET planned_rest_weekdays=?, planned_rest_start_date=? WHERE id=1",
        [selected.join(","), effectiveFrom],
      );
    });
  }

  async purchaseCosmetic(itemId: string, purchaseId: string): Promise<void> {
    const item = COSMETICS.find((cosmetic) => cosmetic.id === itemId);
    if (!item) throw new Error("That cosmetic does not exist");
    if (!purchaseId.trim()) throw new Error("A purchase id is required");
    await this.transaction(() => {
      const priorReceipt = readOne(
        this.db,
        "SELECT reward_key FROM reward_ledger WHERE source_type='purchase' AND source_id=?",
        [purchaseId],
      );
      if (priorReceipt) {
        if (priorReceipt["reward_key"] !== `cosmetic:${itemId}`)
          throw new Error("Purchase id was already used for another item");
        return;
      }
      if (readOne(this.db, "SELECT 1 AS found FROM cosmetic_inventory WHERE item_id=?", [itemId])) {
        throw new Error("You already own this cosmetic");
      }
      const xp = Number(
        readOne(this.db, "SELECT COALESCE(SUM(xp_delta),0) AS total FROM reward_ledger")?.[
          "total"
        ] ?? 0,
      );
      if (levelForXp(xp) < item.requiredLevel)
        throw new Error(`Reach level ${item.requiredLevel} to unlock this item`);
      if (
        item.achievementId &&
        !readOne(this.db, "SELECT 1 AS found FROM unlocked_achievements WHERE achievement_id=?", [
          item.achievementId,
        ])
      ) {
        throw new Error("Complete the required achievement to unlock this item");
      }
      const coins = Number(
        readOne(this.db, "SELECT COALESCE(SUM(coins_delta),0) AS total FROM reward_ledger")?.[
          "total"
        ] ?? 0,
      );
      if (coins < item.price) throw new Error("Not enough coins for this cosmetic");
      this.db.run(
        `INSERT INTO reward_ledger (id,source_type,source_id,reward_key,xp_delta,coins_delta,created_at)
         VALUES (?,?,?,?,?,?,?)`,
        [
          crypto.randomUUID(),
          "purchase",
          purchaseId,
          `cosmetic:${itemId}`,
          0,
          -item.price,
          new Date().toISOString(),
        ],
      );
      this.db.run(
        "INSERT INTO cosmetic_inventory (item_id,unlocked_at,source_type,source_id) VALUES (?,?,?,?)",
        [itemId, new Date().toISOString(), "purchase", purchaseId],
      );
    });
  }

  async equipCosmetic(itemId: string): Promise<void> {
    const item = COSMETICS.find((cosmetic) => cosmetic.id === itemId);
    if (!item) throw new Error("That cosmetic does not exist");
    await this.transaction(() => {
      if (
        !readOne(this.db, "SELECT 1 AS found FROM cosmetic_inventory WHERE item_id=?", [itemId])
      ) {
        throw new Error("Unlock this cosmetic before equipping it");
      }
      this.db.run(
        item.slot === "frame"
          ? "UPDATE avatar_profile SET frame_id=? WHERE id=1"
          : `INSERT INTO equipped_cosmetics (slot,item_id) VALUES (?,?)
             ON CONFLICT(slot) DO UPDATE SET item_id=excluded.item_id`,
        item.slot === "frame" ? [item.id] : [item.slot, item.id],
      );
    });
  }

  async equipBadge(achievementId: string | null): Promise<void> {
    if (
      achievementId !== null &&
      !ACHIEVEMENTS.some((achievement) => achievement.id === achievementId)
    ) {
      throw new Error("That badge does not exist");
    }
    await this.transaction(() => {
      if (
        achievementId !== null &&
        !readOne(this.db, "SELECT 1 AS found FROM unlocked_achievements WHERE achievement_id=?", [
          achievementId,
        ])
      ) {
        throw new Error("Earn this badge before equipping it");
      }
      this.db.run("UPDATE avatar_profile SET badge_id=? WHERE id=1", [achievementId]);
    });
  }

  async latestRecoverableDate(now = new Date()): Promise<string | null> {
    const settings = readOne(this.db, "SELECT * FROM player_settings WHERE id=1");
    const timeZone = String(settings?.["time_zone"] ?? "UTC");
    if (Number(settings?.["recovery_tokens"] ?? 0) <= 0) return null;
    const today = localDateKey(now, timeZone);
    const planned = new Set(readWeekdays(settings?.["planned_rest_weekdays"]));
    const planStart = String(settings?.["planned_rest_start_date"] ?? "1970-01-01");
    const active = new Set(readStrings(this.db, "SELECT local_date FROM qualifying_activity_days"));
    const recovered = new Set(readStrings(this.db, "SELECT local_date FROM streak_recoveries"));
    let mostRecentActivity: string | null = null;
    for (const date of active)
      if (date < today && (!mostRecentActivity || date > mostRecentActivity))
        mostRecentActivity = date;
    if (!mostRecentActivity) return null;
    const gaps: string[] = [];
    for (
      let date = addLocalDays(mostRecentActivity, 1);
      date < today;
      date = addLocalDays(date, 1)
    ) {
      if (
        active.has(date) ||
        recovered.has(date) ||
        (date >= planStart && planned.has(weekdayForDateKey(date)))
      )
        continue;
      gaps.push(date);
    }
    return gaps.length === 1 && gaps[0] && gaps[0] >= addLocalDays(today, -7) ? gaps[0] : null;
  }

  async recoverStreak(localDate: string, now = new Date()): Promise<void> {
    const parsedDate = new Date(`${localDate}T00:00:00.000Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(localDate) ||
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== localDate
    ) {
      throw new Error("Choose a valid date");
    }
    await this.transaction(() => {
      const settings = readOne(this.db, "SELECT * FROM player_settings WHERE id=1");
      const timeZone = String(settings?.["time_zone"] ?? "UTC");
      const today = localDateKey(now, timeZone);
      const earliest = addLocalDays(today, -7);
      if (localDate < earliest || localDate >= today)
        throw new Error("Recovery tokens can cover only a missed day in the last seven days");
      if (Number(settings?.["recovery_tokens"] ?? 0) <= 0)
        throw new Error("No recovery tokens are available");
      const planStart = String(settings?.["planned_rest_start_date"] ?? "1970-01-01");
      if (
        localDate >= planStart &&
        readWeekdays(settings?.["planned_rest_weekdays"]).includes(weekdayForDateKey(localDate))
      ) {
        throw new Error("A planned rest day does not need a recovery token");
      }
      if (
        readOne(this.db, "SELECT 1 AS found FROM qualifying_activity_days WHERE local_date=?", [
          localDate,
        ])
      ) {
        throw new Error("That day already has a qualifying activity");
      }
      if (
        readOne(this.db, "SELECT 1 AS found FROM streak_recoveries WHERE local_date=?", [localDate])
      ) {
        throw new Error("That day has already been recovered");
      }
      if (
        !readOne(this.db, "SELECT 1 AS found FROM qualifying_activity_days WHERE local_date < ?", [
          localDate,
        ])
      ) {
        throw new Error("A recovery token needs an earlier qualifying activity");
      }
      this.db.run("INSERT INTO streak_recoveries (local_date,token_spent_at) VALUES (?,?)", [
        localDate,
        now.toISOString(),
      ]);
      this.db.run("UPDATE player_settings SET recovery_tokens=recovery_tokens-1 WHERE id=1");
    });
  }

  private async setDeviceTimeZone(timeZone: string, now: Date): Promise<void> {
    await this.transaction(() => {
      this.db.run(
        "UPDATE player_settings SET time_zone=? WHERE id=1 AND time_zone_source='device'",
        [timeZone],
      );
      this.rebuildLocalActivityDays(timeZone);
      this.rebuildRecoveryDates(timeZone);
    });
    void now;
  }

  private rebuildLocalActivityDays(timeZone: string): void {
    const sessions =
      this.db.exec(
        `SELECT id, completed_at FROM workout_sessions
       WHERE status='completed' AND exercises_completed > 0 AND duration_seconds >= 60`,
      )[0]?.values ?? [];
    this.db.run("DELETE FROM qualifying_activity_days");
    for (const [id, completedAt] of sessions) {
      const date = localDateKey(new Date(String(completedAt)), timeZone);
      this.db.run(
        `INSERT OR IGNORE INTO qualifying_activity_days (local_date,source_session_id,activity_type,time_zone)
         VALUES (?,?,?,?)`,
        [date, String(id), "workout", timeZone],
      );
    }
  }

  private rebuildRecoveryDates(timeZone: string): void {
    const recoveries =
      this.db.exec("SELECT local_date,token_spent_at FROM streak_recoveries")[0]?.values ?? [];
    this.db.run("DELETE FROM streak_recoveries");
    for (const [, tokenSpentAt] of recoveries) {
      const date = localDateKey(new Date(String(tokenSpentAt)), timeZone);
      this.db.run(
        "INSERT OR IGNORE INTO streak_recoveries (local_date,token_spent_at) VALUES (?,?)",
        [date, String(tokenSpentAt)],
      );
    }
  }

  private async transaction<T>(operation: () => T): Promise<T> {
    this.db.run("BEGIN TRANSACTION");
    try {
      const result = operation();
      this.db.run("COMMIT");
      await this.persist(this.db);
      return result;
    } catch (error) {
      try {
        this.db.run("ROLLBACK");
      } catch {
        /* transaction already committed */
      }
      throw error;
    }
  }
}
