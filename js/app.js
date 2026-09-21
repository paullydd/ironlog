// ---------- Utilities ----------
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function formatDateShort(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatDuration(startMs, endMs) {
  const mins = Math.max(1, Math.round((endMs - startMs) / 60000));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

function startOfWeek(ts) {
  const d = new Date(ts);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day; // Monday start
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function unit() {
  return Store.state.settings.unit || "lbs";
}

function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => t.classList.remove("show"), 1800);
}

const MUSCLE_GROUPS = ["Chest", "Back", "Shoulders", "Legs", "Arms", "Core", "Cardio", "Other"];

// ---------- Router ----------
let activeInterval = null;

function navigate(route) {
  window.location.hash = route;
}

function currentRoute() {
  const hash = window.location.hash.replace(/^#\/?/, "");
  const parts = hash.split("/").filter(Boolean);
  return { name: parts[0] || "home", params: parts.slice(1) };
}

function render() {
  if (activeInterval) {
    clearInterval(activeInterval);
    activeInterval = null;
  }
  const { name, params } = currentRoute();
  const root = document.getElementById("view-root");
  const nav = document.getElementById("bottom-nav");

  const fullscreenViews = ["workout", "routine-edit"];
  nav.classList.toggle("hidden", fullscreenViews.includes(name));

  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.route === name);
  });

  switch (name) {
    case "home":
      root.innerHTML = renderHome();
      break;
    case "routines":
      root.innerHTML = renderRoutines();
      break;
    case "routine-edit":
      root.innerHTML = renderRoutineEdit(params[0]);
      break;
    case "workout":
      if (!Store.state.activeWorkout) {
        navigate("#/home");
        return;
      }
      root.innerHTML = renderWorkout();
      activeInterval = setInterval(updateWorkoutTimer, 1000);
      break;
    case "history":
      root.innerHTML = renderHistory();
      break;
    case "workout-detail":
      root.innerHTML = renderWorkoutDetail(params[0]);
      break;
    case "exercise":
      root.innerHTML = renderExerciseDetail(params[0]);
      break;
    case "settings":
      root.innerHTML = renderSettings();
      break;
    default:
      root.innerHTML = renderHome();
  }
  window.scrollTo(0, 0);
}

window.addEventListener("hashchange", render);

// ---------- Sheet (bottom modal) ----------
function openSheet(html) {
  document.getElementById("sheet-content").innerHTML = html;
  document.getElementById("sheet-backdrop").classList.remove("hidden");
}

function closeSheet() {
  document.getElementById("sheet-backdrop").classList.add("hidden");
  document.getElementById("sheet-content").innerHTML = "";
}

document.getElementById("sheet-backdrop").addEventListener("click", (e) => {
  if (e.target.id === "sheet-backdrop") closeSheet();
});

// ---------- Home ----------
function renderHome() {
  const workouts = Store.state.workouts;
  const totalWorkouts = workouts.length;
  const weekStart = startOfWeek(Date.now());
  const thisWeek = workouts.filter((w) => w.finishedAt >= weekStart).length;
  const routines = Store.state.routines;
  const active = Store.state.activeWorkout;

  let html = `<div class="topbar"><h1>IronLog</h1></div><div class="view">`;

  if (active) {
    html += `
      <div class="card card-tap" onclick="navigate('#/workout')">
        <div class="row-between">
          <div>
            <h3 style="font-size:16px;font-weight:700;">Workout in progress</h3>
            <p class="text-dim">${escapeHtml(active.routineName)} · started ${formatDate(active.startedAt)}</p>
          </div>
          <button class="btn btn-primary btn-small">Resume</button>
        </div>
      </div>`;
  }

  html += `
    <div class="stat-row">
      <div class="stat"><span class="num">${totalWorkouts}</span><span class="label">Workouts</span></div>
      <div class="stat"><span class="num">${thisWeek}</span><span class="label">This Week</span></div>
      <div class="stat"><span class="num">${routines.length}</span><span class="label">Routines</span></div>
    </div>`;

  html += `<div class="section-title">Your Routines</div>`;
  if (routines.length === 0) {
    html += `
      <div class="empty-state">
        <span class="big-icon">🏋️</span>
        <p>No routines yet. Create one to start tracking your split.</p>
      </div>
      <button class="btn btn-primary" onclick="navigate('#/routine-edit/new')">+ Create a Routine</button>`;
  } else {
    routines.forEach((r) => {
      html += `
        <div class="card routine-card">
          <div class="info card-tap" style="flex:1" onclick="navigate('#/routine-edit/${r.id}')">
            <h3>${escapeHtml(r.name)}</h3>
            <p>${r.exerciseIds.length} exercise${r.exerciseIds.length === 1 ? "" : "s"}</p>
          </div>
          <button class="btn btn-primary btn-small" style="width:auto;flex-shrink:0;" onclick="startWorkoutFromRoutine('${r.id}')">Start</button>
        </div>`;
    });
  }

  html += `<div class="section-title">Or</div>`;
  html += `<button class="btn btn-secondary" onclick="startQuickWorkout()">⚡ Quick Workout (no routine)</button>`;

  html += `</div>`;
  return html;
}

