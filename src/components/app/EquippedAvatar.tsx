import sprout from "@/assets/mascot-sprout.png";
import { Award, Flame, Medal, Sparkles, Star, Trophy } from "lucide-react";
import type { GamificationSnapshot } from "@/lib/types";

export function EquippedAvatar({
  snapshot,
  alt,
  className,
  badgeClassName,
  compact = false,
}: {
  snapshot: GamificationSnapshot | null;
  alt?: string;
  className?: string;
  badgeClassName?: string;
  compact?: boolean;
}) {
  const avatar = snapshot?.cosmetics.find(
    (item) => item.id === snapshot.profile.equippedAvatarId && item.slot === "avatar",
  );
  const frame = snapshot?.cosmetics.find(
    (item) => item.id === snapshot.profile.equippedFrameId && item.slot === "frame",
  );
  const equippedBadge = snapshot?.achievements.find(
    (item) => item.id === snapshot.profile.equippedBadgeId && item.unlockedAt,
  );

  return (
    <span
      className={`relative inline-flex aspect-square shrink-0 items-center justify-center rounded-full border-4 p-1 ${frame?.frameClass ?? "avatar-frame-meadow"} ${className ?? ""}`}
    >
      {frame?.frameBanner && (
        <span className={`avatar-frame-banner ${compact ? "avatar-frame-banner-compact" : ""}`}>
          {frame.frameBanner}
        </span>
      )}
      <img
        src={avatar?.asset ?? sprout}
        alt={alt ?? avatar?.name ?? "Sunny Sprout"}
        width={816}
        height={816}
        className="h-full w-full rounded-full object-contain"
      />
      {equippedBadge && (
        <span
          role="img"
          aria-label={`Equipped badge: ${equippedBadge.title}`}
          title={equippedBadge.title}
          className={`equipped-badge equipped-badge-${equippedBadge.rarity ?? "common"} absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-card bg-sun text-sun-foreground shadow-soft ${badgeClassName ?? ""}`}
        >
          <AchievementBadgeIcon id={equippedBadge.id} />
        </span>
      )}
    </span>
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
  return <Icon className="h-5 w-5" aria-hidden />;
}
