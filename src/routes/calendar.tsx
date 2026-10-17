import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Page, PageHeader, Panel } from "@/components/app/Page";
import { ErrorState, LoadingState } from "@/components/app/States";
import { Button } from "@/components/ui/button";
import { useWorkoutSessions } from "@/hooks/use-workout-sessions";
import { dayKey } from "@/lib/services/stats";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/calendar")({
  head: () => ({
    meta: [
      { title: "Calendar — Little by Little" },
      { name: "description", content: "See the days you showed up and exercised." },
      { property: "og:title", content: "Calendar — Little by Little" },
      { property: "og:description", content: "See the days you showed up and exercised." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CalendarPage,
});

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

function CalendarPage() {
  const { sessions, isLoading, error, retry } = useWorkoutSessions();
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const counts = new Map<string, number>();
  sessions.forEach((s) => {
    const k = dayKey(new Date(s.completedAt));
    counts.set(k, (counts.get(k) ?? 0) + 1);
  });

  const offset = (month.getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const todayKey = dayKey(new Date());
  const activeDays = Array.from({ length: daysInMonth }, (_, i) =>
    counts.has(dayKey(new Date(month.getFullYear(), month.getMonth(), i + 1))),
  ).filter(Boolean).length;

  const shift = (n: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));

  return (
    <Page>
      <PageHeader title="Calendar" subtitle="Every dot is a day you showed up." />
      {isLoading ? (
        <LoadingState rows={4} />
      ) : error ? (
        <ErrorState message={error} onRetry={retry} />
      ) : (
        <Panel className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => shift(-1)}>
              <ChevronLeft />
            </Button>
            <p className="font-display text-lg font-semibold">
              {month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
            </p>
            <Button variant="ghost" size="icon" aria-label="Next month" onClick={() => shift(1)}>
              <ChevronRight />
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-muted-foreground">
            {WEEKDAYS.map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1">
            {Array.from({ length: offset }).map((_, i) => (
              <span key={`e${i}`} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const k = dayKey(new Date(month.getFullYear(), month.getMonth(), i + 1));
              const n = counts.get(k) ?? 0;
              return (
                <div
                  key={k}
                  aria-label={`${k}${n ? `, ${n} workout${n > 1 ? "s" : ""}` : ""}`}
                  className={cn(
                    "flex aspect-square flex-col items-center justify-center rounded-xl text-sm font-bold",
                    n ? "bg-primary text-primary-foreground" : "text-foreground",
                    k === todayKey && !n && "ring-2 ring-primary",
                  )}
                >
                  {i + 1}
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {activeDays === 0 ? "No workouts this month yet." : `${activeDays} active day${activeDays > 1 ? "s" : ""} this month`}
          </p>
        </Panel>
      )}
    </Page>
  );
}
