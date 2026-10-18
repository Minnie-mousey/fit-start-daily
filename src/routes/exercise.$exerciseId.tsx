import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Lightbulb,
  Play,
  ShieldAlert,
} from "lucide-react";
import { Page, Panel, SectionTitle } from "@/components/app/Page";
import { CategoryIcon, DifficultyBadge, formatTarget } from "@/components/app/ExerciseBits";
import { Button } from "@/components/ui/button";
import {
  ACTIVITY_LABELS,
  CATEGORY_LABELS,
  getExercise,
  singleExerciseRoutineId,
} from "@/lib/data/exercises";

export const Route = createFileRoute("/exercise/$exerciseId")({
  loader: ({ params }) => {
    const exercise = getExercise(params.exerciseId);
    if (!exercise) throw notFound();
    return { exercise };
  },
  head: ({ loaderData }) => {
    const title = loaderData
      ? `${loaderData.exercise.name} — Little by Little`
      : "Exercise — Little by Little";
    const description = loaderData?.exercise.summary ?? "Step-by-step exercise instructions.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  notFoundComponent: () => (
    <Page>
      <p className="font-display text-xl">We couldn't find that exercise.</p>
      <Button asChild variant="soft" className="mt-4">
        <Link to="/workout">Back to library</Link>
      </Button>
    </Page>
  ),
  component: ExerciseDetail,
});

function ExerciseDetail() {
  const { exercise } = Route.useLoaderData();
  return (
    <Page>
      <Link
        to="/workout"
        className="mb-4 inline-flex items-center gap-1 text-sm font-bold text-muted-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Library
      </Link>

      <div className="flex items-center gap-4">
        <CategoryIcon category={exercise.category} size="lg" />
        <div>
          <h1 className="font-display text-2xl font-semibold leading-tight">{exercise.name}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs font-bold text-muted-foreground">
            <DifficultyBadge difficulty={exercise.difficulty} />
            <span>{ACTIVITY_LABELS[exercise.activity ?? "bodyweight-strength"]}</span>
            <span>· {formatTarget(exercise.target)}</span>
          </div>
        </div>
      </div>
      <p className="mt-4 text-muted-foreground">{exercise.summary}</p>
      <p className="mt-2 text-sm">
        <span className="font-bold">Target areas:</span>{" "}
        {(exercise.targetAreas ?? exercise.muscles).join(", ")}
      </p>
      <p className="mt-1 text-sm">
        <span className="font-bold">Equipment:</span>{" "}
        {exercise.equipment?.includes("none") ? "None" : exercise.equipment?.join(", ")}
      </p>
      {exercise.setupRequirements && exercise.setupRequirements.length > 0 && (
        <p className="mt-1 text-sm">
          <span className="font-bold">Setup:</span> {exercise.setupRequirements.join("; ")}
        </p>
      )}

      <SectionTitle>How to do it</SectionTitle>
      <ol className="space-y-2">
        {exercise.steps.map((step, i) => (
          <li key={i} className="flex gap-3 rounded-2xl bg-card p-3 shadow-soft">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
              {i + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>

      <SectionTitle>Safety notes</SectionTitle>
      <div className="grid gap-2">
        {(exercise.safetyNotes ?? exercise.tips).map((note) => (
          <Panel key={note} className="flex gap-3 bg-secondary">
            <ShieldAlert className="h-5 w-5 shrink-0 text-secondary-foreground" aria-hidden />
            <p className="text-sm">{note}</p>
          </Panel>
        ))}
      </div>

      <SectionTitle>Modifications and alternatives</SectionTitle>
      <div className="grid gap-2">
        <Panel className="flex gap-3 bg-secondary">
          <ChevronDown className="h-5 w-5 shrink-0 text-secondary-foreground" aria-hidden />
          <p className="text-sm">
            <span className="font-bold">Reduced intensity: </span>
            {exercise.easier}
          </p>
        </Panel>
        <Panel className="flex gap-3 bg-sun">
          <ChevronUp className="h-5 w-5 shrink-0 text-sun-foreground" aria-hidden />
          <p className="text-sm">
            <span className="font-bold">Progression: </span>
            {exercise.harder}
          </p>
        </Panel>
        {(exercise.alternatives ?? []).map((alternative) => (
          <Panel key={alternative} className="flex gap-3">
            <Lightbulb className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            <p className="text-sm">
              <span className="font-bold">Alternative: </span>
              {alternative}
            </p>
          </Panel>
        ))}
      </div>

      <SectionTitle>Further guidance</SectionTitle>
      <Panel className="grid gap-2">
        {exercise.demonstration ? (
          <a
            className="inline-flex items-center gap-2 text-sm font-bold text-primary underline"
            href={exercise.demonstration.url}
            target="_blank"
            rel="noreferrer"
          >
            {exercise.demonstration.label}
            <ExternalLink className="h-4 w-4" aria-hidden />
          </a>
        ) : (
          <p className="text-sm text-muted-foreground">
            No external video is listed for this movement; follow the numbered steps above.
          </p>
        )}
        {exercise.source && (
          <a
            className="inline-flex items-center gap-2 text-sm font-bold text-primary underline"
            href={exercise.source.url}
            target="_blank"
            rel="noreferrer"
          >
            {exercise.source.label}
            <ExternalLink className="h-4 w-4" aria-hidden />
          </a>
        )}
        <p className="text-xs text-muted-foreground">
          General exercise information, not individual medical advice.
        </p>
      </Panel>

      <Button asChild variant="hero" size="xl" className="mt-8 w-full">
        <Link to="/play/$routineId" params={{ routineId: singleExerciseRoutineId(exercise.id) }}>
          <Play aria-hidden /> Try this exercise
        </Link>
      </Button>
    </Page>
  );
}
