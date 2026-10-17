import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Play, Search } from "lucide-react";
import { Page, PageHeader, SectionTitle } from "@/components/app/Page";
import { EmptyState } from "@/components/app/States";
import { ExerciseCard } from "@/components/app/ExerciseBits";
import { Input } from "@/components/ui/input";
import { CATEGORY_LABELS, estimateRoutineMinutes, EXERCISES, ROUTINES } from "@/lib/data/exercises";
import type { ExerciseCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/workout")({
  head: () => ({
    meta: [
      { title: "Workouts & exercise library — Little by Little" },
      { name: "description", content: "Pick a guided session or explore equipment-free exercises with step-by-step instructions." },
      { property: "og:title", content: "Workouts & exercise library — Little by Little" },
      { property: "og:description", content: "Guided sessions and equipment-free exercises for beginners." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WorkoutPage,
});

const ROUTINE_TONES = ["bg-primary-soft", "bg-sun", "bg-secondary"];

function WorkoutPage() {
  const [category, setCategory] = useState<ExerciseCategory | "all">("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return EXERCISES.filter(
      (e) =>
        (category === "all" || e.category === category) &&
        (!q || e.name.toLowerCase().includes(q) || e.muscles.some((m) => m.toLowerCase().includes(q))),
    );
  }, [category, query]);

  return (
    <Page>
      <PageHeader title="Workout" subtitle="Choose a session or learn a move." />

      <div className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-2">
        {ROUTINES.map((r, i) => (
          <Link
            key={r.id}
            to="/play/$routineId"
            params={{ routineId: r.id }}
            className={cn("flex w-56 shrink-0 snap-start flex-col rounded-3xl p-4 shadow-soft", ROUTINE_TONES[i % 3])}
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
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or muscle"
          aria-label="Search exercises"
          className="h-11 rounded-full bg-card pl-10"
        />
      </div>
      <div className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1" role="group" aria-label="Filter by category">
        {(["all", ...Object.keys(CATEGORY_LABELS)] as (ExerciseCategory | "all")[]).map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            aria-pressed={category === c}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-sm font-bold transition-colors",
              category === c ? "bg-foreground text-background" : "bg-card text-muted-foreground shadow-soft",
            )}
          >
            {c === "all" ? "All" : CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        {filtered.length === 0 ? (
          <EmptyState title="No matches" body="Try another search or category." />
        ) : (
          filtered.map((e) => <ExerciseCard key={e.id} exercise={e} />)
        )}
      </div>
    </Page>
  );
}
