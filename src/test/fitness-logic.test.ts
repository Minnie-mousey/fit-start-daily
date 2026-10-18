import { describe, expect, it } from "vitest";
import initSqlJs from "sql.js";
import { resolve } from "node:path";
import { EXERCISES, filterExercises, getRoutine } from "@/lib/data/exercises";
import { runMigrations } from "@/lib/db/database";
import { MIGRATIONS } from "@/lib/db/schema";
import { SqliteWorkoutSessionRepository } from "@/lib/repositories/workoutSessionRepository";
import { computeStats, computeStreak } from "@/lib/services/stats";
import { completeWorkout, type CompleteWorkoutInput } from "@/lib/services/workoutCompletion";
import { buildSteps, initialPlayerState, playerReducer } from "@/lib/services/workoutPlayer";
import type { WorkoutSessionRepository } from "@/lib/repositories/workoutSessionRepository";
import type { NewWorkoutSession, WorkoutSession } from "@/lib/types";

const session = (completedAt: string, durationSeconds = 300): WorkoutSession => ({
  id: completedAt,
  routineId: "r",
  routineName: "R",
  startedAt: completedAt,
  completedAt,
  durationSeconds,
  exercisesCompleted: 1,
  totalExercises: 1,
  status: "completed",
});

describe("exercise filtering", () => {
  const sample = {
    id: "chair-squat",
    name: "Chair Squat",
    category: "lower-body" as const,
    activity: "bodyweight-strength" as const,
    difficulty: "beginner" as const,
    muscles: ["Legs"],
    targetAreas: ["Knees", "Legs"],
    equipment: ["chair"],
    summary: "A controlled squat to a chair.",
    steps: ["Stand in front of the chair."],
    tips: [],
    safetyNotes: ["Use a stable chair."],
    easier: "Use a higher seat.",
    harder: "Pause before standing.",
    alternatives: ["Supported squat"],
    target: { kind: "reps" as const, reps: 8 },
  };

  it("combines search, activity, difficulty, target-area, and equipment filters", () => {
    expect(
      filterExercises([sample], {
        query: "controlled",
        activity: "bodyweight-strength",
        difficulty: "beginner",
        targetArea: "Knees",
        equipment: "chair",
      }),
    ).toEqual([sample]);
  });

  it("matches target areas and excludes mismatched equipment", () => {
    expect(filterExercises([sample], { query: "knees", equipment: "none" })).toEqual([]);
    expect(filterExercises([sample], { targetArea: "Shoulders" })).toEqual([]);
  });

  it("includes the requested exercise activity groups", () => {
    expect(EXERCISES.length).toBeGreaterThanOrEqual(40);
    expect(new Set(EXERCISES.map((exercise) => exercise.activity))).toEqual(
      new Set([
        "low-impact-cardio",
        "bodyweight-strength",
        "yoga",
        "flexibility",
        "stairs",
        "recovery",
      ]),
    );
  });
});

describe("stats", () => {
  const now = new Date(2026, 9, 17, 12);
  it("counts consecutive days ending today", () => {
    const s = [15, 16, 17].map((d) => session(new Date(2026, 9, d, 9).toISOString()));
    expect(computeStreak(s, now)).toBe(3);
  });
  it("keeps the streak if last workout was yesterday", () => {
    const s = [15, 16].map((d) => session(new Date(2026, 9, d, 9).toISOString()));
    expect(computeStreak(s, now)).toBe(2);
  });
  it("breaks the streak after a missed day", () => {
    expect(computeStreak([session(new Date(2026, 9, 14).toISOString())], now)).toBe(0);
  });
  it("sums minutes", () => {
    expect(
      computeStats([session(now.toISOString(), 90), session(now.toISOString(), 150)], now)
        .totalMinutes,
    ).toBe(4);
  });
  it("excludes cancelled sessions from totals and streaks", () => {
    const cancelled = { ...session(now.toISOString()), status: "cancelled" as const };
    expect(computeStats([cancelled], now).totalWorkouts).toBe(0);
    expect(computeStreak([cancelled], now)).toBe(0);
  });
});

