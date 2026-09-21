// Generates a fresh, non-repetitive session and prescribes a starting
// weight/rep target per exercise, estimated from the user's own lift
// history (Epley 1RM formula) rather than generic defaults.

const GOAL_PRESETS = {
  strength: { label: "Strength", targetReps: 4 },
  hypertrophy: { label: "Hypertrophy", targetReps: 10 },
  endurance: { label: "Endurance", targetReps: 16 },
};

const GENERATOR_MUSCLE_GROUPS = ["Chest", "Back", "Shoulders", "Legs", "Arms", "Core"];

function estimate1RM(weight, reps) {
  return weight * (1 + reps / 30);
}

function weightForTargetReps(oneRM, targetReps) {
  return oneRM / (1 + targetReps / 30);
}

function isCompoundMovement(name) {
  return /squat|deadlift|bench press|shoulder press|overhead press|military press|row|pull.?up|chin.?up|lunge|dip\b|clean|snatch/i.test(name);
}

function isBodyweightMovement(name) {
  return /push.?up|sit.?up|plank|pull.?up|chin.?up|^dip\b|crunch|mountain climber/i.test(name) && !/machine|assisted|weighted|cable/i.test(name);
}

function roundToStep(val, step) {
  return Math.max(0, Math.round(val / step) * step);
}

function weightRoundingStep() {
  return unit() === "kg" ? 2.5 : 5;
}

// Machine/cable/Smith-assisted lifts let people move noticeably more
// weight than the equivalent free-weight movement (fixed path, no
// stabilizer or balance demand) — a Hack Squat number wildly overestimates
// barbell Lunge capacity if treated the same as a free-weight reference.
function isMachineAssisted(name) {
  return /machine|hack squat|leg press|smith|plate loaded|cable|assisted/i.test(name);
}

// Every distinct exercise's best set in the muscle group, not just the
// single heaviest one — so a target exercise can be estimated from the
// closest-matching reference instead of always the biggest number.
function getMuscleGroupReferences(muscleGroup) {
  const perExercise = new Map();
  Store.state.workouts.forEach((w) => {
    w.exercises.forEach((ex) => {
      const exMeta = Store.getExercise(ex.exerciseId);
      if (!exMeta || exMeta.muscleGroup !== muscleGroup) return;
      ex.sets.forEach((s) => {
        const weight = Number(s.weight) || 0;
        const reps = Number(s.reps) || 0;
        if (weight <= 0 || reps <= 0) return;
        const oneRM = estimate1RM(weight, reps);
        const cur = perExercise.get(ex.exerciseId);
        if (!cur || oneRM > cur.oneRM) {
          perExercise.set(ex.exerciseId, {
            oneRM,
            compound: isCompoundMovement(exMeta.name),
            machine: isMachineAssisted(exMeta.name),
          });
        }
      });
    });
  });
  return Array.from(perExercise.values());
}

// Picks the reference whose compound/machine profile is closest to the
// target exercise (fewest mismatched dimensions), tie-breaking toward the
// smaller number so an outlier doesn't get borrowed unnecessarily.
function pickBestReference(refs, targetCompound, targetMachine) {
  let best = null;
  let bestScore = Infinity;
  refs.forEach((r) => {
    let score = 0;
    if (r.compound !== targetCompound) score += 1;
    if (r.machine !== targetMachine) score += 1;
    if (score < bestScore || (score === bestScore && best && r.oneRM < best.oneRM)) {
      bestScore = score;
      best = r;
    }
  });
  return best ? { ...best, score: bestScore } : null;
}

function crossExerciseDiscount(fromCompound, toCompound) {
  if (fromCompound && !toCompound) return 0.35;
  if (!fromCompound && toCompound) return 1.6;
  return 0.85;
}

function referenceDiscount(ref, targetCompound, targetMachine) {
  let factor = crossExerciseDiscount(ref.compound, targetCompound);
  if (ref.machine && !targetMachine) factor *= 0.55;
  else if (!ref.machine && targetMachine) factor *= 1.25;
  return factor;
}

