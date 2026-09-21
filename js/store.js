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
    return { ...defaultState(), ...parsed };
  } catch (e) {
    console.error("Failed to load state, starting fresh", e);
    return defaultState();
  }
}

function defaultState() {
  return {
    exercises: [],
    routines: [],
    workouts: [],
    activeWorkout: null,
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
  addRoutine(name, exerciseIds) {
    const routine = { id: uid(), name: name.trim(), exerciseIds: exerciseIds || [], createdAt: Date.now() };
    this.state.routines.push(routine);
    this.save();
    return routine;
  },

  updateRoutine(id, updates) {
    const r = this.state.routines.find((r) => r.id === id);
    if (!r) return;
    Object.assign(r, updates);
    this.save();
  },

  deleteRoutine(id) {
    this.state.routines = this.state.routines.filter((r) => r.id !== id);
    this.save();
  },

  getRoutine(id) {
    return this.state.routines.find((r) => r.id === id);
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

  deleteWorkout(id) {
    this.state.workouts = this.state.workouts.filter((w) => w.id !== id);
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
