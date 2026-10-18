import { EXERCISES } from "@/lib/data/exercises";
import type {
  CalendarEventStatus,
  CalendarEventType,
  Exercise,
  ExerciseActivity,
  FitnessGoal,
  FitnessLevel,
  RecoveryPreference,
  Routine,
  WorkoutPlanPreferences,
} from "@/lib/types";

export interface GeneratedPlanEvent {
  date: string;
  type: CalendarEventType;
  status: CalendarEventStatus;
  routine: Routine | null;
}

export interface GeneratedWorkoutPlan {
  name: string;
  preferences: WorkoutPlanPreferences;
  events: GeneratedPlanEvent[];
}

const MAX_PLAN_DAYS = 366;
const WEEKLY_TRAINING_DAYS: Record<number, number[]> = {
  2: [1, 5],
  3: [1, 3, 5],
  4: [1, 2, 4, 6],
  5: [1, 2, 3, 5, 6],
  6: [1, 2, 3, 4, 5, 6],
};

function parseDateKey(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year!, month! - 1, day!);
  return date.getFullYear() === year && date.getMonth() === month! - 1 && date.getDate() === day
    ? date
    : null;
}

function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateOrdinal(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000;
}

function validatePreferences(preferences: WorkoutPlanPreferences): void {
  if (
    !["general-fitness", "strength", "endurance", "flexibility", "weight-loss"].includes(
      preferences.goal,
    )
  )
    throw new Error("Choose a valid fitness goal");
  if (!["beginner", "intermediate", "advanced"].includes(preferences.level))
    throw new Error("Choose a valid fitness level");
  if (
    !Number.isInteger(preferences.availableMinutes) ||
    preferences.availableMinutes < 5 ||
    preferences.availableMinutes > 120
  )
    throw new Error("Workout duration must be between 5 and 120 minutes");
  if (
    !Number.isInteger(preferences.weeklyFrequency) ||
    preferences.weeklyFrequency < 2 ||
    preferences.weeklyFrequency > 6
  )
    throw new Error("Choose between 2 and 6 workout days per week");
  if (preferences.preferredActivities.length === 0)
    throw new Error("Choose at least one preferred activity");
  if (!["balanced", "gentle", "extra-rest"].includes(preferences.recoveryPreference))
    throw new Error("Choose a valid recovery preference");
  const start = parseDateKey(preferences.startDate);
  const end = parseDateKey(preferences.targetDate);
  if (!start || !end) throw new Error("Enter valid start and target dates");
  const dayCount = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  if (dayCount < 1 || dayCount > MAX_PLAN_DAYS)
    throw new Error("The target date must be within 365 days of the start date");
}

function deterministicIndex(seed: string, length: number): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index++) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % length;
}

function levelAllows(exercise: Exercise, level: FitnessLevel): boolean {
  if (level === "beginner") return exercise.difficulty === "beginner";
  if (level === "intermediate") return exercise.difficulty !== "advanced";
  return exercise.difficulty !== "beginner";
}

function avoidsLimitations(exercise: Exercise, limitations: string[]): boolean {
  const searchable = [
    exercise.name,
    exercise.summary,
    ...exercise.muscles,
    ...(exercise.targetAreas ?? []),
    ...exercise.steps,
    ...(exercise.safetyNotes ?? []),
  ]
    .join(" ")
    .toLowerCase();
  return limitations.every((limitation) => {
    const term = limitation.toLowerCase();
    const singular = term.endsWith("s") ? term.slice(0, -1) : term;
    return !searchable.includes(term) && !searchable.includes(singular);
  });
}

export function progressionTarget(
  exercise: Exercise,
  weekIndex: number,
  recoveryPreference: RecoveryPreference,
) {
  const weeksPerIncrease = recoveryPreference === "balanced" ? 2 : 3;
  const progressionSteps = Math.floor(weekIndex / weeksPerIncrease);
  const factor = Math.min(1.5, 1 + progressionSteps * 0.1);
  return exercise.target.kind === "time"
    ? { kind: "time" as const, seconds: Math.round(exercise.target.seconds * factor) }
    : {
        kind: "reps" as const,
        reps: Math.min(
          Math.round(exercise.target.reps * 1.5),
          Math.max(exercise.target.reps, Math.round(exercise.target.reps * factor)),
        ),
      };
}

function goalMatches(exercise: Exercise, goal: FitnessGoal): boolean {
  switch (goal) {
    case "strength":
      return exercise.activity === "bodyweight-strength";
    case "endurance":
    case "weight-loss":
      return exercise.activity === "low-impact-cardio" || exercise.activity === "stairs";
    case "flexibility":
      return exercise.activity === "flexibility" || exercise.activity === "yoga";
    case "general-fitness":
      return true;
  }
}