describe("workout player", () => {
  const routine = getRoutine("gentle-start")!;
  const steps = buildSteps(routine, { durationMinutes: 5 });
  const reduce = playerReducer(steps);

  it("adds a warm-up and rests between work intervals but not after the last", () => {
    expect(steps[0]?.type).toBe("warmup");
    expect(steps.filter((s) => s.type === "work")).toHaveLength(5);
    expect(steps.filter((s) => s.type === "rest")).toHaveLength(4);
    expect(steps.at(-1)?.type).toBe("work");
  });
  it("keeps time fixed while paused and resumes from the saved time", () => {
    let state = reduce(initialPlayerState(steps), { type: "start", nowMs: 0 });
    state = reduce(state, { type: "pause", nowMs: 10_000 });
    expect(state.remaining).toBe(50);
    expect(reduce(state, { type: "sync", nowMs: 100_000 })).toEqual(state);
    state = reduce(state, { type: "resume", nowMs: 100_000 });
    state = reduce(state, { type: "sync", nowMs: 110_000 });
    expect(state.remaining).toBe(40);
  });
  it("reconciles suspended time from timestamps and advances elapsed intervals", () => {
    let state = reduce(initialPlayerState(steps), { type: "start", nowMs: 1_000 });
    state = reduce(state, { type: "sync", nowMs: 61_000 });
    expect(state.stepIndex).toBe(1);
    state = reduce(state, { type: "sync", nowMs: 106_000 });
    expect(state.stepIndex).toBe(2);
    expect(state.exercisesCompleted).toBe(1);
    expect(state.performance[0]).toMatchObject({ status: "completed", actualSeconds: 45 });
  });
  it("records actual reps when the user completes a repetition target", () => {
    const single = buildSteps(getRoutine("single-wall-push-up")!, { durationMinutes: 5 });
    const reduceSingle = playerReducer(single);
    let state = reduceSingle(initialPlayerState(single), { type: "start", nowMs: 0 });
    state = reduceSingle(state, { type: "sync", nowMs: 60_000 });
    state = reduceSingle(state, { type: "done", nowMs: 65_000, actualReps: 7 });
    expect(state.exercisesCompleted).toBe(1);
    expect(state.performance[0]).toMatchObject({ actualReps: 7, status: "completed" });
  });
  it("records elapsed work as skipped when cancelled", () => {
    let state = reduce(initialPlayerState(steps), { type: "start", nowMs: 0 });
    state = reduce(state, { type: "sync", nowMs: 60_000 });
    state = reduce(state, { type: "sync", nowMs: 70_000 });
    state = reduce(state, { type: "cancel", nowMs: 75_000 });
    expect(state.status).toBe("cancelled");
    expect(state.exercisesCompleted).toBe(0);
    expect(state.performance[0]).toMatchObject({ status: "skipped", actualSeconds: 15 });
  });
  it("builds longer plans and a reduced-intensity modification", () => {
    const short = buildSteps(routine, { durationMinutes: 5 });
    const long = buildSteps(routine, { durationMinutes: 10 });
    expect(long.filter((step) => step.type === "work").length).toBeGreaterThan(
      short.filter((step) => step.type === "work").length,
    );
    const reduced = buildSteps(getRoutine("single-wall-push-up")!, {
      durationMinutes: 5,
      reducedIntensity: true,
    });
    expect(reduced.find((step) => step.type === "work")).toMatchObject({
      adaptation: "Stand closer to the wall.",
      target: { kind: "reps", reps: 8 },
    });
  });
  it("finishes only after each work item is completed", () => {
    let state = reduce(initialPlayerState(steps), { type: "start", nowMs: 0 });
    let nowMs = 0;
    while (state.status === "running") {
      const current = steps[state.stepIndex];
      if (!current) break;
      if (current.type === "work" && current.target.kind === "reps") {
        state = reduce(state, { type: "done", nowMs, actualReps: current.target.reps });
      } else {
        const seconds =
          current.type === "rest"
            ? current.seconds
            : current.target.kind === "time"
              ? current.target.seconds
              : 0;
        nowMs += seconds * 1000;
        state = reduce(state, { type: "sync", nowMs });
      }
    }
    expect(state.status).toBe("finished");
    expect(state.exercisesCompleted).toBe(5);
    expect(state.performance).toHaveLength(5);
  });
});

