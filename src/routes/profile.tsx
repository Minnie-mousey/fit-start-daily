import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Award,
  Check,
  Coins,
  Download,
  Flame,
  LockKeyhole,
  Medal,
  ShoppingBag,
  Sparkles,
  Star,
  Trash2,
  Trophy,
  Upload,
} from "lucide-react";
import { Page, PageHeader, Panel, SectionTitle } from "@/components/app/Page";
import { EquippedAvatar } from "@/components/app/EquippedAvatar";
import { ErrorState } from "@/components/app/States";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useClearWorkoutData, useWorkoutSessions } from "@/hooks/use-workout-sessions";
import { useDatabase } from "@/hooks/use-database";
import {
  useBuyCosmetic,
  useEquipBadge,
  useEquipCosmetic,
  useGamification,
  useRecoverStreak,
  useSetPlannedRestWeekdays,
  useSetTimeZone,
} from "@/hooks/use-gamification";
import { cosmeticUnlockDescription, DAY_NAMES } from "@/lib/data/gamification";
import type { CosmeticDefinition } from "@/lib/types";
import {
  parseUserDataBackupJson,
  type BackupValidation,
  type UserDataBackup,
} from "@/lib/services/userDataBackup";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Little by Little" },
      { name: "description", content: "Your profile and data on this device." },
      { property: "og:title", content: "Profile — Little by Little" },
      { property: "og:description", content: "Your profile and data on this device." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { state: database } = useDatabase();
  const { stats } = useWorkoutSessions();
  const game = useGamification();
  const clear = useClearWorkoutData();
  const setTimeZone = useSetTimeZone();
  const setRestDays = useSetPlannedRestWeekdays();
  const buy = useBuyCosmetic();
  const equip = useEquipCosmetic();
  const equipBadge = useEquipBadge();
  const recover = useRecoverStreak();
  const backupInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [restoreConfirmationOpen, setRestoreConfirmationOpen] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [restWeekdays, setRestWeekdays] = useState<number[]>([]);
  const [backupPreview, setBackupPreview] = useState<BackupValidation | null>(null);
  const [backupInput, setBackupInput] = useState<unknown>(null);
  const [backupFileName, setBackupFileName] = useState("");
  const [backupError, setBackupError] = useState<string | null>(null);
  const [restoringBackup, setRestoringBackup] = useState(false);
  const [earnedMascot, setEarnedMascot] = useState<{ id: string; token: number } | null>(null);
  const earnedSequence = useRef(0);
  const knownInventory = useRef<Set<string> | null>(null);
  const snapshot = game.snapshot;
  const avatar = snapshot?.cosmetics.find((item) => item.id === snapshot.profile.equippedAvatarId);
  const theme = snapshot?.cosmetics.find((item) => item.id === snapshot.profile.equippedThemeId);
  const timeZones = [
    ...new Set([
      snapshot?.profile.timeZone ?? "UTC",
      "UTC",
      "America/Los_Angeles",
      "America/Denver",
      "America/Chicago",
      "America/New_York",
      "America/Barbados",
      "Europe/London",
      "Europe/Berlin",
      "Asia/Tokyo",
      "Australia/Sydney",
    ]),
  ];
  const avatarCosmetics = snapshot?.cosmetics.filter((item) => item.slot === "avatar") ?? [];
  const frameCosmetics = snapshot?.cosmetics.filter((item) => item.slot === "frame") ?? [];
  const themeCosmetics = snapshot?.cosmetics.filter((item) => item.slot === "theme") ?? [];
  const renderCosmeticCards = (items: CosmeticDefinition[], ownedOnly = false) =>
    items
      .filter((item) => !ownedOnly || snapshot?.inventory.includes(item.id))
      .map((item) => {
        const owned = snapshot?.inventory.includes(item.id) ?? false;
        const achievementLocked =
          item.achievementId &&
          !snapshot?.achievements.some(
            (achievement) => achievement.id === item.achievementId && achievement.unlockedAt,
          );
        return (
          <CosmeticCard
            key={item.id}
            item={item}
            owned={owned}
            equipped={
              item.id === snapshot?.profile.equippedAvatarId ||
              item.id === snapshot?.profile.equippedFrameId ||
              item.id === snapshot?.profile.equippedThemeId
            }
            locked={
              (snapshot?.profile.level ?? 0) < item.requiredLevel || Boolean(achievementLocked)
            }
            balance={snapshot?.profile.coins ?? 0}
            onBuy={() => buy.mutate({ itemId: item.id, purchaseId: crypto.randomUUID() })}
            onEquip={() => equip.mutate(item.id)}
            busy={buy.isPending || equip.isPending}
            celebrateToken={earnedMascot?.id === item.id ? earnedMascot.token : 0}
          />
        );
      });

  useEffect(() => {
    if (snapshot) setRestWeekdays(snapshot.profile.plannedRestWeekdays);
  }, [snapshot]);
  useEffect(() => {
    if (!snapshot) return;
    const inventory = new Set(snapshot.inventory);
    if (knownInventory.current) {
      const earned = snapshot.inventory.find((itemId) => !knownInventory.current?.has(itemId));
      if (earned) setEarnedMascot({ id: earned, token: ++earnedSequence.current });
    }
    knownInventory.current = inventory;
  }, [snapshot]);

  const toggleRestDay = (weekday: number) => {
    const next = restWeekdays.includes(weekday)
      ? restWeekdays.filter((day) => day !== weekday)
      : [...restWeekdays, weekday].sort((a, b) => a - b);
    setRestWeekdays(next);
    setRestDays.mutate({ weekdays: next });
  };

  const downloadBackup = (backup: UserDataBackup, filename: string) => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const exportBackup = () => {
    if (database.status !== "ready") {
      setBackupError("Your local data is still loading. Try again in a moment.");
      return;
    }
    try {
      downloadBackup(database.backup.exportBackup(), "little-by-little-backup.json");
      setBackupError(null);
    } catch (reason) {
      setBackupError(reason instanceof Error ? reason.message : "Could not export your backup.");
    }
  };

  const previewBackupFile = async (file: File | undefined) => {
    setBackupPreview(null);
    setBackupInput(null);
    setBackupFileName("");
    setBackupError(null);
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      setBackupError("Backup files must be smaller than 50 MB.");
      return;
    }
    if (database.status !== "ready") {
      setBackupError("Your local data is still loading. Try again in a moment.");
      return;
    }
    try {
      const parsed = parseUserDataBackupJson(await file.text());
      const preview = database.backup.previewBackup(parsed);
      setBackupInput(parsed);
      setBackupPreview(preview);
      setBackupFileName(file.name);
    } catch (reason) {
      setBackupError(reason instanceof Error ? reason.message : "Could not validate this backup.");
    }
  };

  const restoreBackup = async () => {
    if (database.status !== "ready" || !backupPreview || backupInput === null) return;
    setRestoringBackup(true);
    setBackupError(null);
    try {
      const safetyBackup = database.backup.exportBackup();
      downloadBackup(safetyBackup, "little-by-little-safety-backup.json");
      await database.backup.restoreBackup(backupInput);
      window.location.reload();
    } catch (reason) {
      setRestoreConfirmationOpen(false);
      setBackupError(reason instanceof Error ? reason.message : "Could not restore this backup.");
    } finally {
      setRestoringBackup(false);
    }
  };

  return (
    <Page>
      <PageHeader title="Rewards" subtitle="Grow your collection one session at a time." />
      {game.isLoading ? (
        <Panel>
          <p className="text-sm text-muted-foreground">Loading your reward progress…</p>
        </Panel>
      ) : game.error ? (
        <ErrorState message={game.error} onRetry={game.retry} />
      ) : snapshot ? (
        <>
          <Panel className="flex items-center gap-4 bg-gradient-dawn">
            <EquippedAvatar snapshot={snapshot} className="h-20 w-20 shrink-0 object-contain" />
            <div>
              <p className="font-display text-xl font-semibold">Level {snapshot.profile.level}</p>
              <p className="text-sm text-muted-foreground">
                {snapshot.profile.xpTotal} XP · {snapshot.profile.streak} day streak
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Equipped: {avatar?.name} · {theme?.name}
              </p>
            </div>
          </Panel>
          <Panel className="mt-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold">Level progress</p>
              <p className="text-sm tabular-nums text-muted-foreground">
                {snapshot.profile.levelProgress} / 100 XP
              </p>
            </div>
            <Progress
              value={snapshot.profile.levelProgress}
              className="mt-2 h-2.5"
              aria-label="Level progress"
            />
            <p className="mt-3 inline-flex items-center gap-1 text-sm font-bold">
              <Coins className="h-4 w-4 text-sun-foreground" aria-hidden />
              {snapshot.profile.coins} coins
            </p>
          </Panel>

          <SectionTitle>Daily rhythm</SectionTitle>
          <Panel>
            <label className="grid gap-1 text-sm font-bold">
              Time zone
              <select
                value={snapshot.profile.timeZone}
                onChange={(event) => setTimeZone.mutate({ timeZone: event.target.value })}
                className="h-11 rounded-xl border border-border bg-background px-3 font-normal"
              >
                {timeZones.map((zone) => (
                  <option value={zone} key={zone}>
                    {zone === "America/Barbados"
                      ? "Barbados (Atlantic Time, UTC-4)"
                      : zone.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <p className="mt-4 text-sm font-bold">Planned rest days</p>
            <div
              className="mt-2 grid grid-cols-7 gap-1.5"
              role="group"
              aria-label="Planned weekly rest days"
            >
              {DAY_NAMES.map((day, weekday) => (
                <button
                  type="button"
                  key={day}
                  aria-label={`${day} planned rest day`}
                  aria-pressed={restWeekdays.includes(weekday)}
                  title={day}
                  onClick={() => toggleRestDay(weekday)}
                  className={`h-10 rounded-xl text-xs font-bold ${restWeekdays.includes(weekday) ? "bg-secondary text-secondary-foreground" : "bg-background text-muted-foreground"}`}
                >
                  {day.slice(0, 2)}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Changes start tomorrow in your selected time zone. A qualifying session is at least
              one completed move and 60 active seconds. Today stays active until local midnight.
            </p>
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3">
              <div>
                <p className="text-sm font-bold">Streak recovery</p>
                <p className="text-xs text-muted-foreground">
                  {snapshot.profile.recoveryTokens} tokens ·{" "}
                  {snapshot.profile.recoverableDate ?? "No single-day gap to recover"}
                </p>
              </div>
              <Button
                variant="soft"
                size="sm"
                disabled={
                  !snapshot.profile.recoverableDate ||
                  snapshot.profile.recoveryTokens === 0 ||
                  recover.isPending
                }
                onClick={() =>
                  snapshot.profile.recoverableDate &&
                  recover.mutate({ localDate: snapshot.profile.recoverableDate })
                }
              >
                Use token
              </Button>
            </div>
            {recover.isError && (
              <p className="mt-2 text-xs font-bold text-destructive">{recover.error.message}</p>
            )}
          </Panel>

          <SectionTitle>Collection</SectionTitle>
          <Tabs defaultValue="shop">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="shop">Shop</TabsTrigger>
              <TabsTrigger value="inventory">Inventory</TabsTrigger>
              <TabsTrigger value="achievements">Badges</TabsTrigger>
            </TabsList>
            <TabsContent value="shop" className="mt-4">
              <h3 className="mb-1 font-display text-lg font-semibold">Sprouts</h3>
              <p className="mb-3 text-xs text-muted-foreground">
                Earn special Sprouts through achievements, or unlock them with levels and coins.
              </p>
              <div className="grid grid-cols-2 gap-3">{renderCosmeticCards(avatarCosmetics)}</div>
              <h3 className="mb-1 mt-6 font-display text-lg font-semibold">Avatar frames</h3>
              <p className="mb-3 text-xs text-muted-foreground">
                Earn frames from milestones or unlock them with levels and coins.
              </p>
              <div className="grid grid-cols-2 gap-3">{renderCosmeticCards(frameCosmetics)}</div>
              <h3 className="mb-1 mt-6 font-display text-lg font-semibold">App themes</h3>
              <p className="mb-3 text-xs text-muted-foreground">
                Reach the listed level and spend coins to change the app’s accent colors.
              </p>
              <div className="grid grid-cols-2 gap-3">{renderCosmeticCards(themeCosmetics)}</div>
              {(buy.isError || equip.isError) && (
                <p className="mt-3 text-sm font-bold text-destructive">
                  {buy.error?.message ?? equip.error?.message}
                </p>
              )}
            </TabsContent>
            <TabsContent value="inventory" className="mt-4">
              {avatarCosmetics.some((item) => snapshot.inventory.includes(item.id)) && (
                <>
                  <h3 className="mb-3 font-display text-lg font-semibold">Sprouts</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {renderCosmeticCards(avatarCosmetics, true)}
                  </div>
                </>
              )}
              {themeCosmetics.some((item) => snapshot.inventory.includes(item.id)) && (
                <>
                  <h3 className="mb-3 mt-6 font-display text-lg font-semibold">App themes</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {renderCosmeticCards(themeCosmetics, true)}
                  </div>
                </>
              )}
              {frameCosmetics.some((item) => snapshot.inventory.includes(item.id)) && (
                <>
                  <h3 className="mb-3 mt-6 font-display text-lg font-semibold">Avatar frames</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {renderCosmeticCards(frameCosmetics, true)}
                  </div>
                </>
              )}
            </TabsContent>
            <TabsContent value="achievements" className="mt-4 space-y-2">
              <p className="mb-3 text-sm text-muted-foreground">
                Earn badges by reaching workout milestones and finishing special challenges, then
                equip one to display it below your avatar frame.
              </p>
              <button
                type="button"
                aria-pressed={snapshot.profile.equippedBadgeId === null}
                className={`mb-2 flex w-full items-center gap-3 rounded-xl border p-3 text-left ${snapshot.profile.equippedBadgeId === null ? "border-primary bg-primary-soft" : "border-border bg-card"}`}
                onClick={() => equipBadge.mutate(null)}
                disabled={equipBadge.isPending}
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Award className="h-6 w-6" aria-hidden />
                </span>
                <span className="flex-1">
                  <span className="block font-bold">No badge</span>
                  <span className="text-xs text-muted-foreground">Hide the equipped badge</span>
                </span>
                {snapshot.profile.equippedBadgeId === null && (
                  <span className="text-xs font-bold text-primary">Equipped</span>
                )}
              </button>
              {snapshot.achievements.map((achievement) => (
                <div
                  key={achievement.id}
                  className={`flex items-center gap-3 rounded-xl p-3 shadow-soft ${snapshot.profile.equippedBadgeId === achievement.id ? "bg-primary-soft" : "bg-card"}`}
                >
                  <span
                    className={`achievement-medallion achievement-medallion-${achievement.unlockedAt ? (achievement.rarity ?? "common") : "common"} flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${achievement.unlockedAt ? "bg-sun text-sun-foreground" : "bg-muted text-muted-foreground"}`}
                  >
                    {achievement.unlockedAt ? (
                      <AchievementBadgeIcon id={achievement.id} />
                    ) : (
                      <LockKeyhole className="h-5 w-5" aria-hidden />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5 font-bold">
                      {achievement.title}
                      {achievement.rarity !== "common" && (
                        <span
                          className={`achievement-rarity achievement-rarity-${achievement.rarity}`}
                        >
                          {achievement.rarity}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{achievement.description}</p>
                    <p className="mt-1 text-xs font-semibold text-primary">
                      {achievement.unlockedAt
                        ? `Earned ${new Date(achievement.unlockedAt).toLocaleDateString()}`
                        : "Not earned yet"}
                    </p>
                  </div>
                  {achievement.rewardItemId && (
                    <img
                      src={
                        snapshot.cosmetics.find((item) => item.id === achievement.rewardItemId)
                          ?.asset
                      }
                      alt=""
                      className="h-10 w-10 object-contain"
                    />
                  )}
                  {achievement.unlockedAt && (
                    <Button
                      type="button"
                      size="sm"
                      variant={
                        snapshot.profile.equippedBadgeId === achievement.id ? "outline" : "soft"
                      }
                      disabled={
                        equipBadge.isPending || snapshot.profile.equippedBadgeId === achievement.id
                      }
                      onClick={() => equipBadge.mutate(achievement.id)}
                    >
                      {snapshot.profile.equippedBadgeId === achievement.id ? "Equipped" : "Equip"}
                    </Button>
                  )}
                </div>
              ))}
              {equipBadge.isError && (
                <p role="alert" className="text-sm font-bold text-destructive">
                  {equipBadge.error.message}
                </p>
              )}
            </TabsContent>
          </Tabs>
        </>
      ) : null}

      <SectionTitle>Your data</SectionTitle>
      <Panel>
        <p className="text-sm text-muted-foreground">
          Workouts and rewards are stored privately on this device. Clearing workout history does
          not remove earned rewards.
        </p>
        <Button
          variant="outline"
          className="mt-4 text-destructive"
          onClick={() => setOpen(true)}
          disabled={clear.isPending}
        >
          <Trash2 aria-hidden /> Delete workout history
        </Button>
        {cleared && clear.isSuccess && (
          <p className="mt-3 text-sm font-bold text-success" role="status">
            History deleted.
          </p>
        )}
        {clear.isError && (
          <div className="mt-3">
            <ErrorState message={clear.error.message} />
          </div>
        )}
      </Panel>

      <SectionTitle>Manual offline backup</SectionTitle>
      <Panel>
        <p className="text-sm text-muted-foreground">
          Export a versioned JSON backup to a file, or preview and restore one from this device. A
          safety backup is saved in this browser and downloaded before any restore replaces data. No
          network or cloud sync is used.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="soft" onClick={exportBackup}>
            <Download aria-hidden /> Export backup
          </Button>
          <input
            ref={backupInputRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-label="Choose a Little by Little backup file"
            onChange={(event) => {
              void previewBackupFile(event.currentTarget.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => backupInputRef.current?.click()}
            disabled={database.status !== "ready" || restoringBackup}
          >
            <Upload aria-hidden /> Choose backup
          </Button>
        </div>
        {backupError && (
          <p role="alert" className="mt-3 text-sm font-bold text-destructive">
            {backupError}
          </p>
        )}
        {backupPreview && (
          <div className="mt-4 rounded-2xl bg-background p-3">
            <h3 className="font-bold">Restore preview: {backupFileName}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Format version {backupPreview.migratedFrom ?? 2}
              {backupPreview.migratedFrom
                ? ` will be migrated to version 3.`
                : ` · exported ${new Date(backupPreview.backup.exportedAt).toLocaleString()}`}
            </p>
            <p className="mt-2 text-sm">
              {Object.values(backupPreview.includedCounts).reduce((sum, count) => sum + count, 0)}{" "}
              records will be restored. {backupPreview.invalidRecords.length} invalid records will
              be skipped; {backupPreview.duplicateRecords.length} duplicate records will be skipped.
            </p>
            {(backupPreview.invalidRecords.length > 0 ||
              backupPreview.duplicateRecords.length > 0) && (
              <ul className="mt-2 max-h-32 space-y-1 overflow-auto text-xs text-muted-foreground">
                {[...backupPreview.invalidRecords, ...backupPreview.duplicateRecords]
                  .slice(0, 10)
                  .map((issue, index) => (
                    <li key={`${issue.table}-${issue.index}-${index}`}>
                      {issue.table} record {issue.index + 1}: {issue.reason}
                    </li>
                  ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Includes settings, weights, plans, calendar, workout history, rewards, challenges,
              achievements, cosmetics and playlist/track metadata. Local audio files are not
              included and may need to be imported again. Restoring replaces those data categories
              on this device.
            </p>
            <Button
              type="button"
              variant="hero"
              className="mt-3"
              disabled={restoringBackup || database.status !== "ready"}
              onClick={() => setRestoreConfirmationOpen(true)}
            >
              Review and restore
            </Button>
          </div>
        )}
      </Panel>

      <AlertDialog open={restoreConfirmationOpen} onOpenChange={setRestoreConfirmationOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Replace this device’s data?</AlertDialogTitle>
            <AlertDialogDescription>
              A safety backup will be stored locally and downloaded first. Then settings, history,
              plans, rewards, weight data, and playlists will be replaced by the validated backup.
              Imported audio files themselves are not in the backup.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoringBackup}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={restoringBackup} onClick={() => void restoreBackup()}>
              {restoringBackup ? "Restoring…" : "Create safety backup and restore"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all workout history?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes every saved session from this device. It can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => clear.mutate(undefined, { onSuccess: () => setCleared(true) })}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  );
}

function AchievementBadgeIcon({ id }: { id: string }) {
  const Icon = id.includes("hundred")
    ? Trophy
    : id.includes("fifty") || id.includes("constellation")
      ? Sparkles
      : id.includes("fortnight")
        ? Medal
        : id.includes("streak")
          ? Flame
          : id.includes("challenge")
            ? Star
            : id.includes("sessions") || id.includes("workouts")
              ? Trophy
              : id.includes("week")
                ? Medal
                : id.includes("first")
                  ? Sparkles
                  : Award;
  return <Icon className="h-6 w-6" aria-hidden />;
}

function CosmeticCard({
  item,
  owned,
  equipped,
  locked,
  balance,
  onBuy,
  onEquip,
  busy,
  celebrateToken,
}: {
  item: CosmeticDefinition;
  owned: boolean;
  equipped: boolean;
  locked: boolean;
  balance: number;
  onBuy: () => void;
  onEquip: () => void;
  busy: boolean;
  celebrateToken: number;
}) {
  const [motion, setMotion] = useState<"tap" | "selected" | "earned" | null>(null);
  const motionTimer = useRef<number | null>(null);
  const playMotion = useCallback((next: "tap" | "selected" | "earned") => {
    if (motionTimer.current !== null) window.clearTimeout(motionTimer.current);
    setMotion(null);
    window.requestAnimationFrame(() => {
      setMotion(next);
      motionTimer.current = window.setTimeout(() => setMotion(null), 950);
    });
  }, []);

  useEffect(() => {
    if (celebrateToken) playMotion("earned");
  }, [celebrateToken, playMotion]);
  useEffect(
    () => () => {
      if (motionTimer.current !== null) window.clearTimeout(motionTimer.current);
    },
    [],
  );

  return (
    <div className="flex min-w-0 flex-col rounded-2xl bg-card p-3 shadow-soft">
      {item.slot === "avatar" ? (
        <button
          type="button"
          aria-label={`Tap ${item.name} to animate`}
          className="mascot-motion flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl bg-secondary"
          data-mascot={item.id}
          data-motion={motion ?? undefined}
          onClick={() => playMotion("tap")}
        >
          <img
            src={item.asset}
            alt={item.name}
            className="h-full w-full object-contain p-2"
            loading="lazy"
          />
        </button>
      ) : item.slot === "frame" ? (
        <div
          role="img"
          aria-label={`${item.name} preview`}
          className={`avatar-frame-preview ${item.frameClass ?? ""}`}
        >
          <img src={item.asset} alt="" className="h-full w-full rounded-full object-contain p-2" />
          {item.frameBanner && <span className="avatar-frame-banner">{item.frameBanner}</span>}
        </div>
      ) : (
        <div
          role="img"
          aria-label={`${item.name} color preview`}
          className="theme-preview flex aspect-square w-full items-center justify-center gap-3 overflow-hidden rounded-xl"
          data-theme={item.id}
        >
          <span className="theme-preview-soft rounded-full p-3 text-sm font-bold">Aa</span>
          <span className="theme-preview-accent h-10 w-10 rounded-full shadow-soft" />
        </div>
      )}
      <p className="mt-2 truncate text-sm font-bold">{item.name}</p>
      <p className="min-h-8 text-xs text-muted-foreground">{item.description}</p>
      <p className="mt-1 min-h-10 text-xs font-semibold text-foreground">
        Unlock: {cosmeticUnlockDescription(item)}
      </p>
      {owned ? (
        <Button
          variant={equipped ? "outline" : "soft"}
          size="sm"
          className="mt-2 w-full"
          disabled={equipped || busy}
          onClick={() => {
            playMotion("selected");
            onEquip();
          }}
        >
          {equipped ? (
            <>
              <Check aria-hidden /> Equipped
            </>
          ) : (
            "Equip"
          )}
        </Button>
      ) : (
        <Button
          variant="hero"
          size="sm"
          className="mt-2 w-full"
          disabled={locked || balance < item.price || busy}
          onClick={onBuy}
        >
          {item.achievementId && locked ? (
            <>
              <LockKeyhole aria-hidden /> Achievement
            </>
          ) : locked ? (
            `Level ${item.requiredLevel}`
          ) : balance < item.price ? (
            `${item.price} coins`
          ) : (
            <>
              <ShoppingBag aria-hidden /> {item.price} coins
            </>
          )}
        </Button>
      )}
    </div>
  );
}
