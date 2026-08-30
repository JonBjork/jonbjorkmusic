// =============================================================================
// The Ultimate Alternate Picking Workout
//
// The exercises are not in this file. They arrive from
// /.netlify/functions/picking-workout-unlock once Lemon Squeezy confirms the key.
//
// Metronome: the Practice Lab engine, copied verbatim except for the sample
// path, which now reads window.__PL_SOUND_BASE. Eighth notes throughout, which
// is subdivision 2: click on the beat, hi-hat on the offbeat.
// =============================================================================

import { createMetronomeEngine, primeMetronomeAudio } from "/picking-workout/metronome.js";

const UNLOCK_URL   = "/.netlify/functions/picking-workout-unlock";
const WORKBOOK_URL = "/.netlify/functions/picking-workout-workbook";
const LICENSE_KEY = "jbm:pickingworkout:license";
const LOG_KEY     = "jbm:pickingworkout:log";
const PREFS_KEY   = "jbm:pickingworkout:prefs";

// The walkthrough video. Paste the YouTube id here — the bit after "v=" in
// the watch URL, e.g. "Hd-gfXTaN_4". Unlisted is fine: unlisted videos embed
// normally, they just do not show up in search or on the channel.
// Leave it empty and the Walkthrough tab hides itself.
const WALKTHROUGH_VIDEO_ID = "a4UkxRIcMNI";

const SUBDIVISION = 2;          // eighth notes, and nothing else
const COUNT_IN_BEATS = 4;

const $ = (id) => document.getElementById(id);

// ── state ────────────────────────────────────────────────────────────────────
const S = {
  meta: null,
  allExercises: [],             // every exercise, notes still carrying the returning note
  exercises: [],                // the selected ones, strokes assigned, returning note trimmed
  flat: [],                     // every note of the session in order
  position: 1,
  startStroke: "D",
  groups: [2, 3, 4],
  bpm: 50,                      // start slow; Jon rarely goes above 80, mostly around 60
  pointer: 0,                   // where playback resumes in S.flat
  playing: false,
  shownEx: -1,
  sessionStartedAt: null,
  activeMs: 0,                  // time actually spent playing, pauses excluded
  runStartedTs: null,
  calMonth: null,
};

const engine = createMetronomeEngine();

// ── helpers ──────────────────────────────────────────────────────────────────
const STRING_NAMES = { 1:"e", 2:"B", 3:"G", 4:"D", 5:"A", 6:"E" };

function fmtClock(sec){
  sec = Math.max(0, Math.round(sec));
  return Math.floor(sec/60) + ":" + String(sec%60).padStart(2,"0");
}
function fmtDur(ms){
  const m = Math.round(ms/60000);
  if (m < 60) return m + "m";
  const h = Math.floor(m/60);
  return h + "h" + (m%60 ? " " + (m%60) + "m" : "");
}
function dayKey(d){
  return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
}
function seg(id, fn){
  const el = $(id);
  el.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    [...el.children].forEach(c => c.setAttribute("aria-pressed", String(c === b)));
    fn(b.dataset.v);
  });
}
function show(id){
  ["view-setup","view-run","view-done","view-log","view-video"].forEach(v => $(v).classList.toggle("hidden", v !== id));
}

// ── the session ──────────────────────────────────────────────────────────────
// Strict alternate picking runs unbroken across whichever exercises are
// selected, so the strokes are assigned to the stream, not to each exercise.
// Every exercise ends one note short of the note it started on, because that
// note opens the next exercise. The last one in the session keeps it.
function rebuild(){
  const chosen = S.allExercises.filter(e => S.groups.includes(e.groupSize));
  let i = 0;
  S.exercises = chosen.map((ex, idx) => {
    const last = idx === chosen.length - 1;
    const raw = last ? ex.notes : ex.notes.slice(0, -1);
    return { ...ex, notes: raw.map(n => {
      const down = (i++ % 2 === 0) === (S.startStroke === "D");
      return { string: n.string, fret: n.fret, stroke: down ? "D" : "U" };
    })};
  });
  S.flat = [];
  S.exercises.forEach((ex, ei) => ex.notes.forEach((n, ni) => S.flat.push({ ...n, ei, ni })));
  paintSetupHints();
}

