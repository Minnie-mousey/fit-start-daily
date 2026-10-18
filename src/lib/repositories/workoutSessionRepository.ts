import type { Database } from "sql.js";
import type { ExercisePerformance, NewWorkoutSession, WorkoutSession } from "@/lib/types";
import { awardCompletedSession } from "@/lib/services/gamificationRewards";

/** Storage-agnostic contract so a cloud-synced implementation can be added later. */
export interface WorkoutSessionRepository {
  save(
    session: NewWorkoutSession,
    performance?: ExercisePerformance[],
    idempotencyKey?: string,
  ): Promise<WorkoutSession>;
  list(limit?: number): Promise<WorkoutSession[]>;
  listPerformance(sessionId: string): Promise<ExercisePerformance[]>;
  clearAll(): Promise<void>;
}

export class SqliteWorkoutSessionRepository implements WorkoutSessionRepository {
  constructor(
    private db: Database,
    private persist: (db: Database) => Promise<void>,
  ) {}

  async save(
    input: NewWorkoutSession,
    performance: ExercisePerformance[] = [],
    idempotencyKey?: string,
  ): Promise<WorkoutSession> {
    const session: WorkoutSession = { id: idempotencyKey ?? crypto.randomUUID(), ...input };
    this.db.run("BEGIN TRANSACTION");
    try {
      this.db.run(
        `INSERT OR IGNORE INTO workout_sessions (id, routine_id, routine_name, started_at, completed_at,
        duration_seconds, exercises_completed, total_exercises, status, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [
          session.id,
          session.routineId,
          session.routineName,
          session.startedAt,
          session.completedAt,
          session.durationSeconds,
          session.exercisesCompleted,
          session.totalExercises,
          session.status,
          new Date().toISOString(),
        ],
      );
      const inserted = this.db.getRowsModified() > 0;
      if (!inserted) {
        const prior = this.getById(session.id);
        if (
          !prior ||
          prior.routineId !== session.routineId ||
          prior.startedAt !== session.startedAt
        ) {
          throw new Error("Session idempotency key was reused for a different workout");
        }
        this.db.run("COMMIT");
        await this.persist(this.db);
        return prior;
      }
      for (const record of performance) {
        this.db.run(
          `INSERT INTO workout_exercise_performance
          (session_id, sequence, exercise_id, exercise_name, target_kind, target_value,
           actual_reps, actual_seconds, status)
         VALUES (?,?,?,?,?,?,?,?,?)`,
          [
            session.id,
            record.sequence,
            record.exerciseId,
            record.exerciseName,
            record.target.kind,
            record.target.kind === "time" ? record.target.seconds : record.target.reps,
            record.actualReps,
            record.actualSeconds,
            record.status,
          ],
        );
      }
      const completedDate = new Date(session.completedAt);
      const eventDate = `${completedDate.getFullYear()}-${String(completedDate.getMonth() + 1).padStart(2, "0")}-${String(completedDate.getDate()).padStart(2, "0")}`;
      const calendarStatus = session.status === "cancelled" ? "skipped" : "completed";
      this.db.run(
        `UPDATE calendar_events SET status = ?, source_session_id = ?, updated_at = ?
         WHERE id = (
           SELECT id FROM calendar_events
           WHERE event_date = ? AND routine_id = ? AND status = 'scheduled'
           ORDER BY id LIMIT 1
         )`,
        [calendarStatus, session.id, session.completedAt, eventDate, session.routineId],
      );
      if (this.db.getRowsModified() === 0) {
        this.db.run(
          `INSERT OR IGNORE INTO calendar_events
           (id, event_date, event_type, status, routine_id, routine_name, source_session_id, updated_at)
           VALUES (?,?,'workout',?,?,?,?,?)`,
          [
            crypto.randomUUID(),
            eventDate,
            calendarStatus,
            session.routineId,
            session.routineName,
            session.id,
            session.completedAt,
          ],
        );
      }
      awardCompletedSession(this.db, session);
      this.db.run("COMMIT");
      await this.persist(this.db);
      return session;
    } catch (error) {
      try {
        this.db.run("ROLLBACK");
      } catch {
        /* transaction already committed */
      }
      throw error;
    }
  }

  private getById(id: string): WorkoutSession | null {
    const statement = this.db.prepare(
      `SELECT id, routine_id, routine_name, started_at, completed_at, duration_seconds,
        exercises_completed, total_exercises, status FROM workout_sessions WHERE id = ?`,
    );
    statement.bind([id]);
    const row = statement.step() ? statement.getAsObject() : null;
    statement.free();
    if (!row) return null;
    return {
      id: String(row["id"]),
      routineId: String(row["routine_id"]),
      routineName: String(row["routine_name"]),
      startedAt: String(row["started_at"]),
      completedAt: String(row["completed_at"]),
      durationSeconds: Number(row["duration_seconds"]),
      exercisesCompleted: Number(row["exercises_completed"]),
      totalExercises: Number(row["total_exercises"]),
      status:
        row["status"] === "partial"
          ? "partial"
          : row["status"] === "cancelled"
            ? "cancelled"
            : "completed",
    };
  }

  async list(limit = 500): Promise<WorkoutSession[]> {
    const stmt = this.db.prepare(
      `SELECT id, routine_id, routine_name, started_at, completed_at, duration_seconds,
        exercises_completed, total_exercises, status
       FROM workout_sessions ORDER BY completed_at DESC LIMIT ?`,
    );
    stmt.bind([limit]);
    const rows: WorkoutSession[] = [];
    while (stmt.step()) {
      const r = stmt.getAsObject();
      rows.push({
        id: String(r["id"]),
        routineId: String(r["routine_id"]),
        routineName: String(r["routine_name"]),
        startedAt: String(r["started_at"]),
        completedAt: String(r["completed_at"]),
        durationSeconds: Number(r["duration_seconds"]),
        exercisesCompleted: Number(r["exercises_completed"]),
        totalExercises: Number(r["total_exercises"]),
        status:
          r["status"] === "partial"
            ? "partial"
            : r["status"] === "cancelled"
              ? "cancelled"
              : "completed",
      });
    }
    stmt.free();
    return rows;
  }

  async listPerformance(sessionId: string): Promise<ExercisePerformance[]> {
    const stmt = this.db.prepare(
      `SELECT sequence, exercise_id, exercise_name, target_kind, target_value,
        actual_reps, actual_seconds, status
       FROM workout_exercise_performance WHERE session_id = ? ORDER BY sequence`,
    );
    stmt.bind([sessionId]);
    const rows: ExercisePerformance[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      const targetValue = Number(row["target_value"]);
      const target =
        row["target_kind"] === "time"
          ? { kind: "time" as const, seconds: targetValue }
          : { kind: "reps" as const, reps: targetValue };
      rows.push({
        sequence: Number(row["sequence"]),
        exerciseId: String(row["exercise_id"]),
        exerciseName: String(row["exercise_name"]),
        target,
        actualReps: row["actual_reps"] === null ? null : Number(row["actual_reps"]),
        actualSeconds: Number(row["actual_seconds"]),
        status: row["status"] === "skipped" ? "skipped" : "completed",
      });
    }
    stmt.free();
    return rows;
  }

  async clearAll(): Promise<void> {
    this.db.run("DELETE FROM workout_sessions");
    await this.persist(this.db);
  }
}
