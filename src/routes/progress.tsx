import { createFileRoute, Link } from "@tanstack/react-router";
import { Page, PageHeader, Panel, SectionTitle } from "@/components/app/Page";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/States";
import { SessionRow } from "@/components/app/ExerciseBits";
import { Button } from "@/components/ui/button";
import { useWorkoutSessions } from "@/hooks/use-workout-sessions";

export const Route = createFileRoute("/progress")({
  head: () => ({
    meta: [
      { title: "Progress — Little by Little" },
      { name: "description", content: "Your workout history and totals." },
      { property: "og:title", content: "Progress — Little by Little" },
      { property: "og:description", content: "Your workout history and totals." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProgressPage,
});

function ProgressPage() {
  const { sessions, stats, isLoading, error, retry } = useWorkoutSessions();
  return (
    <Page>
      <PageHeader title="Progress" subtitle="Look how far you've come." />
      {isLoading ? (
        <LoadingState rows={4} />
      ) : error ? (
        <ErrorState message={error} onRetry={retry} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Panel className="bg-sun">
              <p className="font-display text-3xl font-semibold">{stats.thisWeek}</p>
              <p className="text-sm font-bold text-sun-foreground">This week</p>
            </Panel>
            <Panel className="bg-secondary">
              <p className="font-display text-3xl font-semibold">{stats.totalMinutes}</p>
              <p className="text-sm font-bold text-secondary-foreground">Total minutes</p>
            </Panel>
          </div>
          <SectionTitle>Workout history</SectionTitle>
          {sessions.length === 0 ? (
            <EmptyState
              title="Your history starts here"
              body="Completed workouts are saved on this device."
              action={
                <Button asChild variant="soft">
                  <Link to="/workout">Start a workout</Link>
                </Button>
              }
            />
          ) : (
            <ul className="space-y-2">
              {sessions.map((s) => (
                <SessionRow key={s.id} session={s} />
              ))}
            </ul>
          )}
        </>
      )}
    </Page>
  );
}
