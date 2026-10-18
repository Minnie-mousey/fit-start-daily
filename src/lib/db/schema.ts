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
  {
    version: 2,
    sql: `
      CREATE TABLE workout_sessions_v2 (
        id TEXT PRIMARY KEY,
        routine_id TEXT NOT NULL,
        routine_name TEXT NOT NULL,
        started_at TEXT NOT NULL,
        completed_at TEXT NOT NULL,
        duration_seconds INTEGER NOT NULL,
        exercises_completed INTEGER NOT NULL,
        total_exercises INTEGER NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('completed','partial','cancelled')),
        updated_at TEXT NOT NULL
      );
      INSERT INTO workout_sessions_v2
        SELECT id, routine_id, routine_name, started_at, completed_at, duration_seconds,
          exercises_completed, total_exercises, status, updated_at
        FROM workout_sessions;
      DROP TABLE workout_sessions;
      ALTER TABLE workout_sessions_v2 RENAME TO workout_sessions;
      CREATE INDEX idx_sessions_completed_at ON workout_sessions(completed_at);
      CREATE TABLE workout_exercise_performance (
        session_id TEXT NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
        sequence INTEGER NOT NULL,
        exercise_id TEXT NOT NULL,
        exercise_name TEXT NOT NULL,
        target_kind TEXT NOT NULL CHECK (target_kind IN ('time','reps')),
        target_value INTEGER NOT NULL,
        actual_reps INTEGER,
        actual_seconds INTEGER NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('completed','skipped')),
        PRIMARY KEY (session_id, sequence)
      );
      CREATE INDEX idx_performance_session ON workout_exercise_performance(session_id, sequence);
    `,
  },
  {
    version: 3,
    sql: `
      CREATE TABLE player_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        time_zone TEXT NOT NULL,
        time_zone_source TEXT NOT NULL CHECK (time_zone_source IN ('device','user')),
        planned_rest_weekdays TEXT NOT NULL,
        planned_rest_start_date TEXT NOT NULL,
        recovery_tokens INTEGER NOT NULL DEFAULT 0 CHECK (recovery_tokens >= 0)
      );
      INSERT INTO player_settings (id, time_zone, time_zone_source, planned_rest_weekdays, planned_rest_start_date, recovery_tokens)
        VALUES (1, 'UTC', 'device', '0,6', '1970-01-01', 0);

      CREATE TABLE reward_ledger (
        id TEXT PRIMARY KEY,
        source_type TEXT NOT NULL,
        source_id TEXT NOT NULL,
        reward_key TEXT NOT NULL,
        xp_delta INTEGER NOT NULL,
        coins_delta INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE (source_type, source_id, reward_key)
      );
      CREATE INDEX idx_reward_ledger_created ON reward_ledger(created_at);

      CREATE TABLE challenge_progress (
        challenge_id TEXT NOT NULL,
        period_key TEXT NOT NULL,
        progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0),
        completed_at TEXT,
        PRIMARY KEY (challenge_id, period_key)
      );

      CREATE TABLE qualifying_activity_days (
        local_date TEXT PRIMARY KEY,
        source_session_id TEXT NOT NULL,
        activity_type TEXT NOT NULL,
        time_zone TEXT NOT NULL
      );

      CREATE TABLE streak_recoveries (
        local_date TEXT PRIMARY KEY,
        token_spent_at TEXT NOT NULL
      );

      CREATE TABLE unlocked_achievements (
        achievement_id TEXT PRIMARY KEY,
        unlocked_at TEXT NOT NULL
      );

      CREATE TABLE cosmetic_inventory (
        item_id TEXT PRIMARY KEY,
        unlocked_at TEXT NOT NULL,
        source_type TEXT NOT NULL,
        source_id TEXT NOT NULL
      );

      CREATE TABLE equipped_cosmetics (
        slot TEXT PRIMARY KEY CHECK (slot IN ('avatar','theme')),
        item_id TEXT NOT NULL REFERENCES cosmetic_inventory(item_id)
      );

      INSERT INTO cosmetic_inventory (item_id, unlocked_at, source_type, source_id)
        VALUES
          ('avatar-sprout', '1970-01-01T00:00:00.000Z', 'starter', 'starter'),
          ('theme-meadow', '1970-01-01T00:00:00.000Z', 'starter', 'starter');
      INSERT INTO equipped_cosmetics (slot, item_id)
        VALUES ('avatar', 'avatar-sprout'), ('theme', 'theme-meadow');
    `,
  },
  {
    version: 4,
    sql: `
      CREATE TABLE workout_plans (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        preferences_json TEXT NOT NULL,
        active INTEGER NOT NULL CHECK (active IN (0,1)),
        created_at TEXT NOT NULL
      );

      CREATE TABLE calendar_events (
        id TEXT PRIMARY KEY,
        plan_id TEXT REFERENCES workout_plans(id) ON DELETE SET NULL,
        event_date TEXT NOT NULL,
        event_type TEXT NOT NULL CHECK (event_type IN ('workout','rest')),
        status TEXT NOT NULL CHECK (status IN ('scheduled','completed','skipped','rest')),
        routine_id TEXT,
        routine_name TEXT NOT NULL,
        routine_json TEXT,
        note TEXT NOT NULL DEFAULT '',
        reminder_enabled INTEGER NOT NULL DEFAULT 0 CHECK (reminder_enabled IN (0,1)),
        source_session_id TEXT UNIQUE REFERENCES workout_sessions(id) ON DELETE SET NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX idx_calendar_events_date ON calendar_events(event_date);
      CREATE INDEX idx_calendar_events_plan ON calendar_events(plan_id, event_date);

      CREATE TABLE weight_entries (
        id TEXT PRIMARY KEY,
        measured_date TEXT NOT NULL,
        weight_kg REAL NOT NULL CHECK (weight_kg > 0),
        note TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL
      );
      CREATE INDEX idx_weight_entries_date ON weight_entries(measured_date);

      CREATE TABLE fitness_preferences (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        weight_goal_kg REAL,
        weight_unit TEXT NOT NULL DEFAULT 'kg' CHECK (weight_unit IN ('kg','lb'))
      );
      INSERT INTO fitness_preferences (id, weight_goal_kg, weight_unit) VALUES (1, NULL, 'kg');

      CREATE TABLE recurring_reminders (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0,1)),
        weekdays_json TEXT NOT NULL DEFAULT '[]',
        reminder_time TEXT NOT NULL DEFAULT '09:00'
      );
      INSERT INTO recurring_reminders (id, enabled, weekdays_json, reminder_time)
        VALUES (1, 0, '[]', '09:00');
    `,
  },
  {
    version: 5,
    sql: `
      ALTER TABLE recurring_reminders
        ADD COLUMN quiet_hours_start TEXT NOT NULL DEFAULT '22:00';
      ALTER TABLE recurring_reminders
        ADD COLUMN quiet_hours_end TEXT NOT NULL DEFAULT '07:00';

      CREATE TABLE reminder_runtime_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        last_occurrence TEXT,
        snooze_until TEXT
      );
      INSERT INTO reminder_runtime_state (id, last_occurrence, snooze_until)
        VALUES (1, NULL, NULL);

      CREATE TABLE reminder_deliveries (
        occurrence_key TEXT PRIMARY KEY,
        delivered_at TEXT NOT NULL
      );

      CREATE TABLE audio_tracks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        last_modified INTEGER NOT NULL,
        imported_at TEXT NOT NULL
      );
      CREATE TABLE playlists (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE playlist_tracks (
        playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
        track_id TEXT NOT NULL REFERENCES audio_tracks(id) ON DELETE CASCADE,
        position INTEGER NOT NULL CHECK (position >= 0),
        PRIMARY KEY (playlist_id, track_id),
        UNIQUE (playlist_id, position)
      );
    `,
  },
  {
    version: 6,
    sql: `
      CREATE TABLE avatar_profile (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        frame_id TEXT NOT NULL REFERENCES cosmetic_inventory(item_id),
        badge_id TEXT REFERENCES unlocked_achievements(achievement_id)
      );
      INSERT INTO cosmetic_inventory (item_id, unlocked_at, source_type, source_id)
        VALUES ('frame-meadow', '1970-01-01T00:00:00.000Z', 'starter', 'starter');
      INSERT INTO avatar_profile (id, frame_id, badge_id)
        VALUES (1, 'frame-meadow', NULL);
    `,
  },
];
