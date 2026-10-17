import { getExercise } from "@/lib/data/exercises";
import type { Exercise, ExerciseTarget, Routine } from "@/lib/types";

export type PlayerStep =
  | { type: "work"; exercise: Exercise; target: ExerciseTarget; exerciseIndex: number }
  | { type: "rest"; seconds: number; next: Exercise };

export function buildSteps(routine: Routine): PlayerStep[] {
  const steps: PlayerStep[] = [];
  const exercises = routine.items
    .map((item) => {
      const ex = getExercise(item.exerciseId);
      return ex ? { ex, target: item.target ?? ex.target } : null;
    })
    .filter((x): x is { ex: Exercise; target: ExerciseTarget } => x !== null);
  exercises.forEach(({ ex, target }, i) => {
    steps.push({ type: "work", exercise: ex, target, exerciseIndex: i });
    const next = exercises[i + 1];
    if (next && routine.restSeconds > 0) {
      steps.push({ type: "rest", seconds: routine.restSeconds, next: next.ex });
    }
  });
  return steps;
}

export type PlayerStatus = "ready" | "running" | "paused" | "finished";

export interface PlayerState {
  status: PlayerStatus;
  stepIndex: number;
  /** Seconds left on a timed step; null for rep-based steps. */
  remaining: number | null;
  activeSeconds: number;
  exercisesCompleted: number;
}

export type PlayerAction =
  | { type: "start" }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "tick" }
  | { type: "next" } // finish current step (reps done / skip rest)
  | { type: "end" }; // end early

function stepDuration(step: PlayerStep | undefined): number | null {
  if (!step) return null;
  if (step.type === "rest") return step.seconds;
  return step.target.kind === "time" ? step.target.seconds : null;
}

export function initialPlayerState(steps: PlayerStep[]): PlayerState {
  return { status: "ready", stepIndex: 0, remaining: stepDuration(steps[0]), activeSeconds: 0, exercisesCompleted: 0 };
}

function advance(state: PlayerState, steps: PlayerStep[]): PlayerState {
  const current = steps[state.stepIndex];
  const completed = state.exercisesCompleted + (current?.type === "work" ? 1 : 0);
  const nextIndex = state.stepIndex + 1;
  if (nextIndex >= steps.length) {
    return { ...state, status: "finished", exercisesCompleted: completed, remaining: null };
  }
  return { ...state, stepIndex: nextIndex, remaining: stepDuration(steps[nextIndex]), exercisesCompleted: completed };
}

export function playerReducer(steps: PlayerStep[]) {
  return (state: PlayerState, action: PlayerAction): PlayerState => {
    if (state.status === "finished") return state;
    switch (action.type) {
      case "start":
        return state.status === "ready" ? { ...state, status: "running" } : state;
      case "pause":
        return state.status === "running" ? { ...state, status: "paused" } : state;
      case "resume":
        return state.status === "paused" ? { ...state, status: "running" } : state;
      case "tick": {
        if (state.status !== "running") return state;
        const s = { ...state, activeSeconds: state.activeSeconds + 1 };
        if (s.remaining === null) return s;
        const remaining = s.remaining - 1;
        return remaining <= 0 ? advance({ ...s, remaining: 0 }, steps) : { ...s, remaining };
      }
      case "next":
        return state.status === "running" ? advance(state, steps) : state;
      case "end":
        return { ...state, status: "finished", remaining: null };
    }
  };
}
