// Achievement badges, computed live from Store data (nothing persisted —
// "earned" is just whatever the current stats satisfy) plus a fun real-world
// comparison for total volume lifted.

const VOLUME_COMPARISONS = [
  { label: "a grand piano", lbs: 500, emoji: "🎹" },
  { label: "a car", lbs: 4000, emoji: "🚗" },
  { label: "an elephant", lbs: 13000, emoji: "🐘" },
  { label: "a school bus", lbs: 24000, emoji: "🚌" },
  { label: "a blue whale", lbs: 300000, emoji: "🐋" },
  { label: "the Statue of Liberty", lbs: 450000, emoji: "🗽" },
  { label: "the Eiffel Tower", lbs: 14700000, emoji: "🗼" },
];

function getVolumeComparison(totalRaw, u) {
  const totalLbs = u === "kg" ? totalRaw * 2.20462 : totalRaw;
  let best = null;
  VOLUME_COMPARISONS.forEach((c) => {
    if (totalLbs >= c.lbs) best = c;
  });
  if (!best) return null;
  const multiple = Math.floor(totalLbs / best.lbs);
  if (multiple < 1) return null;
  return `${best.emoji} That's like lifting ${best.label} ${multiple} time${multiple === 1 ? "" : "s"}!`;
}

function plateClubThresholds(u) {
  return u === "kg" ? { bench: 100, squat: 140, deadlift: 180 } : { bench: 225, squat: 315, deadlift: 405 };
}

function computeBadgeStats() {
  const workouts = Store.state.workouts;
  let totalVolume = 0,
    totalSets = 0,
    totalReps = 0,
    prCount = 0,
    longestWorkoutMin = 0,
    hasEarlyBird = false,
    hasNightOwl = false,
    usedSuperset = false,
    bestBench = 0,
    bestSquat = 0,
    bestDeadlift = 0;
  const exercisesUsed = new Set();

  workouts.forEach((w) => {
    const durationMin = (w.finishedAt - w.startedAt) / 60000;
    if (durationMin > longestWorkoutMin) longestWorkoutMin = durationMin;
    const startHour = new Date(w.startedAt).getHours();
    if (startHour < 7) hasEarlyBird = true;
    if (startHour >= 21) hasNightOwl = true;
    if (w.supersets && w.supersets.length > 0) usedSuperset = true;

    w.exercises.forEach((ex) => {
      exercisesUsed.add(ex.exerciseId);
      const n = ex.name.toLowerCase();
      ex.sets.forEach((s) => {
        const weight = Number(s.weight) || 0;
        const reps = Number(s.reps) || 0;
        totalVolume += weight * reps;
        totalSets++;
        totalReps += reps;
        if (s.pr) prCount++;
        if (/bench/.test(n) && weight > bestBench) bestBench = weight;
        if (/squat/.test(n) && weight > bestSquat) bestSquat = weight;
        if (/deadlift/.test(n) && weight > bestDeadlift) bestDeadlift = weight;
      });
    });
  });

  return {
    totalWorkouts: workouts.length,
    totalVolume,
    totalSets,
    totalReps,
    prCount,
    longestWorkoutMin: Math.round(longestWorkoutMin),
    hasEarlyBird,
    hasNightOwl,
    usedSuperset,
    exerciseVarietyCount: exercisesUsed.size,
    bestBench,
    bestSquat,
    bestDeadlift,
    longestStreak: getLongestWeekStreak(),
  };
}

