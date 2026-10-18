import type { Database } from "sql.js";
import { ACHIEVEMENTS, CHALLENGES } from "@/lib/data/gamification";
import type { ChallengeDefinition, WorkoutSession } from "@/lib/types";
import {
  calculateStreak,
  localDateKey,
  startOfLocalWeek,
  qualifiesForStreak,
} from "@/lib/services/streakService";

const SESSION_XP = 20;
const SESSION_COINS = 8;

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

function insertLedgerReward(
  db: Database,
  sourceType: string,
  sourceId: string,
  rewardKey: string,
  xp: number,
  coins: number,
  createdAt: string,
): boolean {
  db.run(
    `INSERT OR IGNORE INTO reward_ledger
      (id, source_type, source_id, reward_key, xp_delta, coins_delta, created_at)
     VALUES (?,?,?,?,?,?,?)`,
    [crypto.randomUUID(), sourceType, sourceId, rewardKey, xp, coins, createdAt],
  );
  return db.getRowsModified() > 0;
}

function weekdaySet(raw: unknown): number[] {
  return String(raw ?? "")
    .split(",")
    .filter(Boolean)
    .map(Number)
    .filter((day) => day >= 0 && day <= 6);
}

function periodKey(challenge: ChallengeDefinition, localDate: string): string {
  return challenge.period === "daily" ? localDate : startOfLocalWeek(localDate);
}

function metricDelta(challenge: ChallengeDefinition, session: WorkoutSession): number {
  switch (challenge.metric) {
    case "sessions":
      return 1;
    case "moves":
      return session.exercisesCompleted;
    case "active-seconds":
      return session.durationSeconds;
    case "active-days":
      return 0;
  }
}

function qualifyingDateCount(db: Database, startDate: string, endDate: string): number {
  return Number(
    readOne(
      db,
      "SELECT COUNT(*) AS total FROM qualifying_activity_days WHERE local_date >= ? AND local_date <= ?",
      [startDate, endDate],
    )?.["total"] ?? 0,
  );
}

function awardChallenge(
  db: Database,
  challenge: ChallengeDefinition,
  localDate: string,
  session: WorkoutSession,
): boolean {
  const key = periodKey(challenge, localDate);
  const previous = readOne(
    db,
    "SELECT progress, completed_at FROM challenge_progress WHERE challenge_id = ? AND period_key = ?",
    [challenge.id, key],
  );
  if (previous?.["completed_at"]) return false;
  const progress =
    challenge.metric === "active-days"
      ? qualifyingDateCount(db, key, localDate)
      : Math.min(
          challenge.target,
          Number(previous?.["progress"] ?? 0) + metricDelta(challenge, session),
        );
  const completedAt = progress >= challenge.target ? session.completedAt : null;
  db.run(
    `INSERT INTO challenge_progress (challenge_id, period_key, progress, completed_at)
     VALUES (?,?,?,?)
     ON CONFLICT(challenge_id, period_key) DO UPDATE SET progress=excluded.progress, completed_at=excluded.completed_at`,
    [challenge.id, key, Math.min(challenge.target, progress), completedAt],
  );
  if (!completedAt) return false;
  return insertLedgerReward(
    db,
    "challenge",
    `${challenge.id}:${key}`,
    "challenge-complete",
    challenge.xpReward,
    challenge.coinReward,
    session.completedAt,
  );
}

function unlockAchievement(db: Database, achievementId: string, unlockedAt: string): boolean {
  const definition = ACHIEVEMENTS.find((candidate) => candidate.id === achievementId);
  if (!definition) return false;
  db.run("INSERT OR IGNORE INTO unlocked_achievements (achievement_id, unlocked_at) VALUES (?,?)", [
    achievementId,
    unlockedAt,
  ]);
  if (db.getRowsModified() === 0) return false;
  insertLedgerReward(
    db,
    "achievement",
    achievementId,
    "achievement-complete",
    definition.rewardXp,
    definition.rewardCoins,
    unlockedAt,
  );
  if (definition.rewardItemId) {
    db.run(
      `INSERT OR IGNORE INTO cosmetic_inventory (item_id, unlocked_at, source_type, source_id)
       VALUES (?,?,?,?)`,
      [definition.rewardItemId, unlockedAt, "achievement", achievementId],
    );
  }
  if (definition.rewardTokens > 0) {
    db.run("UPDATE player_settings SET recovery_tokens = recovery_tokens + ? WHERE id = 1", [
      definition.rewardTokens,
    ]);
  }
  return true;
}

function checkAchievements(
  db: Database,
  localDate: string,
  timeZone: string,
  unlockedAt: string,
): void {
  const totals = readOne(
    db,
    `SELECT COUNT(*) AS sessions FROM workout_sessions
     WHERE status='completed' AND exercises_completed > 0 AND duration_seconds >= 60`,
  );
  const sessions = Number(totals?.["sessions"] ?? 0);
  const challengeCount = Number(
    readOne(
      db,
      "SELECT COUNT(*) AS total FROM reward_ledger WHERE source_type='challenge' AND reward_key='challenge-complete'",
    )?.["total"] ?? 0,
  );
  const settings = readOne(
    db,
    "SELECT planned_rest_weekdays, planned_rest_start_date FROM player_settings WHERE id = 1",
  );
  const active =
    db
      .exec("SELECT local_date FROM qualifying_activity_days ORDER BY local_date")[0]
      ?.values.map((row) => String(row[0])) ?? [];
  const recovered =
    db
      .exec("SELECT local_date FROM streak_recoveries ORDER BY local_date")[0]
      ?.values.map((row) => String(row[0])) ?? [];
  const streak = calculateStreak(
    localDate,
    active,
    weekdaySet(settings?.["planned_rest_weekdays"]),
    recovered,
    String(settings?.["planned_rest_start_date"] ?? "1970-01-01"),
  );
  for (const achievement of ACHIEVEMENTS) {
    const completedSpecialChallenge =
      achievement.requiredChallengeId !== undefined &&
      readOne(
        db,
        "SELECT 1 AS found FROM challenge_progress WHERE challenge_id=? AND completed_at IS NOT NULL LIMIT 1",
        [achievement.requiredChallengeId],
      ) !== null;
    const eligible =
      (achievement.requiredSessions !== undefined && sessions >= achievement.requiredSessions) ||
      (achievement.requiredStreak !== undefined && streak >= achievement.requiredStreak) ||
      (achievement.requiredChallenges !== undefined &&
        challengeCount >= achievement.requiredChallenges) ||
      completedSpecialChallenge;
    if (eligible) unlockAchievement(db, achievement.id, unlockedAt);
  }
}

/** Call only inside the workout session's open SQLite transaction. */
export function awardCompletedSession(db: Database, session: WorkoutSession): void {
  if (session.status !== "completed" || !qualifiesForStreak(session)) return;
  const settings = readOne(db, "SELECT time_zone FROM player_settings WHERE id = 1");
  const timeZone = String(settings?.["time_zone"] ?? "UTC");
  const localDate = localDateKey(new Date(session.completedAt), timeZone);

  insertLedgerReward(
    db,
    "session",
    session.id,
    "session-complete",
    SESSION_XP,
    SESSION_COINS,
    session.completedAt,
  );
  db.run(
    `INSERT OR IGNORE INTO qualifying_activity_days (local_date, source_session_id, activity_type, time_zone)
     VALUES (?,?,?,?)`,
    [localDate, session.id, "workout", timeZone],
  );

  for (const challenge of CHALLENGES) {
    awardChallenge(db, challenge, localDate, session);
  }
  checkAchievements(db, localDate, timeZone, session.completedAt);
}
