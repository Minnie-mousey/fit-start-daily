import type { Exercise, ExerciseCategory, Routine } from "@/lib/types";

export const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  "lower-body": "Lower body",
  "upper-body": "Upper body",
  core: "Core",
  cardio: "Cardio",
  mobility: "Mobility",
};

export const EXERCISES: Exercise[] = [
  {
    id: "bodyweight-squat",
    name: "Bodyweight Squat",
    category: "lower-body",
    difficulty: "beginner",
    muscles: ["Thighs", "Glutes"],
    summary: "Sit back like there's a chair behind you, then stand tall.",
    steps: [
      "Stand with feet shoulder-width apart, toes slightly out.",
      "Push your hips back and bend your knees, keeping your chest up.",
      "Lower until thighs are near parallel, or as far as feels comfortable.",
      "Press through your heels to stand back up.",
    ],
    tips: ["Keep knees in line with your toes.", "Breathe in on the way down, out on the way up."],
    easier: "Squat down to a real chair and stand back up.",
    harder: "Pause for 2 seconds at the bottom.",
    target: { kind: "reps", reps: 10 },
  },
  {
    id: "glute-bridge",
    name: "Glute Bridge",
    category: "lower-body",
    difficulty: "beginner",
    muscles: ["Glutes", "Hamstrings"],
    summary: "Lift your hips from the floor to wake up your glutes.",
    steps: [
      "Lie on your back, knees bent, feet flat and hip-width apart.",
      "Squeeze your glutes and lift your hips toward the ceiling.",
      "Hold briefly at the top with a straight line from knees to shoulders.",
      "Lower slowly back down.",
    ],
    tips: ["Don't arch your lower back — the lift comes from your hips."],
    easier: "Make the lift smaller.",
    harder: "Try it with one foot lifted.",
    target: { kind: "reps", reps: 12 },
  },
  {
    id: "reverse-lunge",
    name: "Reverse Lunge",
    category: "lower-body",
    difficulty: "intermediate",
    muscles: ["Thighs", "Glutes"],
    summary: "Step back and sink down, one leg at a time.",
    steps: [
      "Stand tall with feet together.",
      "Step one foot back and lower both knees to about 90°.",
      "Push through the front heel to return to standing.",
      "Switch legs each rep.",
    ],
    tips: ["Hold a wall or chair for balance if you need it."],
    easier: "Take shorter steps and don't go as low.",
    harder: "Slow down the lowering phase to 3 seconds.",
    target: { kind: "reps", reps: 8 },
  },
  {
    id: "wall-push-up",
    name: "Wall Push-up",
    category: "upper-body",
    difficulty: "beginner",
    muscles: ["Chest", "Arms", "Shoulders"],
    summary: "A gentle push-up standing against a wall.",
    steps: [
      "Stand an arm's length from a wall, hands on it at shoulder height.",
      "Bend your elbows to bring your chest toward the wall.",
      "Push back to the start, keeping your body straight.",
    ],
    tips: ["Step further from the wall to make it harder."],
    easier: "Stand closer to the wall.",
    harder: "Move to a counter or bench for an incline push-up.",
    target: { kind: "reps", reps: 10 },
  },
  {
    id: "knee-push-up",
    name: "Knee Push-up",
    category: "upper-body",
    difficulty: "intermediate",
    muscles: ["Chest", "Arms", "Core"],
    summary: "A push-up from your knees to build pressing strength.",
    steps: [
      "Kneel with hands under your shoulders.",
      "Walk your hands forward until hips, back and head are in a line.",
      "Lower your chest toward the floor with elbows angled back.",
      "Press back up.",
    ],
    tips: ["Put a folded towel under your knees for comfort."],
    easier: "Use the wall push-up instead.",
    harder: "Try a full push-up from your toes.",
    target: { kind: "reps", reps: 8 },
  },
  {
    id: "dead-bug",
    name: "Dead Bug",
    category: "core",
    difficulty: "beginner",
    muscles: ["Abs", "Deep core"],
    summary: "Slow opposite arm and leg reaches while lying on your back.",
    steps: [
      "Lie on your back, arms up, knees bent at 90° above your hips.",
      "Press your lower back gently into the floor.",
      "Slowly lower one arm and the opposite leg toward the floor.",
      "Return and switch sides.",
    ],
    tips: ["Move slowly — control matters more than speed."],
    easier: "Move only your legs, keeping arms still.",
    harder: "Straighten the leg fully as you lower it.",
    target: { kind: "time", seconds: 40 },
  },
  {
    id: "plank",
    name: "Forearm Plank",
    category: "core",
    difficulty: "intermediate",
    muscles: ["Abs", "Shoulders"],
    summary: "Hold a straight, strong line from head to heels.",
    steps: [
      "Place forearms on the floor, elbows under shoulders.",
      "Step feet back and lift your body into a straight line.",
      "Brace your stomach and breathe steadily.",
    ],
    tips: ["Stop if you feel it in your lower back."],
    easier: "Drop to your knees.",
    harder: "Lift one foot for a few seconds at a time.",
    target: { kind: "time", seconds: 30 },
  },
  {
    id: "march-in-place",
    name: "March in Place",
    category: "cardio",
    difficulty: "beginner",
    muscles: ["Legs", "Heart"],
    summary: "An easy way to warm up and get your heart going.",
    steps: [
      "Stand tall and lift one knee, then the other.",
      "Swing your arms naturally.",
      "Find a steady, comfortable rhythm.",
    ],
    tips: ["Great as a warm-up before any workout."],
    easier: "Lift your knees lower.",
    harder: "Speed up into a light jog.",
    target: { kind: "time", seconds: 45 },
  },
  {
    id: "step-jack",
    name: "Step Jack",
    category: "cardio",
    difficulty: "beginner",
    muscles: ["Legs", "Shoulders", "Heart"],
    summary: "A low-impact jumping jack — no jumping needed.",
    steps: [
      "Stand with feet together and arms at your sides.",
      "Step one foot out while raising both arms overhead.",
      "Bring them back, then step the other foot out.",
    ],
    tips: ["Keep the movement light and rhythmic."],
    easier: "Raise arms only to shoulder height.",
    harder: "Switch to regular jumping jacks.",
    target: { kind: "time", seconds: 30 },
  },
  {
    id: "cat-cow",
    name: "Cat–Cow Stretch",
    category: "mobility",
    difficulty: "beginner",
    muscles: ["Spine", "Back"],
    summary: "Gently round and arch your back on hands and knees.",
    steps: [
      "Start on hands and knees.",
      "Breathe in, drop your belly and lift your chest (cow).",
      "Breathe out, round your back toward the ceiling (cat).",
      "Flow slowly between the two.",
    ],
    tips: ["Match each movement to your breath."],
    easier: "Do it seated in a chair.",
    harder: "Add a slow hip circle between rounds.",
    target: { kind: "time", seconds: 40 },
  },
  {
    id: "standing-reach",
    name: "Standing Side Reach",
    category: "mobility",
    difficulty: "beginner",
    muscles: ["Sides", "Shoulders"],
    summary: "Reach up and over to stretch along your sides.",
    steps: [
      "Stand tall with feet hip-width apart.",
      "Reach one arm overhead and lean gently to the opposite side.",
      "Hold a breath or two, then switch sides.",
    ],
    tips: ["Keep both feet planted."],
    easier: "Keep your hand on your hip.",
    harder: "Hold each side a little longer.",
    target: { kind: "time", seconds: 30 },
  },
];