function pickExercises(pool: Exercise[], count: number, seed: string): Exercise[] {
  if (pool.length === 0) return [];
  const start = deterministicIndex(seed, pool.length);
  return Array.from(
    { length: Math.min(count, pool.length) },
    (_, index) => pool[(start + index) % pool.length]!,
  );
}

function makeRoutine(
  date: string,
  weekIndex: number,
  preferences: WorkoutPlanPreferences,
  mainPool: Exercise[],
  warmupPool: Exercise[],
  cooldownPool: Exercise[],
): Routine {
  const mainCount =
    preferences.availableMinutes < 15 ? 3 : preferences.availableMinutes < 25 ? 4 : 6;
  const main = pickExercises(mainPool, mainCount, `${date}:${preferences.goal}:main`);
  const warmup = pickExercises(warmupPool, 2, `${date}:warmup`);
  const cooldown = pickExercises(cooldownPool, 2, `${date}:cooldown`);
  const items = [
    ...warmup.map((exercise) => ({ exerciseId: exercise.id, section: "warmup" as const })),
    ...main.map((exercise) => ({
      exerciseId: exercise.id,
      target: progressionTarget(exercise, weekIndex, preferences.recoveryPreference),
      section: "main" as const,
    })),
    ...cooldown.map((exercise) => ({
      exerciseId: exercise.id,
      section: "cooldown" as const,
    })),
  ];
  const dateName = new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
  });
  return {
    id: "",
    name: `${dateName} ${preferences.goal.replaceAll("-", " ")} session`,
    description: `${preferences.availableMinutes} minutes · Warm-up, focused training and cooldown`,
    restSeconds:
      preferences.recoveryPreference === "extra-rest"
        ? 45
        : preferences.recoveryPreference === "gentle"
          ? 30
          : 20,
    durationMinutes: preferences.availableMinutes,
    items,
  };
}

export function generateWorkoutPlan(preferences: WorkoutPlanPreferences): GeneratedWorkoutPlan {
  validatePreferences(preferences);
  const start = parseDateKey(preferences.startDate)!;
  const end = parseDateKey(preferences.targetDate)!;
  const movementSafe = EXERCISES.filter((exercise) =>
    avoidsLimitations(exercise, preferences.movementLimitations),
  );
  const suitable = movementSafe.filter((exercise) => levelAllows(exercise, preferences.level));
  const preferred = suitable.filter((exercise) =>
    preferences.preferredActivities.includes(exercise.activity as ExerciseActivity),
  );
  const advancedFallback =
    preferences.level === "advanced"
      ? movementSafe.filter((exercise) =>
          preferences.preferredActivities.includes(exercise.activity as ExerciseActivity),
        )
      : [];
  const candidates = preferred.length > 0 ? preferred : advancedFallback;
  if (candidates.length === 0)
    throw new Error(
      "No preferred activities match these movement limitations and level. Adjust your choices.",
    );
  const mainPool = candidates.sort((a, b) => {
    const goalDifference =
      Number(goalMatches(b, preferences.goal)) - Number(goalMatches(a, preferences.goal));
    return goalDifference || a.id.localeCompare(b.id);
  });
  const warmupPool = movementSafe
    .filter((exercise) =>
      ["recovery", "flexibility", "low-impact-cardio"].includes(exercise.activity ?? ""),
    )
    .sort((a, b) => a.id.localeCompare(b.id));
  const cooldownPool = movementSafe
    .filter((exercise) => ["recovery", "flexibility", "yoga"].includes(exercise.activity ?? ""))
    .sort((a, b) => a.id.localeCompare(b.id));
  const trainingWeekdays = new Set(WEEKLY_TRAINING_DAYS[preferences.weeklyFrequency]);
  const events: GeneratedPlanEvent[] = [];

  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const date = formatDateKey(cursor);
    const weekday = (cursor.getDay() + 6) % 7;
    const isWorkoutDay = trainingWeekdays.has(weekday);
    if (!isWorkoutDay) {
      events.push({ date, type: "rest", status: "rest", routine: null });
      continue;
    }
    const weekIndex = Math.floor((dateOrdinal(cursor) - dateOrdinal(start)) / 7);
    events.push({
      date,
      type: "workout",
      status: "scheduled",
      routine: makeRoutine(date, weekIndex, preferences, mainPool, warmupPool, cooldownPool),
    });
  }

  return {
    name: `${preferences.goal.replaceAll("-", " ")} plan`,
    preferences: structuredClone(preferences),
    events,
  };
}

export function convertWeight(value: number, from: "kg" | "lb", to: "kg" | "lb"): number {
  if (!Number.isFinite(value) || value <= 0) throw new Error("Weight must be a positive number");
  if (from === to) return value;
  return from === "kg" ? value * 2.2046226218 : value / 2.2046226218;
}

export function displayWeight(weightKg: number, unit: "kg" | "lb"): number {
  return Number(convertWeight(weightKg, "kg", unit).toFixed(1));
}
