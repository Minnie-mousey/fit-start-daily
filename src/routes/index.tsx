import { createFileRoute, Link } from "@tanstack/react-router";
import { Clock, Flame, Play, Trophy } from "lucide-react";
import sprout from "@/assets/sprout.png";
import { Page, Panel, SectionTitle } from "@/components/app/Page";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/States";
import { SessionRow } from "@/components/app/ExerciseBits";
import { Button } from "@/components/ui/button";
import { useWorkoutSessions } from "@/hooks/use-workout-sessions";
import { estimateRoutineMinutes, ROUTINES } from "@/lib/data/exercises";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Little by Little — Your gentle fitness companion" },
      { name: "description", content: "Short, guided, equipment-free workouts that help you build an exercise habit." },
      { property: "og:title", content: "Little by Little — Your gentle fitness companion" },
      { property: "og:description", content: "Short, guided, equipment-free workouts that help you build an exercise habit." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const { sessions, stats, isLoading, error, retry } = useWorkoutSessions();
  const featured = ROUTINES[0];

  return (
    <Page>
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-dawn p-6 shadow-soft">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">Little by Little</p>
        <h1 className="mt-1 max-w-[60%] font-display text-3xl font-semibold leading-tight">
          {stats.totalWorkouts > 0 ? "Nice to see you again." : "Small steps add up."}
        </h1>
        <p className="mt-2 max-w-[60%] text-sm text-muted-foreground">
          {featured.name} · about {estimateRoutineMinutes(featured)} min
        </p>
        <Button asChild variant="hero" size="lg" className="mt-5">
          <Link to="/play/$routineId" params={{ routineId: featured.id }}>
            <Play aria-hidden /> Start workout
          </Link>
        </Button>
        <img
          src={sprout}
          alt=""
          width={816}
          height={816}
          className="pointer-events-none absolute -bottom-4 -right-6 w-44"
        />
      </section>

      <SectionTitle>Your progress</SectionTitle>
      {isLoading ? (
        <LoadingState rows={1} label="Loading your stats" />
      ) : error ? (
        <ErrorState message={error} onRetry={retry} />
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <Stat icon={<Flame aria-hidden />} value={stats.currentStreak} label="Day streak" tone="bg-primary-soft text-primary" />
          <Stat icon={<Trophy aria-hidden />} value={stats.totalWorkouts} label="Workouts" tone="bg-sun text-sun-foreground" />
          <Stat icon={<Clock aria-hidden />} value={stats.totalMinutes} label="Minutes" tone="bg-secondary text-secondary-foreground" />
        </div>
      )}

      <SectionTitle
        action={
          sessions.length > 0 ? (
            <Link to="/progress" className="text-sm font-bold text-primary">
              See all
            </Link>
          ) : undefined
        }
      >
        Recent
      </SectionTitle>
      {isLoading ? (
        <LoadingState rows={2} />
      ) : error ? null : sessions.length === 0 ? (
        <EmptyState
          title="No workouts yet"
          body="Finish your first session and it will show up here."
          action={
            <Button asChild variant="soft">
              <Link to="/workout">Browse workouts</Link>
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {sessions.slice(0, 3).map((s) => (
            <SessionRow key={s.id} session={s} />
          ))}
        </ul>
      )}
    </Page>
  );
}

function Stat({ icon, value, label, tone }: { icon: React.ReactNode; value: number; label: string; tone: string }) {
  return (
    <Panel className="flex flex-col items-center gap-1 p-3 text-center">
      <span className={`flex h-9 w-9 items-center justify-center rounded-full ${tone} [&_svg]:h-5 [&_svg]:w-5`}>{icon}</span>
      <span className="animate-pop-in font-display text-2xl font-semibold">{value}</span>
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
    </Panel>
  );
}
