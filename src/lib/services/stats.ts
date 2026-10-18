import type { WorkoutSession, WorkoutStats } from "@/lib/types";

/** Local calendar day key, e.g. 2026-10-17. */
export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Streak = consecutive days with at least one session, ending today or yesterday
 * (so the streak isn't "lost" before today's workout).
 */
export function computeStreak(sessions: WorkoutSession[], now: Date): number {
  const days = new Set(
    sessions.filter((s) => s.status !== "cancelled").map((s) => dayKey(new Date(s.completedAt))),
  );
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function computeStats(sessions: WorkoutSession[], now: Date): WorkoutStats {
  const counted = sessions.filter((session) => session.status !== "cancelled");
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7)); // Monday
  const totalSeconds = counted.reduce((sum, s) => sum + s.durationSeconds, 0);
  return {
    totalWorkouts: counted.length,
    totalMinutes: Math.round(totalSeconds / 60),
    currentStreak: computeStreak(counted, now),
    thisWeek: counted.filter((s) => new Date(s.completedAt) >= weekStart).length,
  };
}

export function computeWorkoutConsistency(
  sessions: WorkoutSession[],
  now: Date,
  windowDays = 30,
): { activeDays: number; totalDays: number; percentage: number } {
  if (!Number.isInteger(windowDays) || windowDays < 1)
    throw new Error("Consistency window must be a positive number of days");
  const activeDates = new Set(
    sessions
      .filter((session) => session.status !== "cancelled")
      .map((session) => dayKey(new Date(session.completedAt))),
  );
  let activeDays = 0;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (let offset = 0; offset < windowDays; offset++) {
    const date = new Date(today);
    date.setDate(date.getDate() - offset);
    if (activeDates.has(dayKey(date))) activeDays++;
  }
  return {
    activeDays,
    totalDays: windowDays,
    percentage: Math.round((activeDays / windowDays) * 100),
  };
}