function startWorkoutFromRoutine(routineId) {
  if (Store.state.activeWorkout) {
    if (!confirm("You already have a workout in progress. Discard it and start a new one?")) return;
    Store.cancelWorkout();
  }
  const routine = Store.getRoutine(routineId);
  Store.startWorkout(routine);
  navigate("#/workout");
}

function startQuickWorkout() {
  if (Store.state.activeWorkout) {
    if (!confirm("You already have a workout in progress. Discard it and start a new one?")) return;
    Store.cancelWorkout();
  }
  Store.startWorkout(null);
  navigate("#/workout");
}

// ---------- Routines list ----------
function renderRoutines() {
  const routines = Store.state.routines;
  let html = `
    <div class="topbar">
      <h1>Routines</h1>
      <button class="btn-icon" onclick="navigate('#/routine-edit/new')">+</button>
    </div>
    <div class="view">`;

  if (routines.length === 0) {
    html += `
      <div class="empty-state">
        <span class="big-icon">📋</span>
        <p>No routines yet. Build your split so you can track the same exercises each time.</p>
      </div>
      <button class="btn btn-primary" onclick="navigate('#/routine-edit/new')">+ Create a Routine</button>`;
  } else {
    routines.forEach((r) => {
      html += `
        <div class="card routine-card card-tap" onclick="navigate('#/routine-edit/${r.id}')">
          <div class="info">
            <h3>${escapeHtml(r.name)}</h3>
            <p>${r.exerciseIds.length} exercise${r.exerciseIds.length === 1 ? "" : "s"}</p>
          </div>
          <span style="color:var(--text-faint);font-size:20px;">›</span>
        </div>`;
    });
  }
  html += `</div>`;
  return html;
}

// ---------- Routine editor ----------
let routineEditState = null;

function renderRoutineEdit(id) {
  const isNew = id === "new";
  const routine = isNew ? null : Store.getRoutine(id);
  if (!isNew && !routine) {
    navigate("#/routines");
    return "";
  }

  routineEditState = {
    id: isNew ? null : routine.id,
    name: routine ? routine.name : "",
    exerciseIds: routine ? [...routine.exerciseIds] : [],
  };

  return renderRoutineEditView();
}

function renderRoutineEditView() {
  const s = routineEditState;
  let html = `
    <div class="topbar">
      <button class="back" onclick="navigate('#/routines')">‹ Back</button>
    </div>
    <div class="view">
      <h1 style="margin-bottom:18px;">${s.id ? "Edit Routine" : "New Routine"}</h1>
      <div class="field">
        <label>Routine Name</label>
        <input type="text" id="routine-name-input" placeholder="e.g. Push Day" value="${escapeHtml(s.name)}" />
      </div>
      <div class="section-title">Exercises</div>
      <div id="routine-exercise-list">${renderRoutineExerciseRows()}</div>
      <button class="btn btn-secondary" onclick="openExercisePickerForRoutine()">+ Add Exercises</button>
      <div class="divider"></div>
      <button class="btn btn-primary" onclick="saveRoutine()">Save Routine</button>`;
  if (s.id) {
    html += `<div style="margin-top:10px;text-align:center;"><button class="btn-danger" onclick="deleteRoutineConfirm('${s.id}')">Delete Routine</button></div>`;
  }
  html += `</div>`;
  return html;
}

