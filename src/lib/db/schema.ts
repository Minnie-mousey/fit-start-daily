/** Ordered, append-only migrations. Never edit a shipped migration; add a new one. */
export const MIGRATIONS: { version: number; sql: string }[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE workout_sessions (
        id TEXT PRIMARY KEY,
        routine_id TEXT NOT NULL,
        routine_name TEXT NOT NULL,
        started_at TEXT NOT NULL,
        completed_at TEXT NOT NULL,
        duration_seconds INTEGER NOT NULL,
        exercises_completed INTEGER NOT NULL,
        total_exercises INTEGER NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('completed','partial')),
        updated_at TEXT NOT NULL
      );
      CREATE INDEX idx_sessions_completed_at ON workout_sessions(completed_at);
    `,
  },
];
