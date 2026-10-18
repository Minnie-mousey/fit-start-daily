import { EXERCISES, getExercise } from "@/lib/data/exercises";
import type { Exercise, ExercisePerformance, ExerciseTarget, Routine } from "@/lib/types";

export type PlayerStep =
  | { type: "warmup"; exercise: Exercise; target: ExerciseTarget }
  | {
      type: "work";
      exercise: Exercise;
      target: ExerciseTarget;
      exerciseIndex: number;
      section?: "main" | "cooldown";
      adaptation?: string;
    }
  | { type: "rest"; seconds: number; next: Exercise };

export interface BuildStepsOptions {
  durationMinutes?: number;
  reducedIntensity?: boolean;
}

function lighterAlternative(exercise: Exercise): { exercise: Exercise; adaptation: string } {
  const alternative = exercise.alternatives?.find((name) =>
    EXERCISES.some((candidate) => candidate.name.toLowerCase() === name.toLowerCase()),
  );
  const match =
    alternative &&
    EXERCISES.find((candidate) => candidate.name.toLowerCase() === alternative.toLowerCase());
  if (match)
    return { exercise: match, adaptation: `Lower-intensity alternative to ${exercise.name}` };
  return { exercise, adaptation: exercise.easier };
}

function lowerTarget(target: ExerciseTarget): ExerciseTarget {
  return target.kind === "time"
    ? { kind: "time", seconds: Math.max(20, Math.round(target.seconds * 0.75)) }
    : { kind: "reps", reps: Math.max(4, Math.ceil(target.reps * 0.75)) };
}

function estimateTargetSeconds(target: ExerciseTarget): number {
  return target.kind === "time" ? target.seconds : target.reps * 4;
}

export function buildSteps(routine: Routine, options: BuildStepsOptions = {}): PlayerStep[] {
  const baseExercises: {
    exercise: Exercise;
    target: ExerciseTarget;
    section: "warmup" | "main" | "cooldown";
    adaptation?: string;
  }[] = routine.items.flatMap((item) => {
    const exercise = getExercise(item.exerciseId);
    if (!exercise) return [];
    const originalTarget = item.target ?? exercise.target;
    const section = item.section ?? "main";
    if (!options.reducedIntensity) return [{ exercise, target: originalTarget, section }];
    const alternative = lighterAlternative(exercise);
    const target = lowerTarget(
      alternative.exercise === exercise ? originalTarget : alternative.exercise.target,
    );
    return [
      { exercise: alternative.exercise, target, section, adaptation: alternative.adaptation },
    ];
  });
  const warmupExercise = getExercise("march-in-place");
  const warmups = baseExercises.filter((item) => item.section === "warmup");
  const mainExercises = baseExercises.filter((item) => item.section === "main");
  const cooldowns = baseExercises.filter((item) => item.section === "cooldown");
  if ((!warmupExercise && warmups.length === 0) || mainExercises.length === 0) return [];

  const durationSeconds = Math.max(1, options.durationMinutes ?? 10) * 60;
  const planned = [...mainExercises];
  let estimate =
    60 +
    warmups.length * 30 +
    cooldowns.length * 30 +
    planned.reduce((sum, item) => sum + estimateTargetSeconds(item.target), 0);
  estimate += Math.max(0, planned.length - 1) * routine.restSeconds;
  while (estimate < durationSeconds * 0.9 && planned.length < 100) {
    planned.push(...mainExercises);
    estimate += mainExercises.reduce((sum, item) => sum + estimateTargetSeconds(item.target), 0);
    estimate += mainExercises.length * routine.restSeconds;
  }

  const steps: PlayerStep[] = warmups.length
    ? warmups.map((item) => ({
        type: "warmup" as const,
        exercise: item.exercise,
        target: {
          kind: "time" as const,
          seconds: item.target.kind === "time" ? item.target.seconds : 30,
        },
      }))
    : warmupExercise
      ? [{ type: "warmup", exercise: warmupExercise, target: { kind: "time", seconds: 60 } }]
      : [];
  const workSequence = [...planned, ...cooldowns];
  workSequence.forEach((item, index) => {
    steps.push({
      type: "work",
      exercise: item.exercise,
      target: item.target,
      exerciseIndex: index,
      section: item.section === "cooldown" ? "cooldown" : "main",
      ...(item.adaptation ? { adaptation: item.adaptation } : {}),
    });
    const next = workSequence[index + 1];
    if (next && routine.restSeconds > 0)
      steps.push({ type: "rest", seconds: routine.restSeconds, next: next.exercise });
  });
  return steps;
}

export type PlayerStatus = "ready" | "running" | "paused" | "finished" | "cancelled";

export interface PlayerState {
  status: PlayerStatus;
  stepIndex: number;
  /** Seconds left on a timed step; null for rep-based steps. */
  remaining: number | null;
  activeSeconds: number;
  exercisesCompleted: number;
  performance: ExercisePerformance[];
  lastUpdatedAt: number | null;
}

export type PlayerAction =
  | { type: "start"; nowMs: number }
  | { type: "pause"; nowMs: number }
  | { type: "resume"; nowMs: number }
  | { type: "sync"; nowMs: number }
  | { type: "done"; nowMs: number; actualReps: number }
  | { type: "skip"; nowMs: number }
  | { type: "cancel"; nowMs: number };

function stepDuration(step: PlayerStep | undefined): number | null {
  if (!step) return null;
  if (step.type === "rest") return step.seconds;
  return step.target.kind === "time" ? step.target.seconds : null;
}