function renderRoutineExerciseRows() {
  const s = routineEditState;
  if (s.exerciseIds.length === 0) {
    return `<p class="text-dim" style="margin-bottom:12px;">No exercises added yet.</p>`;
  }
  return s.exerciseIds
    .map((exId) => {
      const ex = Store.getExercise(exId);
      if (!ex) return "";
      return `
        <div class="routine-exercise-row">
          <span>${escapeHtml(ex.name)}</span>
          <button class="btn-icon" style="width:32px;height:32px;font-size:14px;" onclick="removeExerciseFromRoutine('${exId}')">✕</button>
        </div>`;
    })
    .join("");
}

function removeExerciseFromRoutine(exId) {
  routineEditState.exerciseIds = routineEditState.exerciseIds.filter((id) => id !== exId);
  document.getElementById("routine-exercise-list").innerHTML = renderRoutineExerciseRows();
}

function saveRoutine() {
  const nameInput = document.getElementById("routine-name-input");
  const name = nameInput.value.trim();
  if (!name) {
    toast("Give the routine a name");
    nameInput.focus();
    return;
  }
  const s = routineEditState;
  if (s.id) {
    Store.updateRoutine(s.id, { name, exerciseIds: s.exerciseIds });
  } else {
    Store.addRoutine(name, s.exerciseIds);
  }
  toast("Routine saved");
  navigate("#/routines");
}

function deleteRoutineConfirm(id) {
  if (!confirm("Delete this routine? Past workout history stays intact.")) return;
  Store.deleteRoutine(id);
  navigate("#/routines");
}

function openExercisePickerForRoutine() {
  openSheet(renderExercisePickerSheet(routineEditState.exerciseIds, (selectedIds) => {
    routineEditState.exerciseIds = selectedIds;
    document.getElementById("routine-exercise-list").innerHTML = renderRoutineExerciseRows();
  }));
}

// ---------- Merged exercise list (your exercises + the built-in library) ----------
function getMergedExerciseList() {
  const map = new Map();
  Store.state.exercises.forEach((ex) => {
    map.set(ex.id, { key: ex.id, id: ex.id, name: ex.name, muscleGroup: ex.muscleGroup });
  });
  const existingNames = new Set(Store.state.exercises.map((ex) => ex.name.toLowerCase()));
  EXERCISE_LIBRARY.forEach((libEx) => {
    if (!existingNames.has(libEx.name.toLowerCase())) {
      const key = "new:" + libEx.name.toLowerCase();
      map.set(key, { key, id: null, name: libEx.name, muscleGroup: libEx.muscleGroup });
    }
  });
  return Array.from(map.values());
}

function groupByMuscle(items) {
  const groups = {};
  items.forEach((it) => {
    const g = it.muscleGroup || "Other";
    if (!groups[g]) groups[g] = [];
    groups[g].push(it);
  });
  return groups;
}

function filterItemsBySearch(items, term) {
  if (!term) return items;
  const t = term.toLowerCase();
  return items.filter((it) => it.name.toLowerCase().includes(t));
}

// ---------- Exercise picker sheet (multi-select, used by routine editor) ----------
function renderExercisePickerSheet(preselectedIds, onDone) {
  window._pickerOnDone = onDone;
  window._pickerItems = getMergedExerciseList();
  window._pickerSelected = new Set(preselectedIds);
  window._pickerSearch = "";
  let html = `
    <h2>Add Exercises</h2>
    <p class="text-dim" style="margin-bottom:12px;">Search ${window._pickerItems.length}+ exercises, or add your own.</p>
    <div class="field">
      <input type="text" id="picker-search" placeholder="Search exercises…" oninput="filterExercisePicker(this.value)" />
    </div>
    <div class="field">
      <input type="text" id="new-exercise-name" placeholder="New exercise name" />
    </div>
    <div class="field">
      <select id="new-exercise-muscle">
        ${MUSCLE_GROUPS.map((m) => `<option value="${m}">${m}</option>`).join("")}
      </select>
    </div>
    <button class="btn btn-secondary" style="margin-bottom:14px;" onclick="createExerciseFromSheet()">+ Add New Exercise</button>
    <div class="picker-list" id="picker-list">${renderPickerListItems()}</div>
    <button class="btn btn-primary" onclick="confirmExercisePicker()">Done</button>`;
  return html;
}

