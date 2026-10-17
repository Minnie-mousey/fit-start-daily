import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Check, Loader2, Pause, Play, SkipForward, X } from "lucide-react";
import { formatDuration, formatTarget } from "@/components/app/ExerciseBits";
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
import { getRoutine } from "@/lib/data/exercises";
import { buildSteps, initialPlayerState, playerReducer } from "@/lib/services/workoutPlayer";

export const Route = createFileRoute("/play/$routineId")({
  loader: ({ params }) => {
    const routine = getRoutine(params.routineId);
    if (!routine) throw notFound();
    return { routine };
  },
  head: ({ loaderData }) => {
    const title = loaderData ? `${loaderData.routine.name} — Workout player` : "Workout player";
    return {
      meta: [
        { title },
        { name: "description", content: "Guided workout with timers, reps and rest periods." },
        { property: "og:title", content: title },
        { property: "og:description", content: "Guided workout with timers, reps and rest periods." },
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
  const { routine } = Route.useLoaderData();
  const navigate = useNavigate();
  const steps = useMemo(() => buildSteps(routine), [routine]);
  const reducer = useMemo(() => playerReducer(steps), [steps]);
  const [state, dispatch] = useReducer(reducer, steps, initialPlayerState);
  const startedAt = useRef<Date | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const save = useCompleteWorkout();
  const saveTriggered = useRef(false);
  const totalExercises = steps.filter((s) => s.type === "work").length;

  useEffect(() => {
    if (state.status !== "running") return;
    const id = window.setInterval(() => dispatch({ type: "tick" }), 1000);
    return () => window.clearInterval(id);
  }, [state.status]);

  const doSave = () => {
    save.mutate({
      routineId: routine.id,
      routineName: routine.name,
      startedAt: startedAt.current ?? new Date(),
      completedAt: new Date(),
      activeSeconds: state.activeSeconds,
      exercisesCompleted: state.exercisesCompleted,
      totalExercises,
    });
  };

  useEffect(() => {
    if (state.status === "finished" && !saveTriggered.current && state.exercisesCompleted > 0) {
      saveTriggered.current = true;
      doSave();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  if (state.status === "finished") {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <div className="animate-pop-in flex h-24 w-24 items-center justify-center rounded-full bg-success text-success-foreground shadow-pop">
          <Check className="h-12 w-12" aria-hidden />
        </div>
        <h1 className="mt-6 font-display text-3xl font-semibold">
          {state.exercisesCompleted === totalExercises ? "Workout complete!" : "Nice effort!"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {state.exercisesCompleted} of {totalExercises} moves · {formatDuration(state.activeSeconds)}
        </p>
        <div className="mt-6 w-full" aria-live="polite">
          {state.exercisesCompleted === 0 ? (
            <p className="text-sm text-muted-foreground">No moves were finished, so nothing was saved.</p>
          ) : save.isPending ? (
            <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Saving…
            </p>
          ) : save.isError ? (
            <ErrorState message={save.error.message} onRetry={doSave} />
          ) : save.isSuccess ? (
            <p className="text-sm font-bold text-success">Saved to your history</p>
          ) : null}
        </div>
        <Button variant="hero" size="xl" className="mt-8 w-full" disabled={save.isPending} onClick={() => navigate({ to: "/" })}>
          Back home
        </Button>
      </main>
    );
  }

  const step = steps[state.stepIndex];
  const isRest = step.type === "rest";
  const workIndex = isRest ? null : step.exerciseIndex;
  const progress = (state.stepIndex / steps.length) * 100;
  const duration = isRest ? step.seconds : step.target.kind === "time" ? step.target.seconds : null;

  return (
    <main className={`mx-auto flex min-h-screen max-w-md flex-col px-5 pb-8 pt-5 ${isRest ? "bg-secondary" : ""}`}>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" aria-label="End workout" onClick={() => setConfirmEnd(true)}>
          <X />
        </Button>
        <Progress value={progress} className="h-2.5 flex-1" aria-label="Workout progress" />
        <span className="w-14 text-right text-sm font-bold tabular-nums">{formatDuration(state.activeSeconds).replace(" min ", ":").replace(" s", "")}</span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <p className="text-sm font-bold uppercase tracking-widest text-primary">
          {isRest ? "Rest" : `Move ${(workIndex ?? 0) + 1} of ${totalExercises}`}
        </p>
        <h1 className="mt-2 font-display text-4xl font-semibold">{isRest ? "Breathe" : step.exercise.name}</h1>
        {isRest && <p className="mt-1 text-muted-foreground">Up next: {step.next.name}</p>}

        <div className="relative mt-8 flex h-56 w-56 items-center justify-center">
          {duration !== null && state.remaining !== null && (
            <TimerRing fraction={state.remaining / duration} />
          )}
          <span className="font-display text-6xl font-semibold tabular-nums" aria-live="off">
            {state.remaining !== null ? state.remaining : step.type === "work" ? step.target.kind === "reps" ? step.target.reps : "" : ""}
          </span>
          <span className="absolute bottom-12 text-sm font-bold text-muted-foreground">
            {state.remaining !== null ? "seconds" : "reps"}
          </span>
        </div>

        {!isRest && <p className="mt-4 max-w-xs text-sm text-muted-foreground">{step.exercise.steps[0]}</p>}
      </div>

      <div className="flex items-center justify-center gap-5">
        {state.status === "ready" ? (
          <Button
            variant="hero"
            size="xl"
            className="w-full"
            onClick={() => {
              startedAt.current = new Date();
              dispatch({ type: "start" });
            }}
          >
            <Play aria-hidden /> Start
          </Button>
        ) : (
          <>
            <Button
              variant="outline"
              size="icon-xl"
              aria-label={state.status === "paused" ? "Resume" : "Pause"}
              onClick={() => dispatch({ type: state.status === "paused" ? "resume" : "pause" })}
            >
              {state.status === "paused" ? <Play /> : <Pause />}
            </Button>
            <Button
              variant="hero"
              size="xl"
              className="flex-1"
              disabled={state.status === "paused"}
              onClick={() => dispatch({ type: "next" })}
            >
              {isRest ? <><SkipForward aria-hidden /> Skip rest</> : step.target.kind === "reps" ? <><Check aria-hidden /> Done</> : <><SkipForward aria-hidden /> Next</>}
            </Button>
          </>
        )}
      </div>
      {state.status === "paused" && <p className="mt-3 text-center text-sm font-bold text-muted-foreground">Paused</p>}

      <AlertDialog open={confirmEnd} onOpenChange={setConfirmEnd}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>End this workout?</AlertDialogTitle>
            <AlertDialogDescription>
              {state.exercisesCompleted > 0
                ? `You've finished ${state.exercisesCompleted} move${state.exercisesCompleted > 1 ? "s" : ""}. We'll save your progress so far.`
                : "You haven't finished a move yet, so nothing will be saved."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep going</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (state.exercisesCompleted === 0) navigate({ to: "/workout" });
                else dispatch({ type: "end" });
              }}
            >
              End workout
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
