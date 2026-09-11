// ─────────────────────────────────────────────────────────────────────────────
// WORKOUTS — colours and the workout log
// ─────────────────────────────────────────────────────────────────────────────
//
// The section keeps its own log so the calendar and the coverage grid work the
// same way they do in the standalone app. It ALSO writes one addEvent into the
// cross-lab log on every finished session, so the time counts toward the
// Dashboard's streak and totals like any other lab. Two records of the same
// session, on purpose: members shouldn't have to keep a separate log in their
// heads.
//
// Keys live under the "workouts." prefix, which is registered in
// dashboard/practiceLog.js KNOWN_PREFIXES so the unified backup picks it up.
// ─────────────────────────────────────────────────────────────────────────────

export const C = {
  bg:           "#0D0D0D",
  card:         "#141414",
  card2:        "#1a1a1a",
  border:       "rgba(255,255,255,0.07)",
  white:        "#ffffff",
  off:          "#e8e8e8",
  muted:        "rgba(255,255,255,0.72)",
  dim:          "rgba(255,255,255,0.55)",
  purple:       "#7c3aed",
  purpleLt:     "#9d5ff5",
  purpleDim:    "rgba(124,58,237,0.15)",
  purpleBorder: "rgba(124,58,237,0.45)",

  // Tab tokens — same values as the standalone app's renderer.
  string: "#555",
  down:   "#9d5ff5",
  up:     "#e8e8e8",
};

const LOG_KEY   = "jb-vinnie-log-v1";
const PREFS_KEY = "jb-vinnie-prefs-v1";

// A finished routine always counts. An abandoned one has to be a real attempt.
export const MIN_LOGGED_SEC = 10;

function lsGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
}

export function readLog() {
  const parsed = lsGet(LOG_KEY, null);
  if (parsed && Array.isArray(parsed.sessions)) return parsed;
  return { version: 1, product: "workouts", sessions: [] };
}
export function writeLog(log) { lsSet(LOG_KEY, log); }

export function addSession(session) {
  const log = readLog();
  log.sessions.push(session);
  writeLog(log);
  return log;
}

export function readPrefs() { return lsGet(PREFS_KEY, {}) || {}; }
export function writePrefs(patch) {
  lsSet(PREFS_KEY, { ...readPrefs(), ...patch });
}

// ── Derived views ────────────────────────────────────────────────────────────

export function dayKey(d) {
  return d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0");
}

export function sessionsByDay(sessions) {
  const map = {};
  for (const s of sessions) {
    const k = dayKey(new Date(s.startedAt));
    (map[k] = map[k] || []).push(s);
  }
  return map;
}

export function streakOf(map) {
  let n = 0;
  const d = new Date();
  if (!map[dayKey(d)]) d.setDate(d.getDate() - 1);   // today not practiced yet is fine
  while (map[dayKey(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

export function fmtClock(sec) {
  const s = Math.max(0, Math.round(sec));
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}

export function fmtDur(ms) {
  const m = Math.round(ms / 60000);
  if (m < 60) return m + "m";
  const h = Math.floor(m / 60);
  return h + "h" + (m % 60 ? " " + (m % 60) + "m" : "");
}

export function shadeFor(ms) {
  const m = ms / 60000;
  if (m >= 20) return "#7c3aed";
  if (m >= 10) return "rgba(124,58,237,.8)";
  if (m >= 5)  return "rgba(124,58,237,.55)";
  return "rgba(124,58,237,.28)";
}

// ── Export / import ──────────────────────────────────────────────────────────

export function exportLog() {
  const log = readLog();
  log.exportedAt = new Date().toISOString();
  const blob = new Blob([JSON.stringify(log, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `workout-log-${dayKey(new Date())}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return log.sessions.length;
}

// Merges rather than replaces, so importing a backup never loses what is here.
// Accepts a log exported from the standalone app as well as from this section.
export function importLog(parsed) {
  if (!parsed || !Array.isArray(parsed.sessions)) {
    return { ok: false, error: "That file doesn't look like a practice log." };
  }
  const idOf = (s) => [s.startedAt, s.seconds, s.position, s.startStroke].join("|");
  const log = readLog();
  const seen = new Set(log.sessions.map(idOf));
  let added = 0;
  for (const s of parsed.sessions) {
    if (!s || !s.startedAt) continue;
    const id = idOf(s);
    if (!seen.has(id)) { log.sessions.push(s); seen.add(id); added++; }
  }
  log.sessions.sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt));
  writeLog(log);
  return { ok: true, added };
}

// Per-piece settings coexist with the original top-level preferences. Old
// preferences seed only their own workout; switching pieces cannot leak scope.
export function workoutPrefs(workout) {
  const prefs=readPrefs();
  const own=prefs.byWorkout?.[workout.id];
  const source=own || (prefs.workoutId===workout.id ? prefs : {});
  const total=workout.piece?.bars.length || 1;
  const startBar=Math.max(1,Math.min(total,Math.round(source.startBar)||1));
  return {...source, startBar, endBar:Math.max(startBar,Math.min(total,Math.round(source.endBar)||total)),
    chunkSize:Math.max(1,Math.min(total,Math.round(source.chunkSize)||1)),
    bpm:source.bpm || prefs.bpmBy?.[workout.id] || workout.defaultBpm || 60};
}
export function saveWorkoutPrefs(workoutId,settings) {
  const prefs=readPrefs();
  writePrefs({...settings,workoutId,
    bpmBy:{...prefs.bpmBy,[workoutId]:settings.bpm},
    byWorkout:{...prefs.byWorkout,[workoutId]:settings}});
}
