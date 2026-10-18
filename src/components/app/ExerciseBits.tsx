import { Link } from "@tanstack/react-router";
import { Activity, ChevronRight, Flame, Footprints, HandMetal, Wind } from "lucide-react";
import { ACTIVITY_LABELS } from "@/lib/data/exercises";
import type {
  Difficulty,
  Exercise,
  ExerciseCategory,
  ExerciseTarget,
  WorkoutSession,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const CATEGORY_STYLE: Record<ExerciseCategory, { icon: typeof Activity; className: string }> = {
  "lower-body": { icon: Footprints, className: "bg-primary-soft text-primary" },
  "upper-body": { icon: HandMetal, className: "bg-sky text-sky-foreground" },
  core: { icon: Activity, className: "bg-sun text-sun-foreground" },
  cardio: { icon: Flame, className: "bg-primary-soft text-primary" },
  mobility: { icon: Wind, className: "bg-secondary text-secondary-foreground" },
};

export function CategoryIcon({
  category,
  size = "md",
}: {
  category: ExerciseCategory;
  size?: "md" | "lg";
}) {
  const { icon: Icon, className } = CATEGORY_STYLE[category];
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-2xl",
        size === "lg" ? "h-20 w-20 [&_svg]:h-10 [&_svg]:w-10" : "h-12 w-12 [&_svg]:h-6 [&_svg]:w-6",
        className,
      )}
    >
      <Icon />
    </span>
  );
}

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 text-xs font-bold",
        difficulty === "beginner"
          ? "bg-secondary text-secondary-foreground"
          : difficulty === "intermediate"
            ? "bg-sun text-sun-foreground"
            : "bg-primary-soft text-primary",
      )}
    >
      {difficulty === "beginner"
        ? "Beginner"
        : difficulty === "intermediate"
          ? "Intermediate"
          : "Advanced"}
    </span>
  );
}

export function formatTarget(t: ExerciseTarget) {
  return t.kind === "time" ? `${t.seconds} sec` : `${t.reps} reps`;
}

export function ExerciseCard({ exercise }: { exercise: Exercise }) {
  return (
    <Link
      to="/exercise/$exerciseId"
      params={{ exerciseId: exercise.id }}
      className="flex items-center gap-3 rounded-3xl bg-card p-3 shadow-soft transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <CategoryIcon category={exercise.category} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">{exercise.name}</p>
        <p className="text-xs text-muted-foreground">
          {ACTIVITY_LABELS[exercise.activity ?? "bodyweight-strength"]} ·{" "}
          {formatTarget(exercise.target)}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {(exercise.targetAreas ?? exercise.muscles).join(", ")} ·{" "}
          {exercise.equipment?.includes("none") ? "No equipment" : "Support needed"}
        </p>
      </div>
      <DifficultyBadge difficulty={exercise.difficulty} />
      <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
    </Link>
  );
}

export function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m} min ${s.toString().padStart(2, "0")} s` : `${s} s`;
}

export function SessionRow({ session }: { session: WorkoutSession }) {
  const date = new Date(session.completedAt);
  const statusLabel =
    session.status === "completed"
      ? "Completed"
      : session.status === "cancelled"
        ? "Cancelled"
        : `${session.exercisesCompleted}/${session.totalExercises} moves`;
  return (
    <li className="flex items-center justify-between rounded-2xl bg-card px-4 py-3 shadow-soft">
      <div>
        <p className="font-bold">{session.routineName}</p>
        <p className="text-xs text-muted-foreground">
          {date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}{" "}
          · {date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold">{formatDuration(session.durationSeconds)}</p>
        <p
          className={cn(
            "text-xs font-bold",
            session.status === "completed" ? "text-success" : "text-muted-foreground",
          )}
        >
          {statusLabel}
        </p>
      </div>
    </li>
  );
}