export function initialPlayerState(steps: PlayerStep[]): PlayerState {
  return {
    status: "ready",
    stepIndex: 0,
    remaining: stepDuration(steps[0]),
    activeSeconds: 0,
    exercisesCompleted: 0,
    performance: [],
    lastUpdatedAt: null,
  };
}

function performanceFor(
  step: Extract<PlayerStep, { type: "work" }>,
  status: "completed" | "skipped",
  actualSeconds: number,
  actualReps: number | null,
): ExercisePerformance {
  return {
    sequence: step.exerciseIndex,
    exerciseId: step.exercise.id,
    exerciseName: step.exercise.name,
    target: step.target,
    actualReps,
    actualSeconds: Math.max(0, Math.round(actualSeconds)),
    status,
  };
}

function advance(
  state: PlayerState,
  steps: PlayerStep[],
  completion: "completed" | "skipped" | null,
  actualSeconds = 0,
  actualReps: number | null = null,
): PlayerState {
  const current = steps[state.stepIndex];
  const isCompletedWork = current?.type === "work" && completion === "completed";
  const performance =
    current?.type === "work" && completion
      ? [...state.performance, performanceFor(current, completion, actualSeconds, actualReps)]
      : state.performance;
  const nextIndex = state.stepIndex + 1;
  if (nextIndex >= steps.length) {
    return {
      ...state,
      status: "finished",
      stepIndex: nextIndex,
      remaining: null,
      performance,
      exercisesCompleted: state.exercisesCompleted + (isCompletedWork ? 1 : 0),
    };
  }
  return {
    ...state,
    stepIndex: nextIndex,
    remaining: stepDuration(steps[nextIndex]),
    performance,
    exercisesCompleted: state.exercisesCompleted + (isCompletedWork ? 1 : 0),
  };
}

function syncTime(state: PlayerState, steps: PlayerStep[], nowMs: number): PlayerState {
  if (state.status !== "running") return state;
  if (state.lastUpdatedAt === null) return { ...state, lastUpdatedAt: nowMs };
  const elapsed = Math.max(0, (nowMs - state.lastUpdatedAt) / 1000);
  let next: PlayerState = {
    ...state,
    activeSeconds: state.activeSeconds + elapsed,
    lastUpdatedAt: nowMs,
  };
  let unconsumed = elapsed;
  while (next.status === "running" && next.remaining !== null && unconsumed >= next.remaining) {
    const consumed = next.remaining;
    const current = steps[next.stepIndex];
    const completion = current?.type === "work" || current?.type === "warmup" ? "completed" : null;
    const actualReps =
      current?.type === "work" && current.target.kind === "reps" ? current.target.reps : null;
    next = advance(next, steps, completion, consumed, actualReps);
    unconsumed -= consumed;
    if (unconsumed <= 0 || next.remaining === null) break;
  }
  if (next.status === "running" && next.remaining !== null && unconsumed > 0) {
    next = { ...next, remaining: Math.max(0, next.remaining - unconsumed) };
  }
  return next;
}

export function playerReducer(steps: PlayerStep[]) {
  return (state: PlayerState, action: PlayerAction): PlayerState => {
    if (state.status === "finished" || state.status === "cancelled") return state;
    switch (action.type) {
      case "start":
        return state.status === "ready"
          ? { ...state, status: "running", lastUpdatedAt: action.nowMs }
          : state;
      case "resume":
        return state.status === "paused"
          ? { ...state, status: "running", lastUpdatedAt: action.nowMs }
          : state;
      case "sync":
        return syncTime(state, steps, action.nowMs);
      case "pause": {
        const synced = syncTime(state, steps, action.nowMs);
        return synced.status === "running"
          ? { ...synced, status: "paused", lastUpdatedAt: null }
          : synced;
      }
      case "done": {
        const synced = syncTime(state, steps, action.nowMs);
        const current = steps[synced.stepIndex];
        if (
          synced.status !== "running" ||
          current?.type !== "work" ||
          current.target.kind !== "reps"
        )
          return synced;
        const repsDone = Math.max(0, Math.min(current.target.reps, Math.round(action.actualReps)));
        const status = repsDone > 0 ? "completed" : "skipped";
        return advance(synced, steps, status, 0, repsDone);
      }
      case "skip": {
        const synced = syncTime(state, steps, action.nowMs);
        if (synced.status !== "running") return synced;
        const current = steps[synced.stepIndex];
        const actualSeconds =
          current?.type === "work" && current.target.kind === "time" && synced.remaining !== null
            ? Math.max(0, current.target.seconds - synced.remaining)
            : 0;
        return advance(
          synced,
          steps,
          current?.type === "work" ? "skipped" : null,
          actualSeconds,
          0,
        );
      }
      case "cancel": {
        const synced = syncTime(state, steps, action.nowMs);
        if (synced.status !== "running" && synced.status !== "paused" && synced.status !== "ready")
          return synced;
        const current = steps[synced.stepIndex];
        const actualSeconds =
          current?.type === "work" && current.target.kind === "time" && synced.remaining !== null
            ? Math.max(0, current.target.seconds - synced.remaining)
            : 0;
        const performance =
          current?.type === "work"
            ? [...synced.performance, performanceFor(current, "skipped", actualSeconds, 0)]
            : synced.performance;
        return {
          ...synced,
          status: "cancelled",
          remaining: null,
          lastUpdatedAt: null,
          performance,
        };
      }
    }
  };
}