describe("completeWorkout", () => {
  const repo = (): WorkoutSessionRepository & {
    saved: NewWorkoutSession[];
    savedPerformance: NonNullable<CompleteWorkoutInput["performance"]>;
  } => {
    const saved: NewWorkoutSession[] = [];
    const savedPerformance: NonNullable<CompleteWorkoutInput["performance"]> = [];
    return {
      saved,
      savedPerformance,
      save: async (entry, performance = []) => (
        saved.push(entry),
        savedPerformance.push(...performance),
        { id: "1", ...entry }
      ),
      list: async () => [],
      listPerformance: async () => savedPerformance,
      clearAll: async () => {},
    };
  };
  const base = {
    routineId: "r",
    routineName: "R",
    startedAt: new Date(),
    completedAt: new Date(),
    activeSeconds: 60,
    totalExercises: 5,
  };

  it("marks partial sessions", async () => {
    const r = repo();
    expect((await completeWorkout(r, { ...base, exercisesCompleted: 3 })).status).toBe("partial");
  });
  it("persists a zero-exercise cancellation as cancelled", async () => {
    const r = repo();
    const saved = await completeWorkout(r, {
      ...base,
      exercisesCompleted: 0,
      outcome: "cancelled",
    });
    expect(saved.status).toBe("cancelled");
    expect(r.saved[0]?.status).toBe("cancelled");
  });
  it("never labels an incomplete session as completed", async () => {
    const saved = await completeWorkout(repo(), {
      ...base,
      exercisesCompleted: 2,
      outcome: "completed",
    });
    expect(saved.status).toBe("partial");
  });
  it("refuses to save with zero exercises done", async () => {
    await expect(completeWorkout(repo(), { ...base, exercisesCompleted: 0 })).rejects.toThrow();
  });
});

describe("SQLite workout persistence", () => {
  it("migrates existing sessions and round-trips cancellation performance", async () => {
    const SQL = await initSqlJs({
      locateFile: (file) => resolve(process.cwd(), "node_modules/sql.js/dist", file),
    });
    const db = new SQL.Database();
    db.exec(MIGRATIONS[0]!.sql);
    db.exec("PRAGMA user_version = 1;");
    db.run(`INSERT INTO workout_sessions VALUES (?,?,?,?,?,?,?,?,?,?)`, [
      "previous",
      "old-routine",
      "Old routine",
      "2026-10-16T00:00:00.000Z",
      "2026-10-16T00:05:00.000Z",
      300,
      2,
      2,
      "completed",
      "2026-10-16T00:05:00.000Z",
    ]);
    expect(runMigrations(db)).toBe(true);
    let persistCalls = 0;
    const repository = new SqliteWorkoutSessionRepository(db, async () => {
      persistCalls += 1;
    });
    const performance = [
      {
        sequence: 0,
        exerciseId: "march-in-place",
        exerciseName: "March in Place",
        target: { kind: "time" as const, seconds: 30 },
        actualReps: null,
        actualSeconds: 12,
        status: "skipped" as const,
      },
    ];
    const saved = await repository.save(
      {
        routineId: "new-routine",
        routineName: "New routine",
        startedAt: "2026-10-17T00:00:00.000Z",
        completedAt: "2026-10-17T00:00:12.000Z",
        durationSeconds: 12,
        exercisesCompleted: 0,
        totalExercises: 3,
        status: "cancelled",
      },
      performance,
    );

    expect((await repository.list()).map((item) => item.status)).toContain("completed");
    expect((await repository.list()).map((item) => item.status)).toContain("cancelled");
    expect(await repository.listPerformance(saved.id)).toEqual(performance);
    expect(persistCalls).toBe(1);
  });
});