export const ROUTINES: Routine[] = [
  {
    id: "gentle-start",
    name: "Gentle Start",
    description: "A soft, five-move session to build the habit.",
    restSeconds: 15,
    items: [
      { exerciseId: "march-in-place" },
      { exerciseId: "bodyweight-squat", target: { kind: "reps", reps: 8 } },
      { exerciseId: "wall-push-up", target: { kind: "reps", reps: 8 } },
      { exerciseId: "glute-bridge", target: { kind: "reps", reps: 10 } },
      { exerciseId: "standing-reach" },
    ],
  },
  {
    id: "core-calm",
    name: "Core & Calm",
    description: "Steady core work finished with a stretch.",
    restSeconds: 20,
    items: [
      { exerciseId: "cat-cow" },
      { exerciseId: "dead-bug" },
      { exerciseId: "glute-bridge" },
      { exerciseId: "plank", target: { kind: "time", seconds: 20 } },
      { exerciseId: "cat-cow", target: { kind: "time", seconds: 30 } },
    ],
  },
  {
    id: "full-body-basics",
    name: "Full Body Basics",
    description: "A little of everything for a full-body boost.",
    restSeconds: 20,
    items: [
      { exerciseId: "step-jack" },
      { exerciseId: "bodyweight-squat" },
      { exerciseId: "knee-push-up" },
      { exerciseId: "reverse-lunge" },
      { exerciseId: "plank" },
      { exerciseId: "standing-reach" },
    ],
  },
];

export function getExercise(id: string): Exercise | undefined {
  return EXERCISES.find((e) => e.id === id);
}

const SINGLE_PREFIX = "single-";

/** Resolves a routine by id. `single-<exerciseId>` builds a one-exercise session. */
export function getRoutine(id: string): Routine | undefined {
  if (id.startsWith(SINGLE_PREFIX)) {
    const ex = getExercise(id.slice(SINGLE_PREFIX.length));
    if (!ex) return undefined;
    return { id, name: ex.name, description: ex.summary, restSeconds: 0, items: [{ exerciseId: ex.id }] };
  }
  return ROUTINES.find((r) => r.id === id);
}

export function singleExerciseRoutineId(exerciseId: string) {
  return `${SINGLE_PREFIX}${exerciseId}`;
}

export function estimateRoutineMinutes(r: Routine): number {
  let secs = 0;
  r.items.forEach((item, i) => {
    const t = item.target ?? getExercise(item.exerciseId)?.target;
    secs += t ? (t.kind === "time" ? t.seconds : t.reps * 4) : 0;
    if (i < r.items.length - 1) secs += r.restSeconds;
  });
  return Math.max(1, Math.round(secs / 60));
}
