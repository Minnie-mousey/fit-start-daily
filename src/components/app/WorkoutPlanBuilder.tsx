import { useState, type FormEvent } from "react";
import { Check, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel, SectionTitle } from "@/components/app/Page";
import { EXERCISES, ACTIVITY_LABELS } from "@/lib/data/exercises";
import { useActivateWorkoutPlan, useActiveWorkoutPlan } from "@/hooks/use-fitness";
import {
  generateWorkoutPlan,
  type GeneratedPlanEvent,
  type GeneratedWorkoutPlan,
} from "@/lib/services/trainingPlan";
import type {
  ExerciseActivity,
  FitnessGoal,
  FitnessLevel,
  RecoveryPreference,
  WorkoutPlanPreferences,
} from "@/lib/types";

const ACTIVITIES = Object.keys(ACTIVITY_LABELS) as ExerciseActivity[];
const LIMITATIONS = ["knees", "back", "shoulders", "hips", "wrists"];
const GOALS: { value: FitnessGoal; label: string }[] = [
  { value: "general-fitness", label: "General fitness" },
  { value: "strength", label: "Build strength" },
  { value: "endurance", label: "Improve endurance" },
  { value: "flexibility", label: "Flexibility" },
  { value: "weight-loss", label: "Weight management" },
];

function localDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function defaultPreferences(): WorkoutPlanPreferences {
  const start = new Date();
  const target = new Date(start);
  target.setDate(target.getDate() + 41);
  return {
    goal: "general-fitness",
    level: "beginner",
    availableMinutes: 20,
    preferredActivities: ["low-impact-cardio", "bodyweight-strength"],
    weeklyFrequency: 3,
    startDate: localDate(start),
    targetDate: localDate(target),
    recoveryPreference: "balanced",
    movementLimitations: [],
  };
}

