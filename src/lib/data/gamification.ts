import sprout from "@/assets/mascot-sprout.png";
import aqua from "@/assets/mascot-aqua.png";
import buttercup from "@/assets/mascot-buttercup.png";
import bounce from "@/assets/mascot-leafy.png";
import sunbeam from "@/assets/mascot-lemon.png";
import lovely from "@/assets/mascot-lovely.png";
import melody from "@/assets/mascot-melody.png";
import rest from "@/assets/mascot-om.png";
import stormy from "@/assets/mascot-stormy.png";
import yoga from "@/assets/mascot-stretch.png";
import type { ChallengeDefinition, CosmeticDefinition, PlayerAchievement } from "@/lib/types";

export const CHALLENGES: ChallengeDefinition[] = [
  {
    id: "daily-show-up",
    period: "daily",
    title: "Show up",
    description: "Complete one qualifying session today.",
    metric: "sessions",
    target: 1,
    xpReward: 25,
    coinReward: 10,
  },
  {
    id: "daily-three-moves",
    period: "daily",
    title: "Three little moves",
    description: "Complete three exercises today.",
    metric: "moves",
    target: 3,
    xpReward: 30,
    coinReward: 12,
  },
  {
    id: "daily-five-minutes",
    period: "daily",
    title: "Five focused minutes",
    description: "Move for five active minutes today.",
    metric: "active-seconds",
    target: 300,
    xpReward: 30,
    coinReward: 12,
  },
  {
    id: "weekly-three-sessions",
    period: "weekly",
    title: "Steady week",
    description: "Complete three qualifying sessions this week.",
    metric: "sessions",
    target: 3,
    xpReward: 90,
    coinReward: 35,
  },
  {
    id: "weekly-five-days",
    period: "weekly",
    title: "Little by little",
    description: "Be active on five different days this week.",
    metric: "active-days",
    target: 5,
    xpReward: 110,
    coinReward: 45,
  },
];

