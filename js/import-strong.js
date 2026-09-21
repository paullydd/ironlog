// Imports a Strong app CSV export (Date,Workout Name,Duration,Exercise Name,
// Set Order,Weight,Reps,Distance,Seconds,RPE) into Store. Additive and safe
// to re-run: existing exercises are reused by name, existing routines are
// merged rather than duplicated, and sessions already present (matched by
// start time + routine name) are skipped.

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function parseDurationToMs(str) {
  if (!str) return 0;
  let minutes = 0;
  const hMatch = str.match(/(\d+)\s*h/);
  const mMatch = str.match(/(\d+)\s*m/);
  if (hMatch) minutes += parseInt(hMatch[1], 10) * 60;
  if (mMatch) minutes += parseInt(mMatch[1], 10);
  return minutes * 60000;
}

function guessMuscleGroup(name) {
  const lib = EXERCISE_LIBRARY.find((e) => e.name.toLowerCase() === name.toLowerCase());
  if (lib) return lib.muscleGroup;
  const n = name.toLowerCase();
  if (/curl|tricep|bicep|wrist/.test(n)) return "Arms";
  if (/squat|leg|calf|lunge|hip|glute/.test(n)) return "Legs";
  if (/bench|chest|fly|dip|push up/.test(n)) return "Chest";
  if (/row|pull|lat|deadlift|shrug/.test(n)) return "Back";
  if (/shoulder|lateral|raise|shrug|press/.test(n)) return "Shoulders";
  if (/sit up|crunch|plank|ab |russian twist/.test(n)) return "Core";
  if (/run|bike|cycling|treadmill|row(ing)? machine|elliptical|jump rope/.test(n)) return "Cardio";
  return "Other";
}

function parseStrongCsv(text) {
  const rows = parseCsv(text.trim());
  if (rows.length < 2) throw new Error("empty");
  const header = rows[0].map((h) => h.trim());
  const idx = {
    date: header.indexOf("Date"),
    workout: header.indexOf("Workout Name"),
    duration: header.indexOf("Duration"),
    exercise: header.indexOf("Exercise Name"),
    setOrder: header.indexOf("Set Order"),
    weight: header.indexOf("Weight"),
    reps: header.indexOf("Reps"),
  };
  if (idx.date === -1 || idx.exercise === -1 || idx.weight === -1 || idx.reps === -1) {
    throw new Error("unrecognized_format");
  }

  const sessions = new Map(); // key: date|workout -> session
  const sessionOrder = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length < 2 || (r.length === 1 && r[0] === "")) continue;
    const dateStr = r[idx.date];
    const workoutName = r[idx.workout] || "Workout";
    const duration = idx.duration !== -1 ? r[idx.duration] : "";
    const exerciseName = r[idx.exercise];
    const weight = parseFloat(r[idx.weight]) || 0;
    const reps = parseFloat(r[idx.reps]) || 0;
    if (!dateStr || !exerciseName) continue;

    const key = dateStr + "|" + workoutName;
    let session = sessions.get(key);
    if (!session) {
      const startedAt = new Date(dateStr.replace(" ", "T")).getTime();
      session = {
        startedAt,
        finishedAt: startedAt + parseDurationToMs(duration),
        routineName: workoutName,
        exerciseOrder: [],
        exercises: new Map(), // name -> sets[]
      };
      sessions.set(key, session);
      sessionOrder.push(key);
    }
    if (!session.exercises.has(exerciseName)) {
      session.exercises.set(exerciseName, []);
      session.exerciseOrder.push(exerciseName);
    }
    session.exercises.get(exerciseName).push({ weight, reps });
  }

  return sessionOrder.map((key) => sessions.get(key));
}

function importStrongData(text) {
  const sessions = parseStrongCsv(text);
  if (sessions.length === 0) {
    return { workoutsImported: 0, workoutsSkipped: 0, routinesCreated: 0, exercisesCreated: 0 };
  }

  const exercisesBefore = Store.state.exercises.length;

  // Ensure every exercise referenced exists.
  const nameToExercise = new Map();
  sessions.forEach((session) => {
    session.exerciseOrder.forEach((name) => {
      if (!nameToExercise.has(name)) {
        const ex = Store.addExercise(name, guessMuscleGroup(name));
        nameToExercise.set(name, ex);
      }
    });
  });

  // Build/merge routines per unique workout (routine) name.
  const routineExerciseOrder = new Map(); // routineName -> [exerciseName,...]
  sessions.forEach((session) => {
    if (!routineExerciseOrder.has(session.routineName)) {
      routineExerciseOrder.set(session.routineName, []);
    }
    const list = routineExerciseOrder.get(session.routineName);
    session.exerciseOrder.forEach((name) => {
      if (!list.includes(name)) list.push(name);
    });
  });

  let routinesCreated = 0;
  routineExerciseOrder.forEach((exerciseNames, routineName) => {
    const exerciseIds = exerciseNames.map((n) => nameToExercise.get(n).id);
    const existing = Store.state.routines.find((r) => r.name === routineName);
    if (existing) {
      exerciseIds.forEach((id) => {
        if (!existing.exerciseIds.includes(id)) existing.exerciseIds.push(id);
      });
    } else {
      Store.addRoutine(routineName, exerciseIds);
      routinesCreated++;
    }
  });

  // Import workout history, skipping sessions already imported.
  let workoutsImported = 0;
  let workoutsSkipped = 0;
  sessions.forEach((session) => {
    const already = Store.state.workouts.some(
      (w) => w.startedAt === session.startedAt && w.routineName === session.routineName
    );
    if (already) {
      workoutsSkipped++;
      return;
    }
    const exercises = session.exerciseOrder.map((name) => ({
      exerciseId: nameToExercise.get(name).id,
      name,
      sets: session.exercises.get(name),
    }));
    const routine = Store.state.routines.find((r) => r.name === session.routineName);
    Store.state.workouts.push({
      id: uid(),
      routineId: routine ? routine.id : null,
      routineName: session.routineName,
      startedAt: session.startedAt,
      finishedAt: session.finishedAt,
      exercises,
    });
    workoutsImported++;
  });

  Store.state.workouts.sort((a, b) => b.finishedAt - a.finishedAt);
  Store.save();

  return {
    workoutsImported,
    workoutsSkipped,
    routinesCreated,
    exercisesCreated: Store.state.exercises.length - exercisesBefore,
  };
}
