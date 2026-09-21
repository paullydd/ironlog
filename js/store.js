// Local-storage backed data layer. Everything lives on this device only.
const STORAGE_KEY = "ironlog.v1";

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    const state = { ...defaultState(), ...parsed };
    migrateRoutineCategories(state);
    return state;
  } catch (e) {
    console.error("Failed to load state, starting fresh", e);
    return defaultState();
  }
}

// Guesses a reasonable category from a routine name (e.g. "Day One Bulk" ->
// Bulk) instead of leaving everything uncategorized — used both to migrate
// routines saved before categories existed and for routines created fresh
// by the Strong CSV importer.
function guessRoutineCategory(name) {
  if (/bulk/i.test(name)) return "Bulk";
  if (/^day (one|two|three|four|five|six)\b/i.test(name.trim())) return "Shred";
  return "General";
}

function migrateRoutineCategories(state) {
  state.routines.forEach((r) => {
    if (!r.category) r.category = guessRoutineCategory(r.name);
  });
}

function defaultState() {
  return {
    exercises: [],
    routines: [],
    workouts: [],
    bodyweightLogs: [],
    activeWorkout: null,
    // Keyed by JS Date.getDay() (0=Sun..6=Sat) -> a routine id, "rest", or absent (unset).
    schedule: {},
    settings: { unit: "lbs" },
  };
}

