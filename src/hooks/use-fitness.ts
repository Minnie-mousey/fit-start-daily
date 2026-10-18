import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDatabase } from "@/hooks/use-database";
import type {
  CalendarEventStatus,
  RecurringReminder,
  WorkoutPlanPreferences,
  WeightEntry,
  WeightUnit,
} from "@/lib/types";
import type { GeneratedPlanEvent } from "@/lib/services/trainingPlan";
import type { MusicRepository } from "@/lib/repositories/musicRepository";

export const FITNESS_KEY = ["fitness"];
export const CALENDAR_KEY = ["calendar-events"];
export const WEIGHTS_KEY = ["weight-entries"];
export const WEIGHT_SETTINGS_KEY = ["weight-settings"];
export const REMINDER_KEY = ["recurring-reminder"];
export const MUSIC_KEY = ["personal-music"];

export function useActiveWorkoutPlan() {
  const { state } = useDatabase();
  return useQuery({
    queryKey: [...FITNESS_KEY, "active-plan"],
    enabled: state.status === "ready",
    queryFn: () =>
      state.status === "ready" ? state.fitness.getActivePlan() : Promise.resolve(null),
  });
}

export function useCalendarEvents(from: string, to: string) {
  const { state } = useDatabase();
  return useQuery({
    queryKey: [...CALENDAR_KEY, from, to],
    enabled: state.status === "ready",
    queryFn: () =>
      state.status === "ready" ? state.fitness.listEvents(from, to) : Promise.resolve([]),
  });
}

export function useActivateWorkoutPlan() {
  const { state } = useDatabase();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (plan: {
      name: string;
      preferences: WorkoutPlanPreferences;
      events: GeneratedPlanEvent[];
    }) => {
      if (state.status !== "ready") throw new Error("Storage isn't ready yet");
      return state.fitness.activatePlan(plan.name, plan.preferences, plan.events);
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: FITNESS_KEY }),
        queryClient.invalidateQueries({ queryKey: CALENDAR_KEY }),
      ]),
  });
}

export function useUpdateCalendarEvent() {
  const { state } = useDatabase();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      date?: string;
      status?: CalendarEventStatus;
      note?: string;
      reminderEnabled?: boolean;
    }) => {
      if (state.status !== "ready") throw new Error("Storage isn't ready yet");
      return state.fitness.updateEvent(input.id, input);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CALENDAR_KEY }),
  });
}

export function useWeightEntries() {
  const { state } = useDatabase();
  return useQuery({
    queryKey: WEIGHTS_KEY,
    enabled: state.status === "ready",
    queryFn: () => (state.status === "ready" ? state.fitness.getWeights() : Promise.resolve([])),
  });
}

export function useWeightSettings() {
  const { state } = useDatabase();
  return useQuery({
    queryKey: WEIGHT_SETTINGS_KEY,
    enabled: state.status === "ready",
    queryFn: () =>
      state.status === "ready"
        ? state.fitness.getWeightSettings()
        : Promise.resolve({ unit: "kg" as const, goalKg: null }),
  });
}

export function useSaveWeight() {
  const { state } = useDatabase();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { entry: Omit<WeightEntry, "id">; id?: string }) => {
      if (state.status !== "ready") throw new Error("Storage isn't ready yet");
      return state.fitness.saveWeight(input.entry, input.id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: WEIGHTS_KEY }),
  });
}

export function useDeleteWeight() {
  const { state } = useDatabase();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      if (state.status !== "ready") throw new Error("Storage isn't ready yet");
      return state.fitness.deleteWeight(id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: WEIGHTS_KEY }),
  });
}

export function useSaveWeightSettings() {
  const { state } = useDatabase();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { unit: WeightUnit; goalKg: number | null }) => {
      if (state.status !== "ready") throw new Error("Storage isn't ready yet");
      return state.fitness.saveWeightSettings(input);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: WEIGHT_SETTINGS_KEY }),
  });
}