// item: {id, name, muscleGroup} from the merged exercise list (id is null
// for library-only exercises the user has never added).
function suggestForExercise(item, targetReps) {
  if (isBodyweightMovement(item.name)) {
    return { weight: 0, reps: targetReps, confidence: "bodyweight" };
  }

  if (item.id) {
    const best = Store.getBestSet(item.id);
    if (best && best.weight > 0 && best.reps > 0) {
      const oneRM = estimate1RM(best.weight, best.reps);
      const weight = roundToStep(weightForTargetReps(oneRM, targetReps), weightRoundingStep());
      return { weight, reps: targetReps, confidence: "known" };
    }
  }

  const refs = getMuscleGroupReferences(item.muscleGroup);
  const targetCompound = isCompoundMovement(item.name);
  const targetMachine = isMachineAssisted(item.name);
  const ref = pickBestReference(refs, targetCompound, targetMachine);
  if (ref) {
    const oneRM = ref.oneRM * referenceDiscount(ref, targetCompound, targetMachine);
    const weight = Math.max(roundToStep(weightForTargetReps(oneRM, targetReps), weightRoundingStep()), weightRoundingStep());
    return { weight, reps: targetReps, confidence: "estimated" };
  }

  return { weight: "", reps: targetReps, confidence: "unknown" };
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getRecentlyUsedExerciseIds(numWorkouts) {
  const ids = new Set();
  Store.state.workouts.slice(0, numWorkouts).forEach((w) => {
    w.exercises.forEach((ex) => ids.add(ex.exerciseId));
  });
  return ids;
}

function pickExercisesForFocus(focus, count) {
  const merged = getMergedExerciseList();
  const recentIds = getRecentlyUsedExerciseIds(3);

  const poolFor = (group) => merged.filter((it) => it.muscleGroup === group);

  function pickFromPool(pool, n) {
    const neverDone = shuffleArray(pool.filter((it) => !it.id));
    const notRecent = shuffleArray(pool.filter((it) => it.id && !recentIds.has(it.id)));
    const picks = [];
    picks.push(...neverDone.slice(0, Math.ceil(n * 0.6)));
    picks.push(...notRecent.slice(0, n - picks.length));
    if (picks.length < n) {
      const used = new Set(picks.map((p) => p.name.toLowerCase()));
      const fallback = shuffleArray(pool.filter((it) => !used.has(it.name.toLowerCase())));
      picks.push(...fallback.slice(0, n - picks.length));
    }
    return picks.slice(0, n);
  }

  if (focus !== "Full Body") {
    return pickFromPool(poolFor(focus), count);
  }

  // Full body: round-robin across groups so it doesn't cluster on one area.
  const groups = shuffleArray([...GENERATOR_MUSCLE_GROUPS]);
  const perGroupPicks = {};
  groups.forEach((g) => {
    perGroupPicks[g] = pickFromPool(poolFor(g), count);
  });
  const picks = [];
  let gi = 0;
  while (picks.length < count) {
    const g = groups[gi % groups.length];
    const next = perGroupPicks[g].shift();
    if (next) picks.push(next);
    gi++;
    if (gi > groups.length * count) break; // safety valve if pools run dry
  }
  return picks;
}

function getLeastRecentMuscleGroup() {
  const lastTrained = {};
  GENERATOR_MUSCLE_GROUPS.forEach((g) => (lastTrained[g] = 0));
  Store.state.workouts.forEach((w) => {
    w.exercises.forEach((ex) => {
      const exMeta = Store.getExercise(ex.exerciseId);
      if (!exMeta || !(exMeta.muscleGroup in lastTrained)) return;
      if (w.finishedAt > lastTrained[exMeta.muscleGroup]) lastTrained[exMeta.muscleGroup] = w.finishedAt;
    });
  });
  const sorted = [...GENERATOR_MUSCLE_GROUPS].sort((a, b) => lastTrained[a] - lastTrained[b]);
  const group = sorted[0];
  const daysAgo = lastTrained[group] > 0 ? Math.floor((Date.now() - lastTrained[group]) / 86400000) : null;
  return { group, daysAgo };
}

function generateSession(focus, goalKey, count) {
  const goal = GOAL_PRESETS[goalKey] || GOAL_PRESETS.hypertrophy;
  const picks = pickExercisesForFocus(focus, count || 5);
  return picks.map((item) => ({
    exercise: item,
    suggestion: suggestForExercise(item, goal.targetReps),
  }));
}
