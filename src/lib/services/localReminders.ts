import type { CalendarEvent, RecurringReminder } from "@/lib/types";

export interface ReminderStore {
  getReminderSnooze(): Promise<string | null>;
  snoozeReminder(until: string | null): Promise<void>;
  claimReminderOccurrence(key: string, deliveredAt: string): Promise<boolean>;
  releaseReminderOccurrence(key: string): Promise<void>;
}

export interface ReminderNotification {
  title: string;
  body: string;
}

export function isQuietTime(time: string, start: string, end: string): boolean {
  if (start === end) return false;
  if (start < end) return time >= start && time < end;
  return time >= start || time < end;
}

function localDate(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function localTime(now: Date): string {
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function scheduledOccurrence(reminder: RecurringReminder, now: Date): string | null {
  if (!reminder.enabled || !reminder.weekdays.includes(now.getDay())) return null;
  const [hour, minute] = reminder.time.split(":").map(Number);
  const scheduled = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute);
  const minutesLate = (now.getTime() - scheduled.getTime()) / 60_000;
  if (minutesLate < 0 || minutesLate > 60) return null;
  if (
    isQuietTime(reminder.time, reminder.quietHoursStart, reminder.quietHoursEnd) ||
    isQuietTime(localTime(now), reminder.quietHoursStart, reminder.quietHoursEnd)
  )
    return null;
  return `recurring:${localDate(now)}:${reminder.time}`;
}

export async function reconcileRecurringReminder(
  reminder: RecurringReminder,
  store: ReminderStore,
  now: Date,
  permission: NotificationPermission,
  notify: (notification: ReminderNotification) => void,
): Promise<boolean> {
  if (!reminder.enabled || permission !== "granted") return false;
  const snooze = await store.getReminderSnooze();
  const snoozedAt = snooze ? Date.parse(snooze) : Number.NaN;
  const time = localTime(now);
  const quiet = isQuietTime(time, reminder.quietHoursStart, reminder.quietHoursEnd);
  const snoozeDue = Number.isFinite(snoozedAt) && snoozedAt <= now.getTime();
  const occurrence = snoozeDue
    ? quiet
      ? null
      : `snooze:${snooze}`
    : snooze
      ? null
      : scheduledOccurrence(reminder, now);
  if (!occurrence) return false;

  const claimed = await store.claimReminderOccurrence(occurrence, now.toISOString());
  if (!claimed) return false;
  try {
    notify({
      title: snoozeDue ? "Your workout reminder" : "A little movement goes a long way",
      body: "Your workout reminder is here. Pick a session that feels right today.",
    });
  } catch (error) {
    await store.releaseReminderOccurrence(occurrence);
    console.error("Could not display workout reminder", error);
    return false;
  }
  if (snoozeDue) {
    await store.claimReminderOccurrence(
      `recurring:${localDate(now)}:${reminder.time}`,
      now.toISOString(),
    );
    await store.snoozeReminder(null);
  }
  return true;
}

export async function reconcileCalendarReminders(
  events: CalendarEvent[],
  reminder: RecurringReminder,
  store: ReminderStore,
  now: Date,
  permission: NotificationPermission,
  notify: (notification: ReminderNotification) => void,
): Promise<number> {
  if (permission !== "granted") return 0;
  const date = localDate(now);
  const time = localTime(now);
  if (isQuietTime(time, reminder.quietHoursStart, reminder.quietHoursEnd)) return 0;
  const [hour, minute] = (reminder.time || "09:00").split(":").map(Number);
  const eventTime = reminder.time || "09:00";
  const scheduled = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute);
  const minutesLate = (now.getTime() - scheduled.getTime()) / 60_000;
  if (
    minutesLate < 0 ||
    minutesLate > 60 ||
    isQuietTime(eventTime, reminder.quietHoursStart, reminder.quietHoursEnd)
  )
    return 0;
  let delivered = 0;
  for (const event of events) {
    if (!event.reminderEnabled || event.date !== date || event.status !== "scheduled") continue;
    const occurrence = `calendar:${event.id}:${date}:${eventTime}`;
    if (!(await store.claimReminderOccurrence(occurrence, now.toISOString()))) continue;
    try {
      notify({
        title: event.routineName,
        body: "Your planned workout is on the calendar for today.",
      });
      delivered += 1;
    } catch (error) {
      await store.releaseReminderOccurrence(occurrence);
      console.error("Could not display calendar workout reminder", error);
    }
  }
  return delivered;
}
