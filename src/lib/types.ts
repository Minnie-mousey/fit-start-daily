export type Difficulty = "beginner" | "intermediate";
export type ExerciseCategory = "lower-body" | "upper-body" | "core" | "cardio" | "mobility";

export type ExerciseTarget = { kind: "time"; seconds: number } | { kind: "reps"; reps: number };

export interface Exercise {
  id: string;
  name: string;
  category: ExerciseCategory;
  difficulty: Difficulty;
  muscles: string[];
  summary: string;
  steps: string[];
  tips: string[];
  easier: string;
  harder: string;
  target: ExerciseTarget;
}

export interface RoutineItem {
  exerciseId: string;
  target?: ExerciseTarget;
}

export interface Routine {
  id: string;
  name: string;
  description: string;
  restSeconds: number;
  items: RoutineItem[];
}

export type SessionStatus = "completed" | "partial";

export interface WorkoutSession {
  id: string;
  routineId: string;
  routineName: string;
  startedAt: string; // ISO
  completedAt: string; // ISO
  durationSeconds: number;
  exercisesCompleted: number;
  totalExercises: number;
  status: SessionStatus;
}

export type NewWorkoutSession = Omit<WorkoutSession, "id">;

export interface WorkoutStats {
  totalWorkouts: number;
  totalMinutes: number;
  currentStreak: number;
  thisWeek: number;
}