export function WorkoutPlanBuilder() {
  const activePlan = useActiveWorkoutPlan();
  const activate = useActivateWorkoutPlan();
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [draft, setDraft] = useState<GeneratedWorkoutPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = () => {
    try {
      setDraft(generateWorkoutPlan(preferences));
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create this plan");
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    generate();
  };

  const toggle = <T extends string>(values: T[], value: T): T[] =>
    values.includes(value) ? values.filter((item) => item !== value) : [...values, value];

  const editExercise = (date: string, index: number, exerciseId: string) => {
    const replacement = EXERCISES.find((exercise) => exercise.id === exerciseId);
    if (!replacement) return;
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        events: current.events.map((event) => {
          if (event.date !== date || !event.routine) return event;
          return {
            ...event,
            routine: {
              ...event.routine,
              items: event.routine.items.map((item, itemIndex) =>
                itemIndex !== index
                  ? item
                  : {
                      ...item,
                      exerciseId,
                      ...(item.section === "main" ? { target: replacement.target } : {}),
                    },
              ),
            },
          };
        }),
      };
    });
  };

  const workouts = draft?.events.filter((event) => event.type === "workout") ?? [];
  const renderWorkout = (event: GeneratedPlanEvent) => (
    <PreviewWorkout
      key={event.date}
      event={event}
      onEdit={(index, exerciseId) => editExercise(event.date, index, exerciseId)}
    />
  );

  return (
    <>
      <SectionTitle>Make it your plan</SectionTitle>
      <Panel>
        {activePlan.data && (
          <p className="mb-4 flex items-center gap-2 rounded-xl bg-secondary p-3 text-sm">
            <Check className="h-4 w-4 shrink-0" aria-hidden />
            Active plan: <strong className="capitalize">{activePlan.data.name}</strong>
          </p>
        )}
        {activePlan.isError && (
          <p role="alert" className="mb-3 text-sm font-bold text-destructive">
            {activePlan.error.message}
          </p>
        )}
        <form onSubmit={submit} className="grid gap-4">
          <label className="grid gap-1 text-sm font-bold">
            Fitness goal
            <select
              value={preferences.goal}
              onChange={(event) =>
                setPreferences({ ...preferences, goal: event.target.value as FitnessGoal })
              }
              className="h-11 rounded-xl border border-border bg-background px-3 font-normal"
            >
              {GOALS.map((goal) => (
                <option key={goal.value} value={goal.value}>
                  {goal.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-bold">
            Experience level
            <select
              value={preferences.level}
              onChange={(event) =>
                setPreferences({ ...preferences, level: event.target.value as FitnessLevel })
              }
              className="h-11 rounded-xl border border-border bg-background px-3 font-normal"
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-bold">
            Time per workout
            <select
              value={preferences.availableMinutes}
              onChange={(event) =>
                setPreferences({ ...preferences, availableMinutes: Number(event.target.value) })
              }
              className="h-11 rounded-xl border border-border bg-background px-3 font-normal"
            >
              {[10, 15, 20, 30, 45, 60].map((minutes) => (
                <option value={minutes} key={minutes}>
                  {minutes} minutes
                </option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend className="text-sm font-bold">Preferred activities</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {ACTIVITIES.map((activity) => (
                <label
                  key={activity}
                  className="flex items-center gap-2 rounded-xl bg-background p-2 text-xs"
                >
                  <input
                    type="checkbox"
                    checked={preferences.preferredActivities.includes(activity)}
                    onChange={() =>
                      setPreferences({
                        ...preferences,
                        preferredActivities: toggle(preferences.preferredActivities, activity),
                      })
                    }
                  />
                  {ACTIVITY_LABELS[activity]}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="grid gap-1 text-sm font-bold">
            Workouts each week
            <select
              value={preferences.weeklyFrequency}
              onChange={(event) =>
                setPreferences({ ...preferences, weeklyFrequency: Number(event.target.value) })
              }
              className="h-11 rounded-xl border border-border bg-background px-3 font-normal"
            >
              {[2, 3, 4, 5, 6].map((days) => (
                <option value={days} key={days}>
                  {days} days per week
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1 text-sm font-bold">
              Start date
              <input
                type="date"
                value={preferences.startDate}
                onChange={(event) =>
                  setPreferences({ ...preferences, startDate: event.target.value })
                }
                className="h-11 min-w-0 rounded-xl border border-border bg-background px-2 font-normal"
              />
            </label>
            <label className="grid gap-1 text-sm font-bold">
              Target date
              <input
                type="date"
                min={preferences.startDate}
                value={preferences.targetDate}
                onChange={(event) =>
                  setPreferences({ ...preferences, targetDate: event.target.value })
                }
                className="h-11 min-w-0 rounded-xl border border-border bg-background px-2 font-normal"
              />
            </label>
          </div>
          <label className="grid gap-1 text-sm font-bold">
            Recovery preference
            <select
              value={preferences.recoveryPreference}
              onChange={(event) =>
                setPreferences({
                  ...preferences,
                  recoveryPreference: event.target.value as RecoveryPreference,
                })
              }
              className="h-11 rounded-xl border border-border bg-background px-3 font-normal"
            >
              <option value="balanced">Balanced recovery</option>
              <option value="gentle">Gentle pace, longer rests</option>
              <option value="extra-rest">Extra recovery days</option>
            </select>
          </label>
          <fieldset>
            <legend className="text-sm font-bold">Movement limitations to avoid</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {LIMITATIONS.map((limitation) => (
                <label
                  key={limitation}
                  className="flex items-center gap-2 rounded-full bg-background px-3 py-2 text-sm capitalize"
                >
                  <input
                    type="checkbox"
                    checked={preferences.movementLimitations.includes(limitation)}
                    onChange={() =>
                      setPreferences({
                        ...preferences,
                        movementLimitations: toggle(preferences.movementLimitations, limitation),
                      })
                    }
                  />
                  {limitation}
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Exercise modifications can’t replace advice from a qualified health professional.
            </p>
          </fieldset>
          <Button type="submit" variant="hero">
            <Sparkles aria-hidden /> Preview plan
          </Button>
        </form>

        {error && (
          <p className="mt-3 text-sm font-bold text-destructive" role="alert">
            {error}
          </p>
        )}
        {draft && (
          <section className="mt-5 border-t border-border pt-4" aria-label="Plan preview">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-xl font-semibold capitalize">{draft.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {workouts.length} workouts · {draft.events.length - workouts.length} recovery days
                </p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={generate}>
                <RefreshCw aria-hidden /> Regenerate
              </Button>
            </div>
            <div className="mt-3 space-y-2">
              {workouts.slice(0, 8).map(renderWorkout)}
              {workouts.length > 8 && (
                <details className="rounded-xl bg-background p-3">
                  <summary className="cursor-pointer text-sm font-bold">
                    View and edit the remaining {workouts.length - 8} workouts
                  </summary>
                  <div className="mt-3 space-y-2">{workouts.slice(8).map(renderWorkout)}</div>
                </details>
              )}
            </div>
            <Button
              type="button"
              variant="hero"
              className="mt-4 w-full"
              disabled={activate.isPending}
              onClick={() =>
                activate.mutate(
                  { name: draft.name, preferences: draft.preferences, events: draft.events },
                  { onSuccess: () => setDraft(null) },
                )
              }
            >
              {activate.isPending ? "Activating…" : "Activate this plan"}
            </Button>
            {activate.isError && (
              <p role="alert" className="mt-2 text-sm font-bold text-destructive">
                {activate.error.message}
              </p>
            )}
          </section>
        )}
      </Panel>
    </>
  );
}

function PreviewWorkout({
  event,
  onEdit,
}: {
  event: GeneratedPlanEvent;
  onEdit: (index: number, exerciseId: string) => void;
}) {
  return (
    <div className="rounded-xl bg-background p-3">
      <p className="mb-2 text-sm font-bold">
        {new Date(`${event.date}T12:00:00`).toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
        })}
      </p>
      <div className="space-y-2">
        {event.routine?.items.map((item, index) => (
          <label
            key={`${event.date}-${index}`}
            className="grid grid-cols-[5rem_1fr] items-center gap-2 text-xs"
          >
            <span className="capitalize text-muted-foreground">{item.section}</span>
            <select
              value={item.exerciseId}
              onChange={(change) => onEdit(index, change.target.value)}
              className="h-9 min-w-0 rounded-lg border border-border bg-card px-2"
              aria-label={`Edit ${item.section} exercise`}
            >
              {EXERCISES.map((exercise) => (
                <option key={exercise.id} value={exercise.id}>
                  {exercise.name}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </div>
  );
}
