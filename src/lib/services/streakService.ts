import type { WorkoutSession } from "@/lib/types";

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    calendar: "gregory",
    numberingSystem: "latn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export function localDateKey(date: Date, timeZone: string): string {
  const parts = zonedParts(date, timeZone);
  return `${parts["year"]}-${parts["month"]}-${parts["day"]}`;
}

export function addLocalDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day! + days));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function weekdayForDateKey(dateKey: string): number {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!)).getUTCDay();
}

export function startOfLocalWeek(dateKey: string): string {
  return addLocalDays(dateKey, -((weekdayForDateKey(dateKey) + 6) % 7));
}

export function localDateTimeToUtc(dateKey: string, timeZone: string, hour = 0): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  const targetUtc = Date.UTC(year!, month! - 1, day!, hour);
  let candidate = targetUtc;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = zonedParts(new Date(candidate), timeZone);
    const renderedAsUtc = Date.UTC(
      Number(parts["year"]),
      Number(parts["month"]) - 1,
      Number(parts["day"]),
      Number(parts["hour"]),
      Number(parts["minute"]),
      Number(parts["second"]),
    );
    const correction = targetUtc - renderedAsUtc;
    candidate += correction;
    if (correction === 0) break;
  }
  return new Date(candidate);
}

export function nextLocalDayStart(now: Date, timeZone: string): Date {
  const tomorrow = addLocalDays(localDateKey(now, timeZone), 1);
  return localDateTimeToUtc(tomorrow, timeZone);
}

export function secondsUntilNextLocalDay(now: Date, timeZone: string): number {
  return Math.max(
    0,
    Math.ceil((nextLocalDayStart(now, timeZone).getTime() - now.getTime()) / 1000),
  );
}

export function qualifiesForStreak(
  session: Pick<WorkoutSession, "status" | "durationSeconds" | "exercisesCompleted">,
): boolean {
  return (
    session.status !== "cancelled" &&
    session.exercisesCompleted > 0 &&
    session.durationSeconds >= 60
  );
}

export function calculateStreak(
  today: string,
  qualifyingDates: string[],
  plannedRestWeekdays: number[],
  recoveredDates: string[],
  plannedRestStartDate = "0000-01-01",
): number {
  if (qualifyingDates.length === 0) return 0;
  const active = new Set(qualifyingDates);
  const recovered = new Set(recoveredDates);
  const planned = new Set(plannedRestWeekdays);
  let date = [...active].sort()[0]!;
  let streak = 0;
  while (date <= today) {
    if (active.has(date)) streak += 1;
    else if (
      date < plannedRestStartDate ||
      (!planned.has(weekdayForDateKey(date)) && !recovered.has(date) && date !== today)
    )
      streak = 0;
    date = addLocalDays(date, 1);
  }
  return streak;
}