function paintSetupHints(){
  const notes = S.flat.length;
  const secs = notes * (60 / S.bpm) / SUBDIVISION;
  $("hintPos").innerHTML =
    `The tab is always written at the first position, so the fret numbers are the finger numbers. ` +
    `You are playing it with the <b>index finger on fret ${S.position}</b>.`;
  // Time is the only number that matters here. The note and exercise counts
  // were noise.
  $("hintSize").innerHTML =
    `This will take <b>${fmtClock(secs)}</b> per position at <b>${S.bpm}</b> BPM. ` +
    `Play it through starting on a downstroke, then again starting on an upstroke.`;
}

// ── tab ──────────────────────────────────────────────────────────────────────
const COL_W = 38, PAD_L = 48, PAD_R = 26, ROW_H = 25, TOP_PAD = 46;

function renderTab(notes){
  const n = notes.length;
  const width  = PAD_L + PAD_R + n*COL_W;
  const height = TOP_PAD + ROW_H*6 + 18;
  const yFor = (s) => TOP_PAD + ROW_H*(s - 0.5);
  const xFor = (i) => PAD_L + COL_W*(i + 0.5);
  let svg = `<svg id="tabsvg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="tab">`;

  svg += `<rect id="playhead" x="-99" y="${TOP_PAD-34}" width="${COL_W}" height="${ROW_H*6+40}" fill="rgba(124,58,237,0.18)" stroke="#9d5ff5" stroke-width="1" rx="4"/>`;

  for (let s=1;s<=6;s++){
    svg += `<line x1="${PAD_L-10}" y1="${yFor(s)}" x2="${width-PAD_R+6}" y2="${yFor(s)}" stroke="#555" stroke-width="1.1"/>`;
    svg += `<text x="${PAD_L-19}" y="${yFor(s)+4}" text-anchor="end" font-size="13" font-family="Oswald,sans-serif" font-weight="500" fill="#8c8c8c">${STRING_NAMES[s]}</text>`;
  }

  notes.forEach((note,i) => {
    const x = xFor(i), y = yFor(note.string);
    const down = note.stroke === "D";
    const col  = down ? "#9d5ff5" : "#e8e8e8";
    // Standard picking symbols: squared frame down, V up.
    svg += down
      ? `<path d="M ${x-5} ${TOP_PAD-18} L ${x-5} ${TOP_PAD-28} L ${x+5} ${TOP_PAD-28} L ${x+5} ${TOP_PAD-18}" fill="none" stroke="${col}" stroke-width="1.8" stroke-linecap="square"/>`
      : `<path d="M ${x-5} ${TOP_PAD-28} L ${x} ${TOP_PAD-18} L ${x+5} ${TOP_PAD-28}" fill="none" stroke="${col}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;
    svg += `<rect x="${x-11}" y="${y-10}" width="22" height="20" fill="#181818"/>`;
    svg += `<text x="${x}" y="${y+5}" text-anchor="middle" font-size="16" font-family="Oswald,sans-serif" font-weight="600" fill="#e8e8e8">${note.fret}</text>`;
  });

  svg += `</svg>`;
  return svg;
}

function showExercise(ei){
  const ex = S.exercises[ei];
  if (!ex) return;
  S.shownEx = ei;
  $("nowCombo").textContent = ex.comboLabel;
  $("nowMode").textContent  = ex.modeLabel;
  const nx = S.exercises[ei+1];
  $("nextUp").textContent = nx ? `${nx.comboLabel} · ${nx.modeLabel}` : "Last one";
  $("progText").textContent = `Exercise ${ei+1} of ${S.exercises.length}`;
  $("tabwrap").innerHTML = renderTab(ex.notes);
}

function movePlayhead(ni){
  const svg = $("tabsvg"); if (!svg) return;
  const head = svg.querySelector("#playhead"); if (!head) return;
  head.setAttribute("x", PAD_L + COL_W*ni);
  const wrap = $("tabwrap");
  const x = PAD_L + COL_W*(ni + 0.5);
  wrap.scrollTo({ left: Math.max(0, x - wrap.clientWidth/2), behavior: "auto" });
}

// ── transport ────────────────────────────────────────────────────────────────
function paintNote(flatIndex){
  if (flatIndex >= S.flat.length){ finish(true); return; }
  S.pointer = flatIndex;
  const note = S.flat[flatIndex];
  if (note.ei !== S.shownEx) showExercise(note.ei);
  movePlayhead(note.ni);
  const spn = (60 / S.bpm) / SUBDIVISION;
  $("progBar").style.width = (flatIndex / S.flat.length * 100) + "%";
  $("timeText").textContent = fmtClock(flatIndex*spn) + " / " + fmtClock(S.flat.length*spn);
}

async function play(fromIndex, withCountIn){
  S.pointer = fromIndex;
  S.playing = true;
  S.runStartedTs = Date.now();
  $("btnPause").textContent = "Pause";
  const base = fromIndex;
  await engine.start({
    bpm: S.bpm,
    subdivision: SUBDIVISION,
    countInBeats: withCountIn ? COUNT_IN_BEATS : 0,
    countInSubdivide: false,
    onCountIn: (num) => {
      $("countin").classList.remove("hidden");
      $("countinNum").textContent = String(num);
      if (num === 1) setTimeout(() => $("countin").classList.add("hidden"), (60/S.bpm)*1000);
    },
    onTick: (i) => paintNote(base + i),
  });
}

function halt(){
  engine.stop();
  if (S.playing && S.runStartedTs) S.activeMs += Date.now() - S.runStartedTs;
  S.runStartedTs = null;
  S.playing = false;
  $("countin").classList.add("hidden");
}

async function startSession(){
  await primeMetronomeAudio();
  rebuild();
  S.sessionStartedAt = new Date().toISOString();
  S.activeMs = 0;
  S.shownEx = -1;
  savePrefs();
  $("nowPos").innerHTML = `Position <b>${S.position}</b> &middot; index on fret ${S.position}`;
  showExercise(0);
  paintNote(0);
  show("view-run");
  await play(0, true);
}

function jump(delta){
  const cur = S.flat[S.pointer]?.ei ?? 0;
  const target = Math.min(S.exercises.length-1, Math.max(0, cur + delta));
  const idx = S.flat.findIndex(n => n.ei === target);
  const wasPlaying = S.playing;
  halt();
  S.shownEx = -1;
  paintNote(idx);
  if (wasPlaying) play(idx, false);
}

function finish(completed){
  halt();
  const seconds = Math.round(S.activeMs/1000);
  const exercisesDone = completed ? S.exercises.length : ((S.flat[S.pointer]?.ei ?? 0));
  // A finished routine always counts. An abandoned one has to be a real attempt.
  if (completed || seconds >= 10){
    addSession({
      startedAt: S.sessionStartedAt,
      seconds,
      bpm: S.bpm,
      position: S.position,
      startStroke: S.startStroke,
      groups: S.groups.slice(),
      exercisesDone,
      exercisesTotal: S.exercises.length,
      complete: !!completed,
    });
  }
  $("doneTitle").textContent = completed ? "That's the routine" : "Session saved";
  $("doneBody").innerHTML = completed
    ? `All ${S.exercises.length} exercises at position ${S.position}, starting on ${S.startStroke === "D" ? "a downstroke" : "an upstroke"}, in <b style="color:var(--off)">${fmtClock(seconds)}</b>. ` +
      `Now do it again starting on ${S.startStroke === "D" ? "an upstroke" : "a downstroke"}.`
    : `Stopped at exercise ${exercisesDone + 1} of ${S.exercises.length}. <b style="color:var(--off)">${fmtClock(seconds)}</b> logged.`;
  show("view-done");
  renderLog();
}

// ── the practice log ─────────────────────────────────────────────────────────
function readLog(){
  try {
    const raw = localStorage.getItem(LOG_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && Array.isArray(parsed.sessions)) return parsed;
  } catch (e) { /* corrupt or unavailable, start clean */ }
  return { version: 1, product: "picking-workout", sessions: [] };
}
function writeLog(log){
  try { localStorage.setItem(LOG_KEY, JSON.stringify(log)); } catch (e) {}
}
function addSession(s){
  const log = readLog();
  log.sessions.push(s);
  writeLog(log);
}
function savePrefs(){
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({
      position: S.position, startStroke: S.startStroke, groups: S.groups, bpm: S.bpm,
    }));
  } catch (e) {}
}
function loadPrefs(){
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) || "null");
    if (!p) return;
    if (p.position) S.position = p.position;
    if (p.startStroke) S.startStroke = p.startStroke;
    if (Array.isArray(p.groups) && p.groups.length) S.groups = p.groups;
    if (p.bpm) S.bpm = p.bpm;
    [...$("segPosition").children].forEach(b => b.setAttribute("aria-pressed", String(+b.dataset.v === S.position)));
    [...$("segStroke").children].forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === S.startStroke)));
    $("g2").checked = S.groups.includes(2);
    $("g3").checked = S.groups.includes(3);
    $("g4").checked = S.groups.includes(4);
    setBpm(S.bpm);
  } catch (e) {}
}

function byDay(sessions){
  const map = {};
  for (const s of sessions){
    const k = dayKey(new Date(s.startedAt));
    (map[k] = map[k] || []).push(s);
  }
  return map;
}

function streakOf(map){
  let n = 0;
  const d = new Date();
  if (!map[dayKey(d)]) d.setDate(d.getDate() - 1);   // today not practiced yet is fine
  while (map[dayKey(d)]){ n++; d.setDate(d.getDate() - 1); }
  return n;
}

// Walk the finished sessions in order. Each time all ten squares are covered
// the round closes and the grid starts empty again.
function coverageRound(sessions, positions){
  const target = positions.length * 2;
  const finished = sessions
    .filter(s => s.complete && positions.includes(s.position))
    .sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt));
  let round = 1;
  let done = new Set();
  for (const s of finished){
    done.add(s.position + s.startStroke);
    if (done.size >= target){ round++; done = new Set(); }
  }
  return { round, done };
}

function shadeFor(ms){
  const m = ms/60000;
  if (m >= 20) return "#7c3aed";
  if (m >= 10) return "rgba(124,58,237,.8)";
  if (m >= 5)  return "rgba(124,58,237,.55)";
  return "rgba(124,58,237,.28)";
}

function renderLog(){
  const log = readLog();
  const map = byDay(log.sessions);
  const totalMs = log.sessions.reduce((a,s) => a + s.seconds*1000, 0);
  const now = new Date();
  const monthMs = log.sessions
    .filter(s => { const d = new Date(s.startedAt); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth(); })
    .reduce((a,s) => a + s.seconds*1000, 0);

  $("stTotal").textContent    = totalMs ? fmtDur(totalMs) : "0m";
  $("stMonth").textContent    = monthMs ? fmtDur(monthMs) : "0m";
  $("stStreak").textContent   = String(streakOf(map));
  $("stSessions").textContent = String(log.sessions.length);

  // calendar
  const cm = S.calMonth || new Date(now.getFullYear(), now.getMonth(), 1);
  S.calMonth = cm;
  $("calTitle").textContent = cm.toLocaleString(undefined, { month: "long", year: "numeric" });
  const first = new Date(cm.getFullYear(), cm.getMonth(), 1);
  const daysIn = new Date(cm.getFullYear(), cm.getMonth()+1, 0).getDate();
  const lead = (first.getDay() + 6) % 7;   // weeks start Monday
  let html = ["M","T","W","T","F","S","S"].map(d => `<div class="dow">${d}</div>`).join("");
  for (let i=0;i<lead;i++) html += `<div class="day blank"></div>`;
  for (let d=1; d<=daysIn; d++){
    const key = dayKey(new Date(cm.getFullYear(), cm.getMonth(), d));
    const list = map[key];
    const ms = list ? list.reduce((a,s)=>a+s.seconds*1000,0) : 0;
    const isToday = key === dayKey(now);
    const cls = "day" + (list ? " done" : "") + (isToday ? " today" : "");
    const style = list ? ` style="background:${shadeFor(ms)}"` : "";
    const label = list ? `<em>${Math.max(1, Math.round(ms/60000))}m</em>` : "";
    const title = list ? `${list.length} session${list.length>1?"s":""}, ${fmtDur(ms)}` : "";
    html += `<div class="${cls}"${style} title="${title}">${d}${label}</div>`;
  }
  $("cal").innerHTML = html;

  // Coverage: five positions against the two starting strokes. Fill all ten and
  // it starts a new round, so the grid keeps meaning something instead of
  // sitting permanently full.
  const positions = (S.meta && S.meta.positions) || [1,5,9,13,17];
  const { round, done } = coverageRound(log.sessions, positions);
  const target = positions.length * 2;
  $("covRound").textContent = `Round ${round} · ${done.size} of ${target}`;

  let cov = `<div class="lbl"></div>` + positions.map(p => `<div class="lbl">Pos ${p}</div>`).join("");
  for (const stroke of ["D","U"]){
    cov += `<div class="lbl">${stroke === "D" ? "Downstroke" : "Upstroke"}</div>`;
    for (const p of positions){
      const hit = done.has(p + stroke);
      cov += `<div class="${hit ? "hit" : ""}">${hit ? "✓" : "—"}</div>`;
    }
  }
  $("coverage").innerHTML = cov;

  // recent sessions
  const recent = log.sessions.slice().sort((a,b) => new Date(b.startedAt) - new Date(a.startedAt)).slice(0, 12);
  $("recentTitle").textContent = recent.length ? "Recent sessions" : "No sessions yet";
  $("recent").innerHTML = recent.length
    ? `<tr><th>Date</th><th>Time</th><th>Position</th><th>Start</th><th>BPM</th><th>Exercises</th></tr>` +
      recent.map(s => {
        const d = new Date(s.startedAt);
        return `<tr><td>${d.toLocaleDateString(undefined,{day:"numeric",month:"short"})}</td>` +
               `<td>${fmtDur(s.seconds*1000)}</td><td>${s.position}</td>` +
               `<td>${s.startStroke === "D" ? "Down" : "Up"}</td><td>${s.bpm}</td>` +
               `<td>${s.complete ? "all " + s.exercisesTotal : s.exercisesDone + " of " + s.exercisesTotal}</td></tr>`;
      }).join("")
    : "";
}

// ── export / import ──────────────────────────────────────────────────────────
function exportLog(){
  const log = readLog();
  log.exportedAt = new Date().toISOString();
  const blob = new Blob([JSON.stringify(log, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `picking-workout-log-${dayKey(new Date())}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  $("ioMsg").className = "err ok";
  $("ioMsg").textContent = `Exported ${log.sessions.length} session${log.sessions.length === 1 ? "" : "s"}.`;
}

function importLog(file){
  const reader = new FileReader();
  reader.onload = () => {
    let incoming;
    try { incoming = JSON.parse(String(reader.result)); }
    catch (e) { $("ioMsg").className = "err"; $("ioMsg").textContent = "That file isn't valid JSON."; return; }
    if (!incoming || !Array.isArray(incoming.sessions)){
      $("ioMsg").className = "err"; $("ioMsg").textContent = "That file doesn't look like a practice log.";
      return;
    }
    // Merge rather than replace, so importing a backup never loses what is here.
    const log = readLog();
    const idOf = (s) => [s.startedAt, s.seconds, s.position, s.startStroke].join("|");
    const seen = new Set(log.sessions.map(idOf));
    let added = 0;
    for (const s of incoming.sessions){
      if (!s || !s.startedAt) continue;
      const id = idOf(s);
      if (!seen.has(id)){ log.sessions.push(s); seen.add(id); added++; }
    }
    log.sessions.sort((a,b) => new Date(a.startedAt) - new Date(b.startedAt));
    writeLog(log);
    renderLog();
    $("ioMsg").className = "err ok";
    $("ioMsg").textContent = added
      ? `Added ${added} session${added === 1 ? "" : "s"}.`
      : "Nothing new in that file, your log already had all of it.";
  };
  reader.readAsText(file);
}

// ── the gate ─────────────────────────────────────────────────────────────────
function deviceName(){
  const ua = navigator.userAgent || "";
  let os = "Browser";
  if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad/i.test(ua)) os = "iOS";
  else if (/Mac/i.test(ua)) os = "Mac";
  else if (/Win/i.test(ua)) os = "Windows";
  else if (/Linux/i.test(ua)) os = "Linux";
  return `Picking Workout – ${os}`;
}

async function callUnlock(key, instanceId){
  const res = await fetch(UNLOCK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, instanceId, deviceName: deviceName() }),
  });
  return res.json();
}