const Store = {
  state: loadState(),

  save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
  },

  // ----- Exercises -----
  addExercise(name, muscleGroup) {
    const existing = this.state.exercises.find(
      (e) => e.name.toLowerCase() === name.trim().toLowerCase()
    );
    if (existing) return existing;
    const ex = { id: uid(), name: name.trim(), muscleGroup: muscleGroup || "Other" };
    this.state.exercises.push(ex);
    this.save();
    return ex;
  },

  getExercise(id) {
    return this.state.exercises.find((e) => e.id === id);
  },

  // ----- Routines -----
  addRoutine(name, exerciseIds, category, supersets) {
    const routine = {
      id: uid(),
      name: name.trim(),
      exerciseIds: exerciseIds || [],
      category: (category || "General").trim() || "General",
      supersets: supersets || [],
      createdAt: Date.now(),
    };
    this.state.routines.push(routine);
    this.save();
    return routine;
  },

  getRoutineCategories() {
    const cats = new Set(this.state.routines.map((r) => r.category || "General"));
    return Array.from(cats).sort((a, b) => {
      if (a === "General") return 1;
      if (b === "General") return -1;
      return a.localeCompare(b);
    });
  },

  updateRoutine(id, updates) {
    const r = this.state.routines.find((r) => r.id === id);
    if (!r) return;
    Object.assign(r, updates);
    this.save();
  },

  deleteRoutine(id) {
    this.state.routines = this.state.routines.filter((r) => r.id !== id);
    Object.keys(this.state.schedule).forEach((day) => {
      if (this.state.schedule[day] === id) delete this.state.schedule[day];
    });
    this.save();
  },

  getRoutine(id) {
    return this.state.routines.find((r) => r.id === id);
  },

  // ----- Weekly schedule -----
  setScheduleDay(day, value) {
    if (value === null || value === undefined) {
      delete this.state.schedule[day];
    } else {
      this.state.schedule[day] = value;
    }
    this.save();
  },

  getScheduleDay(day) {
    return this.state.schedule[day] || null;
  },

  // ----- Active workout -----
  startWorkout(routine) {
    const exercises = (routine ? routine.exerciseIds : []).map((exId) => {
      const ex = this.getExercise(exId);
      return { exerciseId: exId, name: ex ? ex.name : "Unknown", sets: [] };
    });
    this.state.activeWorkout = {
      id: uid(),
      routineId: routine ? routine.id : null,
      routineName: routine ? routine.name : "Quick Workout",
      startedAt: Date.now(),
      exercises,
      supersets: routine && routine.supersets ? routine.supersets.map((g) => [...g]) : [],
    };
    this.save();
    return this.state.activeWorkout;
  },

  cancelWorkout() {
    this.state.activeWorkout = null;
    this.save();
  },

  addExerciseToActiveWorkout(exercise) {
    if (!this.state.activeWorkout) return;
    const already = this.state.activeWorkout.exercises.find((e) => e.exerciseId === exercise.id);
    if (already) return;
    this.state.activeWorkout.exercises.push({ exerciseId: exercise.id, name: exercise.name, sets: [] });
    this.save();
  },

  removeExerciseFromActiveWorkout(exerciseId) {
    if (!this.state.activeWorkout) return;
    this.state.activeWorkout.exercises = this.state.activeWorkout.exercises.filter(
      (e) => e.exerciseId !== exerciseId
    );
    if (this.state.activeWorkout.supersets) {
      this.state.activeWorkout.supersets = this.state.activeWorkout.supersets
        .map((g) => g.filter((id) => id !== exerciseId))
        .filter((g) => g.length >= 2);
    }
    this.save();
  },

  addSet(exerciseId, weight, reps) {
    if (!this.state.activeWorkout) return;
    const ex = this.state.activeWorkout.exercises.find((e) => e.exerciseId === exerciseId);
    if (!ex) return;
    ex.sets.push({ weight, reps, done: true });
    this.save();
  },

  removeSet(exerciseId, setIndex) {
    if (!this.state.activeWorkout) return;
    const ex = this.state.activeWorkout.exercises.find((e) => e.exerciseId === exerciseId);
    if (!ex) return;
    ex.sets.splice(setIndex, 1);
    this.save();
  },

  finishWorkout() {
    const w = this.state.activeWorkout;
    if (!w) return null;
    w.finishedAt = Date.now();
    // Drop exercises with zero logged sets so history stays clean.
    w.exercises = w.exercises.filter((e) => e.sets.length > 0);
    // Tag sets that set a new all-time best for that exercise (weight for
    // strength, distance/duration for cardio), so history/progress views
    // can show a PR badge after the fact.
    w.exercises.forEach((ex) => {
      const exMeta = this.getExercise(ex.exerciseId);
      if (exMeta && exMeta.muscleGroup === "Cardio") {
        let runningBestDistance = this.getBestCardioMetric(ex.exerciseId, "distance") || 0;
        let runningBestDuration = this.getBestCardioMetric(ex.exerciseId, "duration") || 0;
        ex.sets.forEach((s) => {
          const metric = Number(s.distance) > 0 ? "distance" : "duration";
          const value = Number(s[metric]) || 0;
          if (value <= 0) return;
          if (metric === "distance" && value > runningBestDistance) {
            s.pr = true;
            runningBestDistance = value;
          } else if (metric === "duration" && value > runningBestDuration) {
            s.pr = true;
            runningBestDuration = value;
          }
        });
        return;
      }
      const priorBest = this.getBestSet(ex.exerciseId);
      let runningBest = priorBest ? priorBest.weight : 0;
      ex.sets.forEach((s) => {
        const weight = Number(s.weight) || 0;
        if (weight > 0 && weight > runningBest) {
          s.pr = true;
          runningBest = weight;
        }
      });
    });
    if (w.exercises.length > 0) {
      this.state.workouts.unshift(w);
    }
    this.state.activeWorkout = null;
    this.save();
    return w;
  },

  // ----- History / stats -----
  getLastPerformance(exerciseId) {
    for (const w of this.state.workouts) {
      const ex = w.exercises.find((e) => e.exerciseId === exerciseId);
      if (ex && ex.sets.length > 0) return { date: w.finishedAt, sets: ex.sets };
    }
    return null;
  },

  getExerciseHistory(exerciseId) {
    const history = [];
    for (const w of this.state.workouts) {
      const ex = w.exercises.find((e) => e.exerciseId === exerciseId);
      if (ex && ex.sets.length > 0) {
        history.push({ date: w.finishedAt, sets: ex.sets });
      }
    }
    return history;
  },

  getBestSet(exerciseId) {
    let best = null;
    for (const w of this.state.workouts) {
      const ex = w.exercises.find((e) => e.exerciseId === exerciseId);
      if (!ex) continue;
      for (const s of ex.sets) {
        if (!best || s.weight > best.weight) best = s;
      }
    }
    return best;
  },

  // metric: "distance" or "duration" — the best value ever logged for a
  // cardio exercise on that metric.
  getBestCardioMetric(exerciseId, metric) {
    let best = 0;
    for (const w of this.state.workouts) {
      const ex = w.exercises.find((e) => e.exerciseId === exerciseId);
      if (!ex) continue;
      for (const s of ex.sets) {
        const v = Number(s[metric]) || 0;
        if (v > best) best = v;
      }
    }
    return best > 0 ? best : null;
  },

  deleteWorkout(id) {
    this.state.workouts = this.state.workouts.filter((w) => w.id !== id);
    this.save();
  },

  workoutVolume(w) {
    return w.exercises.reduce(
      (sum, ex) => sum + ex.sets.reduce((s, set) => s + (Number(set.weight) || 0) * (Number(set.reps) || 0), 0),
      0
    );
  },

  // ----- Bodyweight -----
  addBodyweightLog(weight, date) {
    const entry = { id: uid(), weight, date: date || Date.now() };
    this.state.bodyweightLogs.push(entry);
    this.save();
    return entry;
  },

  deleteBodyweightLog(id) {
    this.state.bodyweightLogs = this.state.bodyweightLogs.filter((l) => l.id !== id);
    this.save();
  },

  // ----- Import / export -----
  exportData() {
    return JSON.stringify(this.state, null, 2);
  },

  importData(json) {
    const parsed = JSON.parse(json);
    this.state = { ...defaultState(), ...parsed };
    this.save();
  },

  setUnit(unit) {
    this.state.settings.unit = unit;
    this.save();
  },
};
