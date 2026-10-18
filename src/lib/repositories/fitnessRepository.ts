import type { Database } from "sql.js";
import type {
  CalendarEvent,
  CalendarEventStatus,
  RecurringReminder,
  Routine,
  WeightEntry,
  WeightUnit,
  WorkoutPlan,
  WorkoutPlanPreferences,
} from "@/lib/types";
import type { GeneratedPlanEvent as PlanEvent } from "@/lib/services/trainingPlan";

export interface FitnessRepository {
  activatePlan(
    name: string,
    preferences: WorkoutPlanPreferences,
    events: PlanEvent[],
  ): Promise<WorkoutPlan>;
  getActivePlan(): Promise<WorkoutPlan | null>;
  listEvents(from: string, to: string): Promise<CalendarEvent[]>;
  getEvent(id: string): Promise<CalendarEvent | null>;
  getRoutine(id: string): Promise<Routine | null>;
  updateEvent(
    id: string,
    update: {
      date?: string;
      status?: CalendarEventStatus;
      note?: string;
      reminderEnabled?: boolean;
    },
  ): Promise<void>;
  getWeights(): Promise<WeightEntry[]>;
  saveWeight(entry: Omit<WeightEntry, "id">, id?: string): Promise<WeightEntry>;
  deleteWeight(id: string): Promise<void>;
  getWeightSettings(): Promise<{ unit: WeightUnit; goalKg: number | null }>;
  saveWeightSettings(settings: { unit: WeightUnit; goalKg: number | null }): Promise<void>;
  getRecurringReminder(): Promise<RecurringReminder>;
  saveRecurringReminder(reminder: RecurringReminder): Promise<void>;
  getReminderSnooze(): Promise<string | null>;
  snoozeReminder(until: string | null): Promise<void>;
  claimReminderOccurrence(key: string, deliveredAt: string): Promise<boolean>;
  releaseReminderOccurrence(key: string): Promise<void>;
}

function readAll(db: Database, sql: string, params: (string | number)[] = []) {
  const statement = db.prepare(sql);
  statement.bind(params);
  const rows: Record<string, unknown>[] = [];
  while (statement.step()) rows.push(statement.getAsObject());
  statement.free();
  return rows;
}

function decodeEvent(row: Record<string, unknown>): CalendarEvent {
  const rawRoutine = row["routine_json"];
  return {
    id: String(row["id"]),
    planId: row["plan_id"] === null ? null : String(row["plan_id"]),
    date: String(row["event_date"]),
    type: row["event_type"] === "rest" ? "rest" : "workout",
    status:
      row["status"] === "completed" || row["status"] === "skipped" || row["status"] === "rest"
        ? row["status"]
        : "scheduled",
    routineId: row["routine_id"] === null ? null : String(row["routine_id"]),
    routineName: String(row["routine_name"]),
    routine: rawRoutine ? (JSON.parse(String(rawRoutine)) as Routine) : null,
    note: String(row["note"] ?? ""),
    reminderEnabled: Number(row["reminder_enabled"]) === 1,
    sourceSessionId: row["source_session_id"] === null ? null : String(row["source_session_id"]),
  };
}

function decodePlan(row: Record<string, unknown>): WorkoutPlan {
  return {
    id: String(row["id"]),
    name: String(row["name"]),
    preferences: JSON.parse(String(row["preferences_json"])) as WorkoutPlanPreferences,
    active: Number(row["active"]) === 1,
    createdAt: String(row["created_at"]),
  };
}

export class SqliteFitnessRepository implements FitnessRepository {
  constructor(
    private readonly db: Database,
    private readonly persist: (db: Database) => Promise<void>,
  ) {}