function renderPickerListItems() {
  const items = filterItemsBySearch(window._pickerItems, window._pickerSearch);
  const grouped = groupByMuscle(items);
  const selected = window._pickerSelected;
  let html = "";
  Object.keys(grouped)
    .sort()
    .forEach((group) => {
      html += `<div class="section-title" style="margin-top:12px;">${group}</div>`;
      grouped[group].forEach((it) => {
        const checked = selected.has(it.key) ? "checked" : "";
        html += `
          <label class="picker-item">
            <span class="name">${escapeHtml(it.name)}</span>
            <input type="checkbox" ${checked} onchange="togglePickerExercise('${it.key}', this.checked)" />
          </label>`;
      });
    });
  if (items.length === 0) {
    html = `<p class="text-dim">No matches — add it as a new exercise above.</p>`;
  }
  return html;
}

function filterExercisePicker(term) {
  window._pickerSearch = term;
  document.getElementById("picker-list").innerHTML = renderPickerListItems();
}

function togglePickerExercise(key, checked) {
  if (checked) window._pickerSelected.add(key);
  else window._pickerSelected.delete(key);
}

function createExerciseFromSheet() {
  const nameInput = document.getElementById("new-exercise-name");
  const muscleSelect = document.getElementById("new-exercise-muscle");
  const name = nameInput.value.trim();
  if (!name) {
    toast("Enter an exercise name");
    return;
  }
  const ex = Store.addExercise(name, muscleSelect.value);
  window._pickerItems = getMergedExerciseList();
  window._pickerSelected.add(ex.id);
  nameInput.value = "";
  document.getElementById("picker-list").innerHTML = renderPickerListItems();
  toast(`Added ${ex.name}`);
}

function confirmExercisePicker() {
  const resolvedIds = [];
  window._pickerSelected.forEach((key) => {
    const item = window._pickerItems.find((it) => it.key === key);
    if (!item) return;
    if (item.id) {
      resolvedIds.push(item.id);
    } else {
      const ex = Store.addExercise(item.name, item.muscleGroup);
      resolvedIds.push(ex.id);
    }
  });
  if (window._pickerOnDone) window._pickerOnDone(resolvedIds);
  closeSheet();
}

// ---------- Active workout ----------
function updateWorkoutTimer() {
  const el = document.getElementById("workout-timer");
  if (!el || !Store.state.activeWorkout) return;
  el.textContent = formatDuration(Store.state.activeWorkout.startedAt, Date.now());
}

function renderWorkout() {
  const w = Store.state.activeWorkout;
  let html = `
    <div class="workout-header">
      <div class="title-row">
        <h2>${escapeHtml(w.routineName)}</h2>
        <button class="btn-danger btn-small" onclick="cancelWorkoutConfirm()">Cancel</button>
      </div>
      <div class="workout-timer" id="workout-timer">${formatDuration(w.startedAt, Date.now())}</div>
    </div>
    <div class="view" id="workout-exercise-list">`;

  if (w.exercises.length === 0) {
    html += `
      <div class="empty-state">
        <span class="big-icon">💪</span>
        <p>Add an exercise to get started.</p>
      </div>`;
  } else {
    w.exercises.forEach((ex) => {
      html += renderExerciseBlock(ex);
    });
  }

  html += `<button class="btn btn-secondary" onclick="openExercisePickerForWorkout()">+ Add Exercise</button>`;
  html += `</div>
    <div class="finish-bar">
      <button class="btn btn-primary" onclick="finishWorkoutConfirm()">Finish Workout</button>
    </div>`;
  return html;
}