function openApp(data){
  S.meta = data.meta;
  S.allExercises = data.exercises;
  $("scr-locked").classList.add("hidden");
  $("scr-main").classList.remove("hidden");
  loadPrefs();
  setBpm(S.bpm);      // keep the sliders in step with the state, prefs or not
  rebuild();
  renderLog();
  // A first-time buyer lands on the walkthrough; everyone else on the routine.
  const firstRun = readLog().sessions.length === 0;
  if (WALKTHROUGH_VIDEO_ID){
    $("tabVideo").classList.remove("hidden");
    if (firstRun){ setTab("video"); return; }
  }
  show("view-setup");
}

async function tryStoredKey(){
  let stored = null;
  try { stored = JSON.parse(localStorage.getItem(LICENSE_KEY) || "null"); } catch (e) {}
  if (!stored || !stored.key){ $("scr-locked").classList.remove("hidden"); return; }
  try {
    const data = await callUnlock(stored.key, stored.instanceId);
    if (data.unlocked){ openApp(data); return; }
  } catch (e) { /* offline or the function is down */ }
  $("scr-locked").classList.remove("hidden");
  $("keyInput").value = stored.key;
  $("keyErr").textContent = "Couldn't confirm that key just now. Try again, or check your connection.";
}

async function unlock(){
  const key = $("keyInput").value.trim();
  if (!key){ $("keyErr").textContent = "Paste your key first."; return; }
  $("btnUnlock").disabled = true;
  $("keyErr").className = "err";
  $("keyErr").textContent = "Checking…";
  try {
    const data = await callUnlock(key, "");
    if (!data.unlocked){ $("keyErr").textContent = data.error || "That key didn't work."; return; }
    // Only present while PICKING_WORKOUT_PRODUCT_ID is unset. Tells us which
    // product the key actually belongs to, and whether it was a test order.
    if (data.unconfigured) console.log("[picking-workout] unconfigured:", data.unconfigured);
    try { localStorage.setItem(LICENSE_KEY, JSON.stringify({ key, instanceId: data.instanceId })); } catch (e) {}
    $("keyErr").textContent = "";
    openApp(data);
  } catch (e) {
    $("keyErr").textContent = "Couldn't reach the server. Check your connection and try again.";
  } finally {
    $("btnUnlock").disabled = false;
  }
}