function getLongestWeekStreak() {
  if (Store.state.workouts.length === 0) return 0;
  const weekStarts = Array.from(new Set(Store.state.workouts.map((w) => startOfWeek(w.finishedAt)))).sort((a, b) => a - b);
  let longest = 1,
    current = 1;
  for (let i = 1; i < weekStarts.length; i++) {
    if (weekStarts[i] - weekStarts[i - 1] === 7 * 86400000) {
      current++;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }
  return longest;
}

function getBadgeDefinitions() {
  const u = unit();
  const plates = plateClubThresholds(u);
  return [
    { id: "first-workout", icon: "🎉", name: "First Rep", desc: "Complete your first workout.", goal: 1, progress: (s) => s.totalWorkouts, check: (s) => s.totalWorkouts >= 1 },
    { id: "w10", icon: "🔥", name: "Getting Started", desc: "Complete 10 workouts.", goal: 10, progress: (s) => s.totalWorkouts, check: (s) => s.totalWorkouts >= 10 },
    { id: "w50", icon: "💪", name: "Iron Regular", desc: "Complete 50 workouts.", goal: 50, progress: (s) => s.totalWorkouts, check: (s) => s.totalWorkouts >= 50 },
    { id: "w100", icon: "🏆", name: "Century Club", desc: "Complete 100 workouts.", goal: 100, progress: (s) => s.totalWorkouts, check: (s) => s.totalWorkouts >= 100 },
    { id: "w250", icon: "👑", name: "Iron Veteran", desc: "Complete 250 workouts.", goal: 250, progress: (s) => s.totalWorkouts, check: (s) => s.totalWorkouts >= 250 },
    { id: "w500", icon: "🐐", name: "Legend", desc: "Complete 500 workouts.", goal: 500, progress: (s) => s.totalWorkouts, check: (s) => s.totalWorkouts >= 500 },

    { id: "vol10k", icon: "🪨", name: "10K Club", desc: `Lift a total of 10,000${u} across all workouts.`, goal: 10000, progress: (s) => s.totalVolume, check: (s) => s.totalVolume >= 10000 },
    { id: "vol100k", icon: "🚗", name: "Car Lifter", desc: `Lift a total of 100,000${u}.`, goal: 100000, progress: (s) => s.totalVolume, check: (s) => s.totalVolume >= 100000 },
    { id: "vol1m", icon: "🐘", name: "Elephant Mover", desc: `Lift a total of 1,000,000${u}.`, goal: 1000000, progress: (s) => s.totalVolume, check: (s) => s.totalVolume >= 1000000 },

    { id: "bench-plate", icon: "🎯", name: `${plates.bench}${u} Bench`, desc: `Bench press ${plates.bench}${u} for at least one rep.`, check: (s) => s.bestBench >= plates.bench },
    { id: "squat-plate", icon: "🎯", name: `${plates.squat}${u} Squat`, desc: `Squat ${plates.squat}${u} for at least one rep.`, check: (s) => s.bestSquat >= plates.squat },
    { id: "deadlift-plate", icon: "🎯", name: `${plates.deadlift}${u} Deadlift`, desc: `Deadlift ${plates.deadlift}${u} for at least one rep.`, check: (s) => s.bestDeadlift >= plates.deadlift },

    { id: "streak2", icon: "📅", name: "2 Week Streak", desc: "Work out at least once a week, 2 weeks in a row.", goal: 2, progress: (s) => s.longestStreak, check: (s) => s.longestStreak >= 2 },
    { id: "streak4", icon: "📅", name: "4 Week Streak", desc: "Work out at least once a week, 4 weeks in a row.", goal: 4, progress: (s) => s.longestStreak, check: (s) => s.longestStreak >= 4 },
    { id: "streak12", icon: "📅", name: "12 Week Streak", desc: "Work out at least once a week, 12 weeks in a row.", goal: 12, progress: (s) => s.longestStreak, check: (s) => s.longestStreak >= 12 },

    { id: "pr1", icon: "🏅", name: "First PR", desc: "Set your first personal record.", goal: 1, progress: (s) => s.prCount, check: (s) => s.prCount >= 1 },
    { id: "pr10", icon: "🏅", name: "PR Hunter", desc: "Set 10 personal records.", goal: 10, progress: (s) => s.prCount, check: (s) => s.prCount >= 10 },
    { id: "pr50", icon: "🏅", name: "PR Machine", desc: "Set 50 personal records.", goal: 50, progress: (s) => s.prCount, check: (s) => s.prCount >= 50 },

    { id: "early-bird", icon: "🌅", name: "Early Bird", desc: "Start a workout before 7am.", check: (s) => s.hasEarlyBird },
    { id: "night-owl", icon: "🦉", name: "Night Owl", desc: "Start a workout at 9pm or later.", check: (s) => s.hasNightOwl },
    { id: "marathon", icon: "⏱️", name: "Marathon Session", desc: "Complete a workout lasting 90+ minutes.", check: (s) => s.longestWorkoutMin >= 90 },
    { id: "variety", icon: "🧭", name: "Iron Explorer", desc: "Log 10 different exercises.", goal: 10, progress: (s) => s.exerciseVarietyCount, check: (s) => s.exerciseVarietyCount >= 10 },
    { id: "superset", icon: "🔗", name: "Superset Squad", desc: "Complete a workout using a superset.", check: (s) => s.usedSuperset },
  ];
}
