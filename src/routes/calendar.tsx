import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, ChevronLeft, ChevronRight, CircleCheck, Clock3, Moon, XCircle } from "lucide-react";
import { Page, PageHeader, Panel } from "@/components/app/Page";
import { ErrorState, LoadingState } from "@/components/app/States";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  useCalendarEvents,
  useReminderSnooze,
  useRecurringReminder,
  useSaveRecurringReminder,
  useSnoozeReminder,
  useUpdateCalendarEvent,
} from "@/hooks/use-fitness";
import { dayKey } from "@/lib/services/stats";
import { cn } from "@/lib/utils";
import type { CalendarEvent, RecurringReminder } from "@/lib/types";

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
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const EVENT_STYLES = {
  scheduled: "bg-sky text-sky-foreground",
  completed: "bg-success text-success-foreground",
  skipped: "bg-destructive/15 text-destructive",
  rest: "bg-secondary text-secondary-foreground",
} as const;

function CalendarPage() {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => dayKey(new Date()));
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const from = dayKey(month);
  const to = dayKey(new Date(month.getFullYear(), month.getMonth() + 1, 0));
  const eventsQuery = useCalendarEvents(from, to);
  const updateEvent = useUpdateCalendarEvent();
  const reminderQuery = useRecurringReminder();
  const saveReminder = useSaveRecurringReminder();
  const reminderSnooze = useReminderSnooze();
  const snoozeReminder = useSnoozeReminder();
  const [reminderDraft, setReminderDraft] = useState<RecurringReminder>({
    enabled: false,
    weekdays: [],
    time: "09:00",
    quietHoursStart: "22:00",
    quietHoursEnd: "07:00",
  });
  const [noteDraft, setNoteDraft] = useState("");
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [reminderError, setReminderError] = useState<string | null>(null);

  const events = eventsQuery.data ?? [];
  const dayEvents = events.filter((event) => event.date === selectedDate);
  const selectedEvent =
    events.find((event) => event.id === selectedEventId) ?? dayEvents[0] ?? null;
  const counts = new Map<string, CalendarEvent[]>();
  events.forEach((event) => counts.set(event.date, [...(counts.get(event.date) ?? []), event]));
  const completedCount = events.filter((event) => event.status === "completed").length;
  const error =
    eventsQuery.error?.message ?? (eventsQuery.isError ? "Couldn't load calendar entries" : null);

  useEffect(() => {
    if (reminderQuery.data) setReminderDraft(reminderQuery.data);
  }, [reminderQuery.data]);
  useEffect(() => {
    setSelectedEventId(null);
  }, [selectedDate]);
  useEffect(() => {
    setNoteDraft(selectedEvent?.note ?? "");
    setRescheduleDate(selectedEvent?.date ?? "");
  }, [selectedEvent?.id, selectedEvent?.note, selectedEvent?.date]);

  const offset = (month.getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const todayKey = dayKey(new Date());
  const shift = (n: number) => {
    const nextMonth = new Date(month.getFullYear(), month.getMonth() + n, 1);
    setMonth(nextMonth);
    setSelectedDate(dayKey(new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1)));
  };
  const selectedDateLabel = new Date(`${selectedDate}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const setStatus = (event: CalendarEvent, status: "completed" | "skipped") =>
    updateEvent.mutate({ id: event.id, status });

  const changeReminder = (weekday: number) =>
    setReminderDraft((current) => ({
      ...current,
      weekdays: current.weekdays.includes(weekday)
        ? current.weekdays.filter((day) => day !== weekday)
        : [...current.weekdays, weekday].sort((a, b) => a - b),
    }));

  const persistReminder = async () => {
    setReminderError(null);
    if (reminderDraft.enabled) {
      if (reminderDraft.weekdays.length === 0) {
        setReminderError("Choose at least one weekday for your reminder.");
        return;
      }
      if (!("Notification" in window)) {
        setReminderError("This browser does not support notifications.");
        return;
      }
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setReminderError("Allow notifications in your browser to turn on reminders.");
          return;
        }
      } catch (reason) {
        setReminderError(
          reason instanceof Error ? reason.message : "Could not request notification permission.",
        );
        return;
      }
    }
    saveReminder.mutate(reminderDraft);
  };

  return (
    <Page>
      <PageHeader title="Calendar" subtitle="Your plans, rest days and workout history." />
      {eventsQuery.isPending ? (
        <LoadingState rows={4} />
      ) : error ? (
        <ErrorState message={error} onRetry={() => eventsQuery.refetch()} />
      ) : (
        <>
          <Panel className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Previous month"
                onClick={() => shift(-1)}
              >
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
              {WEEKDAYS.map((weekday, index) => (
                <span key={`${weekday}-${index}`}>{weekday}</span>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-7 gap-1">
              {Array.from({ length: offset }).map((_, index) => (
                <span key={`empty-${index}`} />
              ))}
              {Array.from({ length: daysInMonth }, (_, index) => {
                const date = dayKey(new Date(month.getFullYear(), month.getMonth(), index + 1));
                const dateEvents = counts.get(date) ?? [];
                const statuses = [...new Set(dateEvents.map((event) => event.status))];
                return (
                  <button
                    key={date}
                    type="button"
                    aria-label={`${date}${statuses.length ? `: ${statuses.join(", ")}` : ""}`}
                    aria-pressed={date === selectedDate}
                    onClick={() => setSelectedDate(date)}
                    className={cn(
                      "relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm font-bold",
                      date === selectedDate
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground hover:bg-accent",
                      date === todayKey && date !== selectedDate && "ring-2 ring-primary",
                    )}
                  >
                    {index + 1}
                    {statuses.length > 0 && (
                      <span className="mt-1 flex gap-0.5" aria-hidden>
                        {statuses.slice(0, 3).map((status) => (
                          <span
                            key={status}
                            className={cn(
                              "h-1 w-1 rounded-full",
                              date === selectedDate
                                ? "bg-primary-foreground"
                                : EVENT_STYLES[status].split(" ")[0],
                            )}
                          />
                        ))}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-x-3 gap-y-2 text-xs">
              <Legend icon={Clock3} label="Scheduled" className="text-sky-foreground" />
              <Legend icon={CircleCheck} label="Completed" className="text-success" />
              <Legend icon={XCircle} label="Skipped" className="text-destructive" />
              <Legend icon={Moon} label="Rest" className="text-secondary-foreground" />
            </div>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              {completedCount} completed workout{completedCount === 1 ? "" : "s"} this month
            </p>
          </Panel>

          <Panel className="mt-4">
            <h2 className="font-display text-lg font-semibold">{selectedDateLabel}</h2>
            {dayEvents.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Nothing scheduled for this day.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {dayEvents.map((event) => (
                  <article
                    key={event.id}
                    className={cn("rounded-2xl p-3", EVENT_STYLES[event.status])}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <button
                        type="button"
                        className="text-left"
                        onClick={() => setSelectedEventId(event.id)}
                        aria-pressed={selectedEvent?.id === event.id}
                      >
                        <p className="font-bold">{event.routineName}</p>
                        <p className="text-xs capitalize">{event.status}</p>
                      </button>
                      {event.reminderEnabled && (
                        <Bell className="h-4 w-4" aria-label="Reminder set" />
                      )}
                    </div>
                    {event.type === "workout" &&
                      event.routineId &&
                      event.status === "scheduled" && (
                        <Link
                          to="/play/$routineId"
                          params={{ routineId: event.routineId }}
                          className="mt-2 inline-flex rounded-full bg-card px-3 py-1.5 text-xs font-bold text-foreground"
                        >
                          Start workout
                        </Link>
                      )}
                  </article>
                ))}
              </div>
            )}
            {selectedEvent && (
              <div className="mt-4 space-y-3 border-t border-border pt-4">
                {selectedEvent.type === "workout" && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="grid gap-1 text-xs font-bold">
                        Reschedule date
                        <input
                          type="date"
                          value={rescheduleDate}
                          onChange={(event) => setRescheduleDate(event.target.value)}
                          className="h-10 rounded-lg border border-border bg-background px-2"
                          disabled={selectedEvent.status !== "scheduled"}
                        />
                      </label>
                      <div className="flex items-end">
                        <Button
                          variant="soft"
                          size="sm"
                          className="w-full"
                          disabled={
                            selectedEvent.status !== "scheduled" ||
                            rescheduleDate === selectedEvent.date ||
                            updateEvent.isPending
                          }
                          onClick={() =>
                            updateEvent.mutate({ id: selectedEvent.id, date: rescheduleDate })
                          }
                        >
                          Reschedule
                        </Button>
                      </div>
                    </div>
                    {selectedEvent.status === "scheduled" && (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="soft"
                          onClick={() => setStatus(selectedEvent, "completed")}
                        >
                          <CircleCheck aria-hidden /> Mark completed
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setStatus(selectedEvent, "skipped")}
                        >
                          <XCircle aria-hidden /> Skip workout
                        </Button>
                        <label className="ml-auto flex items-center gap-2 text-sm font-bold">
                          <input
                            type="checkbox"
                            checked={selectedEvent.reminderEnabled}
                            onChange={async (change) => {
                              const enabled = change.target.checked;
                              setReminderError(null);
                              if (!enabled) {
                                updateEvent.mutate({
                                  id: selectedEvent.id,
                                  reminderEnabled: false,
                                });
                                return;
                              }
                              if (!("Notification" in window)) {
                                setReminderError("This browser does not support notifications.");
                                return;
                              }
                              try {
                                const permission = await Notification.requestPermission();
                                if (permission !== "granted") {
                                  setReminderError(
                                    "Allow notifications in your browser to turn on reminders.",
                                  );
                                  return;
                                }
                                updateEvent.mutate({
                                  id: selectedEvent.id,
                                  reminderEnabled: true,
                                });
                              } catch (reason) {
                                setReminderError(
                                  reason instanceof Error
                                    ? reason.message
                                    : "Could not request notification permission.",
                                );
                              }
                            }}
                          />
                          <Bell className="h-4 w-4" aria-hidden /> Reminder
                        </label>
                      </div>
                    )}
                  </>
                )}
                <label className="grid gap-1 text-sm font-bold">
                  Notes
                  <Textarea
                    value={noteDraft}
                    onChange={(event) => setNoteDraft(event.target.value)}
                    maxLength={1000}
                  />
                </label>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <label className="grid gap-1 text-sm font-bold">
                    Quiet hours start
                    <input
                      type="time"
                      value={reminderDraft.quietHoursStart}
                      onChange={(event) =>
                        setReminderDraft({ ...reminderDraft, quietHoursStart: event.target.value })
                      }
                      className="h-10 rounded-lg border border-border bg-background px-2"
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-bold">
                    Quiet hours end
                    <input
                      type="time"
                      value={reminderDraft.quietHoursEnd}
                      onChange={(event) =>
                        setReminderDraft({ ...reminderDraft, quietHoursEnd: event.target.value })
                      }
                      className="h-10 rounded-lg border border-border bg-background px-2"
                    />
                  </label>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Reminders within quiet hours are skipped. Snooze and cancellation apply to your
                  recurring reminder.
                </p>
                <Button
                  size="sm"
                  variant="soft"
                  disabled={noteDraft === selectedEvent.note || updateEvent.isPending}
                  onClick={() => updateEvent.mutate({ id: selectedEvent.id, note: noteDraft })}
                >
                  Save note
                </Button>
              </div>
            )}
            {updateEvent.isError && (
              <p role="alert" className="mt-2 text-sm font-bold text-destructive">
                {updateEvent.error.message}
              </p>
            )}
            {reminderDraft.enabled && (
              <div className="mt-4 border-t border-border pt-3">
                <p className="text-sm font-bold">Snooze recurring reminder</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[5, 15, 30].map((minutes) => (
                    <Button
                      key={minutes}
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={snoozeReminder.isPending}
                      onClick={() => snoozeReminder.mutate(minutes)}
                    >
                      Snooze {minutes} min
                    </Button>
                  ))}
                  {reminderSnooze.data && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={snoozeReminder.isPending}
                      onClick={() => snoozeReminder.mutate(null)}
                    >
                      Cancel snooze
                    </Button>
                  )}
                </div>
                {reminderSnooze.data && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Snoozed until{" "}
                    {new Date(reminderSnooze.data).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                )}
                {snoozeReminder.isError && (
                  <p role="alert" className="mt-2 text-sm font-bold text-destructive">
                    {snoozeReminder.error.message}
                  </p>
                )}
              </div>
            )}
          </Panel>

          <Panel className="mt-4">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
              <Bell className="h-5 w-5 text-primary" aria-hidden /> Weekly reminders
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Browser notifications are delivered while this app is open and permission is granted.
            </p>
            <label className="mt-3 flex items-center gap-2 text-sm font-bold">
              <input
                type="checkbox"
                checked={reminderDraft.enabled}
                onChange={(event) =>
                  setReminderDraft({ ...reminderDraft, enabled: event.target.checked })
                }
              />
              Turn on recurring reminders
            </label>
            <div
              className="mt-3 grid grid-cols-7 gap-1"
              role="group"
              aria-label="Reminder weekdays"
            >
              {DAY_NAMES.map((name, weekday) => (
                <button
                  key={name}
                  type="button"
                  aria-pressed={reminderDraft.weekdays.includes(weekday)}
                  onClick={() => changeReminder(weekday)}
                  className={cn(
                    "h-9 rounded-lg text-xs font-bold",
                    reminderDraft.weekdays.includes(weekday)
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground",
                  )}
                >
                  {name}
                </button>
              ))}
            </div>
            <label className="mt-3 grid gap-1 text-sm font-bold">
              Reminder time
              <input
                type="time"
                value={reminderDraft.time}
                onChange={(event) =>
                  setReminderDraft({ ...reminderDraft, time: event.target.value })
                }
                className="h-10 rounded-lg border border-border bg-background px-2"
              />
            </label>
            <Button
              className="mt-3"
              size="sm"
              variant="soft"
              disabled={saveReminder.isPending}
              onClick={persistReminder}
            >
              Save reminder
            </Button>
            {saveReminder.isError && (
              <p role="alert" className="mt-2 text-sm font-bold text-destructive">
                {saveReminder.error.message}
              </p>
            )}
            {reminderError && (
              <p role="alert" className="mt-2 text-sm font-bold text-destructive">
                {reminderError}
              </p>
            )}
            {reminderQuery.isError && (
              <p role="alert" className="mt-2 text-sm font-bold text-destructive">
                {reminderQuery.error.message}
              </p>
            )}
          </Panel>
        </>
      )}
    </Page>
  );
}

function Legend({
  icon: Icon,
  label,
  className,
}: {
  icon: typeof Clock3;
  label: string;
  className: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1 font-bold", className)}>
      <Icon className="h-3 w-3" aria-hidden /> {label}
    </span>
  );
}
