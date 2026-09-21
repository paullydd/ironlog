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

function formatTimeOfDay(ts) {
  return new Date(ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function getTodaysCompletedWorkoutForRoutine(routineId) {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfDay = startOfDay + 86400000;
  return (
    Store.state.workouts.find((w) => w.routineId === routineId && w.finishedAt >= startOfDay && w.finishedAt < endOfDay) || null
  );
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
  if (name !== "workout") stopRestTimerSilently();
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
    case "progress":
      root.innerHTML = renderProgress();
      break;
    case "schedule":
      root.innerHTML = renderSchedule();
      break;
    case "settings":
      root.innerHTML = renderSettings();
      break;
    default:
      root.innerHTML = renderHome();
  }
  root.classList.remove("view-fade");
  void root.offsetWidth;
  root.classList.add("view-fade");
  window.scrollTo(0, 0);
}

window.addEventListener("hashchange", render);

// ---------- Sheet (bottom modal) ----------
function openSheet(html) {
  document.getElementById("sheet-content").innerHTML = html;
  const backdrop = document.getElementById("sheet-backdrop");
  backdrop.classList.remove("hidden");
  void backdrop.offsetWidth;
  backdrop.classList.add("open");
}

function closeSheet() {
  const backdrop = document.getElementById("sheet-backdrop");
  backdrop.classList.remove("open");
  setTimeout(() => {
    backdrop.classList.add("hidden");
    document.getElementById("sheet-content").innerHTML = "";
  }, 200);
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
  const totalMs = workouts.reduce((sum, w) => sum + Math.max(0, w.finishedAt - w.startedAt), 0);
  const totalHours = Math.round(totalMs / 3600000);

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

  html += renderTodayCard();

  html += `
    <div class="stat-row">
      <div class="stat"><span class="num">${totalWorkouts}</span><span class="label">Workouts</span></div>
      <div class="stat"><span class="num">${thisWeek}</span><span class="label">This Week</span></div>
      <div class="stat"><span class="num">${totalHours}h</span><span class="label">Time Logged</span></div>
    </div>`;

  if (routines.length === 0) {
    html += `<div class="section-title">Your Routines</div>`;
    html += `
      <div class="empty-state">
        <span class="big-icon">🏋️</span>
        <p>No routines yet. Create one to start tracking your split.</p>
      </div>
      <button class="btn btn-primary" onclick="navigate('#/routine-edit/new')">+ Create a Routine</button>`;
  } else {
    const grouped = groupRoutinesByCategory(routines);
    Object.keys(grouped)
      .sort(categorySortOrder)
      .forEach((cat) => {
        html += `<div class="section-title">${escapeHtml(cat)}</div>`;
        grouped[cat].forEach((r) => {
          html += `
            <div class="card routine-card">
              <div class="info card-tap" style="flex:1" onclick="navigate('#/routine-edit/${r.id}')">
                <h3>${escapeHtml(r.name)}</h3>
                <p>${r.exerciseIds.length} exercise${r.exerciseIds.length === 1 ? "" : "s"}</p>
              </div>
              <button class="btn btn-primary btn-small" style="width:auto;flex-shrink:0;" onclick="startWorkoutFromRoutine('${r.id}')">Start</button>
            </div>`;
        });
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
function groupRoutinesByCategory(routines) {
  const groups = {};
  routines.forEach((r) => {
    const cat = r.category || "General";
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(r);
  });
  return groups;
}

function categorySortOrder(a, b) {
  if (a === "General") return 1;
  if (b === "General") return -1;
  return a.localeCompare(b);
}

let routinesFilter = "All";

function renderRoutines() {
  const routines = Store.state.routines;
  const categories = Store.getRoutineCategories();
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
    html += `</div>`;
    return html;
  }

  if (categories.length > 1) {
    if (!categories.includes(routinesFilter)) routinesFilter = "All";
    html += `<div class="chip-row" id="routine-filter-chips">${renderCategoryChips(categories)}</div>`;
  } else {
    routinesFilter = "All";
  }

  html += `<div id="routines-list">${renderRoutinesList(routines)}</div>`;
  html += `</div>`;
  return html;
}

function renderCategoryChips(categories) {
  const all = ["All", ...categories];
  return all
    .map((cat) => {
      const active = routinesFilter === cat ? "chip-active" : "";
      return `<button class="chip ${active}" onclick="setRoutinesFilter('${escapeHtml(cat).replace(/'/g, "\\'")}')">${escapeHtml(cat)}</button>`;
    })
    .join("");
}

function setRoutinesFilter(cat) {
  routinesFilter = cat;
  document.getElementById("routine-filter-chips").innerHTML = renderCategoryChips(Store.getRoutineCategories());
  document.getElementById("routines-list").innerHTML = renderRoutinesList(Store.state.routines);
}

function renderRoutinesList(routines) {
  const filtered = routinesFilter === "All" ? routines : routines.filter((r) => (r.category || "General") === routinesFilter);
  const grouped = groupRoutinesByCategory(filtered);
  let html = "";
  Object.keys(grouped)
    .sort(categorySortOrder)
    .forEach((cat) => {
      if (routinesFilter === "All") html += `<div class="section-title">${escapeHtml(cat)}</div>`;
      grouped[cat].forEach((r) => {
        html += `
          <div class="card routine-card card-tap" onclick="navigate('#/routine-edit/${r.id}')">
            <div class="info">
              <h3>${escapeHtml(r.name)}</h3>
              <p>${r.exerciseIds.length} exercise${r.exerciseIds.length === 1 ? "" : "s"}</p>
            </div>
            <span style="color:var(--text-faint);font-size:20px;">›</span>
          </div>`;
      });
    });
  return html;
}

// ---------- Routine editor ----------
// Groups an ordered exercise-id list into display "blocks" using a list of
// superset groups (each an array of 2+ ids that must be contiguous in the
// order). A block is {type:"single"|"superset", ids:[...]}. Reordering and
// removal always operate on whole blocks so a group can never silently pick
// up or lose a member just because list order changed elsewhere.
function computeBlocks(orderedIds, groups) {
  const blocks = [];
  const consumed = new Set();
  orderedIds.forEach((id) => {
    if (consumed.has(id)) return;
    const group = (groups || []).find((g) => g.includes(id));
    const orderedGroupIds = group ? orderedIds.filter((gid) => group.includes(gid)) : null;
    if (orderedGroupIds && orderedGroupIds.length >= 2) {
      orderedGroupIds.forEach((gid) => consumed.add(gid));
      blocks.push({ type: "superset", ids: orderedGroupIds });
    } else {
      consumed.add(id);
      blocks.push({ type: "single", ids: [id] });
    }
  });
  return blocks;
}

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
    category: routine ? routine.category || "General" : "",
    exerciseIds: routine ? [...routine.exerciseIds] : [],
    supersets: routine && routine.supersets ? routine.supersets.map((g) => [...g]) : [],
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
      <div class="field">
        <label>Category</label>
        <input type="text" id="routine-category-input" list="routine-category-options" placeholder="e.g. Shred, Bulk" value="${escapeHtml(s.category)}" />
        <datalist id="routine-category-options">
          ${Store.getRoutineCategories()
            .concat(["Shred", "Bulk", "General"])
            .filter((c, i, arr) => arr.indexOf(c) === i)
            .map((c) => `<option value="${escapeHtml(c)}"></option>`)
            .join("")}
        </datalist>
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
  const blocks = computeBlocks(s.exerciseIds, s.supersets);
  return blocks
    .map((block, i) => {
      const isSuperset = block.type === "superset";
      let html = `<div class="${isSuperset ? "superset-block" : ""}">`;
      if (isSuperset) html += `<div class="superset-label">🔗 Superset</div>`;
      block.ids.forEach((exId) => {
        const ex = Store.getExercise(exId);
        if (!ex) return;
        html += `
          <div class="routine-exercise-row">
            <span>${getExerciseIcon(ex.name, ex.muscleGroup)} ${escapeHtml(ex.name)}</span>
            <button class="btn-icon" style="width:32px;height:32px;font-size:14px;" onclick="removeExerciseFromRoutineBlock('${exId}')">✕</button>
          </div>`;
      });
      html += `
        <div class="block-controls">
          <button class="reorder-btn btn-icon" ${i === 0 ? "disabled" : ""} onclick="moveRoutineBlock(${i}, -1)">▲</button>
          <button class="reorder-btn btn-icon" ${i === blocks.length - 1 ? "disabled" : ""} onclick="moveRoutineBlock(${i}, 1)">▼</button>
          ${isSuperset ? `<button class="btn-ghost btn-small" onclick="unlinkRoutineBlock(${i})">Unlink</button>` : ""}
          ${!isSuperset && i < blocks.length - 1 ? `<button class="btn-ghost btn-small" onclick="mergeRoutineBlocks(${i})">🔗 Link with next</button>` : ""}
        </div>`;
      html += `</div>`;
      return html;
    })
    .join("");
}

function refreshRoutineExerciseList() {
  document.getElementById("routine-exercise-list").innerHTML = renderRoutineExerciseRows();
}

function moveRoutineBlock(blockIndex, direction) {
  const s = routineEditState;
  const blocks = computeBlocks(s.exerciseIds, s.supersets);
  const newIndex = blockIndex + direction;
  if (newIndex < 0 || newIndex >= blocks.length) return;
  [blocks[blockIndex], blocks[newIndex]] = [blocks[newIndex], blocks[blockIndex]];
  s.exerciseIds = blocks.flatMap((b) => b.ids);
  refreshRoutineExerciseList();
}

function mergeRoutineBlocks(blockIndex) {
  const s = routineEditState;
  const blocks = computeBlocks(s.exerciseIds, s.supersets);
  if (blockIndex < 0 || blockIndex >= blocks.length - 1) return;
  const merged = [...blocks[blockIndex].ids, ...blocks[blockIndex + 1].ids];
  const rest = blocks.filter((b, i) => i !== blockIndex && i !== blockIndex + 1 && b.type === "superset").map((b) => b.ids);
  s.supersets = [...rest, merged];
  refreshRoutineExerciseList();
}

function unlinkRoutineBlock(blockIndex) {
  const s = routineEditState;
  const blocks = computeBlocks(s.exerciseIds, s.supersets);
  s.supersets = blocks.filter((b, i) => i !== blockIndex && b.type === "superset").map((b) => b.ids);
  refreshRoutineExerciseList();
}

function removeExerciseFromRoutineBlock(exId) {
  const s = routineEditState;
  s.exerciseIds = s.exerciseIds.filter((id) => id !== exId);
  s.supersets = s.supersets.map((g) => g.filter((id) => id !== exId)).filter((g) => g.length >= 2);
  refreshRoutineExerciseList();
}

function saveRoutine() {
  const nameInput = document.getElementById("routine-name-input");
  const name = nameInput.value.trim();
  if (!name) {
    toast("Give the routine a name");
    nameInput.focus();
    return;
  }
  const categoryInput = document.getElementById("routine-category-input");
  const category = categoryInput.value.trim() || "General";
  const s = routineEditState;
  if (s.id) {
    Store.updateRoutine(s.id, { name, category, exerciseIds: s.exerciseIds, supersets: s.supersets });
  } else {
    Store.addRoutine(name, s.exerciseIds, category, s.supersets);
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
            <span class="name">${getExerciseIcon(it.name, it.muscleGroup)} ${escapeHtml(it.name)}</span>
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

// ---------- Rest timer ----------
const restTimer = { endAt: null, interval: null, duration: 90 };

function startRestTimer(seconds) {
  clearInterval(restTimer.interval);
  restTimer.endAt = Date.now() + (seconds || restTimer.duration) * 1000;
  renderRestBar();
  restTimer.interval = setInterval(updateRestBar, 250);
}

function adjustRestTimer(deltaSeconds) {
  if (!restTimer.endAt) return;
  restTimer.endAt = Math.max(Date.now(), restTimer.endAt + deltaSeconds * 1000);
  updateRestBar();
}

function skipRestTimer() {
  clearInterval(restTimer.interval);
  restTimer.interval = null;
  restTimer.endAt = null;
  const bar = document.getElementById("rest-bar");
  if (bar) bar.remove();
}

function stopRestTimerSilently() {
  clearInterval(restTimer.interval);
  restTimer.interval = null;
  restTimer.endAt = null;
  const bar = document.getElementById("rest-bar");
  if (bar) bar.remove();
}

function formatRestTime(totalSeconds) {
  const s = Math.max(0, totalSeconds);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function renderRestBar() {
  let bar = document.getElementById("rest-bar");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "rest-bar";
    bar.className = "rest-bar";
    document.body.appendChild(bar);
  }
  const remaining = Math.round((restTimer.endAt - Date.now()) / 1000);
  bar.innerHTML = `
    <span class="rest-label">😤 Rest <span id="rest-time-label">${formatRestTime(remaining)}</span></span>
    <div class="rest-controls">
      <button class="rest-btn" onclick="adjustRestTimer(-15)">−15s</button>
      <button class="rest-btn" onclick="adjustRestTimer(15)">+15s</button>
      <button class="rest-btn rest-skip" onclick="skipRestTimer()">Skip</button>
    </div>`;
}

function updateRestBar() {
  if (!restTimer.endAt) return;
  const remaining = Math.round((restTimer.endAt - Date.now()) / 1000);
  if (remaining <= 0) {
    clearInterval(restTimer.interval);
    restTimer.interval = null;
    restTimer.endAt = null;
    playRestEndSound();
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    const bar = document.getElementById("rest-bar");
    if (bar) bar.remove();
    return;
  }
  const label = document.getElementById("rest-time-label");
  if (label) label.textContent = formatRestTime(remaining);
}

function playRestEndSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch (e) {
    // Audio unavailable — the visual bar and vibration still cover it.
  }
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
    const blocks = computeBlocks(w.exercises.map((e) => e.exerciseId), w.supersets);
    blocks.forEach((block, i) => {
      if (block.type === "superset") {
        html += `<div class="superset-block">`;
        html += `<div class="superset-label">🔗 Superset — alternate sets, rest after the last one</div>`;
        block.ids.forEach((exId) => {
          const ex = w.exercises.find((e) => e.exerciseId === exId);
          if (ex) html += renderExerciseBlock(ex);
        });
        html += `<button class="btn-ghost btn-small" onclick="unlinkWorkoutBlock(${i})">Unlink Superset</button>`;
        html += `</div>`;
      } else {
        const ex = w.exercises.find((e) => e.exerciseId === block.ids[0]);
        if (ex) html += renderExerciseBlock(ex);
      }
      if (i < blocks.length - 1) {
        html += `<button class="link-next-btn" onclick="mergeWorkoutBlocks(${i})">🔗 Link with next as superset</button>`;
      }
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
  const bestBefore = Store.getBestSet(ex.exerciseId);
  const bestWeight = bestBefore ? bestBefore.weight : 0;

  let rows = `
    <div class="set-table-head">
      <span>Set</span><span>Weight (${unit()})</span><span>Reps</span><span></span>
    </div>`;
  ex.sets.forEach((set, i) => {
    const placeholder = last && last.sets[i] ? last.sets[i] : null;
    const isPR = set.done && Number(set.weight) > 0 && Number(set.weight) > bestWeight;
    const rowClasses = ["set-row"];
    if (set.done) rowClasses.push("set-row-done");
    if (isPR) rowClasses.push("set-row-pr");
    rows += `
      <div class="${rowClasses.join(" ")}" data-exercise="${ex.exerciseId}" data-index="${i}">
        <button class="set-num" onclick="toggleSetDone('${ex.exerciseId}', ${i})">${set.done ? "✓" : i + 1}</button>
        <div class="stepper-group">
          <button class="stepper-btn" onclick="adjustSetField('${ex.exerciseId}', ${i}, 'weight', -5)">−</button>
          <input class="weight-input" type="number" inputmode="decimal" placeholder="${placeholder ? placeholder.weight : ""}" value="${set.weight === "" ? "" : set.weight}" oninput="updateSetField('${ex.exerciseId}', ${i}, 'weight', this.value)" />
          <button class="stepper-btn" onclick="adjustSetField('${ex.exerciseId}', ${i}, 'weight', 5)">+</button>
        </div>
        <div class="stepper-group">
          <button class="stepper-btn" onclick="adjustSetField('${ex.exerciseId}', ${i}, 'reps', -1)">−</button>
          <input class="reps-input" type="number" inputmode="numeric" placeholder="${placeholder ? placeholder.reps : ""}" value="${set.reps === "" ? "" : set.reps}" oninput="updateSetField('${ex.exerciseId}', ${i}, 'reps', this.value)" />
          <button class="stepper-btn" onclick="adjustSetField('${ex.exerciseId}', ${i}, 'reps', 1)">+</button>
        </div>
        <button class="set-remove" onclick="removeSetRow('${ex.exerciseId}', ${i})">✕</button>
      </div>
      ${isPR ? `<div class="pr-tag">🏆 New PR</div>` : ""}`;
  });

  const exMeta = Store.getExercise(ex.exerciseId);
  const addLabel = getAddSetLabel(ex, last);
  return `
    <div class="exercise-block">
      <div class="row-between">
        <h3>${getExerciseIcon(ex.name, exMeta && exMeta.muscleGroup)} ${escapeHtml(ex.name)}</h3>
        <div style="display:flex;gap:6px;flex-shrink:0;">
          <button class="btn-ghost btn-small" onclick="openPlateCalculatorForExercise('${ex.exerciseId}')">🧮</button>
          <button class="btn-ghost btn-small" onclick="removeExerciseFromWorkout('${ex.exerciseId}')">Remove</button>
        </div>
      </div>
      <p class="last-time">${lastText}</p>
      ${rows}
      <button class="add-set-btn" onclick="addSetRow('${ex.exerciseId}')">${addLabel}</button>
    </div>`;
}

function getAddSetLabel(ex, last) {
  if (ex.sets.length > 0) {
    const prev = ex.sets[ex.sets.length - 1];
    if (prev.weight !== "" && prev.reps !== "") return `🔁 Repeat Last Set (${prev.weight}${unit()}×${prev.reps})`;
    return "+ Add Set";
  }
  const lastSet = last && last.sets[0];
  if (lastSet) return `+ Add Set (${lastSet.weight}${unit()}×${lastSet.reps})`;
  return "+ Add Set";
}

function updateSetField(exerciseId, index, field, value) {
  const ex = Store.state.activeWorkout.exercises.find((e) => e.exerciseId === exerciseId);
  if (!ex || !ex.sets[index]) return;
  ex.sets[index][field] = value === "" ? "" : Number(value);
  Store.save();
}

function adjustSetField(exerciseId, index, field, delta) {
  const ex = Store.state.activeWorkout.exercises.find((e) => e.exerciseId === exerciseId);
  if (!ex || !ex.sets[index]) return;
  const current = Number(ex.sets[index][field]) || 0;
  const next = Math.max(0, current + delta);
  ex.sets[index][field] = next;
  Store.save();
  const row = document.querySelector(`.set-row[data-exercise="${exerciseId}"][data-index="${index}"]`);
  const input = row && row.querySelector(field === "weight" ? ".weight-input" : ".reps-input");
  if (input) input.value = next;
}

function toggleSetDone(exerciseId, index) {
  const ex = Store.state.activeWorkout.exercises.find((e) => e.exerciseId === exerciseId);
  if (!ex || !ex.sets[index]) return;
  const set = ex.sets[index];
  if (!set.done) {
    if (set.reps === "" || set.reps === undefined || set.reps === null || Number(set.reps) <= 0) {
      toast("Add reps before marking this set done");
      return;
    }
    set.done = true;
    Store.save();
    const best = Store.getBestSet(exerciseId);
    const weight = Number(set.weight) || 0;
    const isPR = weight > 0 && (!best || weight > best.weight);
    if (isLastInSupersetGroup(exerciseId)) {
      startRestTimer();
    }
    if (isPR) {
      toast(`🏆 New PR! ${weight}${unit()} × ${set.reps}`);
    } else if (!isLastInSupersetGroup(exerciseId)) {
      const partnerName = getNextSupersetPartnerName(exerciseId);
      if (partnerName) toast(`💪 Next: ${partnerName}`);
    }
  } else {
    set.done = false;
    Store.save();
  }
  refreshWorkoutView();
}

function isLastInSupersetGroup(exerciseId) {
  const w = Store.state.activeWorkout;
  const group = w.supersets && w.supersets.find((g) => g.includes(exerciseId));
  if (!group) return true;
  const orderedIds = w.exercises.map((e) => e.exerciseId).filter((id) => group.includes(id));
  return orderedIds[orderedIds.length - 1] === exerciseId;
}

function getNextSupersetPartnerName(exerciseId) {
  const w = Store.state.activeWorkout;
  const group = w.supersets && w.supersets.find((g) => g.includes(exerciseId));
  if (!group) return null;
  const orderedIds = w.exercises.map((e) => e.exerciseId).filter((id) => group.includes(id));
  const idx = orderedIds.indexOf(exerciseId);
  if (idx === -1 || idx === orderedIds.length - 1) return null;
  const nextEx = w.exercises.find((e) => e.exerciseId === orderedIds[idx + 1]);
  return nextEx ? nextEx.name : null;
}

function mergeWorkoutBlocks(blockIndex) {
  const w = Store.state.activeWorkout;
  const blocks = computeBlocks(w.exercises.map((e) => e.exerciseId), w.supersets);
  if (blockIndex < 0 || blockIndex >= blocks.length - 1) return;
  const merged = [...blocks[blockIndex].ids, ...blocks[blockIndex + 1].ids];
  const rest = blocks.filter((b, i) => i !== blockIndex && i !== blockIndex + 1 && b.type === "superset").map((b) => b.ids);
  w.supersets = [...rest, merged];
  Store.save();
  refreshWorkoutView();
}

function unlinkWorkoutBlock(blockIndex) {
  const w = Store.state.activeWorkout;
  const blocks = computeBlocks(w.exercises.map((e) => e.exerciseId), w.supersets);
  w.supersets = blocks.filter((b, i) => i !== blockIndex && b.type === "superset").map((b) => b.ids);
  Store.save();
  refreshWorkoutView();
}

function addSetRow(exerciseId) {
  const ex = Store.state.activeWorkout.exercises.find((e) => e.exerciseId === exerciseId);
  if (!ex) return;
  if (ex.sets.length > 0) {
    const prev = ex.sets[ex.sets.length - 1];
    ex.sets.push({ weight: prev.weight, reps: prev.reps });
  } else {
    const last = Store.getLastPerformance(exerciseId);
    const lastSet = last && last.sets[0];
    ex.sets.push({ weight: lastSet ? lastSet.weight : "", reps: lastSet ? lastSet.reps : "" });
  }
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
            <span class="name">${getExerciseIcon(it.name, it.muscleGroup)} ${escapeHtml(it.name)}</span>
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
      <p class="text-dim" style="margin-bottom:4px;">${formatDuration(w.startedAt, w.finishedAt)}</p>
      <p class="text-dim" style="margin-bottom:18px;font-size:12px;">Tap +/− to fix a set — changes save automatically.</p>`;

  w.exercises.forEach((ex) => {
    const exMeta = Store.getExercise(ex.exerciseId);
    html += `
      <div class="card">
        <h3 class="card-tap" style="font-size:16px;font-weight:700;margin-bottom:6px;" onclick="navigate('#/exercise/${ex.exerciseId}')">${getExerciseIcon(ex.name, exMeta && exMeta.muscleGroup)} ${escapeHtml(ex.name)}</h3>
        ${ex.sets
          .map(
            (s, i) => `
          <div class="set-row" data-w="${w.id}" data-ex="${ex.exerciseId}" data-index="${i}">
            <span class="set-num">${i + 1}</span>
            <div class="stepper-group">
              <button class="stepper-btn" onclick="adjustHistorySetField('${w.id}','${ex.exerciseId}',${i},'weight',-5)">−</button>
              <input class="weight-input" type="number" inputmode="decimal" value="${s.weight}" oninput="updateHistorySetField('${w.id}','${ex.exerciseId}',${i},'weight',this.value)" />
              <button class="stepper-btn" onclick="adjustHistorySetField('${w.id}','${ex.exerciseId}',${i},'weight',5)">+</button>
            </div>
            <div class="stepper-group">
              <button class="stepper-btn" onclick="adjustHistorySetField('${w.id}','${ex.exerciseId}',${i},'reps',-1)">−</button>
              <input class="reps-input" type="number" inputmode="numeric" value="${s.reps}" oninput="updateHistorySetField('${w.id}','${ex.exerciseId}',${i},'reps',this.value)" />
              <button class="stepper-btn" onclick="adjustHistorySetField('${w.id}','${ex.exerciseId}',${i},'reps',1)">+</button>
            </div>
            <button class="set-remove" onclick="removeHistorySetRow('${w.id}','${ex.exerciseId}',${i})">✕</button>
          </div>
          ${s.pr ? `<div class="pr-tag">🏆 PR</div>` : ""}`
          )
          .join("")}
        <button class="add-set-btn" onclick="addHistorySetRow('${w.id}','${ex.exerciseId}')">+ Add Set</button>
      </div>`;
  });

  html += `
      <div style="margin-top:16px;text-align:center;">
        <button class="btn-danger" onclick="deleteWorkoutConfirm('${w.id}')">Delete Workout</button>
      </div>
    </div>`;
  return html;
}

function refreshWorkoutDetailView(id) {
  document.getElementById("view-root").innerHTML = renderWorkoutDetail(id);
}

function findHistorySet(workoutId, exerciseId, index) {
  const w = Store.state.workouts.find((w) => w.id === workoutId);
  const ex = w && w.exercises.find((e) => e.exerciseId === exerciseId);
  return ex && ex.sets[index] ? { w, ex, set: ex.sets[index] } : null;
}

function updateHistorySetField(workoutId, exerciseId, index, field, value) {
  const found = findHistorySet(workoutId, exerciseId, index);
  if (!found) return;
  found.set[field] = value === "" ? "" : Number(value);
  delete found.set.pr;
  Store.save();
  removeStalePrTag(workoutId, exerciseId, index);
}

function adjustHistorySetField(workoutId, exerciseId, index, field, delta) {
  const found = findHistorySet(workoutId, exerciseId, index);
  if (!found) return;
  const current = Number(found.set[field]) || 0;
  const next = Math.max(0, current + delta);
  found.set[field] = next;
  delete found.set.pr;
  Store.save();
  const row = document.querySelector(`.set-row[data-w="${workoutId}"][data-ex="${exerciseId}"][data-index="${index}"]`);
  const input = row && row.querySelector(field === "weight" ? ".weight-input" : ".reps-input");
  if (input) input.value = next;
  removeStalePrTag(workoutId, exerciseId, index);
}

function removeStalePrTag(workoutId, exerciseId, index) {
  const row = document.querySelector(`.set-row[data-w="${workoutId}"][data-ex="${exerciseId}"][data-index="${index}"]`);
  const next = row && row.nextElementSibling;
  if (next && next.classList.contains("pr-tag")) next.remove();
}

function addHistorySetRow(workoutId, exerciseId) {
  const w = Store.state.workouts.find((w) => w.id === workoutId);
  const ex = w && w.exercises.find((e) => e.exerciseId === exerciseId);
  if (!ex) return;
  const prev = ex.sets[ex.sets.length - 1];
  ex.sets.push({ weight: prev ? prev.weight : "", reps: prev ? prev.reps : "" });
  Store.save();
  refreshWorkoutDetailView(workoutId);
}

function removeHistorySetRow(workoutId, exerciseId, index) {
  const w = Store.state.workouts.find((w) => w.id === workoutId);
  const ex = w && w.exercises.find((e) => e.exerciseId === exerciseId);
  if (!ex) return;
  ex.sets.splice(index, 1);
  if (ex.sets.length === 0) {
    w.exercises = w.exercises.filter((e) => e.exerciseId !== exerciseId);
  }
  Store.save();
  refreshWorkoutDetailView(workoutId);
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
      <h1 style="margin-bottom:2px;font-size:32px;">${getExerciseIcon(ex.name, ex.muscleGroup)} ${escapeHtml(ex.name)}</h1>
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
            ${h.sets.map((s, i) => `<div>Set ${i + 1}: ${s.weight}${unit()} × ${s.reps}${s.pr ? ` <span class="pr-badge">🏆 PR</span>` : ""}</div>`).join("")}
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

// ---------- Progress / Stats ----------
function formatVolume(v) {
  if (v >= 1000000) return (v / 1000000).toFixed(1) + "M";
  if (v >= 1000) return Math.round(v / 1000) + "k";
  return Math.round(v).toString();
}

function getWeeklyVolume(weeksBack) {
  const weeks = [];
  const now = Date.now();
  for (let i = weeksBack - 1; i >= 0; i--) {
    const weekStart = startOfWeek(now - i * 7 * 86400000);
    const weekEnd = weekStart + 7 * 86400000;
    const volume = Store.state.workouts
      .filter((w) => w.finishedAt >= weekStart && w.finishedAt < weekEnd)
      .reduce((sum, w) => sum + Store.workoutVolume(w), 0);
    weeks.push({ weekStart, volume });
  }
  return weeks;
}

function getVolumeByMuscleGroup(daysBack) {
  const cutoff = Date.now() - daysBack * 86400000;
  const totals = {};
  Store.state.workouts
    .filter((w) => w.finishedAt >= cutoff)
    .forEach((w) => {
      w.exercises.forEach((ex) => {
        const exMeta = Store.getExercise(ex.exerciseId);
        const group = (exMeta && exMeta.muscleGroup) || "Other";
        const vol = ex.sets.reduce((s, set) => s + (Number(set.weight) || 0) * (Number(set.reps) || 0), 0);
        totals[group] = (totals[group] || 0) + vol;
      });
    });
  return totals;
}

function getWeekStreak() {
  let streak = 0;
  let weekStart = startOfWeek(Date.now());
  const hasCurrent = Store.state.workouts.some((w) => w.finishedAt >= weekStart && w.finishedAt < weekStart + 7 * 86400000);
  if (!hasCurrent) weekStart -= 7 * 86400000;
  while (true) {
    const weekEnd = weekStart + 7 * 86400000;
    const has = Store.state.workouts.some((w) => w.finishedAt >= weekStart && w.finishedAt < weekEnd);
    if (!has) break;
    streak++;
    weekStart -= 7 * 86400000;
  }
  return streak;
}

function renderProgress() {
  const weekStreak = getWeekStreak();
  const totalVolume = Store.state.workouts.reduce((s, w) => s + Store.workoutVolume(w), 0);

  let html = `<div class="topbar"><h1>Stats</h1></div><div class="view">`;

  html += `
    <div class="stat-row">
      <div class="stat"><span class="num">${weekStreak}</span><span class="label">Week Streak</span></div>
      <div class="stat"><span class="num">${formatVolume(totalVolume)}</span><span class="label">Total Volume</span></div>
    </div>`;

  const volumeComparison = getVolumeComparison(totalVolume, unit());
  if (volumeComparison) {
    html += `<p class="text-dim" style="text-align:center;font-size:13px;margin:-8px 0 16px;">${volumeComparison}</p>`;
  }

  html += `<div class="section-title">Badges</div>`;
  html += renderBadgesSection();

  html += `<div class="section-title">Weekly Volume</div>`;
  if (Store.state.workouts.length === 0) {
    html += `<div class="empty-state"><span class="big-icon">📊</span><p>Finish some workouts and your trends will show up here.</p></div>`;
  } else {
    const weeks = getWeeklyVolume(12);
    const maxVol = Math.max(...weeks.map((w) => w.volume), 1);
    html += renderVolumeChart(weeks, maxVol);

    html += `<div class="section-title">Last 30 Days by Muscle Group</div>`;
    const groupTotals = getVolumeByMuscleGroup(30);
    const groupEntries = Object.entries(groupTotals).sort((a, b) => b[1] - a[1]);
    if (groupEntries.length === 0) {
      html += `<p class="text-dim">No workouts in the last 30 days.</p>`;
    } else {
      const maxGroupVol = Math.max(...groupEntries.map(([, v]) => v), 1);
      groupEntries.forEach(([group, vol]) => {
        const pct = Math.round((vol / maxGroupVol) * 100);
        html += `
          <div class="volume-bar-row">
            <div class="volume-bar-label">${MUSCLE_GROUP_ICONS[group] || "⚡"} ${escapeHtml(group)}</div>
            <div class="volume-bar-track"><div class="volume-bar-fill" style="width:${pct}%"></div></div>
            <div class="volume-bar-value">${formatVolume(vol)}</div>
          </div>`;
      });
    }
  }

  html += `<div class="section-title">Body Weight</div>`;
  html += renderBodyweightSection();

  html += `</div>`;
  return html;
}

function renderVolumeChart(weeks, maxVol) {
  const w = 500,
    h = 170;
  const padL = 36,
    padR = 10,
    padT = 14,
    padB = 26;
  const plotW = w - padL - padR,
    plotH = h - padT - padB;
  const barGap = 5;
  const barWidth = (plotW - barGap * (weeks.length - 1)) / weeks.length;

  const bars = weeks
    .map((wk, i) => {
      const x = padL + i * (barWidth + barGap);
      const barH = maxVol > 0 ? (wk.volume / maxVol) * plotH : 0;
      const isCurrent = i === weeks.length - 1;
      return `<rect x="${x.toFixed(1)}" y="${(padT + plotH - barH).toFixed(1)}" width="${barWidth.toFixed(1)}" height="${Math.max(barH, 0).toFixed(1)}" rx="3" fill="${isCurrent ? "#ff5722" : "#ff572299"}"><title>${formatDateShort(wk.weekStart)}: ${formatVolume(wk.volume)}${unit()}</title></rect>`;
    })
    .join("");

  const gridLines = [0, 0.5, 1]
    .map((f) => {
      const gy = padT + plotH * (1 - f);
      const val = Math.round(maxVol * f);
      return `<line x1="${padL}" y1="${gy}" x2="${w - padR}" y2="${gy}" stroke="#2a2f36" stroke-width="1" /><text x="${padL - 6}" y="${gy + 4}" font-size="9" fill="#666d77" text-anchor="end">${formatVolume(val)}</text>`;
    })
    .join("");

  const firstLabel = weeks.length ? formatDateShort(weeks[0].weekStart) : "";
  const lastLabel = weeks.length ? "This wk" : "";

  return `
    <div class="chart-wrap">
      <svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" role="img" aria-label="Weekly training volume">
        ${gridLines}
        ${bars}
        <text x="${padL}" y="${h - 4}" font-size="9" fill="#666d77">${firstLabel}</text>
        <text x="${w - padR}" y="${h - 4}" font-size="9" fill="#666d77" text-anchor="end">${lastLabel}</text>
      </svg>
    </div>`;
}

// ---------- Badges ----------
function renderBadgesSection() {
  const stats = computeBadgeStats();
  const defs = getBadgeDefinitions();
  const earnedCount = defs.filter((b) => b.check(stats)).length;

  let html = `<p class="text-dim" style="margin-bottom:10px;">${earnedCount} / ${defs.length} earned</p>`;
  html += `<div class="badge-grid">`;
  defs.forEach((b) => {
    const isEarned = b.check(stats);
    html += `
      <button class="badge-tile ${isEarned ? "badge-earned" : "badge-locked"}" onclick="showBadgeDetail('${b.id}')">
        <span class="badge-icon">${isEarned ? b.icon : "🔒"}</span>
        <span class="badge-name">${escapeHtml(b.name)}</span>
      </button>`;
  });
  html += `</div>`;
  return html;
}

function showBadgeDetail(id) {
  const stats = computeBadgeStats();
  const b = getBadgeDefinitions().find((x) => x.id === id);
  if (!b) return;
  const isEarned = b.check(stats);
  let html = `<h2>${b.icon} ${escapeHtml(b.name)}</h2>`;
  html += `<p class="text-dim" style="margin:10px 0 14px;">${escapeHtml(b.desc)}</p>`;
  if (isEarned) {
    html += `<p style="color:var(--success);font-weight:700;">✅ Earned</p>`;
  } else if (b.goal) {
    const current = Math.min(b.progress(stats), b.goal);
    const pct = Math.round((current / b.goal) * 100);
    html += `
      <div class="volume-bar-track" style="margin-bottom:6px;"><div class="volume-bar-fill" style="width:${pct}%"></div></div>
      <p class="text-dim" style="font-size:13px;">${formatVolume(current)} / ${formatVolume(b.goal)}</p>`;
  } else {
    html += `<p class="text-dim">🔒 Not yet earned</p>`;
  }
  openSheet(html);
}

// ---------- Body weight ----------
function renderBodyweightSection() {
  const logs = [...Store.state.bodyweightLogs].sort((a, b) => b.date - a.date);
  let html = `<button class="btn btn-secondary" style="margin-bottom:12px;" onclick="openBodyweightSheet()">+ Log Body Weight</button>`;
  if (logs.length === 0) {
    html += `<p class="text-dim">No entries yet.</p>`;
    return html;
  }
  if (logs.length >= 2) {
    html += renderBodyweightChart([...logs].reverse());
  }
  const latest = logs[0];
  html += `
    <div class="stat-row" style="margin-bottom:10px;">
      <div class="stat"><span class="num">${latest.weight}${unit()}</span><span class="label">Latest · ${formatDateShort(latest.date)}</span></div>
    </div>`;
  html += logs
    .slice(0, 5)
    .map(
      (l) => `
    <div class="routine-exercise-row">
      <span>${formatDateShort(l.date)}: ${l.weight}${unit()}</span>
      <button class="btn-icon" style="width:32px;height:32px;font-size:14px;" onclick="deleteBodyweightEntryConfirm('${l.id}')">✕</button>
    </div>`
    )
    .join("");
  return html;
}

function renderBodyweightChart(points) {
  const w = 500,
    h = 150;
  const padL = 36,
    padR = 12,
    padT = 14,
    padB = 22;
  const plotW = w - padL - padR,
    plotH = h - padT - padB;

  const values = points.map((p) => p.weight);
  const maxVal = Math.max(...values);
  const minVal = Math.min(...values);
  const range = maxVal - minVal || 1;

  const x = (i) => padL + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (v) => padT + plotH - ((v - minVal) / range) * plotH;

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p.weight).toFixed(1)}`).join(" ");
  const dots = points
    .map(
      (p, i) =>
        `<circle cx="${x(i).toFixed(1)}" cy="${y(p.weight).toFixed(1)}" r="4" fill="#ff5722" stroke="#0d0f12" stroke-width="2"><title>${formatDateShort(p.date)}: ${p.weight}${unit()}</title></circle>`
    )
    .join("");

  return `
    <div class="chart-wrap">
      <svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" role="img" aria-label="Body weight over time">
        <path d="${linePath}" fill="none" stroke="#ff5722" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        ${dots}
        <text x="${padL}" y="${h - 4}" font-size="9" fill="#666d77">${formatDateShort(points[0].date)}</text>
        <text x="${w - padR}" y="${h - 4}" font-size="9" fill="#666d77" text-anchor="end">${formatDateShort(points[points.length - 1].date)}</text>
      </svg>
    </div>`;
}

function openBodyweightSheet() {
  const html = `
    <h2>Log Body Weight</h2>
    <div class="field" style="margin-top:12px;">
      <label>Weight (${unit()})</label>
      <input type="number" inputmode="decimal" id="bw-input" placeholder="e.g. 180" />
    </div>
    <button class="btn btn-primary" onclick="saveBodyweightEntry()">Save</button>`;
  openSheet(html);
}

function saveBodyweightEntry() {
  const input = document.getElementById("bw-input");
  const val = parseFloat(input.value);
  if (!val || val <= 0) {
    toast("Enter a valid weight");
    return;
  }
  Store.addBodyweightLog(val);
  closeSheet();
  toast("Weight logged");
  document.getElementById("view-root").innerHTML = renderProgress();
}

function deleteBodyweightEntryConfirm(id) {
  if (!confirm("Delete this body weight entry?")) return;
  Store.deleteBodyweightLog(id);
  document.getElementById("view-root").innerHTML = renderProgress();
}

// ---------- Weekly schedule ----------
const DAY_NAMES = { 0: "Sunday", 1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday", 5: "Friday", 6: "Saturday" };
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday first

function renderSchedule() {
  let html = `
    <div class="topbar"><button class="back" onclick="navigate('#/settings')">‹ Back</button></div>
    <div class="view">
      <h1 style="margin-bottom:6px;">Weekly Schedule</h1>
      <p class="text-dim" style="margin-bottom:18px;">Assign a routine or a rest day to each day of the week. Home shows today's plan.</p>`;

  DAY_ORDER.forEach((day) => {
    const val = Store.getScheduleDay(day);
    let label = "Not set";
    let icon = "➖";
    if (val === "rest") {
      label = "Rest Day";
      icon = "😴";
    } else if (val) {
      const r = Store.getRoutine(val);
      if (r) {
        label = r.name;
        icon = "🏋️";
      }
    }
    html += `
      <div class="card routine-card card-tap" onclick="openScheduleDayPicker(${day})">
        <div class="info">
          <h3>${DAY_NAMES[day]}</h3>
          <p>${icon} ${escapeHtml(label)}</p>
        </div>
        <span style="color:var(--text-faint);font-size:20px;">›</span>
      </div>`;
  });

  html += `</div>`;
  return html;
}

function openScheduleDayPicker(day) {
  let html = `<h2>${DAY_NAMES[day]}</h2><p class="text-dim" style="margin-bottom:14px;">Choose a routine or mark it a rest day.</p>`;
  html += `<div class="picker-item card-tap" onclick="setScheduleDayAndClose(${day}, 'rest')"><span class="name">😴 Rest Day</span></div>`;

  const routines = Store.state.routines;
  if (routines.length === 0) {
    html += `<p class="text-dim" style="margin-top:12px;">No routines yet — create one first.</p>`;
  } else {
    const grouped = groupRoutinesByCategory(routines);
    Object.keys(grouped)
      .sort(categorySortOrder)
      .forEach((cat) => {
        html += `<div class="section-title" style="margin-top:12px;">${escapeHtml(cat)}</div>`;
        grouped[cat].forEach((r) => {
          html += `<div class="picker-item card-tap" onclick="setScheduleDayAndClose(${day}, '${r.id}')"><span class="name">🏋️ ${escapeHtml(r.name)}</span></div>`;
        });
      });
  }

  html += `<button class="btn-danger" style="margin-top:16px;width:100%;" onclick="setScheduleDayAndClose(${day}, null)">Clear</button>`;
  openSheet(html);
}

function setScheduleDayAndClose(day, value) {
  Store.setScheduleDay(day, value);
  closeSheet();
  document.getElementById("view-root").innerHTML = renderSchedule();
}

function renderTodayCard() {
  const today = new Date().getDay();
  const val = Store.getScheduleDay(today);
  if (!val) {
    return `
      <div class="card card-tap" onclick="navigate('#/schedule')">
        <div class="row-between">
          <div>
            <h3 style="font-size:16px;font-weight:700;">📅 No plan for today</h3>
            <p class="text-dim">Set up your weekly schedule</p>
          </div>
          <span style="color:var(--text-faint);font-size:20px;">›</span>
        </div>
      </div>`;
  }
  if (val === "rest") {
    return `
      <div class="card">
        <h3 style="font-size:16px;font-weight:700;">😴 Rest Day</h3>
        <p class="text-dim">Recovery is part of the program.</p>
      </div>`;
  }
  const r = Store.getRoutine(val);
  if (!r) return "";

  const completedToday = getTodaysCompletedWorkoutForRoutine(r.id);
  if (completedToday) {
    return `
      <div class="card">
        <div class="row-between">
          <div>
            <h3 style="font-size:16px;font-weight:700;">✅ Done for today: ${escapeHtml(r.name)}</h3>
            <p class="text-dim">Finished at ${formatTimeOfDay(completedToday.finishedAt)}</p>
          </div>
          <button class="btn btn-secondary btn-small" style="width:auto;flex-shrink:0;" onclick="startWorkoutFromRoutine('${r.id}')">Again</button>
        </div>
      </div>`;
  }

  return `
    <div class="card">
      <div class="row-between">
        <div>
          <h3 style="font-size:16px;font-weight:700;">📅 Today: ${escapeHtml(r.name)}</h3>
          <p class="text-dim">${r.exerciseIds.length} exercise${r.exerciseIds.length === 1 ? "" : "s"}</p>
        </div>
        <button class="btn btn-primary btn-small" style="width:auto;flex-shrink:0;" onclick="startWorkoutFromRoutine('${r.id}')">Start</button>
      </div>
    </div>`;
}

// ---------- Plate calculator ----------
function openPlateCalculator(prefillWeight) {
  const u = unit();
  window._plateBar = DEFAULT_BAR_WEIGHT[u] || DEFAULT_BAR_WEIGHT.lbs;
  window._plateTarget = prefillWeight && prefillWeight > 0 ? prefillWeight : window._plateBar;
  openSheet(renderPlateCalculatorSheet());
}

function openPlateCalculatorForExercise(exerciseId) {
  let prefill = null;
  const active = Store.state.activeWorkout && Store.state.activeWorkout.exercises.find((e) => e.exerciseId === exerciseId);
  if (active && active.sets.length > 0) {
    const lastSet = active.sets[active.sets.length - 1];
    if (lastSet.weight !== "" && lastSet.weight != null) prefill = Number(lastSet.weight);
  }
  if (prefill === null) {
    const last = Store.getLastPerformance(exerciseId);
    if (last && last.sets[0] && last.sets[0].weight) prefill = Number(last.sets[0].weight);
  }
  openPlateCalculator(prefill);
}

function renderPlateCalculatorSheet() {
  const u = unit();
  const barOptions = BAR_WEIGHT_OPTIONS[u] || BAR_WEIGHT_OPTIONS.lbs;
  return `
    <h2>🧮 Plate Calculator</h2>
    <div class="field" style="margin-top:14px;">
      <label>Bar Weight</label>
      <select id="plate-bar-select" onchange="setPlateBar(this.value)">
        ${barOptions.map((b) => `<option value="${b}" ${b === window._plateBar ? "selected" : ""}>${b}${u} bar</option>`).join("")}
      </select>
    </div>
    <div class="field">
      <label>Target Weight (${u})</label>
      <div class="stepper-group" style="max-width:220px;">
        <button class="stepper-btn" style="width:34px;height:40px;" onclick="adjustPlateTarget(-5)">−</button>
        <input type="number" inputmode="decimal" id="plate-target-input" value="${window._plateTarget}" oninput="setPlateTarget(this.value)" style="text-align:center;background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;padding:10px;color:var(--text);font-size:18px;width:100%;" />
        <button class="stepper-btn" style="width:34px;height:40px;" onclick="adjustPlateTarget(5)">+</button>
      </div>
    </div>
    <div id="plate-visual">${renderPlateVisual(u)}</div>
    <div id="plate-breakdown">${renderPlateBreakdown(u)}</div>`;
}

function setPlateBar(val) {
  window._plateBar = Number(val);
  refreshPlateCalc();
}

function setPlateTarget(val) {
  window._plateTarget = val === "" ? 0 : Number(val);
  refreshPlateCalc();
}

function adjustPlateTarget(delta) {
  window._plateTarget = Math.max(0, (Number(window._plateTarget) || 0) + delta);
  const input = document.getElementById("plate-target-input");
  if (input) input.value = window._plateTarget;
  refreshPlateCalc();
}

function refreshPlateCalc() {
  const u = unit();
  document.getElementById("plate-visual").innerHTML = renderPlateVisual(u);
  document.getElementById("plate-breakdown").innerHTML = renderPlateBreakdown(u);
}

function renderPlateVisual(u) {
  const { plates } = calculatePlates(window._plateTarget, window._plateBar, u);
  if (plates.length === 0) {
    return `<p class="text-dim" style="text-align:center;margin:20px 0;">Just the bar — no plates needed.</p>`;
  }
  const colors = PLATE_COLORS[u] || PLATE_COLORS.lbs;
  const sequence = [];
  plates.forEach((p) => {
    for (let i = 0; i < p.count; i++) sequence.push(p.size);
  });
  const stackHtml = sequence
    .map((size) => {
      const height = Math.min(92, 34 + size * 1.7);
      const color = colors[size] || "#9aa1ab";
      const textColor = size === 10 || size === 5 ? "#0d0f12" : "#fff";
      return `<div class="plate" style="height:${height}px;background:${color};color:${textColor};" title="${size}${u}">${size}</div>`;
    })
    .join("");
  return `
    <div class="plate-viz">
      <div class="plate-stack plate-stack-left">${stackHtml}</div>
      <div class="bar-segment"></div>
      <div class="plate-stack">${stackHtml}</div>
    </div>`;
}

function renderPlateBreakdown(u) {
  const { plates, remaining } = calculatePlates(window._plateTarget, window._plateBar, u);
  if (plates.length === 0) {
    return `<p class="text-dim" style="text-align:center;">Bar only: ${window._plateBar}${u}</p>`;
  }
  let html = `<p class="text-dim" style="text-align:center;margin-bottom:6px;">Per side:</p>`;
  html += `<div style="text-align:center;font-size:18px;font-weight:800;margin-bottom:8px;">${plates.map((p) => `${p.size}${u}×${p.count}`).join("  +  ")}</div>`;
  if (remaining > 0.01) {
    html += `<p class="text-dim" style="text-align:center;font-size:12px;">${remaining.toFixed(1)}${u} short per side — no smaller plates available.</p>`;
  }
  return html;
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

      <div class="section-title">Planning</div>
      <button class="btn btn-secondary" style="margin-bottom:10px;" onclick="navigate('#/schedule')">📅 Weekly Schedule</button>

      <div class="section-title">Tools</div>
      <button class="btn btn-secondary" style="margin-bottom:10px;" onclick="openPlateCalculator()">🧮 Plate Calculator</button>

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
