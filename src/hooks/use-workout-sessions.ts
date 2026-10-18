import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDatabase } from "@/hooks/use-database";
import { GAMIFICATION_KEY } from "@/hooks/use-gamification";
import { computeStats } from "@/lib/services/stats";
import { completeWorkout, type CompleteWorkoutInput } from "@/lib/services/workoutCompletion";

const KEY = ["workout-sessions"];

export function useWorkoutSessions() {
  const { state, retry } = useDatabase();
  const query = useQuery({
    queryKey: KEY,
    enabled: state.status === "ready",
    queryFn: () => (state.status === "ready" ? state.sessions.list() : Promise.resolve([])),
  });
  const dbError = state.status === "error" ? state.error : null;
  return {
    sessions: query.data ?? [],
    stats: computeStats(query.data ?? [], new Date()),
    isLoading: state.status === "loading" || query.isPending,
    error: dbError ?? (query.error ? query.error.message : null),
    retry: () => (dbError ? retry() : query.refetch()),
  };
}

export function useCompleteWorkout() {
  const { state } = useDatabase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CompleteWorkoutInput) => {
      if (state.status !== "ready") throw new Error("Storage isn't ready yet");
      return completeWorkout(state.sessions, input);
    },
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: KEY }),
        qc.invalidateQueries({ queryKey: GAMIFICATION_KEY }),
      ]),
  });
}

export function useClearWorkoutData() {
  const { state } = useDatabase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => {
      if (state.status !== "ready") throw new Error("Storage isn't ready yet");
      return state.sessions.clearAll();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
