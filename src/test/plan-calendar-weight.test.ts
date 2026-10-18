import { describe, expect, it } from "vitest";
import initSqlJs from "sql.js";
import { resolve } from "node:path";
import { EXERCISES, getRoutine } from "@/lib/data/exercises";
import { runMigrations } from "@/lib/db/database";
import { SqliteFitnessRepository } from "@/lib/repositories/fitnessRepository";
import { SqliteWorkoutSessionRepository } from "@/lib/repositories/workoutSessionRepository";
import { computeWorkoutConsistency, dayKey } from "@/lib/services/stats";
import {
  convertWeight,
  displayWeight,
  generateWorkoutPlan,
  progressionTarget,
} from "@/lib/services/trainingPlan";
import type { WorkoutPlanPreferences } from "@/lib/types";

const preferences = (startDate: string, targetDate: string): WorkoutPlanPreferences => ({
  goal: "general-fitness",
  level: "beginner",
  availableMinutes: 20,
  preferredActivities: ["low-impact-cardio", "bodyweight-strength"],
  weeklyFrequency: 3,
  startDate,
  targetDate,
  recoveryPreference: "balanced",
  movementLimitations: [],
});

async function makeRepositories() {
  const SQL = await initSqlJs({
    locateFile: (file) => resolve(process.cwd(), "node_modules/sql.js/dist", file),
  });
  const db = new SQL.Database();
  runMigrations(db);
  const persist = async () => {};
  return {
    fitness: new SqliteFitnessRepository(db, persist),
    sessions: new SqliteWorkoutSessionRepository(db, persist),
  };
}

describe("workout plan generation", () => {
  it("includes both date boundaries and handles leap days deterministically", () => {
    const input = preferences("2028-02-28", "2028-03-01");
    const first = generateWorkoutPlan(input);
    expect(first.events.map((event) => event.date)).toEqual([
      "2028-02-28",
      "2028-02-29",
      "2028-03-01",
    ]);
    expect(generateWorkoutPlan(input)).toEqual(first);
  });

  it("rejects invalid and excessively distant target dates", () => {
    expect(() => generateWorkoutPlan(preferences("2028-02-30", "2028-03-01"))).toThrow(
      "valid start and target dates",
    );
    expect(() => generateWorkoutPlan(preferences("2028-01-01", "2029-01-02"))).toThrow(
      "within 365 days",
    );
  });

  it("makes structured sessions with a gradual, recovery-aware progression", () => {
    const plan = generateWorkoutPlan(preferences("2026-10-19", "2026-11-15"));
    const session = plan.events.find((event) => event.type === "workout")?.routine;
    expect(session?.items.map((item) => item.section)).toEqual([
      "warmup",
      "warmup",
      "main",
      "main",
      "main",
      "main",
      "cooldown",
      "cooldown",
    ]);
    const exercise = {
      id: "test",
      name: "Test",
      category: "core" as const,
      difficulty: "beginner" as const,
      muscles: [],
      summary: "",
      steps: [],
      tips: [],
      easier: "",
      harder: "",
      target: { kind: "reps" as const, reps: 12 },
    };
    expect(progressionTarget(exercise, 0, "balanced")).toEqual({ kind: "reps", reps: 12 });
    expect(progressionTarget(exercise, 2, "balanced")).toEqual({ kind: "reps", reps: 13 });
    expect(progressionTarget(exercise, 2, "extra-rest")).toEqual({ kind: "reps", reps: 12 });
    expect(progressionTarget(exercise, 20, "balanced")).toEqual({ kind: "reps", reps: 18 });
    expect(
      progressionTarget({ ...exercise, target: { kind: "time", seconds: 40 } }, 2, "balanced"),
    ).toEqual({ kind: "time", seconds: 44 });
    expect(plan.events.some((event) => event.status === "rest")).toBe(true);
  });

  it("avoids selected movement limitations and enforces weekly frequency", () => {
    const input = {
      ...preferences("2026-10-19", "2026-10-25"),
      level: "intermediate" as const,
      weeklyFrequency: 3,
      movementLimitations: ["knees"],
    };
    const plan = generateWorkoutPlan(input);
    expect(plan.events.filter((event) => event.type === "workout")).toHaveLength(3);
    const generatedExercises = plan.events.flatMap(
      (event) => event.routine?.items.map((item) => item.exerciseId) ?? [],
    );
    expect(generatedExercises).not.toContain("reverse-lunge");
  });

  it("uses intermediate and advanced strength moves for an advanced plan", () => {
    const plan = generateWorkoutPlan({
      ...preferences("2026-10-20", "2026-10-20"),
      level: "advanced",
      preferredActivities: ["bodyweight-strength"],
    });
    const mainItems =
      plan.events[0]?.routine?.items.filter((item) => item.section === "main") ?? [];
    expect(mainItems.length).toBeGreaterThan(0);
    expect(
      mainItems.every(
        (item) =>
          EXERCISES.find((exercise) => exercise.id === item.exerciseId)?.difficulty !== "beginner",
      ),
    ).toBe(true);
  });
});

