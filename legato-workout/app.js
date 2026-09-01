// =============================================================================
// The Legato Workout
//
// The exercises are not in this file. They arrive from
// /.netlify/functions/legato-workout-unlock once Lemon Squeezy confirms the key.
//
// Metronome: the Practice Lab engine, byte-identical to the picking workout's
// copy except for the sample path, which reads window.__PL_SOUND_BASE.
//
// Eighth notes throughout, so one metronome run per session. The run-chaining
// in startRun is kept because it costs nothing and the next routine may not be
// so tidy.
// =============================================================================

import { createMetronomeEngine, primeMetronomeAudio } from "/legato-workout/metronome.js";

const UNLOCK_URL   = "/.netlify/functions/legato-workout-unlock";
const WORKBOOK_URL = "/.netlify/functions/legato-workout-workbook";
const LICENSE_KEY = "jbm:legatoworkout:license";
const LOG_KEY     = "jbm:legatoworkout:log";
const PREFS_KEY   = "jbm:legatoworkout:prefs";

// Paste the YouTube id here. Leave it empty and the Walkthrough tab hides.
const WALKTHROUGH_VIDEO_ID = "";

const COUNT_IN_BEATS = 4;
const SUB = { "8ths": 2, "triplets": 3 };

const $ = (id) => document.getElementById(id);

// ── state ────────────────────────────────────────────────────────────────────
const S = {
  meta: null,
  sections: [],            // the whole routine as it came from the server
  mode: "legato",          // or "hammers"
  sel: { two: true, three: true, four: false },
  exercises: [],           // the selected ones, in order
  flat: [],                // every note of the session
  runs: [],                // [{from, to, sub}] stretches of equal note value
  position: 1,
  bpm: 50,
  pointer: 0,
  playing: false,
  shownEx: -1,
  sessionStartedAt: null,
  activeMs: 0,
  runStartedTs: null,
  calMonth: null,
};

const engine = createMetronomeEngine();

// ── helpers ──────────────────────────────────────────────────────────────────
const STRING_NAMES = { 1:"e", 2:"B", 3:"G", 4:"D", 5:"A", 6:"E" };
function ord(n){
  if (n === 1) return "1st"; if (n === 2) return "2nd"; if (n === 3) return "3rd";
  return n + "th";
}

