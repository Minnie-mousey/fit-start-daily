import { describe, expect, it } from "vitest";
import { getRoutine } from "@/lib/data/exercises";
import { computeStats, computeStreak } from "@/lib/services/stats";
import { completeWorkout } from "@/lib/services/workoutCompletion";
import { buildSteps, initialPlayerState, playerReducer } from "@/lib/services/workoutPlayer";
import type { WorkoutSessionRepository } from "@/lib/repositories/workoutSessionRepository";
import type { NewWorkoutSession, WorkoutSession } from "@/lib/types";

const session = (completedAt: string, durationSeconds = 300): WorkoutSession => ({
  id: completedAt, routineId: "r", routineName: "R", startedAt: completedAt, completedAt,
  durationSeconds, exercisesCompleted: 1, totalExercises: 1, status: "completed",
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
    expect(computeStats([session(now.toISOString(), 90), session(now.toISOString(), 150)], now).totalMinutes).toBe(4);
  });
});

describe("workout player", () => {
  const routine = getRoutine("gentle-start")!;
  const steps = buildSteps(routine);
  const reduce = playerReducer(steps);

  it("adds rest between exercises but not after the last", () => {
    expect(steps.filter((s) => s.type === "work")).toHaveLength(5);
    expect(steps.filter((s) => s.type === "rest")).toHaveLength(4);
    expect(steps.at(-1)?.type).toBe("work");
  });
  it("does not tick while paused", () => {
    let s = reduce(initialPlayerState(steps), { type: "start" });
    s = reduce(s, { type: "pause" });
    expect(reduce(s, { type: "tick" })).toEqual(s);
  });
  it("auto-advances a timed step when it reaches zero", () => {
    let s = reduce(initialPlayerState(steps), { type: "start" });
    for (let i = 0; i < 45; i++) s = reduce(s, { type: "tick" });
    expect(s.stepIndex).toBe(1);
    expect(s.exercisesCompleted).toBe(1);
  });
  it("finishes after the last step", () => {
    let s = reduce(initialPlayerState(steps), { type: "start" });
    for (let i = 0; i < steps.length; i++) s = reduce(s, { type: "next" });
    expect(s.status).toBe("finished");
    expect(s.exercisesCompleted).toBe(5);
  });
});

describe("completeWorkout", () => {
  const repo = (): WorkoutSessionRepository & { saved: NewWorkoutSession[] } => {
    const saved: NewWorkoutSession[] = [];
    return { saved, save: async (s) => (saved.push(s), { id: "1", ...s }), list: async () => [], clearAll: async () => {} };
  };
  const base = { routineId: "r", routineName: "R", startedAt: new Date(), completedAt: new Date(), activeSeconds: 60, totalExercises: 5 };

  it("marks partial sessions", async () => {
    const r = repo();
    expect((await completeWorkout(r, { ...base, exercisesCompleted: 3 })).status).toBe("partial");
  });
  it("refuses to save with zero exercises done", async () => {
    await expect(completeWorkout(repo(), { ...base, exercisesCompleted: 0 })).rejects.toThrow();
  });
});
