import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Page, PageHeader, Panel, SectionTitle } from "@/components/app/Page";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/States";
import { SessionRow } from "@/components/app/ExerciseBits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  useDeleteWeight,
  useSaveWeight,
  useSaveWeightSettings,
  useWeightEntries,
  useWeightSettings,
} from "@/hooks/use-fitness";
import { useWorkoutSessions } from "@/hooks/use-workout-sessions";
import { computeWorkoutConsistency, dayKey } from "@/lib/services/stats";
import { convertWeight, displayWeight } from "@/lib/services/trainingPlan";
import type { WeightEntry, WeightUnit } from "@/lib/types";

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
  const weights = useWeightEntries();
  const settings = useWeightSettings();
  const saveWeight = useSaveWeight();
  const deleteWeight = useDeleteWeight();
  const saveSettings = useSaveWeightSettings();
  const [unit, setUnit] = useState<WeightUnit>("kg");
  const [goalInput, setGoalInput] = useState("");
  const [weightInput, setWeightInput] = useState("");
  const [dateInput, setDateInput] = useState(dayKey(new Date()));
  const [noteInput, setNoteInput] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [weightError, setWeightError] = useState<string | null>(null);
  const consistency = computeWorkoutConsistency(sessions, new Date());
  const workoutChartData = useMemo(() => {
    const currentWeek = new Date();
    currentWeek.setHours(0, 0, 0, 0);
    currentWeek.setDate(currentWeek.getDate() - ((currentWeek.getDay() + 6) % 7));
    const weeks = Array.from({ length: 8 }, (_, index) => {
      const start = new Date(currentWeek);
      start.setDate(start.getDate() - (7 - index) * 7);
      return {
        key: dayKey(start),
        week: start.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        workouts: 0,
      };
    });
    const byWeek = new Map(weeks.map((week) => [week.key, week]));
    for (const session of sessions) {
      if (session.status === "cancelled") continue;
      const completed = new Date(session.completedAt);
      if (!Number.isFinite(completed.getTime())) continue;
      completed.setHours(0, 0, 0, 0);
      completed.setDate(completed.getDate() - ((completed.getDay() + 6) % 7));
      const week = byWeek.get(dayKey(completed));
      if (week) week.workouts += 1;
    }
    return weeks;
  }, [sessions]);

  useEffect(() => {
    if (settings.data) {
      setUnit(settings.data.unit);
      setGoalInput(
        settings.data.goalKg === null
          ? ""
          : String(displayWeight(settings.data.goalKg, settings.data.unit)),
      );
    }
  }, [settings.data]);

  const chartData = useMemo(
    () =>
      [...(weights.data ?? [])]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((entry) => ({
          date: new Date(`${entry.date}T12:00:00`).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          }),
          weight: displayWeight(entry.weightKg, unit),
        })),
    [weights.data, unit],
  );

  const resetWeightForm = () => {
    setEditingId(null);
    setWeightInput("");
    setDateInput(dayKey(new Date()));
    setNoteInput("");
    setWeightError(null);
  };

  const editWeight = (entry: WeightEntry) => {
    setEditingId(entry.id);
    setWeightInput(String(displayWeight(entry.weightKg, unit)));
    setDateInput(entry.date);
    setNoteInput(entry.note);
    setWeightError(null);
  };

  const submitWeight = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = Number(weightInput);
    if (!Number.isFinite(value) || value <= 0) {
      setWeightError("Enter a weight greater than zero.");
      return;
    }
    saveWeight.mutate(
      {
        ...(editingId ? { id: editingId } : {}),
        entry: {
          date: dateInput,
          weightKg: convertWeight(value, unit, "kg"),
          note: noteInput.trim(),
        },
      },
      {
        onSuccess: resetWeightForm,
        onError: (saveError) => setWeightError(saveError.message),
      },
    );
  };

  const persistWeightSettings = () => {
    const goalValue = goalInput.trim() === "" ? null : Number(goalInput);
    if (goalValue !== null && (!Number.isFinite(goalValue) || goalValue <= 0)) {
      setWeightError("Weight goal must be a positive number, or leave it blank.");
      return;
    }
    saveSettings.mutate(
      {
        unit,
        goalKg: goalValue === null ? null : convertWeight(goalValue, unit, "kg"),
      },
      {
        onSuccess: () => setWeightError(null),
        onError: (saveError) => setWeightError(saveError.message),
      },
    );
  };

  const changeUnit = (nextUnit: WeightUnit) => {
    const convertInput = (raw: string) => {
      const value = Number(raw);
      if (!raw.trim() || !Number.isFinite(value) || value <= 0) return raw;
      const canonicalKg = convertWeight(value, unit, "kg");
      return String(displayWeight(canonicalKg, nextUnit));
    };
    setGoalInput(convertInput(goalInput));
    setWeightInput(convertInput(weightInput));
    setUnit(nextUnit);
  };

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
            <Panel>
              <p className="font-display text-3xl font-semibold">{stats.currentStreak}</p>
              <p className="text-sm font-bold text-muted-foreground">Day streak</p>
            </Panel>
            <Panel>
              <p className="font-display text-3xl font-semibold">{stats.totalWorkouts}</p>
              <p className="text-sm font-bold text-muted-foreground">Total workouts</p>
            </Panel>
          </div>
          <SectionTitle>Workout consistency</SectionTitle>
          <Panel>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="font-display text-3xl font-semibold">{consistency.percentage}%</p>
                <p className="text-sm text-muted-foreground">
                  of the last {consistency.totalDays} days active
                </p>
              </div>
              <p className="text-sm font-bold text-primary">
                {consistency.activeDays} active day{consistency.activeDays === 1 ? "" : "s"}
              </p>
            </div>
            <div
              className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={consistency.percentage}
              aria-label="Workout consistency over the last 30 days"
            >
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${consistency.percentage}%` }}
              />
            </div>
          </Panel>

          <SectionTitle>Workout activity</SectionTitle>
          <Panel>
            <p className="text-sm text-muted-foreground">
              Saved workouts each week over the last eight weeks.
            </p>
            <div className="mt-3 h-56 w-full" role="img" aria-label="Workout activity trend chart">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={workoutChartData}
                  margin={{ top: 12, right: 12, left: -16, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} width={40} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => [Number(value), "Workouts"]} />
                  <Line
                    type="monotone"
                    dataKey="workouts"
                    stroke="hsl(var(--chart-2))"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <SectionTitle>Weight tracking</SectionTitle>
          <Panel>
            {settings.isError && (
              <p role="alert" className="mb-3 text-sm font-bold text-destructive">
                {settings.error.message}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1 text-sm font-bold">
                Display unit
                <select
                  value={unit}
                  onChange={(event) => changeUnit(event.target.value as WeightUnit)}
                  className="h-10 rounded-lg border border-border bg-background px-2 font-normal"
                >
                  <option value="kg">Kilograms (kg)</option>
                  <option value="lb">Pounds (lb)</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm font-bold">
                Goal (optional)
                <Input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={goalInput}
                  onChange={(event) => setGoalInput(event.target.value)}
                  placeholder={`No goal (${unit})`}
                />
              </label>
            </div>
            <Button
              size="sm"
              variant="soft"
              className="mt-3"
              onClick={persistWeightSettings}
              disabled={saveSettings.isPending}
            >
              Save unit and goal
            </Button>
            {weights.isError && (
              <p role="alert" className="mt-3 text-sm font-bold text-destructive">
                {weights.error.message}
              </p>
            )}
            {weights.isPending ? (
              <p className="mt-4 text-sm text-muted-foreground">Loading weight history…</p>
            ) : weights.data?.length ? (
              <>
                <p className="mt-4 text-sm font-bold">
                  Latest: {displayWeight(weights.data[0]!.weightKg, unit)} {unit}
                  {settings.data?.goalKg !== null && settings.data?.goalKg !== undefined && (
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      · Goal {displayWeight(settings.data.goalKg, unit)} {unit}
                    </span>
                  )}
                </p>
                <div
                  className="mt-3 h-56 w-full"
                  role="img"
                  aria-label={`Weight trend chart in ${unit}`}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={chartData}
                      margin={{ top: 12, right: 12, left: -16, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis
                        width={48}
                        domain={["dataMin - 2", "dataMax + 2"]}
                        tick={{ fontSize: 11 }}
                        unit={` ${unit}`}
                      />
                      <Tooltip
                        formatter={(value) => [`${Number(value).toFixed(1)} ${unit}`, "Weight"]}
                      />
                      {settings.data?.goalKg !== null && settings.data?.goalKg !== undefined && (
                        <ReferenceLine
                          y={displayWeight(settings.data.goalKg, unit)}
                          stroke="hsl(var(--primary))"
                          strokeDasharray="5 5"
                        />
                      )}
                      <Line
                        type="monotone"
                        dataKey="weight"
                        stroke="hsl(var(--primary))"
                        strokeWidth={3}
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : (
              <p className="mt-4 rounded-xl bg-background p-3 text-sm text-muted-foreground">
                Add an entry to start your private weight trend. Weight goals are optional.
              </p>
            )}

            <form onSubmit={submitWeight} className="mt-4 grid gap-3 border-t border-border pt-4">
              <h3 className="font-display text-lg font-semibold">
                {editingId ? "Edit entry" : "Add weight entry"}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1 text-sm font-bold">
                  Weight ({unit})
                  <Input
                    type="number"
                    min="0.1"
                    step="0.1"
                    required
                    value={weightInput}
                    onChange={(event) => setWeightInput(event.target.value)}
                    placeholder={`e.g. 70.5 ${unit}`}
                  />
                </label>
                <label className="grid gap-1 text-sm font-bold">
                  Date
                  <Input
                    type="date"
                    required
                    value={dateInput}
                    onChange={(event) => setDateInput(event.target.value)}
                  />
                </label>
              </div>
              <label className="grid gap-1 text-sm font-bold">
                Note (optional)
                <Textarea
                  value={noteInput}
                  maxLength={500}
                  onChange={(event) => setNoteInput(event.target.value)}
                />
              </label>
              <div className="flex gap-2">
                <Button type="submit" variant="hero" disabled={saveWeight.isPending}>
                  {saveWeight.isPending ? "Saving…" : editingId ? "Update entry" : "Add entry"}
                </Button>
                {editingId && (
                  <Button type="button" variant="outline" onClick={resetWeightForm}>
                    Cancel edit
                  </Button>
                )}
              </div>
              {weightError && (
                <p role="alert" className="text-sm font-bold text-destructive">
                  {weightError}
                </p>
              )}
            </form>

            {(weights.data?.length ?? 0) > 0 && (
              <div className="mt-4 space-y-2 border-t border-border pt-4">
                <h3 className="font-display text-lg font-semibold">Weight history</h3>
                {weights.data?.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-2 rounded-xl bg-background p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-bold">
                        {displayWeight(entry.weightKg, unit)} {unit}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(`${entry.date}T12:00:00`).toLocaleDateString()}
                        {entry.note && ` · ${entry.note}`}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => editWeight(entry)}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      disabled={deleteWeight.isPending}
                      onClick={() => deleteWeight.mutate(entry.id)}
                    >
                      Delete
                    </Button>
                  </div>
                ))}
                {deleteWeight.isError && (
                  <p role="alert" className="text-sm font-bold text-destructive">
                    {deleteWeight.error.message}
                  </p>
                )}
              </div>
            )}
          </Panel>

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
