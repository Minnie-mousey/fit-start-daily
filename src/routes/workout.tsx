import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Play, RotateCcw, Search } from "lucide-react";
import { Page, PageHeader, SectionTitle } from "@/components/app/Page";
import { EmptyState } from "@/components/app/States";
import { ExerciseCard } from "@/components/app/ExerciseBits";
import { Input } from "@/components/ui/input";
import {
  ACTIVITY_LABELS,
  estimateRoutineMinutes,
  EXERCISES,
  filterExercises,
  ROUTINES,
} from "@/lib/data/exercises";
import type { ExerciseFilters } from "@/lib/data/exercises";
import { cn } from "@/lib/utils";
import { WorkoutPlanBuilder } from "@/components/app/WorkoutPlanBuilder";
import { PersonalMusicLibrary } from "@/components/app/PersonalMusicLibrary";

export const Route = createFileRoute("/workout")({
  head: () => ({
    meta: [
      { title: "Workouts & exercise library — Little by Little" },
      {
        name: "description",
        content:
          "Pick a guided session or explore equipment-free exercises with step-by-step instructions.",
      },
      { property: "og:title", content: "Workouts & exercise library — Little by Little" },
      {
        property: "og:description",
        content: "Guided sessions and equipment-free exercises for beginners.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WorkoutPage,
});

const ROUTINE_TONES = ["bg-primary-soft", "bg-sun", "bg-secondary"];

function WorkoutPage() {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<ExerciseFilters>({
    activity: "all",
    difficulty: "all",
    targetArea: "all",
    equipment: "all",
  });

  const filtered = useMemo(() => {
    return filterExercises(EXERCISES, { ...filters, query });
  }, [filters, query]);
  const targetAreas = [
    ...new Set(EXERCISES.flatMap((exercise) => exercise.targetAreas ?? exercise.muscles)),
  ].sort();
  const equipmentOptions = [
    ...new Set(EXERCISES.flatMap((exercise) => exercise.equipment ?? ["none"])),
  ].sort();
  const isFiltered = query.length > 0 || Object.values(filters).some((value) => value !== "all");

  return (
    <Page>
      <PageHeader title="Workout" subtitle="Choose a session or learn a move." />
      <WorkoutPlanBuilder />
      <PersonalMusicLibrary />

      <div className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-2">
        {ROUTINES.map((r, i) => (
          <Link
            key={r.id}
            to="/play/$routineId"
            params={{ routineId: r.id }}
            className={cn(
              "flex w-56 shrink-0 snap-start flex-col rounded-3xl p-4 shadow-soft",
              ROUTINE_TONES[i % 3],
            )}
          >
            <p className="font-display text-lg font-semibold">{r.name}</p>
            <p className="mt-1 flex-1 text-sm text-foreground/75">{r.description}</p>
            <div className="mt-4 flex items-center justify-between text-sm font-bold">
              <span>
                {r.items.length} moves · ~{estimateRoutineMinutes(r)} min
              </span>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-card text-primary">
                <Play className="h-4 w-4" aria-label={`Start ${r.name}`} />
              </span>
            </div>
          </Link>
        ))}
      </div>

      <SectionTitle>Exercise library</SectionTitle>
      <div className="relative">
        <Search
          className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search names, areas, or instructions"
          aria-label="Search exercises"
          className="h-11 rounded-full bg-card pl-10"
        />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="grid gap-1 text-xs font-bold text-muted-foreground">
          Category
          <select
            value={filters.activity ?? "all"}
            onChange={(event) =>
              setFilters({
                ...filters,
                activity: event.target.value as NonNullable<ExerciseFilters["activity"]>,
              })
            }
            className="h-11 min-w-0 rounded-xl border border-border bg-card px-3 text-sm text-foreground"
            aria-label="Filter by category"
          >
            <option value="all">All categories</option>
            {Object.entries(ACTIVITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-bold text-muted-foreground">
          Difficulty
          <select
            value={filters.difficulty ?? "all"}
            onChange={(event) =>
              setFilters({
                ...filters,
                difficulty: event.target.value as NonNullable<ExerciseFilters["difficulty"]>,
              })
            }
            className="h-11 min-w-0 rounded-xl border border-border bg-card px-3 text-sm text-foreground"
            aria-label="Filter by difficulty"
          >
            <option value="all">All levels</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs font-bold text-muted-foreground">
          Target area
          <select
            value={filters.targetArea ?? "all"}
            onChange={(event) => setFilters({ ...filters, targetArea: event.target.value })}
            className="h-11 min-w-0 rounded-xl border border-border bg-card px-3 text-sm text-foreground"
            aria-label="Filter by target area"
          >
            <option value="all">All areas</option>
            {targetAreas.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-bold text-muted-foreground">
          Equipment / support
          <select
            value={filters.equipment ?? "all"}
            onChange={(event) => setFilters({ ...filters, equipment: event.target.value })}
            className="h-11 min-w-0 rounded-xl border border-border bg-card px-3 text-sm text-foreground"
            aria-label="Filter by equipment or support"
          >
            <option value="all">Any requirement</option>
            {equipmentOptions.map((equipment) => (
              <option key={equipment} value={equipment}>
                {equipment === "none"
                  ? "No equipment"
                  : equipment === "support"
                    ? "Wall or counter"
                    : equipment}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>{filtered.length} exercises</span>
        {isFiltered && (
          <button
            type="button"
            className="inline-flex items-center gap-1 font-bold text-primary"
            onClick={() => {
              setQuery("");
              setFilters({
                activity: "all",
                difficulty: "all",
                targetArea: "all",
                equipment: "all",
              });
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Reset filters
          </button>
        )}
      </div>
      <div className="mt-2 space-y-2">
        {filtered.length === 0 ? (
          <EmptyState title="No matches" body="Try another search or category." />
        ) : (
          filtered.map((e) => <ExerciseCard key={e.id} exercise={e} />)
        )}
      </div>
    </Page>
  );
}