function fmtClock(sec){
  sec = Math.max(0, Math.round(sec));
  const m = Math.floor(sec/60);
  return m + ":" + String(sec%60).padStart(2,"0");
}
function fmtLong(sec){
  sec = Math.max(0, Math.round(sec));
  const m = Math.floor(sec/60), s = sec%60;
  if (!m) return s + " seconds";
  return m + " minute" + (m===1?"":"s") + (s ? " " + s + " second" + (s===1?"":"s") : "");
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

function modeMeta(){
  return ((S.meta && S.meta.modes) || []).find(m => m.id === S.mode)
      || { name: "Normal Legato", positions: [1,5,9,13,17], blurb: "" };
}
function chosenSections(){
  return S.sections.filter(sec => S.sel[sec.id]);
}

// ── the session ──────────────────────────────────────────────────────────────
function rebuild(){
  S.exercises = [];
  chosenSections().forEach(sec => sec.exercises.forEach(ex => S.exercises.push({
    ...ex, sectionId: sec.id, sectionName: sec.name, sub: 2,
  })));

  S.flat = [];
  S.exercises.forEach((ex, ei) => ex.notes.forEach((n, ni) =>
    S.flat.push({ ...n, ei, ni, sub: 2 })));

  S.runs = [];
  for (let i = 0; i < S.flat.length; i++){
    const last = S.runs[S.runs.length - 1];
    if (last && last.sub === S.flat[i].sub) last.to = i + 1;
    else S.runs.push({ from: i, to: i + 1, sub: S.flat[i].sub });
  }
  paintSetup();
}

function sessionSeconds(bpm){
  return S.runs.reduce((a, r) => a + (r.to - r.from) * (60/bpm) / r.sub, 0);
}

function paintSetup(){
  const sec = sessionSeconds(S.bpm);
  const m = modeMeta();
  const names = chosenSections().map(x => x.name.replace(" fingers", ""));
  const what = names.length
    ? names.length === 1 ? names[0] + " fingers"
      : names.slice(0,-1).join(", ") + " and " + names[names.length-1] + " fingers"
    : "Nothing selected";

  $("todayLine").textContent = `${m.name} · ${what} · ${ord(S.position)} position`;
  $("todayTime").innerHTML = S.exercises.length
    ? `This will take <b>${fmtLong(sec)}</b> at <b>${S.bpm}</b> BPM.`
    : `Pick at least one set to play.`;
  $("btnStart").disabled = !S.exercises.length;

  $("hintMode").innerHTML = m.blurb;
  $("hintPos").innerHTML =
    `The tab is written at the first position, so the fret numbers are the finger numbers. ` +
    `You are playing it with the <b>index finger on fret ${S.position}</b>.`;

  const full = S.sel.two && (S.sel.three || S.sel.four);
  $("hintSections").innerHTML = !S.exercises.length
    ? `Pick at least one set.`
    : S.sel.two && S.sel.three && S.sel.four
      ? `All three sets. That is the long session, <b>${fmtLong(sec)}</b> at ${S.bpm} BPM.`
      : full
        ? `That is a full workout, <b>${fmtLong(sec)}</b> at ${S.bpm} BPM.`
        : `A full workout is the two-finger set plus either the three-finger or the four-finger one.`;
}

// The position buttons change with the mode: Normal Legato runs from the 1st,
// All Hammers from the 3rd so there are no open strings to mute, and neither
// goes past the 17th so nothing needs more than 20 frets.
function paintPositions(){
  const list = modeMeta().positions;
  if (!list.includes(S.position)) S.position = list[0];
  $("segPosition").innerHTML = list.map(p =>
    `<button data-v="${p}" aria-pressed="${p === S.position}">${p}</button>`).join("");
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

  // Slurs, in Normal Legato only. Anything after the first note of a string
  // visit is a hammer-on or a pull-off, so it gets an arc back to the note
  // before it. All Hammers gets no slurs; every note there is marked H.
  if (S.mode !== "hammers"){
    notes.forEach((note,i) => {
      const prev = notes[i-1];
      if (prev && prev.string === note.string && !note.stringStart){
        const x1 = xFor(i-1), x2 = xFor(i), y = yFor(note.string) - 13;
        svg += `<path class="slur" d="M ${x1} ${y} Q ${(x1+x2)/2} ${y-9} ${x2} ${y}" fill="none" stroke="#7c3aed" stroke-width="1.5"/>`;
      }
    });
  }

  notes.forEach((note,i) => {
    const x = xFor(i), y = yFor(note.string);
    // All Hammers marks every note the same, because every note is hammered,
    // including the one that starts a string with nothing behind it.
    if (S.mode === "hammers"){
      svg += `<text x="${x}" y="${TOP_PAD-20}" text-anchor="middle" font-size="12" font-family="Oswald,sans-serif" font-weight="600" fill="#8c8c8c">H</text>`;
    }
    if (note.stringStart){
      if (S.mode === "hammers"){
        /* nothing extra: the H above is the marking */
      } else {
        // Standard picking symbols: squared frame down, V up. Down going up the
        // strings, up coming back.
        const down = note.dir === "up";
        const col = down ? "#9d5ff5" : "#e8e8e8";
        svg += down
          ? `<path d="M ${x-5} ${TOP_PAD-18} L ${x-5} ${TOP_PAD-28} L ${x+5} ${TOP_PAD-28} L ${x+5} ${TOP_PAD-18}" fill="none" stroke="${col}" stroke-width="1.8" stroke-linecap="square"/>`
          : `<path d="M ${x-5} ${TOP_PAD-28} L ${x} ${TOP_PAD-18} L ${x+5} ${TOP_PAD-28}" fill="none" stroke="${col}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;
      }
    }
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
  $("nowCombo").textContent = ex.fingeringLabel.split("").join("–");
  $("nowMode").textContent  = ex.sectionName;
  const nx = S.exercises[ei+1];
  $("nextUp").textContent = nx ? `${nx.fingeringLabel.split("").join("–")} · ${nx.sectionName}` : "Last one";
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
function elapsedTo(i){
  let t = 0;
  for (const r of S.runs){
    if (i <= r.from) break;
    t += (Math.min(i, r.to) - r.from) * (60/S.bpm) / r.sub;
  }
  return t;
}

function paintNote(flatIndex){
  if (flatIndex >= S.flat.length){ finish(true); return; }
  S.pointer = flatIndex;
  const note = S.flat[flatIndex];
  if (note.ei !== S.shownEx) showExercise(note.ei);
  movePlayhead(note.ni);
  $("progBar").style.width = (flatIndex / S.flat.length * 100) + "%";
  $("timeText").textContent = fmtClock(elapsedTo(flatIndex)) + " / " + fmtClock(sessionSeconds(S.bpm));
}

function runAt(i){ return S.runs.find(r => i >= r.from && i < r.to) || S.runs[0]; }

// One metronome run per stretch of equal note value. engine.start() returns as
// soon as its scheduler is running, not when the run ends, so the handoff has
// to happen inside the tick callback: when the pointer reaches the end of the
// current stretch the engine is stopped and immediately restarted on the next
// subdivision, with no count-in. The player hears a breath between blocks and
// then a different feel, which is the point of the routine changing note value.
async function play(fromIndex, withCountIn){
  S.playing = true;
  S.runStartedTs = Date.now();
  $("btnPause").textContent = "Pause";
  await startRun(fromIndex, withCountIn);
}

async function startRun(fromIndex, withCountIn){
  const r = runAt(fromIndex);
  if (!r) { finish(true); return; }
  S.pointer = fromIndex;
  const base = fromIndex, end = r.to;
  let handedOff = false;

  await engine.start({
    bpm: S.bpm,
    subdivision: r.sub,
    countInBeats: withCountIn ? COUNT_IN_BEATS : 0,
    countInSubdivide: false,
    onCountIn: (num) => {
      $("countin").classList.remove("hidden");
      $("countinNum").textContent = String(num);
      if (num === 1) setTimeout(() => $("countin").classList.add("hidden"), (60/S.bpm)*1000);
    },
    onTick: (i) => {
      const at = base + i;
      if (at < end){ paintNote(at); return; }
      if (handedOff) return;
      handedOff = true;
      engine.stop();
      if (end >= S.flat.length){ finish(true); return; }
      // out of the audio callback before starting the next run
      setTimeout(() => { if (S.playing) startRun(end, false); }, 0);
    },
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
  const sections = [...new Set(S.exercises.map(e => e.sectionId))];
  // A finished routine always counts. An abandoned one has to be a real attempt.
  const saved = completed || seconds >= 10;
  if (saved){
    addSession({
      startedAt: S.sessionStartedAt,
      seconds, bpm: S.bpm, position: S.position, mode: S.mode, sections,
      exercisesDone, exercisesTotal: S.exercises.length,
      complete: !!completed,
    });
  }
  $("doneTitle").textContent = completed ? "That's the routine" : "Session saved";
  $("doneBody").innerHTML = completed
    ? `All ${S.exercises.length} exercises at the ${ord(S.position)} position, in <b style="color:var(--off)">${fmtClock(seconds)}</b>. ` +
      `Next time the app will move you to the ${ord(nextPosition())} position.`
    : `Stopped at exercise ${exercisesDone + 1} of ${S.exercises.length}. ` +
      (saved ? `<b style="color:var(--off)">${fmtClock(seconds)}</b> logged.`
             : `Too short to log, nothing saved.`);
  show("view-done");
  S.position = nextPosition();
  paintPositions();
  savePrefs();
  renderLog();
}

// ── position cycling ─────────────────────────────────────────────────────────
// The positions Jon actually uses, in order, skipping the 17th unless the
// player has asked for it. Whichever has gone longest without a finished
// session comes up next, so nobody has to remember where they were.
function nextPosition(){
  const list = modeMeta().positions;
  // only sessions in this mode count towards where you are due next
  const done = readLog().sessions.filter(s => s.complete && (s.mode || "legato") === S.mode);
  const lastAt = {};
  for (const s of done) lastAt[s.position] = Math.max(lastAt[s.position] || 0, +new Date(s.startedAt));
  let best = list[0], bestT = Infinity;
  for (const p of list){
    const t = lastAt[p] || 0;
    if (t < bestT){ bestT = t; best = p; }
  }
  return best;
}

// ── the practice log ─────────────────────────────────────────────────────────
function readLog(){
  try {
    const raw = localStorage.getItem(LOG_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && Array.isArray(parsed.sessions)) return parsed;
  } catch (e) {}
  return { version: 1, product: "legato-workout", sessions: [] };
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
      position: S.position, bpm: S.bpm, sel: S.sel, mode: S.mode,
    }));
  } catch (e) {}
}
function loadPrefs(){
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) || "null");
    if (p){
      if (p.position) S.position = p.position;
      if (p.bpm) S.bpm = p.bpm;
      if (p.mode) S.mode = p.mode;
      if (p.sel) S.sel = { two: true, three: true, four: false, ...p.sel };
    }
  } catch (e) {}
  // A finished session moves you on, so open on wherever you are due next.
  if (readLog().sessions.some(s => s.complete)) S.position = nextPosition();
  [...$("segMode").children].forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === S.mode)));
  paintPositions();
  $("secTwo").checked   = !!S.sel.two;
  $("secThree").checked = !!S.sel.three;
  $("secFour").checked  = !!S.sel.four;
  setBpm(S.bpm);
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
  if (!map[dayKey(d)]) d.setDate(d.getDate() - 1);
  while (map[dayKey(d)]){ n++; d.setDate(d.getDate() - 1); }
  return n;
}
function shadeFor(ms){
  const m = ms/60000;
  if (m >= 20) return "#7c3aed";
  if (m >= 10) return "rgba(124,58,237,.8)";
  if (m >= 5)  return "rgba(124,58,237,.55)";
  return "rgba(124,58,237,.28)";
}

// Coverage is the three sets against the positions, and only for the mode you
// are looking at, so it stays fifteen cells however much you have played.
// Fill the grid and it starts a new round.
function coverageRound(sessions, positions, sectionIds, mode){
  const target = positions.length * sectionIds.length;
  const finished = sessions
    .filter(s => s.complete && (s.mode || "legato") === mode && positions.includes(s.position))
    .sort((a,b) => new Date(a.startedAt) - new Date(b.startedAt));
  let round = 1, done = new Set();
  for (const s of finished){
    for (const id of (s.sections || [])){
      if (!sectionIds.includes(id)) continue;
      done.add(s.position + ":" + id);
    }
    if (done.size >= target){ round++; done = new Set(); }
  }
  return { round, done };
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

  const cm = S.calMonth || new Date(now.getFullYear(), now.getMonth(), 1);
  S.calMonth = cm;
  $("calTitle").textContent = cm.toLocaleString(undefined, { month: "long", year: "numeric" });
  const first = new Date(cm.getFullYear(), cm.getMonth(), 1);
  const daysIn = new Date(cm.getFullYear(), cm.getMonth()+1, 0).getDate();
  const lead = (first.getDay() + 6) % 7;
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

  const m = modeMeta();
  const positions = m.positions;
  const sectionIds = S.sections.map(x => x.id);
  const { round, done } = coverageRound(log.sessions, positions, sectionIds, S.mode);
  $("covRound").textContent =
    `${m.name} · round ${round} · ${done.size} of ${positions.length * sectionIds.length}`;

  let cov = `<div class="lbl"></div>` + positions.map(p => `<div class="lbl">Pos ${p}</div>`).join("");
  for (const sec of S.sections){
    cov += `<div class="lbl">${sec.name.replace(" fingers","")}</div>`;
    for (const p of positions){
      const hit = done.has(p + ":" + sec.id);
      cov += `<div class="${hit ? "hit" : ""}">${hit ? "✓" : "—"}</div>`;
    }
  }
  $("coverage").style.gridTemplateColumns = `auto repeat(${positions.length},1fr)`;
  $("coverage").innerHTML = cov;

  const recent = log.sessions.slice().sort((a,b) => new Date(b.startedAt) - new Date(a.startedAt)).slice(0, 12);
  $("recentTitle").textContent = recent.length ? "Recent sessions" : "No sessions yet";
  $("recent").innerHTML = recent.length
    ? `<tr><th>Date</th><th>Time</th><th>Mode</th><th>Position</th><th>Ran</th><th>BPM</th><th>Exercises</th></tr>` +
      recent.map(s => {
        const d = new Date(s.startedAt);
        return `<tr><td>${d.toLocaleDateString(undefined,{day:"numeric",month:"short"})}</td>` +
               `<td>${fmtDur(s.seconds*1000)}</td>` +
               `<td>${(s.mode || "legato") === "hammers" ? "Hammers" : "Legato"}</td><td>${s.position}</td>` +
               `<td>${(s.sections||[]).join(" + ")}</td><td>${s.bpm}</td>` +
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
  a.download = `legato-workout-log-${dayKey(new Date())}.json`;
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
    const log = readLog();
    const idOf = (s) => [s.startedAt, s.seconds, s.position, s.mode || "legato"].join("|");
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
  return `Legato Workout – ${os}`;
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
  S.sections = data.sections || data.exercises;
  $("scr-locked").classList.add("hidden");
  $("scr-main").classList.remove("hidden");
  loadPrefs();
  setBpm(S.bpm);
  paintPositions();
  rebuild();
  renderLog();
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
  } catch (e) {}
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
    if (data.unconfigured) console.log("[legato-workout] unconfigured:", data.unconfigured);
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
  if (S.flat.length) paintSetup();
}

$("segPosition").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  S.position = +b.dataset.v;
  [...$("segPosition").children].forEach(c => c.setAttribute("aria-pressed", String(c === b)));
  paintSetup(); savePrefs();
});
$("segMode").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  S.mode = b.dataset.v;
  [...$("segMode").children].forEach(c => c.setAttribute("aria-pressed", String(c === b)));
  // Each mode keeps its own place in the position cycle.
  S.position = nextPosition();
  paintPositions();
  paintSetup(); savePrefs();
});

["secTwo","secThree","secFour"].forEach(id => $(id).addEventListener("change", () => {
  const next = { two: $("secTwo").checked, three: $("secThree").checked, four: $("secFour").checked };
  if (!next.two && !next.three && !next.four){ $(id).checked = true; return; }   // never empty
  S.sel = next;
  rebuild(); savePrefs();
}));

["tempo","tempo2"].forEach(id => $(id).addEventListener("input", e => setBpm(+e.target.value)));

$("btnUnlock").addEventListener("click", unlock);
$("keyInput").addEventListener("keydown", e => { if (e.key === "Enter") unlock(); });

$("btnStart").addEventListener("click", startSession);
$("btnStop").addEventListener("click", () => finish(false));
$("btnNext").addEventListener("click", () => jump(1));
$("btnPrev").addEventListener("click", () => jump(-1));
$("btnPause").addEventListener("click", async () => {
  if (S.playing){ halt(); $("btnPause").textContent = "Resume"; return; }
  // Resuming restarts the exercise from its first note, after a count-in.
  const ei = (S.flat[S.pointer] || {}).ei || 0;
  const first = S.flat.findIndex(n => n.ei === ei);
  S.shownEx = -1;
  await play(first < 0 ? S.pointer : first, true);
});
$("btnAgain").addEventListener("click", () => { paintSetup(); show("view-setup"); });
$("btnSeeLog").addEventListener("click", () => setTab("log"));

$("calPrev").addEventListener("click", () => { S.calMonth = new Date(S.calMonth.getFullYear(), S.calMonth.getMonth()-1, 1); renderLog(); });
$("calNext").addEventListener("click", () => { S.calMonth = new Date(S.calMonth.getFullYear(), S.calMonth.getMonth()+1, 1); renderLog(); });

$("btnExport").addEventListener("click", exportLog);
$("btnImport").addEventListener("click", () => $("fileInput").click());
$("fileInput").addEventListener("change", e => { if (e.target.files[0]) importLog(e.target.files[0]); e.target.value = ""; });

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
  else {
    // A finished session moves the position on, so the card has to be repainted
    // rather than left showing where you were.
    if (!S.playing) paintSetup();
    show(S.playing ? "view-run" : "view-setup");
  }
}
$("tabPractice").addEventListener("click", () => setTab("practice"));
$("tabLog").addEventListener("click", () => setTab("log"));
$("tabVideo").addEventListener("click", () => setTab("video"));
$("btnToPractice").addEventListener("click", () => setTab("practice"));

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
    a.download = "Ultimate-Legato-Warmup-Routine-Cheat-Sheet.pdf";
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

window.__app = { S, rebuild, renderLog, openApp, readLog, writeLog, nextPosition };