// ── wiring ───────────────────────────────────────────────────────────────────
function setBpm(v){
  S.bpm = v;
  $("bpmVal").textContent = v; $("bpmVal2").textContent = v;
  $("tempo").value = v; $("tempo2").value = v;
  if (S.playing) engine.setBpm(v);
  if (S.flat.length) paintSetupHints();
}

seg("segPosition", v => { S.position = +v; paintSetupHints(); savePrefs(); });
seg("segStroke",   v => { S.startStroke = v; rebuild(); savePrefs(); });

["g2","g3","g4"].forEach((id, i) => {
  $(id).addEventListener("change", () => {
    const picked = [2,3,4].filter((g, gi) => $(["g2","g3","g4"][gi]).checked);
    if (!picked.length){ $(id).checked = true; return; }   // never leave it empty
    S.groups = picked;
    rebuild(); savePrefs();
  });
});

["tempo","tempo2"].forEach(id => $(id).addEventListener("input", e => setBpm(+e.target.value)));

$("btnUnlock").addEventListener("click", unlock);
$("keyInput").addEventListener("keydown", e => { if (e.key === "Enter") unlock(); });

$("btnStart").addEventListener("click", startSession);
$("btnStop").addEventListener("click", () => finish(false));
$("btnNext").addEventListener("click", () => jump(1));
$("btnPrev").addEventListener("click", () => jump(-1));
$("btnPause").addEventListener("click", async () => {
  if (S.playing){ halt(); $("btnPause").textContent = "Resume"; return; }
  const ei = (S.flat[S.pointer] || {}).ei || 0;
  const first = S.flat.findIndex(n => n.ei === ei);
  S.shownEx = -1;
  await play(first < 0 ? S.pointer : first, true);
});
$("btnAgain").addEventListener("click", () => show("view-setup"));
$("btnSeeLog").addEventListener("click", () => { setTab("log"); });

