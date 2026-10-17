import type { WorkoutSessionRepository } from "@/lib/repositories/workoutSessionRepository";
import type { WorkoutSession } from "@/lib/types";

export interface CompleteWorkoutInput {
  routineId: string;
  routineName: string;
  startedAt: Date;
  completedAt: Date;
  activeSeconds: number;
  exercisesCompleted: number;
  totalExercises: number;
}

/**
 * The single entry point for finishing a workout. Future rewards (XP, streak
 * bonuses, achievements) hook in here so every completion path is consistent.
 */
export async function completeWorkout(
  repo: WorkoutSessionRepository,
  input: CompleteWorkoutInput,
): Promise<WorkoutSession> {
  if (input.totalExercises <= 0) throw new Error("Workout has no exercises");
  if (input.exercisesCompleted <= 0) throw new Error("Complete at least one exercise to save");
  const done = Math.min(input.exercisesCompleted, input.totalExercises);
  return repo.save({
    routineId: input.routineId,
    routineName: input.routineName,
    startedAt: input.startedAt.toISOString(),
    completedAt: input.completedAt.toISOString(),
    durationSeconds: Math.max(0, Math.round(input.activeSeconds)),
    exercisesCompleted: done,
    totalExercises: input.totalExercises,
    status: done === input.totalExercises ? "completed" : "partial",
  });
}
