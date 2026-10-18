export type Difficulty = "beginner" | "intermediate" | "advanced";
export type ExerciseCategory = "lower-body" | "upper-body" | "core" | "cardio" | "mobility";
export type ExerciseActivity =
  "low-impact-cardio" | "bodyweight-strength" | "yoga" | "flexibility" | "stairs" | "recovery";

export type ExerciseTarget = { kind: "time"; seconds: number } | { kind: "reps"; reps: number };

export interface Exercise {
  id: string;
  name: string;
  category: ExerciseCategory;
  activity?: ExerciseActivity;
  difficulty: Difficulty;
  muscles: string[];
  targetAreas?: string[];
  equipment?: string[];
  setupRequirements?: string[];
  summary: string;
  steps: string[];
  tips: string[];
  safetyNotes?: string[];
  easier: string;
  harder: string;
  modifications?: string[];
  alternatives?: string[];
  demonstration?: { label: string; url: string };
  source?: { label: string; url: string };
  target: ExerciseTarget;
}

export interface RoutineItem {
  exerciseId: string;
  target?: ExerciseTarget;
  section?: "warmup" | "main" | "cooldown";
}

export interface Routine {
  id: string;
  name: string;
  description: string;
  restSeconds: number;
  items: RoutineItem[];
  durationMinutes?: number;
}

export type SessionStatus = "completed" | "partial" | "cancelled";

export interface ExercisePerformance {
  sequence: number;
  exerciseId: string;
  exerciseName: string;
  target: ExerciseTarget;
  actualReps: number | null;
  actualSeconds: number;
  status: "completed" | "skipped";
}

export interface WorkoutSession {
  id: string;
  routineId: string;
  routineName: string;
  startedAt: string; // ISO
  completedAt: string; // ISO
  durationSeconds: number;
  exercisesCompleted: number;
  totalExercises: number;
  status: SessionStatus;
}

export type NewWorkoutSession = Omit<WorkoutSession, "id">;

export interface WorkoutStats {
  totalWorkouts: number;
  totalMinutes: number;
  currentStreak: number;
  thisWeek: number;
}

export type FitnessGoal =
  "general-fitness" | "strength" | "endurance" | "flexibility" | "weight-loss";
export type FitnessLevel = Difficulty;
export type RecoveryPreference = "balanced" | "gentle" | "extra-rest";

export interface WorkoutPlanPreferences {
  goal: FitnessGoal;
  level: FitnessLevel;
  availableMinutes: number;
  preferredActivities: ExerciseActivity[];
  weeklyFrequency: number;
  startDate: string;
  targetDate: string;
  recoveryPreference: RecoveryPreference;
  movementLimitations: string[];
}

export interface WorkoutPlan {
  id: string;
  name: string;
  preferences: WorkoutPlanPreferences;
  active: boolean;
  createdAt: string;
}

export type CalendarEventStatus = "scheduled" | "completed" | "skipped" | "rest";
export type CalendarEventType = "workout" | "rest";

export interface CalendarEvent {
  id: string;
  planId: string | null;
  date: string;
  type: CalendarEventType;
  status: CalendarEventStatus;
  routineId: string | null;
  routineName: string;
  routine: Routine | null;
  note: string;
  reminderEnabled: boolean;
  sourceSessionId: string | null;
}

export interface WeightEntry {
  id: string;
  date: string;
  weightKg: number;
  note: string;
}

export type WeightUnit = "kg" | "lb";

export interface RecurringReminder {
  enabled: boolean;
  weekdays: number[];
  time: string;
  quietHoursStart: string;
  quietHoursEnd: string;
}

export interface AudioTrack {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  lastModified: number;
  importedAt: string;
  available: boolean;
}

export interface Playlist {
  id: string;
  name: string;
  createdAt: string;
  tracks: AudioTrack[];
}

export type ChallengeMetric = "sessions" | "moves" | "active-seconds" | "active-days";
export type ChallengePeriod = "daily" | "weekly";

export interface ChallengeDefinition {
  id: string;
  period: ChallengePeriod;
  title: string;
  description: string;
  metric: ChallengeMetric;
  target: number;
  xpReward: number;
  coinReward: number;
}

export interface ChallengeProgress extends ChallengeDefinition {
  periodKey: string;
  progress: number;
  completedAt: string | null;
  claimed: boolean;
}

export type CosmeticSlot = "avatar" | "frame" | "theme";

export interface CosmeticDefinition {
  id: string;
  name: string;
  description: string;
  slot: CosmeticSlot;
  price: number;
  requiredLevel: number;
  achievementId?: string;
  asset: string;
  frameClass?: string;
  frameBanner?: string;
  themeClass?: string;
}

export interface PlayerProfile {
  timeZone: string;
  plannedRestWeekdays: number[];
  recoveryTokens: number;
  streak: number;
  xpTotal: number;
  level: number;
  levelProgress: number;
  xpForNextLevel: number;
  coins: number;
  equippedAvatarId: string;
  equippedFrameId: string;
  equippedBadgeId: string | null;
  equippedThemeId: string;
  nextLocalDayAt: string;
  recoverableDate: string | null;
}

export interface PlayerAchievement {
  id: string;
  title: string;
  description: string;
  unlockedAt: string | null;
  rewardItemId: string | null;
  rarity?: "common" | "rare" | "epic" | "legendary";
}

export interface GamificationSnapshot {
  profile: PlayerProfile;
  challenges: ChallengeProgress[];
  achievements: PlayerAchievement[];
  inventory: string[];
  cosmetics: CosmeticDefinition[];
}

export interface RewardSummary {
  xp: number;
  coins: number;
  level: number;
  unlockedItems: string[];
  completedChallenges: string[];
}