function renderExerciseBlock(ex) {
  const last = Store.getLastPerformance(ex.exerciseId);
  let lastText = "No previous data";
  if (last) {
    lastText = "Last time: " + last.sets.map((s) => `${s.weight}${unit()}×${s.reps}`).join(", ");
  }

  let rows = `
    <div class="set-table-head">
      <span>Set</span><span>Weight (${unit()})</span><span>Reps</span><span></span>
    </div>`;
  ex.sets.forEach((set, i) => {
    const placeholder = last && last.sets[i] ? last.sets[i] : null;
    rows += `
      <div class="set-row" data-exercise="${ex.exerciseId}" data-index="${i}">
        <span class="set-num">${i + 1}</span>
        <input type="number" inputmode="decimal" placeholder="${placeholder ? placeholder.weight : ""}" value="${set.weight === "" ? "" : set.weight}" oninput="updateSetField('${ex.exerciseId}', ${i}, 'weight', this.value)" />
        <input type="number" inputmode="numeric" placeholder="${placeholder ? placeholder.reps : ""}" value="${set.reps === "" ? "" : set.reps}" oninput="updateSetField('${ex.exerciseId}', ${i}, 'reps', this.value)" />
        <button class="set-remove" onclick="removeSetRow('${ex.exerciseId}', ${i})">✕</button>
      </div>`;
  });

  return `
    <div class="exercise-block">
      <div class="row-between">
        <h3>${escapeHtml(ex.name)}</h3>
        <button class="btn-ghost btn-small" onclick="removeExerciseFromWorkout('${ex.exerciseId}')">Remove</button>
      </div>
      <p class="last-time">${lastText}</p>
      ${rows}
      <button class="add-set-btn" onclick="addSetRow('${ex.exerciseId}')">+ Add Set</button>
    </div>`;
}

function updateSetField(exerciseId, index, field, value) {
  const ex = Store.state.activeWorkout.exercises.find((e) => e.exerciseId === exerciseId);
  if (!ex || !ex.sets[index]) return;
  ex.sets[index][field] = value === "" ? "" : Number(value);
  Store.save();
}

function addSetRow(exerciseId) {
  const ex = Store.state.activeWorkout.exercises.find((e) => e.exerciseId === exerciseId);
  if (!ex) return;
  const last = Store.getLastPerformance(exerciseId);
  const lastSet = last && last.sets[ex.sets.length];
  ex.sets.push({ weight: lastSet ? lastSet.weight : "", reps: lastSet ? lastSet.reps : "" });
  Store.save();
  refreshWorkoutView();
}

function removeSetRow(exerciseId, index) {
  const ex = Store.state.activeWorkout.exercises.find((e) => e.exerciseId === exerciseId);
  if (!ex) return;
  ex.sets.splice(index, 1);
  Store.save();
  refreshWorkoutView();
}

function removeExerciseFromWorkout(exerciseId) {
  Store.removeExerciseFromActiveWorkout(exerciseId);
  refreshWorkoutView();
}

function refreshWorkoutView() {
  document.getElementById("view-root").innerHTML = renderWorkout();
}

function openExercisePickerForWorkout() {
  window._pickerItems = getMergedExerciseList();
  window._pickerSearch = "";
  let html = `
    <h2>Add Exercise</h2>
    <p class="text-dim" style="margin-bottom:12px;">Search ${window._pickerItems.length}+ exercises — tap to add to this workout.</p>
    <div class="field">
      <input type="text" id="picker-search" placeholder="Search exercises…" oninput="filterWorkoutPicker(this.value)" />
    </div>
    <div class="field">
      <input type="text" id="new-exercise-name" placeholder="New exercise name" />
    </div>
    <div class="field">
      <select id="new-exercise-muscle">
        ${MUSCLE_GROUPS.map((m) => `<option value="${m}">${m}</option>`).join("")}
      </select>
    </div>
    <button class="btn btn-secondary" style="margin-bottom:14px;" onclick="createExerciseForWorkout()">+ Add New Exercise</button>
    <div class="picker-list" id="picker-list">${renderWorkoutPickerItems()}</div>`;
  openSheet(html);
}