$("calPrev").addEventListener("click", () => { S.calMonth = new Date(S.calMonth.getFullYear(), S.calMonth.getMonth()-1, 1); renderLog(); });
$("calNext").addEventListener("click", () => { S.calMonth = new Date(S.calMonth.getFullYear(), S.calMonth.getMonth()+1, 1); renderLog(); });

$("btnExport").addEventListener("click", exportLog);
$("btnImport").addEventListener("click", () => $("fileInput").click());
$("fileInput").addEventListener("change", e => { if (e.target.files[0]) importLog(e.target.files[0]); e.target.value = ""; });

// The iframe is only built the first time the tab is opened, so the video
// never costs anything to someone who just wants to practise.
function mountVideo(){
  const box = $("videobox");
  if (!WALKTHROUGH_VIDEO_ID || box.dataset.mounted) return;
  box.dataset.mounted = "1";
  const f = document.createElement("iframe");
  f.src = `https://www.youtube-nocookie.com/embed/${WALKTHROUGH_VIDEO_ID}?rel=0`;
  f.title = "Walkthrough";
  f.allow = "accelerometer; encrypted-media; picture-in-picture; fullscreen";
  f.allowFullscreen = true;
  f.loading = "lazy";
  box.appendChild(f);
}

function setTab(which){
  $("tabPractice").setAttribute("aria-pressed", String(which === "practice"));
  $("tabLog").setAttribute("aria-pressed", String(which === "log"));
  $("tabVideo").setAttribute("aria-pressed", String(which === "video"));
  if (which === "log"){ renderLog(); show("view-log"); }
  else if (which === "video"){ mountVideo(); show("view-video"); }
  else { show(S.playing ? "view-run" : "view-setup"); }
}
$("tabPractice").addEventListener("click", () => setTab("practice"));
$("tabLog").addEventListener("click", () => setTab("log"));
$("tabVideo").addEventListener("click", () => setTab("video"));
$("btnToPractice").addEventListener("click", () => setTab("practice"));