describe("weight conversion and consistency date boundaries", () => {
  it("converts between kg and lb without changing the stored canonical value", () => {
    expect(convertWeight(70, "kg", "lb")).toBeCloseTo(154.3236, 3);
    expect(convertWeight(154.3246, "lb", "kg")).toBeCloseTo(70, 3);
    expect(displayWeight(70, "lb")).toBe(154.3);
    expect(() => convertWeight(0, "kg", "lb")).toThrow("positive number");
  });

  it("counts only active days in the rolling window, not future sessions", () => {
    const now = new Date(2026, 9, 17, 12);
    const sessions = [16, 17, 18].map((day) => {
      const completedAt = new Date(2026, 9, day, 9).toISOString();
      return {
        id: completedAt,
        routineId: "routine",
        routineName: "Routine",
        startedAt: completedAt,
        completedAt,
        durationSeconds: 300,
        exercisesCompleted: 1,
        totalExercises: 1,
        status: "completed" as const,
      };
    });
    expect(computeWorkoutConsistency(sessions, now, 2)).toEqual({
      activeDays: 2,
      totalDays: 2,
      percentage: 100,
    });
    expect(dayKey(now)).toBe("2026-10-17");
  });
});

describe("calendar persistence and workout history", () => {
  it("reschedules and annotates events, synchronizes completions, and preserves history on plan changes", async () => {
    const { fitness, sessions } = await makeRepositories();
    const today = dayKey(new Date());
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowKey = dayKey(tomorrow);
    const routine = getRoutine("gentle-start")!;
    const planPreferences = preferences(today, tomorrowKey);

    await fitness.activatePlan("First plan", planPreferences, [
      { date: today, type: "workout", status: "scheduled", routine },
      { date: tomorrowKey, type: "rest", status: "rest", routine: null },
    ]);
    const firstEvent = (await fitness.listEvents(today, today))[0]!;
    const startedAt = new Date(Date.now() - 5 * 60_000);
    const completedAt = new Date();
    const saved = await sessions.save({
      routineId: firstEvent.routineId!,
      routineName: firstEvent.routineName,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationSeconds: 300,
      exercisesCompleted: 5,
      totalExercises: 5,
      status: "completed",
    });
    expect((await fitness.getEvent(firstEvent.id))?.status).toBe("completed");
    expect((await fitness.getEvent(firstEvent.id))?.sourceSessionId).toBe(saved.id);

    await fitness.activatePlan("Second plan", planPreferences, [
      { date: tomorrowKey, type: "workout", status: "scheduled", routine },
    ]);
    const retainedEvents = await fitness.listEvents(today, tomorrowKey);
    expect(
      retainedEvents.some((event) => event.id === firstEvent.id && event.status === "completed"),
    ).toBe(true);
    expect((await sessions.list()).map((session) => session.id)).toContain(saved.id);

    const nextWorkout = retainedEvents.find((event) => event.status === "scheduled")!;
    await fitness.updateEvent(nextWorkout.id, { date: today, note: "Take it easy" });
    expect(await fitness.getEvent(nextWorkout.id)).toMatchObject({
      date: today,
      note: "Take it easy",
    });
    expect(await fitness.listEvents(tomorrowKey, tomorrowKey)).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "rest", status: "rest" })]),
    );
    await fitness.updateEvent(nextWorkout.id, { status: "skipped" });
    await expect(fitness.updateEvent(nextWorkout.id, { date: tomorrowKey })).rejects.toThrow(
      "Only scheduled workouts",
    );
  });

  it("synchronizes cancelled planned sessions as skipped calendar history", async () => {
    const { fitness, sessions } = await makeRepositories();
    const today = dayKey(new Date());
    const routine = getRoutine("gentle-start")!;
    await fitness.activatePlan("Plan", preferences(today, today), [
      { date: today, type: "workout", status: "scheduled", routine },
    ]);
    const event = (await fitness.listEvents(today, today))[0]!;
    const now = new Date().toISOString();
    const session = await sessions.save({
      routineId: event.routineId!,
      routineName: event.routineName,
      startedAt: now,
      completedAt: now,
      durationSeconds: 15,
      exercisesCompleted: 0,
      totalExercises: 5,
      status: "cancelled",
    });
    expect(await fitness.getEvent(event.id)).toMatchObject({
      status: "skipped",
      sourceSessionId: session.id,
    });
  });

  it("creates, edits, deletes and displays weights using an optional goal and recurring reminders", async () => {
    const { fitness } = await makeRepositories();
    const entry = await fitness.saveWeight({
      date: "2026-10-17",
      weightKg: 70,
      note: "Morning",
    });
    await fitness.saveWeight(
      { ...entry, weightKg: convertWeight(150, "lb", "kg"), note: "Updated" },
      entry.id,
    );
    expect(await fitness.getWeights()).toMatchObject([
      { id: entry.id, weightKg: expect.any(Number), note: "Updated" },
    ]);
    expect((await fitness.getWeights())[0]?.weightKg).toBeCloseTo(68.0389, 3);
    await expect(
      fitness.saveWeight({ date: "2026-02-30", weightKg: 70, note: "" }),
    ).rejects.toThrow("valid measurement date");
    await fitness.saveWeightSettings({ unit: "lb", goalKg: null });
    expect(await fitness.getWeightSettings()).toEqual({ unit: "lb", goalKg: null });
    await fitness.saveRecurringReminder({
      enabled: true,
      weekdays: [1, 3, 5],
      time: "08:30",
      quietHoursStart: "22:00",
      quietHoursEnd: "07:00",
    });
    expect(await fitness.getRecurringReminder()).toEqual({
      enabled: true,
      weekdays: [1, 3, 5],
      time: "08:30",
      quietHoursStart: "22:00",
      quietHoursEnd: "07:00",
    });
    await expect(
      fitness.saveRecurringReminder({
        enabled: true,
        weekdays: [],
        time: "08:30",
        quietHoursStart: "22:00",
        quietHoursEnd: "07:00",
      }),
    ).rejects.toThrow("at least one reminder day");
    await fitness.deleteWeight(entry.id);
    expect(await fitness.getWeights()).toEqual([]);
  });
});
