import type { Database } from "sql.js";
import type { NewWorkoutSession, WorkoutSession } from "@/lib/types";

/** Storage-agnostic contract so a cloud-synced implementation can be added later. */
export interface WorkoutSessionRepository {
  save(session: NewWorkoutSession): Promise<WorkoutSession>;
  list(limit?: number): Promise<WorkoutSession[]>;
  clearAll(): Promise<void>;
}

export class SqliteWorkoutSessionRepository implements WorkoutSessionRepository {
  constructor(
    private db: Database,
    private persist: (db: Database) => Promise<void>,
  ) {}

  async save(input: NewWorkoutSession): Promise<WorkoutSession> {
    const session: WorkoutSession = { id: crypto.randomUUID(), ...input };
    this.db.run(
      `INSERT INTO workout_sessions (id, routine_id, routine_name, started_at, completed_at,
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
    await this.persist(this.db);
    return session;
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
        id: String(r.id),
        routineId: String(r.routine_id),
        routineName: String(r.routine_name),
        startedAt: String(r.started_at),
        completedAt: String(r.completed_at),
        durationSeconds: Number(r.duration_seconds),
        exercisesCompleted: Number(r.exercises_completed),
        totalExercises: Number(r.total_exercises),
        status: r.status === "partial" ? "partial" : "completed",
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