function renderWorkoutPickerItems() {
  const items = filterItemsBySearch(window._pickerItems, window._pickerSearch);
  const grouped = groupByMuscle(items);
  const currentIds = new Set(Store.state.activeWorkout.exercises.map((e) => e.exerciseId));
  let html = "";
  Object.keys(grouped)
    .sort()
    .forEach((group) => {
      html += `<div class="section-title" style="margin-top:12px;">${group}</div>`;
      grouped[group].forEach((it) => {
        const already = it.id && currentIds.has(it.id);
        html += `
          <div class="picker-item card-tap" style="${already ? "opacity:0.4;" : ""}" onclick="${already ? "" : `addPickedExerciseToWorkout('${it.key}')`}">
            <span class="name">${escapeHtml(it.name)}</span>
            <span class="muscle">${already ? "Added" : "+"}</span>
          </div>`;
      });
    });
  if (items.length === 0) html = `<p class="text-dim">No matches — add it as a new exercise above.</p>`;
  return html;
}

function filterWorkoutPicker(term) {
  window._pickerSearch = term;
  document.getElementById("picker-list").innerHTML = renderWorkoutPickerItems();
}

function addPickedExerciseToWorkout(key) {
  const item = window._pickerItems.find((it) => it.key === key);
  if (!item) return;
  const ex = item.id ? Store.getExercise(item.id) : Store.addExercise(item.name, item.muscleGroup);
  Store.addExerciseToActiveWorkout(ex);
  closeSheet();
  refreshWorkoutView();
}

function createExerciseForWorkout() {
  const nameInput = document.getElementById("new-exercise-name");
  const muscleSelect = document.getElementById("new-exercise-muscle");
  const name = nameInput.value.trim();
  if (!name) {
    toast("Enter an exercise name");
    return;
  }
  const ex = Store.addExercise(name, muscleSelect.value);
  Store.addExerciseToActiveWorkout(ex);
  closeSheet();
  refreshWorkoutView();
  toast(`Added ${ex.name}`);
}

function cancelWorkoutConfirm() {
  if (!confirm("Discard this workout? Nothing will be saved.")) return;
  Store.cancelWorkout();
  navigate("#/home");
}

function finishWorkoutConfirm() {
  const w = Store.state.activeWorkout;
  const hasSets = w.exercises.some((e) => e.sets.some((s) => s.reps !== "" && s.reps !== undefined && s.reps !== null));
  if (!hasSets) {
    if (!confirm("No sets logged yet. Finish anyway?")) return;
  }
  Store.finishWorkout();
  toast("Workout saved 💪");
  navigate("#/history");
}

// ---------- History ----------
function renderHistory() {
  const workouts = Store.state.workouts;
  let html = `<div class="topbar"><h1>History</h1></div><div class="view">`;
  if (workouts.length === 0) {
    html += `
      <div class="empty-state">
        <span class="big-icon">📈</span>
        <p>Finish a workout and it'll show up here.</p>
      </div>`;
  } else {
    workouts.forEach((w) => {
      const totalSets = w.exercises.reduce((sum, e) => sum + e.sets.length, 0);
      html += `
        <div class="card history-item card-tap" onclick="navigate('#/workout-detail/${w.id}')">
          <div style="flex:1">
            <div class="date">${formatDate(w.finishedAt)}</div>
            <h3>${escapeHtml(w.routineName)}</h3>
            <div class="summary">${w.exercises.length} exercise${w.exercises.length === 1 ? "" : "s"} · ${totalSets} set${totalSets === 1 ? "" : "s"} · ${formatDuration(w.startedAt, w.finishedAt)}</div>
          </div>
          <span style="color:var(--text-faint);font-size:20px;">›</span>
        </div>`;
    });
  }
  html += `</div>`;
  return html;
}

function renderWorkoutDetail(id) {
  const w = Store.state.workouts.find((w) => w.id === id);
  if (!w) {
    navigate("#/history");
    return "";
  }
  let html = `
    <div class="topbar"><button class="back" onclick="navigate('#/history')">‹ Back</button></div>
    <div class="view">
      <div class="date">${formatDate(w.finishedAt)}</div>
      <h1 style="margin-bottom:4px;">${escapeHtml(w.routineName)}</h1>
      <p class="text-dim" style="margin-bottom:18px;">${formatDuration(w.startedAt, w.finishedAt)}</p>`;

  w.exercises.forEach((ex) => {
    html += `
      <div class="card">
        <h3 class="card-tap" style="font-size:16px;font-weight:700;margin-bottom:6px;" onclick="navigate('#/exercise/${ex.exerciseId}')">${escapeHtml(ex.name)}</h3>
        <div class="detail-set-list">
          ${ex.sets.map((s, i) => `<div>Set ${i + 1}: ${s.weight}${unit()} × ${s.reps}</div>`).join("")}
        </div>
      </div>`;
  });

  html += `
      <div style="margin-top:16px;text-align:center;">
        <button class="btn-danger" onclick="deleteWorkoutConfirm('${w.id}')">Delete Workout</button>
      </div>
    </div>`;
  return html;
}

