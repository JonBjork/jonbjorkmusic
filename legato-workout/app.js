// =============================================================================
// The Ultimate Legato Warmup Routine
//
// The exercises are not in this file. They arrive from
// /.netlify/functions/legato-workout-unlock once Lemon Squeezy confirms the key.
//
// Metronome: the Practice Lab engine, byte-identical to the picking workout's
// copy except for the sample path, which reads window.__PL_SOUND_BASE.
//
// Unlike the picking workout this routine mixes note values: some blocks are
// eighths, some are triplets. The engine takes one subdivision per run, so the
// session is played as a chain of runs, one per stretch of equal note value,
// handed off seamlessly at the boundary.
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
  sel: { B: false, C: false, block: "all" },
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
const ORD = { 1:"1st", 5:"5th", 9:"9th", 13:"13th", 17:"17th" };

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

// every block of every selected section, flattened
function allBlocks(){
  const want = ["A", ...(S.sel.B ? ["B"] : []), ...(S.sel.C ? ["C"] : [])];
  return S.sections.filter(s => want.includes(s.id))
                   .flatMap(s => s.blocks.map(b => ({ ...b, sectionId: s.id, sectionName: s.name })));
}

// ── the session ──────────────────────────────────────────────────────────────
function rebuild(){
  let blocks = allBlocks();
  if (S.sel.block !== "all") blocks = blocks.filter(b => b.id === S.sel.block);

  S.exercises = [];
  blocks.forEach(b => b.exercises.forEach(ex => S.exercises.push({
    ...ex,
    blockId: b.id, blockName: b.name, sectionId: b.sectionId,
    sub: SUB[b.noteValue] || 2,
  })));

  S.flat = [];
  S.exercises.forEach((ex, ei) => ex.notes.forEach((n, ni) =>
    S.flat.push({ ...n, ei, ni, sub: ex.sub })));

  // stretches of equal note value, so each can be one metronome run
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
  const bits = ["Section A"];
  if (S.sel.B) bits.push("Section B");
  if (S.sel.C) bits.push("the 24 combinations");
  const what = S.sel.block === "all"
    ? bits.length === 1 ? bits[0] : bits.slice(0,-1).join(", ") + " and " + bits[bits.length-1]
    : (S.exercises[0] ? S.exercises[0].blockName : "One block");

  $("todayLine").textContent = `${what} · ${ORD[S.position] || S.position + "th"} position`;
  $("todayTime").innerHTML =
    `This will take <b>${fmtLong(sec)}</b> at <b>${S.bpm}</b> BPM.`;
  $("hintPos").innerHTML =
    `The tab is written at the first position, so the fret numbers are the finger numbers. ` +
    `You are playing it with the <b>index finger on fret ${S.position}</b>. ` +
    `Coming back down the strings the hand moves up one fret, which is why you will see a 5.`;
  $("hintAdd").innerHTML = S.sel.B || S.sel.C
    ? `That is <b>${fmtLong(sec)}</b> at ${S.bpm} BPM. Learn section A first, then add these.`
    : `Section A on its own is the daily warm-up. Add these when you want a longer technique session.`;
}