export const COSMETICS: CosmeticDefinition[] = [
  {
    id: "avatar-sprout",
    name: "Sunny Sprout",
    description: "Your original companion.",
    slot: "avatar",
    price: 0,
    requiredLevel: 1,
    asset: sprout,
  },
  {
    id: "avatar-bounce",
    name: "Bounce Sprout",
    description: "A little extra lift.",
    slot: "avatar",
    price: 45,
    requiredLevel: 2,
    asset: bounce,
  },
  {
    id: "avatar-yoga",
    name: "Stretch Sprout",
    description: "A calm balance pose.",
    slot: "avatar",
    price: 70,
    requiredLevel: 3,
    asset: yoga,
  },
  {
    id: "avatar-sunbeam",
    name: "Sunbeam Sprout",
    description: "Bright and ready to go.",
    slot: "avatar",
    price: 90,
    requiredLevel: 4,
    asset: sunbeam,
    achievementId: "first-workout",
  },
  {
    id: "avatar-rest",
    name: "Resting Sprout",
    description: "A reminder that recovery counts.",
    slot: "avatar",
    price: 85,
    requiredLevel: 3,
    asset: rest,
  },
  {
    id: "avatar-aqua",
    name: "Aqua Sprout",
    description: "A fresh splash of color.",
    slot: "avatar",
    price: 55,
    requiredLevel: 2,
    asset: aqua,
  },
  {
    id: "avatar-buttercup",
    name: "Buttercup Sprout",
    description: "A little sunny flower power.",
    slot: "avatar",
    price: 65,
    requiredLevel: 3,
    asset: buttercup,
  },
  {
    id: "avatar-lovely",
    name: "Lovely Sprout",
    description: "A cozy, cheerful companion.",
    slot: "avatar",
    price: 75,
    requiredLevel: 3,
    asset: lovely,
  },
  {
    id: "avatar-melody",
    name: "Melody Sprout",
    description: "Find your movement rhythm.",
    slot: "avatar",
    price: 85,
    requiredLevel: 4,
    asset: melody,
  },
  {
    id: "avatar-stormy",
    name: "Stormy Sprout",
    description: "A little strength for cloudy days.",
    slot: "avatar",
    price: 95,
    requiredLevel: 4,
    asset: stormy,
  },
  {
    id: "frame-meadow",
    name: "Meadow Frame",
    description: "A fresh green frame for your companion.",
    slot: "frame",
    price: 0,
    requiredLevel: 1,
    asset: sprout,
    frameClass: "avatar-frame-meadow",
  },
  {
    id: "frame-sunrise",
    name: "Sunrise Frame",
    description: "A golden glow to celebrate your first workout.",
    slot: "frame",
    price: 65,
    requiredLevel: 2,
    asset: sprout,
    achievementId: "first-workout",
    frameClass: "avatar-frame-sunrise",
  },
  {
    id: "frame-trailblazer",
    name: "Trailblazer Frame",
    description: "A bright frame for five active days in a week.",
    slot: "frame",
    price: 90,
    requiredLevel: 3,
    asset: sprout,
    achievementId: "five-day-challenge",
    frameClass: "avatar-frame-trailblazer",
  },
  {
    id: "frame-flame",
    name: "Flame Frame",
    description: "A fiery frame earned with a seven-day streak.",
    slot: "frame",
    price: 100,
    requiredLevel: 4,
    asset: sprout,
    achievementId: "seven-day-streak",
    frameClass: "avatar-frame-flame",
  },
  {
    id: "frame-aurora",
    name: "Aurora Crown",
    description: "A living ribbon of color, earned through two weeks of consistency.",
    slot: "frame",
    price: 0,
    requiredLevel: 5,
    asset: sprout,
    achievementId: "fourteen-day-streak",
    frameClass: "avatar-frame-aurora",
    frameBanner: "AURORA",
  },
  {
    id: "frame-stardust",
    name: "Stardust Halo",
    description: "A shimmering orbit for reaching fifty workouts.",
    slot: "frame",
    price: 0,
    requiredLevel: 6,
    asset: sprout,
    achievementId: "fifty-sessions",
    frameClass: "avatar-frame-stardust",
    frameBanner: "STARDUST",
  },
  {
    id: "frame-legend",
    name: "Legend's Crest",
    description: "A champion's animated crest for one hundred workouts.",
    slot: "frame",
    price: 0,
    requiredLevel: 8,
    asset: sprout,
    achievementId: "hundred-sessions",
    frameClass: "avatar-frame-legend",
    frameBanner: "LEGEND",
  },
  {
    id: "theme-meadow",
    name: "Meadow",
    description: "Fresh green accents.",
    slot: "theme",
    price: 0,
    requiredLevel: 1,
    asset: sprout,
    themeClass: "theme-meadow",
  },
  {
    id: "theme-sky",
    name: "Clear Sky",
    description: "Cool blue accents.",
    slot: "theme",
    price: 55,
    requiredLevel: 2,
    asset: bounce,
    themeClass: "theme-sky",
  },
  {
    id: "theme-sunshine",
    name: "Sunshine",
    description: "Warm golden accents.",
    slot: "theme",
    price: 80,
    requiredLevel: 3,
    asset: sunbeam,
    themeClass: "theme-sunshine",
  },
  {
    id: "theme-dusk",
    name: "Soft Dusk",
    description: "A gentle rose palette.",
    slot: "theme",
    price: 100,
    requiredLevel: 4,
    asset: rest,
    themeClass: "theme-dusk",
  },
];

