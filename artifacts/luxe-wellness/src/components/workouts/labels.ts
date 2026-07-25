export const MUSCLE_LABELS: Record<string, string> = {
  chest: "Chest",
  lats: "Lats",
  upper_back: "Upper Back",
  lower_back: "Lower Back",
  traps: "Traps",
  shoulders: "Shoulders",
  biceps: "Biceps",
  triceps: "Triceps",
  forearms: "Forearms",
  core: "Core",
  quads: "Quads",
  hamstrings: "Hamstrings",
  glutes: "Glutes",
  calves: "Calves",
};

export const EQUIPMENT_LABELS: Record<string, string> = {
  bodyweight: "Bodyweight",
  dumbbell: "Dumbbells",
  barbell: "Barbell",
  machine: "Machines",
  cable: "Cables",
  band: "Bands",
  kettlebell: "Kettlebells",
};

export const GOAL_LABELS: Record<string, string> = {
  strength: "Get stronger",
  build_muscle: "Build muscle",
  tone: "Tone up",
  endurance: "Endurance",
};

export const EXPERIENCE_LABELS: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export const FOCUS_AREA_OPTIONS: { key: string; label: string }[] = [
  { key: "full_body", label: "Full body" },
  { key: "upper_body", label: "Upper body" },
  { key: "lower_body", label: "Lower body" },
  { key: "core", label: "Core" },
  { key: "arms", label: "Arms" },
  { key: "back", label: "Back" },
  { key: "chest", label: "Chest" },
  { key: "shoulders", label: "Shoulders" },
  { key: "legs", label: "Legs" },
  { key: "glutes", label: "Glutes" },
];

export const ENERGY_OPTIONS: { key: string; label: string }[] = [
  { key: "low", label: "Low — take it easy" },
  { key: "medium", label: "Medium — feeling normal" },
  { key: "high", label: "High — ready to push" },
];

export function muscleLabel(key: string): string {
  return MUSCLE_LABELS[key] ?? key;
}

export function equipmentLabel(key: string): string {
  return EQUIPMENT_LABELS[key] ?? key;
}

/** Deep-link to a YouTube search for a proper-form demo of the given exercise. */
export function howToVideoUrl(exerciseName: string): string {
  const query = encodeURIComponent(`how to ${exerciseName} proper form technique`);
  return `https://www.youtube.com/results?search_query=${query}`;
}
