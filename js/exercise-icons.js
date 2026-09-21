// Maps an exercise name to a representative emoji, checked as ordered
// keyword rules (most specific first) with a muscle-group emoji fallback.
const EXERCISE_ICON_RULES = [
  [/push[\s-]?up/, "🫸"],
  [/pull[\s-]?up|chin[\s-]?up/, "🧗"],
  [/deadlift/, "🏋️‍♂️"],
  [/squat/, "🦵"],
  [/leg press|leg extension|leg curl|calf raise|lunge|split squat/, "🦵"],
  [/shrug/, "🤷"],
  [/upright row/, "🙌"],
  [/row/, "🚣"],
  [/curl/, "💪"],
  [/lateral raise|front raise|reverse fly/, "🙆"],
  [/shoulder press|overhead press|military press|arnold press|push press/, "🙌"],
  [/bench press|chest press|chest fly|cable crossover|pec deck|dip/, "🏋️"],
  [/plank/, "🧘"],
  [/sit[\s-]?up|crunch|ab wheel|russian twist|leg raise/, "🔥"],
  [/run(ning)?|treadmill/, "🏃"],
  [/bike|cycling/, "🚴"],
  [/swim/, "🏊"],
  [/row(ing)? machine/, "🚣"],
  [/jump rope|box jump/, "🤸"],
  [/farmer/, "🚶"],
  [/kettlebell|clean and jerk|snatch/, "🏋️"],
];

const MUSCLE_GROUP_ICONS = {
  Chest: "🏋️",
  Back: "🚣",
  Shoulders: "🙌",
  Legs: "🦵",
  Arms: "💪",
  Core: "🔥",
  Cardio: "🏃",
  Other: "⚡",
};

function getExerciseIcon(name, muscleGroup) {
  const n = (name || "").toLowerCase();
  for (const [pattern, icon] of EXERCISE_ICON_RULES) {
    if (pattern.test(n)) return icon;
  }
  return MUSCLE_GROUP_ICONS[muscleGroup] || "⚡";
}
