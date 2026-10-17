import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { getDatabase, persistDatabase } from "@/lib/db/database";
import {
  SqliteWorkoutSessionRepository,
  type WorkoutSessionRepository,
} from "@/lib/repositories/workoutSessionRepository";

type DbState =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; sessions: WorkoutSessionRepository };

const DbContext = createContext<{ state: DbState; retry: () => void }>({
  state: { status: "loading" },
  retry: () => {},
});

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DbState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    getDatabase()
      .then((db) => {
        if (!cancelled) setState({ status: "ready", sessions: new SqliteWorkoutSessionRepository(db, persistDatabase) });
      })
      .catch((e: unknown) => {
        if (!cancelled) setState({ status: "error", error: e instanceof Error ? e.message : "Could not open storage" });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  return <DbContext.Provider value={{ state, retry }}>{children}</DbContext.Provider>;
}

export function useDatabase() {
  return useContext(DbContext);
}
