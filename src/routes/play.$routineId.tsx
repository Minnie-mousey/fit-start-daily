import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Check, Loader2, Minus, Pause, Play, Plus, SkipForward, X } from "lucide-react";
import { formatDuration, formatTarget } from "@/components/app/ExerciseBits";
import { EquippedAvatar } from "@/components/app/EquippedAvatar";
import { ErrorState } from "@/components/app/States";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useCompleteWorkout } from "@/hooks/use-workout-sessions";
import { useDatabase } from "@/hooks/use-database";
import { useGamification } from "@/hooks/use-gamification";
import { WorkoutMusicControls } from "@/components/app/WorkoutMusicControls";
import { getRoutine } from "@/lib/data/exercises";
import { buildSteps, initialPlayerState, playerReducer } from "@/lib/services/workoutPlayer";
import type { SessionStatus } from "@/lib/types";
import type { Routine } from "@/lib/types";

export const Route = createFileRoute("/play/$routineId")({
  loader: ({ params }) => {
    return { routine: getRoutine(params.routineId) ?? null };
  },
  head: ({ loaderData }) => {
    const title = loaderData?.routine
      ? `${loaderData.routine.name} — Workout player`
      : "Workout player";
    return {
      meta: [
        { title },
        { name: "description", content: "Guided workout with timers, reps and rest periods." },
        { property: "og:title", content: title },
        {
          property: "og:description",
          content: "Guided workout with timers, reps and rest periods.",
        },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  notFoundComponent: () => (
    <main className="mx-auto max-w-md p-6">
      <p className="font-display text-xl">That workout doesn't exist.</p>
      <Button asChild variant="soft" className="mt-4">
        <Link to="/workout">Back to workouts</Link>
      </Button>
    </main>
  ),
  component: Player,
});

function Player() {
  const { routine: staticRoutine } = Route.useLoaderData();
  const { routineId } = Route.useParams();
  const { state } = useDatabase();
  const routineQuery = useQuery({
    queryKey: ["planned-routine", routineId],
    enabled: !staticRoutine && state.status === "ready",
    queryFn: () =>
      state.status === "ready" ? state.fitness.getRoutine(routineId) : Promise.resolve(null),
  });
  const routine = staticRoutine ?? routineQuery.data;
  if (!routine) {
    if (routineQuery.isError)
      return (
        <main className="mx-auto max-w-md px-5 pt-8">
          <ErrorState message={routineQuery.error.message} />
        </main>
      );
    return (
      <main className="mx-auto max-w-md px-5 pt-8">
        {state.status === "error" ? (
          <ErrorState message={state.error} />
        ) : routineQuery.isPending || state.status === "loading" ? (
          <p className="text-sm text-muted-foreground">Loading planned workout…</p>
        ) : (
          <p className="font-display text-xl">That workout doesn’t exist.</p>
        )}
        <Button asChild variant="soft" className="mt-4">
          <Link to="/workout">Back to workouts</Link>
        </Button>
      </main>
    );
  }
  return <RoutinePlayer routine={routine} />;
}

function RoutinePlayer({ routine }: { routine: Routine }) {
  const navigate = useNavigate();
  const [durationMinutes, setDurationMinutes] = useState(routine.durationMinutes ?? 10);
  const [reducedIntensity, setReducedIntensity] = useState(false);
  const steps = useMemo(
    () => buildSteps(routine, { durationMinutes, reducedIntensity }),
    [routine, durationMinutes, reducedIntensity],
  );
  const reducer = useMemo(() => playerReducer(steps), [steps]);
  const [state, dispatch] = useReducer(reducer, steps, initialPlayerState);
  const startedAt = useRef<Date | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [actualReps, setActualReps] = useState(0);
  const { snapshot } = useGamification();
  const save = useCompleteWorkout();
  const saveTriggered = useRef(false);
  const sessionId = useRef(crypto.randomUUID());
  const totalExercises = steps.filter((s) => s.type === "work").length;
  const estimatedSeconds = steps.reduce((sum, step) => {
    if (step.type === "rest") return sum + step.seconds;
    return sum + (step.target.kind === "time" ? step.target.seconds : step.target.reps * 4);
  }, 0);
  const step = steps[state.stepIndex];

  useEffect(() => {
    setActualReps(step?.type === "work" && step.target.kind === "reps" ? step.target.reps : 0);
  }, [state.stepIndex, step]);

  useEffect(() => {
    if (state.status !== "running") return;
    const reconcile = () => dispatch({ type: "sync", nowMs: Date.now() });
    const interval = window.setInterval(reconcile, 1000);
    document.addEventListener("visibilitychange", reconcile);
    window.addEventListener("pageshow", reconcile);
    window.addEventListener("focus", reconcile);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", reconcile);
      window.removeEventListener("pageshow", reconcile);
      window.removeEventListener("focus", reconcile);
    };
  }, [state.status]);

  const doSave = (outcome: SessionStatus) => {
    save.mutate({
      routineId: routine.id,
      routineName: routine.name,
      startedAt: startedAt.current ?? new Date(),
      completedAt: new Date(),
      activeSeconds: Math.floor(state.activeSeconds),
      exercisesCompleted: state.exercisesCompleted,
      totalExercises,
      performance: state.performance,
      outcome,
      idempotencyKey: sessionId.current,
    });
  };

  useEffect(() => {
    if (
      (state.status === "finished" || state.status === "cancelled") &&
      startedAt.current &&
      !saveTriggered.current
    ) {
      saveTriggered.current = true;
      const outcome: SessionStatus =
        state.status === "cancelled"
          ? "cancelled"
          : state.exercisesCompleted === totalExercises
            ? "completed"
            : "partial";
      doSave(outcome);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, state.exercisesCompleted]);

  if (state.status === "finished" || state.status === "cancelled") {
    const outcome: SessionStatus =
      state.status === "cancelled"
        ? "cancelled"
        : state.exercisesCompleted === totalExercises
          ? "completed"
          : "partial";
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <div className="relative">
          <EquippedAvatar snapshot={snapshot} className="h-24 w-24 object-contain" />
          <span
            className={`animate-pop-in absolute -bottom-1 -right-1 flex h-10 w-10 items-center justify-center rounded-full shadow-pop ${outcome === "completed" ? "bg-success text-success-foreground" : "bg-secondary text-secondary-foreground"}`}
          >
            {outcome === "completed" ? (
              <Check className="h-5 w-5" aria-hidden />
            ) : (
              <X className="h-5 w-5" aria-hidden />
            )}
          </span>
        </div>
        <h1 className="mt-6 font-display text-3xl font-semibold">
          {outcome === "completed"
            ? "Workout complete!"
            : outcome === "cancelled"
              ? "Workout cancelled"
              : "Session saved"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {state.exercisesCompleted} of {totalExercises} moves ·{" "}
          {formatDuration(Math.floor(state.activeSeconds))}
        </p>
        <div className="mt-6 w-full" aria-live="polite">
          {save.isPending ? (
            <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Saving…
            </p>
          ) : save.isError ? (
            <ErrorState message={save.error.message} onRetry={() => doSave(outcome)} />
          ) : save.isSuccess ? (
            <p className="text-sm font-bold text-success">Saved to your history as {outcome}</p>
          ) : null}
        </div>
        <Button
          variant="hero"
          size="xl"
          className="mt-8 w-full"
          disabled={save.isPending}
          onClick={() => navigate({ to: "/" })}
        >
          Back home
        </Button>
      </main>
    );
  }

  if (!step) return null;
  const isRest = step.type === "rest";
  const isWarmup = step.type === "warmup";
  const isCooldown = step.type === "work" && step.section === "cooldown";
  const workIndex = step.type === "work" ? step.exerciseIndex : null;
  const progress = (state.stepIndex / steps.length) * 100;
  const duration = isRest ? step.seconds : step.target.kind === "time" ? step.target.seconds : null;
  const exercise = isRest ? null : step.exercise;

  return (
    <main
      className={`mx-auto flex min-h-screen max-w-md flex-col px-5 pb-8 pt-5 ${isRest ? "bg-secondary" : ""}`}
    >
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Cancel workout"
          onClick={() => setConfirmEnd(true)}
        >
          <X />
        </Button>
        <Progress value={progress} className="h-2.5 flex-1" aria-label="Workout progress" />
        <span className="w-14 text-right text-sm font-bold tabular-nums">
          {formatDuration(Math.floor(state.activeSeconds)).replace(" min ", ":").replace(" s", "")}
        </span>
        <EquippedAvatar
          snapshot={snapshot}
          alt="Your equipped avatar"
          className="h-9 w-9 shrink-0 object-contain"
          compact
        />
      </div>
      <WorkoutMusicControls />

      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <p className="text-sm font-bold uppercase tracking-widest text-primary">
          {isRest
            ? "Rest"
            : isWarmup
              ? "Warm-up"
              : isCooldown
                ? "Cooldown"
                : `Move ${(workIndex ?? 0) + 1} of ${totalExercises}`}
        </p>
        <h1 className="mt-2 font-display text-4xl font-semibold">
          {isRest ? "Breathe" : exercise?.name}
        </h1>
        {isRest && <p className="mt-1 text-muted-foreground">Up next: {step.next.name}</p>}

        {state.status === "ready" ? (
          <div className="mt-5 grid w-full gap-4 rounded-2xl bg-card p-4 text-left shadow-soft">
            <label className="grid gap-1 text-sm font-bold">
              Session duration
              <select
                value={durationMinutes}
                onChange={(event) => setDurationMinutes(Number(event.target.value))}
                className="h-11 rounded-xl border border-border bg-background px-3"
              >
                {[5, 10, 15, 20, 30, 45, 60].map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes} minutes
                  </option>
                ))}
              </select>
            </label>
            <div>
              <p className="mb-2 text-sm font-bold">Intensity</p>
              <div className="grid grid-cols-2 gap-2" role="group" aria-label="Workout intensity">
                <button
                  type="button"
                  aria-pressed={!reducedIntensity}
                  onClick={() => setReducedIntensity(false)}
                  className={`rounded-xl px-3 py-2 text-sm font-bold ${!reducedIntensity ? "bg-foreground text-background" : "bg-background text-muted-foreground"}`}
                >
                  Standard
                </button>
                <button
                  type="button"
                  aria-pressed={reducedIntensity}
                  onClick={() => setReducedIntensity(true)}
                  className={`rounded-xl px-3 py-2 text-sm font-bold ${reducedIntensity ? "bg-foreground text-background" : "bg-background text-muted-foreground"}`}
                >
                  Reduced
                </button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              About {Math.max(1, Math.round(estimatedSeconds / 60))} minutes including warm-up and
              rests. Repetition pace varies.
            </p>
          </div>
        ) : (
          <>
            <div className="relative mt-6 flex h-48 w-48 shrink-0 items-center justify-center">
              {duration !== null && state.remaining !== null && (
                <TimerRing fraction={state.remaining / duration} />
              )}
              <span className="font-display text-6xl font-semibold tabular-nums" aria-live="off">
                {state.remaining !== null
                  ? Math.ceil(state.remaining)
                  : step.type === "work" && step.target.kind === "reps"
                    ? step.target.reps
                    : ""}
              </span>
              <span className="absolute bottom-10 text-sm font-bold text-muted-foreground">
                {state.remaining !== null ? "seconds" : "target reps"}
              </span>
            </div>
            {step.type === "work" && step.target.kind === "reps" && (
              <label className="mt-3 flex items-center justify-center gap-3 text-sm font-bold">
                Actual reps
                <button
                  type="button"
                  aria-label="Decrease actual reps"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-card"
                  onClick={() => setActualReps((count) => Math.max(0, count - 1))}
                >
                  <Minus className="h-4 w-4" />
                </button>
                <input
                  aria-label="Actual repetitions completed"
                  className="h-10 w-16 rounded-lg border border-border bg-card text-center tabular-nums"
                  type="number"
                  min={0}
                  max={step.target.reps}
                  value={actualReps}
                  onChange={(event) =>
                    setActualReps(
                      Math.max(
                        0,
                        Math.min(
                          step.target.kind === "reps" ? step.target.reps : 0,
                          Number(event.target.value) || 0,
                        ),
                      ),
                    )
                  }
                />
                <button
                  type="button"
                  aria-label="Increase actual reps"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-card"
                  onClick={() =>
                    setActualReps((count) =>
                      Math.min(step.target.kind === "reps" ? step.target.reps : count, count + 1),
                    )
                  }
                >
                  <Plus className="h-4 w-4" />
                </button>
              </label>
            )}
            {exercise && (
              <div className="mt-4 w-full max-w-md text-left">
                {step.type === "work" && step.adaptation && (
                  <p className="mb-2 rounded-xl bg-secondary p-3 text-sm">
                    <span className="font-bold">Reduced option: </span>
                    {step.adaptation}
                  </p>
                )}
                <ol className="space-y-1.5 text-sm text-muted-foreground">
                  {exercise.steps.map((instruction, index) => (
                    <li key={instruction} className="flex gap-2">
                      <span className="font-bold text-foreground">{index + 1}.</span>
                      <span>{instruction}</span>
                    </li>
                  ))}
                </ol>
                {(exercise.safetyNotes ?? exercise.tips).slice(0, 1).map((note) => (
                  <p key={note} className="mt-3 text-xs text-muted-foreground">
                    <span className="font-bold">Safety: </span>
                    {note}
                  </p>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex items-center justify-center gap-5">
        {state.status === "ready" ? (
          <Button
            variant="hero"
            size="xl"
            className="w-full"
            onClick={() => {
              startedAt.current = new Date();
              dispatch({ type: "start", nowMs: Date.now() });
            }}
          >
            <Play aria-hidden /> Start warm-up
          </Button>
        ) : (
          <>
            <Button
              variant="outline"
              size="icon-xl"
              aria-label={state.status === "paused" ? "Resume" : "Pause"}
              onClick={() =>
                dispatch({
                  type: state.status === "paused" ? "resume" : "pause",
                  nowMs: Date.now(),
                })
              }
            >
              {state.status === "paused" ? <Play /> : <Pause />}
            </Button>
            <Button
              variant="hero"
              size="xl"
              className="flex-1"
              disabled={state.status === "paused"}
              onClick={() =>
                dispatch(
                  step.type === "work" && step.target.kind === "reps"
                    ? { type: "done", nowMs: Date.now(), actualReps }
                    : { type: "skip", nowMs: Date.now() },
                )
              }
            >
              {step.type === "work" && step.target.kind === "reps" ? (
                <>
                  <Check aria-hidden /> Record reps
                </>
              ) : (
                <>
                  <SkipForward aria-hidden />{" "}
                  {isRest ? "Skip rest" : isWarmup ? "Skip warm-up" : "Skip interval"}
                </>
              )}
            </Button>
          </>
        )}
      </div>
      {state.status === "paused" && (
        <p className="mt-3 text-center text-sm font-bold text-muted-foreground">Paused</p>
      )}

      <AlertDialog open={confirmEnd} onOpenChange={setConfirmEnd}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this workout?</AlertDialogTitle>
            <AlertDialogDescription>
              {startedAt.current
                ? "This session will be saved as cancelled, never as completed. Finished and skipped exercise performance will be retained."
                : "The session has not started, so no history will be saved."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep going</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!startedAt.current) navigate({ to: "/workout" });
                else dispatch({ type: "cancel", nowMs: Date.now() });
              }}
            >
              Cancel workout
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

function TimerRing({ fraction }: { fraction: number }) {
  const r = 100;
  const c = 2 * Math.PI * r;
  return (
    <svg className="absolute inset-0 -rotate-90" viewBox="0 0 224 224" aria-hidden>
      <circle cx="112" cy="112" r={r} fill="none" strokeWidth="14" className="stroke-muted" />
      <circle
        cx="112"
        cy="112"
        r={r}
        fill="none"
        strokeWidth="14"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.max(0, Math.min(1, fraction)))}
        className="stroke-primary transition-[stroke-dashoffset] duration-1000 ease-linear"
      />
    </svg>
  );
}