export interface AchievementDefinition extends Omit<PlayerAchievement, "unlockedAt"> {
  requiredSessions?: number;
  requiredStreak?: number;
  requiredChallenges?: number;
  requiredChallengeId?: string;
  rarity?: NonNullable<PlayerAchievement["rarity"]>;
  rewardXp: number;
  rewardCoins: number;
  rewardTokens: number;
}

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: "first-workout",
    title: "First Step",
    description: "Finish your first qualifying session.",
    rewardItemId: "avatar-sunbeam",
    requiredSessions: 1,
    rewardXp: 25,
    rewardCoins: 10,
    rewardTokens: 0,
  },
  {
    id: "three-day-streak",
    title: "Three Days Growing",
    description: "Reach a three-day activity streak.",
    rewardItemId: "avatar-yoga",
    requiredStreak: 3,
    rarity: "rare",
    rewardXp: 50,
    rewardCoins: 20,
    rewardTokens: 1,
  },
  {
    id: "first-challenge",
    title: "Challenge Accepted",
    description: "Complete your first daily or weekly challenge.",
    rewardItemId: null,
    requiredChallenges: 1,
    rarity: "rare",
    rewardXp: 35,
    rewardCoins: 15,
    rewardTokens: 0,
  },
  {
    id: "ten-sessions",
    title: "Ten Small Wins",
    description: "Finish ten qualifying sessions.",
    rewardItemId: "avatar-rest",
    requiredSessions: 10,
    rarity: "rare",
    rewardXp: 80,
    rewardCoins: 30,
    rewardTokens: 1,
  },
  {
    id: "seven-day-streak",
    title: "A Week in Motion",
    description: "Reach a seven-day activity streak.",
    rewardItemId: "frame-flame",
    requiredStreak: 7,
    rarity: "epic",
    rewardXp: 100,
    rewardCoins: 40,
    rewardTokens: 1,
  },
  {
    id: "twenty-five-sessions",
    title: "Quarter-Century Club",
    description: "Finish twenty-five qualifying sessions.",
    rewardItemId: null,
    requiredSessions: 25,
    rarity: "rare",
    rewardXp: 125,
    rewardCoins: 50,
    rewardTokens: 0,
  },
  {
    id: "five-day-challenge",
    title: "Five-Day Trailblazer",
    description: "Complete the weekly challenge by being active on five different days.",
    rewardItemId: "frame-trailblazer",
    requiredChallengeId: "weekly-five-days",
    rarity: "epic",
    rewardXp: 75,
    rewardCoins: 30,
    rewardTokens: 0,
  },
  {
    id: "fourteen-day-streak",
    title: "Fortnight Firefly",
    description: "Keep your activity streak alive for fourteen days.",
    rewardItemId: "frame-aurora",
    requiredStreak: 14,
    rarity: "epic",
    rewardXp: 200,
    rewardCoins: 80,
    rewardTokens: 2,
  },
  {
    id: "fifty-sessions",
    title: "Orbit Maker",
    description: "Complete fifty qualifying workout sessions.",
    rewardItemId: "frame-stardust",
    requiredSessions: 50,
    rarity: "epic",
    rewardXp: 250,
    rewardCoins: 100,
    rewardTokens: 1,
  },
  {
    id: "hundred-sessions",
    title: "The Hundred Club",
    description: "Complete one hundred qualifying workout sessions.",
    rewardItemId: "frame-legend",
    requiredSessions: 100,
    rarity: "legendary",
    rewardXp: 500,
    rewardCoins: 200,
    rewardTokens: 2,
  },
  {
    id: "ten-challenges",
    title: "Quest Constellation",
    description: "Complete ten daily or weekly challenges.",
    rewardItemId: null,
    requiredChallenges: 10,
    rarity: "rare",
    rewardXp: 150,
    rewardCoins: 60,
    rewardTokens: 1,
  },
];

export function cosmeticUnlockDescription(item: CosmeticDefinition): string {
  const rewardAchievement = ACHIEVEMENTS.find(
    (achievement) => achievement.rewardItemId === item.id,
  );
  const purchaseRequirement = `Reach Level ${item.requiredLevel} and spend ${item.price} coins.`;

  if (item.price === 0 && item.requiredLevel === 1 && !rewardAchievement) {
    return "Available from the start.";
  }
  if (item.achievementId && rewardAchievement) {
    return `Earn automatically: ${rewardAchievement.description}`;
  }
  if (rewardAchievement) {
    return `Earn automatically: ${rewardAchievement.description} Or ${purchaseRequirement.toLowerCase()}`;
  }
  if (item.achievementId) {
    const achievement = ACHIEVEMENTS.find((candidate) => candidate.id === item.achievementId);
    if (achievement) {
      return `Complete “${achievement.title}” and ${purchaseRequirement.toLowerCase()}`;
    }
  }
  return purchaseRequirement;
}

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
export const DEFAULT_DEVICE_TIME_ZONE = "UTC";

export function levelForXp(xp: number): number {
  return Math.floor(Math.max(0, xp) / 100) + 1;
}
