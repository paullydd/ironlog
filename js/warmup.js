// Suggests a warm-up ramp (empty bar -> 50% -> 70% -> 85%) leading into a
// given working weight. Reuses roundToStep() from plates.js/generator.js.
function computeWarmupSets(workingWeight, u) {
  const bar = u === "kg" ? 20 : 45;
  const step = u === "kg" ? 2.5 : 5;
  const w = Number(workingWeight) || 0;
  if (w <= bar) return [];

  const ramp = [
    { pct: 0, reps: 10 },
    { pct: 0.5, reps: 5 },
    { pct: 0.7, reps: 3 },
    { pct: 0.85, reps: 2 },
  ];

  const sets = [];
  ramp.forEach((r) => {
    const raw = r.pct === 0 ? bar : Math.max(bar, roundToStep(w * r.pct, step));
    if (raw < w && (sets.length === 0 || raw > sets[sets.length - 1].weight)) {
      sets.push({ weight: raw, reps: r.reps });
    }
  });
  return sets;
}