// The workbook is bundled into its Netlify function rather than published, so
// it has to be fetched with the licence key and handed over as a blob.
$("btnWorkbook").addEventListener("click", async () => {
  const btn = $("btnWorkbook"), msg = $("wbMsg");
  let stored = null;
  try { stored = JSON.parse(localStorage.getItem(LICENSE_KEY) || "null"); } catch (e) {}
  if (!stored || !stored.key){ msg.className = "err"; msg.textContent = "Your key isn't stored on this device any more. Reload and paste it again."; return; }
  btn.disabled = true; msg.className = "err"; msg.textContent = "Fetching…";
  try {
    const res = await fetch(WORKBOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: stored.key, instanceId: stored.instanceId }),
    });
    if (!res.ok){
      let err = "That didn't work.";
      try { err = (await res.json()).error || err; } catch (e) {}
      msg.className = "err"; msg.textContent = err;
      return;
    }
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "The-Ultimate-Alternate-Picking-Workout-Workbook.pdf";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    msg.className = "err ok"; msg.textContent = "Downloaded.";
  } catch (e) {
    msg.className = "err"; msg.textContent = "Couldn't reach the server. Check your connection and try again.";
  } finally {
    btn.disabled = false;
  }
});

window.addEventListener("beforeunload", e => {
  if (S.playing){ e.preventDefault(); e.returnValue = ""; }
});

tryStoredKey();

// exposed for testing only
window.__app = { S, rebuild, renderLog, openApp, readLog, writeLog };