function paintBlockPicker(){
  const blocks = allBlocks();
  $("segBlock").innerHTML =
    `<button data-v="all" aria-pressed="${S.sel.block === "all"}">Everything</button>` +
    blocks.map(b => `<button data-v="${b.id}" aria-pressed="${S.sel.block === b.id}">${b.name}</button>`).join("");
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

  // Slurs. Everything here is legato, so any two consecutive notes on the same
  // string are a hammer-on or a pull-off and get an arc. A note that starts a
  // string is either picked or, in the first block, tapped.
  notes.forEach((note,i) => {
    const prev = notes[i-1];
    if (prev && prev.string === note.string){
      const x1 = xFor(i-1), x2 = xFor(i), y = yFor(note.string) - 13;
      svg += `<path d="M ${x1} ${y} Q ${(x1+x2)/2} ${y-9} ${x2} ${y}" fill="none" stroke="#7c3aed" stroke-width="1.5"/>`;
    }
  });

  notes.forEach((note,i) => {
    const x = xFor(i), y = yFor(note.string);
    if (note.tap){
      svg += `<text x="${x}" y="${TOP_PAD-20}" text-anchor="middle" font-size="12" font-family="Oswald,sans-serif" font-weight="600" fill="#9d5ff5">T</text>`;
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
  $("nowMode").textContent  = ex.blockName;
  const nx = S.exercises[ei+1];
  $("nextUp").textContent = nx ? `${nx.fingeringLabel.split("").join("–")} · ${nx.blockName}` : "Last one";
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
  const blocks = [...new Set(S.exercises.map(e => e.blockId))];
  // A finished routine always counts. An abandoned one has to be a real attempt.
  const saved = completed || seconds >= 10;
  if (saved){
    addSession({
      startedAt: S.sessionStartedAt,
      seconds, bpm: S.bpm, position: S.position,
      blocks, sections: [...new Set(S.exercises.map(e => e.sectionId))],
      exercisesDone, exercisesTotal: S.exercises.length,
      complete: !!completed,
    });
  }
  $("doneTitle").textContent = completed ? "That's the routine" : "Session saved";
  $("doneBody").innerHTML = completed
    ? `All ${S.exercises.length} exercises at the ${ORD[S.position] || S.position} position, in <b style="color:var(--off)">${fmtClock(seconds)}</b>. ` +
      `Next time the app will move you to the ${ORD[nextPosition()] || nextPosition()} position.`
    : `Stopped at exercise ${exercisesDone + 1} of ${S.exercises.length}. ` +
      (saved ? `<b style="color:var(--off)">${fmtClock(seconds)}</b> logged.`
             : `Too short to log, nothing saved.`);
  show("view-done");
  S.position = nextPosition();
  [...$("segPosition").children].forEach(b => b.setAttribute("aria-pressed", String(+b.dataset.v === S.position)));
  savePrefs();
  renderLog();
}

// ── position cycling ─────────────────────────────────────────────────────────
// The positions Jon actually uses, in order, skipping the 17th unless the
// player has asked for it. Whichever has gone longest without a finished
// session comes up next, so nobody has to remember where they were.
function positionsInPlay(){
  const all = (S.meta && S.meta.positions) || [1,5,9,13,17];
  const def = (S.meta && S.meta.defaultPositions) || all;
  return S.position === 17 ? all : def;
}
function nextPosition(){
  const list = positionsInPlay();
  const done = readLog().sessions.filter(s => s.complete);
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
      position: S.position, bpm: S.bpm, sel: S.sel,
    }));
  } catch (e) {}
}
function loadPrefs(){
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) || "null");
    if (p){
      if (p.position) S.position = p.position;
      if (p.bpm) S.bpm = p.bpm;
      if (p.sel) S.sel = { block: "all", ...p.sel };
    }
  } catch (e) {}
  // A finished session moves you on, so open on wherever you are due next.
  if (readLog().sessions.some(s => s.complete)) S.position = nextPosition();
  [...$("segPosition").children].forEach(b => b.setAttribute("aria-pressed", String(+b.dataset.v === S.position)));
  $("secB").checked = !!S.sel.B;
  $("secC").checked = !!S.sel.C;
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

// Coverage is blocks against positions: which parts of the routine you have
// actually played where. Fill the grid and it starts a new round.
function coverageRound(sessions, positions, blockIds){
  const target = positions.length * blockIds.length;
  const finished = sessions
    .filter(s => s.complete && positions.includes(s.position))
    .sort((a,b) => new Date(a.startedAt) - new Date(b.startedAt));
  let round = 1, done = new Set();
  for (const s of finished){
    for (const b of (s.blocks || [])){
      if (!blockIds.includes(b)) continue;
      done.add(s.position + ":" + b);
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

  const positions = (S.meta && S.meta.defaultPositions) || [1,5,9,13];
  const aBlocks = (S.sections.find(s => s.id === "A") || { blocks: [] }).blocks;
  const blockIds = aBlocks.map(b => b.id);
  const { round, done } = coverageRound(log.sessions, positions, blockIds);
  $("covRound").textContent = `Round ${round} · ${done.size} of ${positions.length * blockIds.length}`;

  let cov = `<div class="lbl"></div>` + positions.map(p => `<div class="lbl">Pos ${p}</div>`).join("");
  for (const b of aBlocks){
    cov += `<div class="lbl">${b.name.replace(" per string","")}</div>`;
    for (const p of positions){
      const hit = done.has(p + ":" + b.id);
      cov += `<div class="${hit ? "hit" : ""}">${hit ? "✓" : "—"}</div>`;
    }
  }
  $("coverage").style.gridTemplateColumns = `auto repeat(${positions.length},1fr)`;
  $("coverage").innerHTML = cov;

  const recent = log.sessions.slice().sort((a,b) => new Date(b.startedAt) - new Date(a.startedAt)).slice(0, 12);
  $("recentTitle").textContent = recent.length ? "Recent sessions" : "No sessions yet";
  $("recent").innerHTML = recent.length
    ? `<tr><th>Date</th><th>Time</th><th>Position</th><th>Ran</th><th>BPM</th><th>Exercises</th></tr>` +
      recent.map(s => {
        const d = new Date(s.startedAt);
        return `<tr><td>${d.toLocaleDateString(undefined,{day:"numeric",month:"short"})}</td>` +
               `<td>${fmtDur(s.seconds*1000)}</td><td>${s.position}</td>` +
               `<td>${(s.sections||["A"]).join(" + ")}</td><td>${s.bpm}</td>` +
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
    const idOf = (s) => [s.startedAt, s.seconds, s.position].join("|");
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
  paintBlockPicker();
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

seg("segPosition", v => { S.position = +v; paintSetup(); savePrefs(); });
$("segBlock").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  S.sel.block = b.dataset.v;
  [...$("segBlock").children].forEach(c => c.setAttribute("aria-pressed", String(c === b)));
  rebuild(); savePrefs();
});

["secB","secC"].forEach(id => $(id).addEventListener("change", () => {
  S.sel.B = $("secB").checked;
  S.sel.C = $("secC").checked;
  S.sel.block = "all";            // adding a section always means the whole thing
  paintBlockPicker();
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