function deleteWorkoutConfirm(id) {
  if (!confirm("Delete this workout from history?")) return;
  Store.deleteWorkout(id);
  navigate("#/history");
}

// ---------- Exercise progress ----------
function renderExerciseDetail(id) {
  const ex = Store.getExercise(id);
  if (!ex) {
    navigate("#/history");
    return "";
  }
  const history = Store.getExerciseHistory(id); // newest first
  const best = Store.getBestSet(id);

  let html = `
    <div class="topbar"><button class="back" onclick="history.back()">‹ Back</button></div>
    <div class="view">
      <h1 style="margin-bottom:2px;">${escapeHtml(ex.name)}</h1>
      <p class="text-dim" style="margin-bottom:18px;">${escapeHtml(ex.muscleGroup)}</p>
      <div class="pr-row">
        <div class="stat"><span class="num">${best ? best.weight : "–"}</span><span class="label">Best Weight (${unit()})</span></div>
        <div class="stat"><span class="num">${history.length}</span><span class="label">Sessions</span></div>
      </div>`;

  if (history.length >= 2) {
    html += renderProgressChart(history);
  }

  html += `<div class="section-title">History</div>`;
  if (history.length === 0) {
    html += `<p class="text-dim">No sessions logged for this exercise yet.</p>`;
  } else {
    history.forEach((h) => {
      html += `
        <div class="card">
          <div class="date">${formatDate(h.date)}</div>
          <div class="detail-set-list">
            ${h.sets.map((s, i) => `<div>Set ${i + 1}: ${s.weight}${unit()} × ${s.reps}</div>`).join("")}
          </div>
        </div>`;
    });
  }
  html += `</div>`;
  return html;
}