export function useRecurringReminder() {
  const { state } = useDatabase();
  return useQuery({
    queryKey: REMINDER_KEY,
    enabled: state.status === "ready",
    queryFn: () =>
      state.status === "ready"
        ? state.fitness.getRecurringReminder()
        : Promise.resolve({
            enabled: false,
            weekdays: [],
            time: "09:00",
            quietHoursStart: "22:00",
            quietHoursEnd: "07:00",
          }),
  });
}

export function useSaveRecurringReminder() {
  const { state } = useDatabase();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reminder: RecurringReminder) => {
      if (state.status !== "ready") throw new Error("Storage isn't ready yet");
      return state.fitness.saveRecurringReminder(reminder);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: REMINDER_KEY }),
  });
}

export function useReminderSnooze() {
  const { state } = useDatabase();
  return useQuery({
    queryKey: [...REMINDER_KEY, "snooze"],
    enabled: state.status === "ready",
    queryFn: () =>
      state.status === "ready" ? state.fitness.getReminderSnooze() : Promise.resolve(null),
  });
}

export function useSnoozeReminder() {
  const { state } = useDatabase();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (minutes: number | null) => {
      if (state.status !== "ready") throw new Error("Storage isn't ready yet");
      const until = minutes === null ? null : new Date(Date.now() + minutes * 60_000).toISOString();
      return state.fitness.snoozeReminder(until);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: REMINDER_KEY }),
  });
}

export function useMusicTracks() {
  const { state } = useDatabase();
  return useQuery({
    queryKey: [...MUSIC_KEY, "tracks"],
    enabled: state.status === "ready",
    queryFn: () => (state.status === "ready" ? state.music.listTracks() : Promise.resolve([])),
  });
}

export function usePlaylists() {
  const { state } = useDatabase();
  return useQuery({
    queryKey: [...MUSIC_KEY, "playlists"],
    enabled: state.status === "ready",
    queryFn: () => (state.status === "ready" ? state.music.listPlaylists() : Promise.resolve([])),
  });
}

export function useImportAudioTrack() {
  const { state } = useDatabase();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      if (state.status !== "ready") throw new Error("Storage isn't ready yet");
      return state.music.importTrack(file);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MUSIC_KEY }),
  });
}

function useMusicMutation<TInput, TOutput>(
  action: (music: MusicRepository, input: TInput) => Promise<TOutput>,
) {
  const { state } = useDatabase();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TInput) => {
      if (state.status !== "ready") throw new Error("Storage isn't ready yet");
      return action(state.music, input);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MUSIC_KEY }),
  });
}

export function useCreatePlaylist() {
  return useMusicMutation((music, name: string) => music.createPlaylist(name));
}

export function useAddTrackToPlaylist() {
  return useMusicMutation((music, input: { playlistId: string; trackId: string }) =>
    music.addToPlaylist(input.playlistId, input.trackId),
  );
}

export function useDeleteAudioTrack() {
  const { state } = useDatabase();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (trackId: string) => {
      if (state.status !== "ready") throw new Error("Storage isn't ready yet");
      return state.music.deleteTrack(trackId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MUSIC_KEY }),
  });
}

export function useAudioFile(trackId: string | undefined) {
  const { state } = useDatabase();
  return useQuery({
    queryKey: [...MUSIC_KEY, "file", trackId],
    enabled: state.status === "ready" && Boolean(trackId),
    queryFn: async () => {
      if (state.status !== "ready" || !trackId) return null;
      return state.music.getAudio(trackId);
    },
  });
}

export function useUpdatePlaylistAction() {
  return useMusicMutation(
    (music, input: { playlistId: string; trackId: string; offset?: -1 | 1 }) => {
      if (!input.trackId) throw new Error("Select a track first.");
      if (input.offset) return music.moveTrack(input.playlistId, input.trackId, input.offset);
      return music.removeFromPlaylist(input.playlistId, input.trackId);
    },
  );
}
