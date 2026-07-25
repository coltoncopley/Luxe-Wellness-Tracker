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

export function muscleLabel(key: string): string {
  return MUSCLE_LABELS[key] ?? key;
}

export function equipmentLabel(key: string): string {
  return EQUIPMENT_LABELS[key] ?? key;
}
