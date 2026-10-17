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
  const days = new Set(sessions.map((s) => dayKey(new Date(s.completedAt))));
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
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7)); // Monday
  const totalSeconds = sessions.reduce((sum, s) => sum + s.durationSeconds, 0);
  return {
    totalWorkouts: sessions.length,
    totalMinutes: Math.round(totalSeconds / 60),
    currentStreak: computeStreak(sessions, now),
    thisWeek: sessions.filter((s) => new Date(s.completedAt) >= weekStart).length,
  };
}
