import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDatabase } from "@/hooks/use-database";
import type { GamificationRepository } from "@/lib/repositories/gamificationRepository";

export const GAMIFICATION_KEY = ["gamification"] as const;

export function useGamification() {
  const { state, retry } = useDatabase();
  const query = useQuery({
    queryKey: GAMIFICATION_KEY,
    enabled: state.status === "ready",
    queryFn: () =>
      state.status === "ready"
        ? state.gamification.snapshot(
            new Date(),
            Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
          )
        : Promise.reject(new Error("Storage is not ready")),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const dbError = state.status === "error" ? state.error : null;
  return {
    snapshot: query.data ?? null,
    isLoading: state.status === "loading" || query.isPending,
    error: dbError ?? (query.error ? query.error.message : null),
    retry: () => (dbError ? retry() : query.refetch()),
  };
}

function useGamificationMutation<TInput>(
  operation: (input: TInput, repository: GamificationRepository) => Promise<void>,
) {
  const { state } = useDatabase();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TInput) => {
      if (state.status !== "ready") throw new Error("Storage isn't ready yet");
      return operation(input, state.gamification);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: GAMIFICATION_KEY }),
        queryClient.invalidateQueries({ queryKey: ["workout-sessions"] }),
      ]);
    },
  });
}

export function useSetTimeZone() {
  return useGamificationMutation(
    ({ timeZone, now }: { timeZone: string; now?: Date }, repository) =>
      repository.setTimeZone(timeZone, now),
  );
}

export function useSetPlannedRestWeekdays() {
  return useGamificationMutation(
    ({ weekdays, now }: { weekdays: number[]; now?: Date }, repository) =>
      repository.setPlannedRestWeekdays(weekdays, now),
  );
}

export function useBuyCosmetic() {
  return useGamificationMutation(
    ({ itemId, purchaseId }: { itemId: string; purchaseId: string }, repository) =>
      repository.purchaseCosmetic(itemId, purchaseId),
  );
}

export function useEquipCosmetic() {
  return useGamificationMutation((itemId: string, repository) => repository.equipCosmetic(itemId));
}

export function useEquipBadge() {
  return useGamificationMutation((achievementId: string | null, repository) =>
    repository.equipBadge(achievementId),
  );
}

export function useRecoverStreak() {
  return useGamificationMutation(
    ({ localDate, now }: { localDate: string; now?: Date }, repository) =>
      repository.recoverStreak(localDate, now),
  );
}
