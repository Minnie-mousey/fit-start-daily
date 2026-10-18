import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Award, Clock, Flame, Play, Sparkles, Star, Trophy, Coins } from "lucide-react";
import { EquippedAvatar } from "@/components/app/EquippedAvatar";
import { Page, Panel, SectionTitle } from "@/components/app/Page";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/States";
import { SessionRow } from "@/components/app/ExerciseBits";
import { Button } from "@/components/ui/button";
import { useWorkoutSessions } from "@/hooks/use-workout-sessions";
import { useGamification } from "@/hooks/use-gamification";
import { estimateRoutineMinutes, ROUTINES } from "@/lib/data/exercises";
import { Progress } from "@/components/ui/progress";
import type { ChallengeProgress } from "@/lib/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Little by Little — Your gentle fitness companion" },
      {
        name: "description",
        content: "Short, guided, equipment-free workouts that help you build an exercise habit.",
      },
      { property: "og:title", content: "Little by Little — Your gentle fitness companion" },
      {
        property: "og:description",
        content: "Short, guided, equipment-free workouts that help you build an exercise habit.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const { sessions, stats, isLoading, error, retry } = useWorkoutSessions();
  const game = useGamification();
  const featured = ROUTINES[0]!;

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
        <EquippedAvatar
          snapshot={game.snapshot}
          alt=""
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
          <Stat
            icon={<Flame aria-hidden />}
            value={game.snapshot?.profile.streak ?? stats.currentStreak}
            label="Day streak"
            tone="bg-primary-soft text-primary"
          />
          <Stat
            icon={<Trophy aria-hidden />}
            value={stats.totalWorkouts}
            label="Workouts"
            tone="bg-sun text-sun-foreground"
          />
          <Stat
            icon={<Clock aria-hidden />}
            value={stats.totalMinutes}
            label="Minutes"
            tone="bg-secondary text-secondary-foreground"
          />
        </div>
      )}

      {game.snapshot && (
        <>
          <section
            className="mt-5 rounded-2xl bg-card p-4 shadow-soft"
            aria-label="Player level and wallet"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-display text-lg font-semibold">
                  Level {game.snapshot.profile.level}
                </p>
                <p className="text-xs text-muted-foreground">
                  {game.snapshot.profile.xpTotal} XP total · {game.snapshot.profile.xpForNextLevel}{" "}
                  XP to next level
                </p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-sun px-3 py-1.5 text-sm font-bold text-sun-foreground">
                <Coins className="h-4 w-4" aria-hidden />
                {game.snapshot.profile.coins}
              </span>
            </div>
            <Progress
              value={game.snapshot.profile.levelProgress}
              className="mt-3 h-2"
              aria-label="Level progress"
            />
          </section>

          <SectionTitle>Challenges</SectionTitle>
          <p className="mb-3 text-xs text-muted-foreground">
            Daily challenges reset in{" "}
            <DailyCountdown nextLocalDayAt={game.snapshot.profile.nextLocalDayAt} /> · Weekly
            challenges reset Monday in {game.snapshot.profile.timeZone}.
          </p>
          <div className="space-y-2">
            {game.snapshot.challenges.map((challenge) => (
              <ChallengeRow key={`${challenge.id}:${challenge.periodKey}`} challenge={challenge} />
            ))}
          </div>
          <SectionTitle
            action={
              <Link to="/profile" className="text-sm font-bold text-primary">
                View badges
              </Link>
            }
          >
            Badges · {game.snapshot.achievements.filter((badge) => badge.unlockedAt).length} earned
          </SectionTitle>
          {game.snapshot.achievements.some((badge) => badge.unlockedAt) ? (
            <div className="grid grid-cols-3 gap-2">
              {game.snapshot.achievements
                .filter((badge) => badge.unlockedAt)
                .sort((a, b) => (b.unlockedAt ?? "").localeCompare(a.unlockedAt ?? ""))
                .slice(0, 3)
                .map((badge) => (
                  <div
                    key={badge.id}
                    className="flex min-w-0 flex-col items-center rounded-2xl bg-card p-3 text-center shadow-soft"
                  >
                    <span
                      className={`achievement-medallion achievement-medallion-${badge.rarity ?? "common"} flex h-10 w-10 items-center justify-center rounded-full bg-sun text-sun-foreground`}
                    >
                      <AchievementBadgeIcon id={badge.id} />
                    </span>
                    <span className="mt-2 line-clamp-2 text-xs font-bold">{badge.title}</span>
                  </div>
                ))}
            </div>
          ) : (
            <p className="rounded-xl bg-card p-3 text-sm text-muted-foreground shadow-soft">
              Your first badge is waiting. Complete a workout or challenge to earn one.
            </p>
          )}
        </>
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

function AchievementBadgeIcon({ id }: { id: string }) {
  const Icon = id.includes("hundred")
    ? Trophy
    : id.includes("fifty") || id.includes("constellation")
      ? Sparkles
      : id.includes("fortnight")
        ? Flame
        : id.includes("challenge")
          ? Star
          : id.includes("streak")
            ? Flame
            : Award;
  return <Icon className="h-5 w-5" aria-hidden />;
}

function ChallengeRow({ challenge }: { challenge: ChallengeProgress }) {
  const progress = Math.min(100, Math.round((challenge.progress / challenge.target) * 100));
  const displayProgress =
    challenge.metric === "active-seconds"
      ? `${Math.floor(challenge.progress / 60)} / ${Math.ceil(challenge.target / 60)} min`
      : `${challenge.progress} / ${challenge.target}`;
  return (
    <div className="rounded-xl bg-card px-4 py-3 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold">{challenge.title}</p>
          <p className="text-xs text-muted-foreground">{challenge.description}</p>
        </div>
        <span className="shrink-0 text-right text-xs font-bold text-primary">
          {challenge.claimed ? "Earned" : `+${challenge.xpReward} XP`}
          <span className="block text-muted-foreground">+{challenge.coinReward} coins</span>
        </span>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Progress
          value={progress}
          className="h-2 flex-1"
          aria-label={`${challenge.title} progress`}
        />
        <span className="min-w-16 text-right text-xs font-bold tabular-nums text-muted-foreground">
          {displayProgress}
        </span>
      </div>
    </div>
  );
}

function DailyCountdown({ nextLocalDayAt }: { nextLocalDayAt: string }) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, new Date(nextLocalDayAt).getTime() - Date.now()),
  );
  useEffect(() => {
    const update = () => setRemaining(Math.max(0, new Date(nextLocalDayAt).getTime() - Date.now()));
    const timer = window.setInterval(update, 1000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [nextLocalDayAt]);
  const seconds = Math.floor(remaining / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return (
    <span className="font-bold tabular-nums">
      {hours}h {minutes.toString().padStart(2, "0")}m
    </span>
  );
}

function Stat({
  icon,
  value,
  label,
  tone,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  tone: string;
}) {
  return (
    <Panel className="flex flex-col items-center gap-1 p-3 text-center">
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-full ${tone} [&_svg]:h-5 [&_svg]:w-5`}
      >
        {icon}
      </span>
      <span className="animate-pop-in font-display text-2xl font-semibold">{value}</span>
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
    </Panel>
  );
}