function renderProgressChart(history) {
  // history is newest-first; chart reads oldest-first, left to right
  const points = [...history].reverse().map((h) => ({
    date: h.date,
    maxWeight: Math.max(...h.sets.map((s) => Number(s.weight) || 0)),
  }));

  const w = 500;
  const h = 160;
  const padL = 36, padR = 12, padT = 16, padB = 26;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const maxVal = Math.max(...points.map((p) => p.maxWeight), 1);
  const minVal = Math.min(...points.map((p) => p.maxWeight), 0);
  const range = maxVal - minVal || 1;

  const x = (i) => padL + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (v) => padT + plotH - ((v - minVal) / range) * plotH;

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p.maxWeight).toFixed(1)}`).join(" ");

  const gridLines = [0, 0.5, 1].map((f) => {
    const gy = padT + plotH * f;
    const val = Math.round(maxVal - f * range);
    return `<line x1="${padL}" y1="${gy}" x2="${w - padR}" y2="${gy}" stroke="#2a2f36" stroke-width="1" />
            <text x="${padL - 6}" y="${gy + 4}" font-size="10" fill="#666d77" text-anchor="end">${val}</text>`;
  }).join("");

  const dots = points.map((p, i) => `
      <circle cx="${x(i).toFixed(1)}" cy="${y(p.maxWeight).toFixed(1)}" r="4" fill="#ff5722" stroke="#0d0f12" stroke-width="2">
        <title>${formatDateShort(p.date)}: ${p.maxWeight}${unit()}</title>
      </circle>`).join("");

  const firstLabel = points.length ? formatDateShort(points[0].date) : "";
  const lastLabel = points.length ? formatDateShort(points[points.length - 1].date) : "";

  return `
    <div class="chart-wrap">
      <svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" role="img" aria-label="Top weight per session over time">
        ${gridLines}
        <path d="${linePath}" fill="none" stroke="#ff5722" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        ${dots}
        <text x="${padL}" y="${h - 4}" font-size="10" fill="#666d77">${firstLabel}</text>
        <text x="${w - padR}" y="${h - 4}" font-size="10" fill="#666d77" text-anchor="end">${lastLabel}</text>
      </svg>
    </div>`;
}

// ---------- Settings ----------
function renderSettings() {
  const u = unit();
  return `
    <div class="topbar"><h1>Settings</h1></div>
    <div class="view">
      <div class="section-title">Units</div>
      <div class="card">
        <div class="row-between">
          <span>Weight unit</span>
          <div>
            <button class="btn btn-small ${u === "lbs" ? "btn-primary" : "btn-secondary"}" style="width:auto;display:inline-flex;" onclick="setUnit('lbs')">lbs</button>
            <button class="btn btn-small ${u === "kg" ? "btn-primary" : "btn-secondary"}" style="width:auto;display:inline-flex;" onclick="setUnit('kg')">kg</button>
          </div>
        </div>
      </div>

      <div class="section-title">Import</div>
      <p class="text-dim" style="margin-bottom:12px;">Bring in your history from the Strong app: export your data there as CSV (Settings → Export Data), then import it here. Safe to run more than once — it won't create duplicates.</p>
      <button class="btn btn-secondary" style="margin-bottom:10px;" onclick="document.getElementById('import-strong-file-input').click()">💪 Import from Strong (CSV)</button>

      <div class="section-title">Your Data</div>
      <p class="text-dim" style="margin-bottom:12px;">Everything is stored only on this device. Export a backup before clearing your browser data or switching phones.</p>
      <button class="btn btn-secondary" style="margin-bottom:10px;" onclick="exportData()">⬇ Export Backup (JSON)</button>
      <button class="btn btn-secondary" style="margin-bottom:10px;" onclick="document.getElementById('import-file-input').click()">⬆ Import Backup</button>
      <button class="btn btn-danger" onclick="clearAllDataConfirm()">Delete All Data</button>

      <div class="section-title">Exercise Library</div>
      <p class="text-dim">${Store.state.exercises.length} exercises created</p>
    </div>`;
}

function setUnit(u) {
  Store.setUnit(u);
  render();
  toast(`Units set to ${u}`);
}

function exportData() {
  const data = Store.exportData();
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `ironlog-backup-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast("Backup downloaded");
}

document.getElementById("import-file-input").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      if (!confirm("Importing will replace all current data. Continue?")) return;
      Store.importData(reader.result);
      toast("Data imported");
      navigate("#/home");
      render();
    } catch (err) {
      alert("That file doesn't look like a valid IronLog backup.");
    }
  };
  reader.readAsText(file);
  e.target.value = "";
});

document.getElementById("import-strong-file-input").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const result = importStrongData(reader.result);
      const parts = [`${result.workoutsImported} workout${result.workoutsImported === 1 ? "" : "s"}`];
      if (result.workoutsSkipped) parts.push(`${result.workoutsSkipped} already imported (skipped)`);
      parts.push(`${result.routinesCreated} routine${result.routinesCreated === 1 ? "" : "s"}`);
      parts.push(`${result.exercisesCreated} new exercise${result.exercisesCreated === 1 ? "" : "s"}`);
      alert(`Import complete: ${parts.join(", ")}.`);
      navigate("#/history");
      render();
    } catch (err) {
      console.error(err);
      alert("Couldn't read that file. Make sure it's a Strong CSV export (Settings → Export Data in the Strong app).");
    }
  };
  reader.readAsText(file);
  e.target.value = "";
});

function clearAllDataConfirm() {
  if (!confirm("This permanently deletes all routines, exercises, and workout history on this device. This cannot be undone. Continue?")) return;
  localStorage.removeItem("ironlog.v1");
  Store.state = { exercises: [], routines: [], workouts: [], activeWorkout: null, settings: { unit: "lbs" } };
  toast("All data cleared");
  navigate("#/home");
  render();
}

// ---------- Bottom nav wiring ----------
document.querySelectorAll(".nav-item").forEach((btn) => {
  btn.addEventListener("click", () => navigate("#/" + btn.dataset.route));
});

// ---------- Service worker ----------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((err) => console.error("SW registration failed", err));
  });
}

// ---------- Init ----------
render();