  async activatePlan(
    name: string,
    preferences: WorkoutPlanPreferences,
    events: PlanEvent[],
  ): Promise<WorkoutPlan> {
    const plan: WorkoutPlan = {
      id: crypto.randomUUID(),
      name,
      preferences,
      active: true,
      createdAt: new Date().toISOString(),
    };
    const today = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`;
    this.db.run("BEGIN TRANSACTION");
    try {
      this.db.run("UPDATE workout_plans SET active = 0 WHERE active = 1");
      this.db.run(
        `UPDATE calendar_events SET status = 'skipped', updated_at = ?
         WHERE plan_id IN (SELECT id FROM workout_plans)
           AND event_date < ? AND status = 'scheduled'`,
        [plan.createdAt, today],
      );
      this.db.run(
        `DELETE FROM calendar_events
         WHERE plan_id IN (SELECT id FROM workout_plans)
           AND event_date >= ? AND status IN ('scheduled','rest')`,
        [today],
      );
      this.db.run(
        "INSERT INTO workout_plans (id, name, preferences_json, active, created_at) VALUES (?,?,?,?,?)",
        [plan.id, plan.name, JSON.stringify(preferences), 1, plan.createdAt],
      );
      for (const event of events) {
        const id = crypto.randomUUID();
        const routineId = event.routine ? `planned:${plan.id}:${event.date}` : null;
        const routine = event.routine ? { ...event.routine, id: routineId! } : null;
        const status =
          event.status === "scheduled" && event.date < today ? "skipped" : event.status;
        this.db.run(
          `INSERT INTO calendar_events
           (id, plan_id, event_date, event_type, status, routine_id, routine_name, routine_json, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?)`,
          [
            id,
            plan.id,
            event.date,
            event.type,
            status,
            routineId,
            routine?.name ?? "Rest day",
            routine ? JSON.stringify(routine) : null,
            plan.createdAt,
          ],
        );
      }
      this.db.run("COMMIT");
      await this.persist(this.db);
      return plan;
    } catch (error) {
      try {
        this.db.run("ROLLBACK");
      } catch {
        // The transaction may already have committed.
      }
      throw error;
    }
  }

  async getActivePlan(): Promise<WorkoutPlan | null> {
    const [row] = readAll(
      this.db,
      "SELECT id, name, preferences_json, active, created_at FROM workout_plans WHERE active = 1 ORDER BY created_at DESC LIMIT 1",
    );
    return row ? decodePlan(row) : null;
  }

  async listEvents(from: string, to: string): Promise<CalendarEvent[]> {
    return readAll(
      this.db,
      `SELECT id, plan_id, event_date, event_type, status, routine_id, routine_name,
        routine_json, note, reminder_enabled, source_session_id
       FROM calendar_events WHERE event_date >= ? AND event_date <= ? ORDER BY event_date, id`,
      [from, to],
    ).map(decodeEvent);
  }

  async getEvent(id: string): Promise<CalendarEvent | null> {
    const [row] = readAll(
      this.db,
      `SELECT id, plan_id, event_date, event_type, status, routine_id, routine_name,
        routine_json, note, reminder_enabled, source_session_id
       FROM calendar_events WHERE id = ?`,
      [id],
    );
    return row ? decodeEvent(row) : null;
  }

  async getRoutine(id: string): Promise<Routine | null> {
    const [row] = readAll(
      this.db,
      "SELECT routine_json FROM calendar_events WHERE routine_id = ? AND routine_json IS NOT NULL LIMIT 1",
      [id],
    );
    return row ? (JSON.parse(String(row["routine_json"])) as Routine) : null;
  }

  async updateEvent(
    id: string,
    update: {
      date?: string;
      status?: CalendarEventStatus;
      note?: string;
      reminderEnabled?: boolean;
    },
  ): Promise<void> {
    const event = await this.getEvent(id);
    if (!event) throw new Error("Calendar event no longer exists");
    if (update.date !== undefined && event.status !== "scheduled")
      throw new Error("Only scheduled workouts can be rescheduled");
    if (update.status !== undefined && (event.type !== "workout" || event.status !== "scheduled"))
      throw new Error("Only scheduled workouts can change their status");
    const nextStatus = update.status ?? event.status;
    const nextDate = update.date ?? event.date;
    if (update.date !== undefined && update.date !== event.date) {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(nextDate);
      const parsedDate = match
        ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
        : null;
      if (
        !parsedDate ||
        parsedDate.getFullYear() !== Number(match?.[1]) ||
        parsedDate.getMonth() !== Number(match?.[2]) - 1 ||
        parsedDate.getDate() !== Number(match?.[3])
      )
        throw new Error("Enter a valid reschedule date");
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      if (nextDate < today) throw new Error("A workout can't be rescheduled into the past");
      if (
        event.planId &&
        readAll(
          this.db,
          `SELECT id FROM calendar_events
           WHERE plan_id = ? AND event_date = ? AND event_type = 'workout'
             AND status = 'scheduled' AND id != ?`,
          [event.planId, nextDate, id],
        ).length > 0
      )
        throw new Error("Another workout is already scheduled for that date");
    }
    const updatedAt = new Date().toISOString();
    this.db.run("BEGIN TRANSACTION");
    try {
      if (event.planId && nextDate !== event.date) {
        const active =
          readAll(this.db, "SELECT id FROM workout_plans WHERE id = ? AND active = 1", [
            event.planId,
          ]).length > 0;
        if (active) {
          this.db.run(
            "DELETE FROM calendar_events WHERE plan_id = ? AND event_date = ? AND status = 'rest'",
            [event.planId, nextDate],
          );
          this.db.run(
            `INSERT INTO calendar_events
             (id, plan_id, event_date, event_type, status, routine_name, updated_at)
             VALUES (?,?,?,'rest','rest','Rest day',?)`,
            [crypto.randomUUID(), event.planId, event.date, updatedAt],
          );
        }
      }
      this.db.run(
        `UPDATE calendar_events SET event_date = ?, status = ?, note = ?, reminder_enabled = ?, updated_at = ?
         WHERE id = ?`,
        [
          nextDate,
          nextStatus,
          update.note ?? event.note,
          Number(update.reminderEnabled ?? event.reminderEnabled),
          updatedAt,
          id,
        ],
      );
      this.db.run("COMMIT");
      await this.persist(this.db);
    } catch (error) {
      try {
        this.db.run("ROLLBACK");
      } catch {
        // The transaction may already have committed.
      }
      throw error;
    }
  }

  async getWeights(): Promise<WeightEntry[]> {
    return readAll(
      this.db,
      "SELECT id, measured_date, weight_kg, note FROM weight_entries ORDER BY measured_date DESC, id",
    ).map((row) => ({
      id: String(row["id"]),
      date: String(row["measured_date"]),
      weightKg: Number(row["weight_kg"]),
      note: String(row["note"] ?? ""),
    }));
  }

  async saveWeight(
    entry: Omit<WeightEntry, "id">,
    id: string = crypto.randomUUID(),
  ): Promise<WeightEntry> {
    if (!Number.isFinite(entry.weightKg) || entry.weightKg <= 0)
      throw new Error("Weight must be a positive number");
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(entry.date);
    const parsedDate = match
      ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
      : null;
    if (
      !parsedDate ||
      parsedDate.getFullYear() !== Number(match?.[1]) ||
      parsedDate.getMonth() !== Number(match?.[2]) - 1 ||
      parsedDate.getDate() !== Number(match?.[3])
    )
      throw new Error("Enter a valid measurement date");
    this.db.run(
      `INSERT INTO weight_entries (id, measured_date, weight_kg, note, updated_at)
       VALUES (?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET measured_date=excluded.measured_date,
         weight_kg=excluded.weight_kg, note=excluded.note, updated_at=excluded.updated_at`,
      [id, entry.date, entry.weightKg, entry.note, new Date().toISOString()],
    );
    await this.persist(this.db);
    return { id, ...entry };
  }

  async deleteWeight(id: string): Promise<void> {
    this.db.run("DELETE FROM weight_entries WHERE id = ?", [id]);
    await this.persist(this.db);
  }

  async getWeightSettings(): Promise<{ unit: WeightUnit; goalKg: number | null }> {
    const [row] = readAll(
      this.db,
      "SELECT weight_unit, weight_goal_kg FROM fitness_preferences WHERE id = 1",
    );
    if (!row) throw new Error("Weight settings are missing");
    return {
      unit: row["weight_unit"] === "lb" ? "lb" : "kg",
      goalKg: row["weight_goal_kg"] === null ? null : Number(row["weight_goal_kg"]),
    };
  }

  async saveWeightSettings(settings: { unit: WeightUnit; goalKg: number | null }): Promise<void> {
    if (settings.goalKg !== null && (!Number.isFinite(settings.goalKg) || settings.goalKg <= 0))
      throw new Error("Weight goal must be a positive number");
    this.db.run("UPDATE fitness_preferences SET weight_unit = ?, weight_goal_kg = ? WHERE id = 1", [
      settings.unit,
      settings.goalKg,
    ]);
    await this.persist(this.db);
  }

  async getRecurringReminder(): Promise<RecurringReminder> {
    const [row] = readAll(
      this.db,
      `SELECT enabled, weekdays_json, reminder_time, quiet_hours_start, quiet_hours_end
       FROM recurring_reminders WHERE id = 1`,
    );
    if (!row) throw new Error("Reminder settings are missing");
    return {
      enabled: Number(row["enabled"]) === 1,
      weekdays: JSON.parse(String(row["weekdays_json"])) as number[],
      time: String(row["reminder_time"]),
      quietHoursStart: String(row["quiet_hours_start"]),
      quietHoursEnd: String(row["quiet_hours_end"]),
    };
  }

  async saveRecurringReminder(reminder: RecurringReminder): Promise<void> {
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(reminder.time))
      throw new Error("Enter a valid reminder time");
    if (
      !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(reminder.quietHoursStart) ||
      !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(reminder.quietHoursEnd)
    )
      throw new Error("Enter valid quiet hours");
    if (reminder.weekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6))
      throw new Error("Choose valid reminder days");
    if (reminder.enabled && reminder.weekdays.length === 0)
      throw new Error("Choose at least one reminder day");
    this.db.run(
      `UPDATE recurring_reminders SET enabled = ?, weekdays_json = ?, reminder_time = ?,
       quiet_hours_start = ?, quiet_hours_end = ? WHERE id = 1`,
      [
        Number(reminder.enabled),
        JSON.stringify([...new Set(reminder.weekdays)]),
        reminder.time,
        reminder.quietHoursStart,
        reminder.quietHoursEnd,
      ],
    );
    if (!reminder.enabled)
      this.db.run("UPDATE reminder_runtime_state SET snooze_until = NULL WHERE id = 1");
    await this.persist(this.db);
  }

  async getReminderSnooze(): Promise<string | null> {
    const [row] = readAll(this.db, "SELECT snooze_until FROM reminder_runtime_state WHERE id = 1");
    if (!row) throw new Error("Reminder state is missing");
    return row["snooze_until"] === null ? null : String(row["snooze_until"]);
  }

  async snoozeReminder(until: string | null): Promise<void> {
    if (until !== null && !Number.isFinite(Date.parse(until)))
      throw new Error("Enter a valid snooze time");
    this.db.run("UPDATE reminder_runtime_state SET snooze_until = ? WHERE id = 1", [until]);
    await this.persist(this.db);
  }

  async claimReminderOccurrence(key: string, deliveredAt: string): Promise<boolean> {
    this.db.run(
      "INSERT OR IGNORE INTO reminder_deliveries (occurrence_key, delivered_at) VALUES (?,?)",
      [key, deliveredAt],
    );
    const inserted = this.db.getRowsModified() === 1;
    if (inserted) await this.persist(this.db);
    return inserted;
  }

  async releaseReminderOccurrence(key: string): Promise<void> {
    this.db.run("DELETE FROM reminder_deliveries WHERE occurrence_key = ?", [key]);
    await this.persist(this.db);
  }
}
