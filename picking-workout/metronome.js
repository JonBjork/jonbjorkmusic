// ─────────────────────────────────────────────────────────────────────────────
// SHARED METRONOME ENGINE
// ─────────────────────────────────────────────────────────────────────────────
//
// Used by Rep Tracker and Streaks. A simple metronome with subdivision and
// a count-in (4 beats by default, 2 for a half count-in). Click on the main
// beat (and during count-in); hi-hat on
// every subdivision tick (layered on the main beat when subdivision > 1).
// Same Web Audio scheduling pattern as rhythm-lab/audio.js (Chris Wilson
// lookahead) but pattern-free: every tick is rhythmically identical at a
// given subdivision.
//
// API:
//   const engine = createMetronomeEngine();
//   await engine.start({
//     bpm, subdivision,
//     countInBeats = 4,      // 2 for a half count-in; 0 skips it
//     countInSubdivide = false, // true: count-in ticks at the chosen
//                            // subdivision (hi-hat between beats), matching
//                            // what follows; false: plain beat clicks only
//     onCountIn(num),        // num = countInBeats..1 (one per count-in BEAT,
//                            // regardless of countInSubdivide)
//     onTick(idx),           // idx = 0-based tick index after count-in
//     onScheduleTick(idx),   // like onTick, but fires synchronously when the
//                            // tick is SCHEDULED (up to ~100ms before it
//                            // sounds). setSubdivision/setMuted calls made
//                            // here apply to that tick and its interval —
//                            // use it for boundary-exact changes.
//   });
//   engine.setBpm(120); engine.setSubdivision(2);
//   engine.stop();
//
// Pattern-rhythm mode (Galamian Lab):
//   await engine.startPattern({
//     bpm,
//     // pattern is an array of click positions in 16th-notes from the start of
//     // the pattern (e.g. [0, 3, 4, 7] for two long-short pairs across 2 beats).
//     // patternLength16ths is the total length of the pattern in 16th notes
//     // (e.g. 16 for a 4-beat pattern). The pattern repeats indefinitely.
//     // beatPositions16ths marks which positions are downbeats (different
//     // sound) — typically [0, 4, 8, 12] for 4 beats.
//     pattern, patternLength16ths, beatPositions16ths,
//     countInBeats = 4,
//     onCountIn(num),
//     onPatternTick({ index, positionIn16ths, isBeat, repeatNum }),
//     onPatternComplete(repeatNum),  // fired when a pattern repeat finishes
//   });
//
// ─────────────────────────────────────────────────────────────────────────────

// Sample location. Defaults to the Practice Lab path so this file stays a
// drop-in copy of practice-lab/src/shared/metronome.js; any other product sets
// window.__PL_SOUND_BASE before importing it.
const SOUND_BASE =
  (typeof window !== "undefined" && window.__PL_SOUND_BASE) || "/rhythm-lab/sounds";
const CLICK_URL = `${SOUND_BASE}/click.wav`;
const HIHAT_URL = `${SOUND_BASE}/hihat.wav`;

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SEC = 0.1;
const AUDIO_START_OFFSET = 0.1;

// Module-level singletons (one AudioContext per page).
let audioCtx = null;
let clickBuffer = null;
let hihatBuffer = null;
// Raw sample bytes, kept so a dead context can be rebuilt without refetching
// (decodeAudioData detaches its input, hence the .slice(0) copies below).
let clickData = null;
let hihatData = null;
let audioLoading = false;
let initInFlight = null;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// If the scheduler falls further behind the audio clock than this (tab was
// suspended: screen lock, app switch), we resync instead of scheduling the
// whole backlog — a catch-up burst of past-due ticks fires hundreds of
// simultaneous audio sources and callbacks at once, which can crash iOS
// Safari outright.
const MAX_BEHIND_SEC = 1;

// ── Screen wake lock ─────────────────────────────────────────────────────────
// Keep the device awake while a metronome runs. Practicing means hands on the
// instrument, not the screen — without this, iPads auto-lock mid-session and
// iOS suspends (often evicts) the page, killing the session.
let wakeLockSentinel = null;
let wakeLockWanted = false;

async function acquireWakeLock() {
  if (!("wakeLock" in navigator)) return;
  try {
    const sentinel = await navigator.wakeLock.request("screen");
    if (!wakeLockWanted) { sentinel.release().catch(() => {}); return; }
    wakeLockSentinel = sentinel;
    sentinel.addEventListener("release", () => {
      if (wakeLockSentinel === sentinel) wakeLockSentinel = null;
    });
  } catch (e) {
    wakeLockSentinel = null;
  }
}

function requestWakeLock() {
  wakeLockWanted = true;
  if (!wakeLockSentinel) acquireWakeLock();
}

function releaseWakeLock() {
  wakeLockWanted = false;
  if (wakeLockSentinel) {
    wakeLockSentinel.release().catch(() => {});
    wakeLockSentinel = null;
  }
}

// The OS drops the lock whenever the page is hidden; reacquire on return if a
// metronome is still running.
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (wakeLockWanted && document.visibilityState === "visible") acquireWakeLock();
  });
}

async function fetchSample(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return await response.arrayBuffer();
}

// The canonical iOS unlock: start a silent one-sample buffer inside the user
// gesture. Without this, WebKit can leave the context effectively muted/dead
// even after resume() appears to succeed.
function unlockKick() {
  try {
    const b = audioCtx.createBuffer(1, 1, audioCtx.sampleRate);
    const s = audioCtx.createBufferSource();
    s.buffer = b;
    s.connect(audioCtx.destination);
    s.start(0);
  } catch (e) {}
}

async function decodeSamples() {
  clickBuffer = await audioCtx.decodeAudioData(clickData.slice(0));
  hihatBuffer = await audioCtx.decodeAudioData(hihatData.slice(0));
}

// How long we let a context prove itself before calling its clock dead.
// resume() is not instant: Android tablets (and anything routing to a
// Bluetooth speaker or headphones) can take most of a second to open the
// output device, and the context sits in "suspended" the whole time. The
// old single 120ms probe read that as a failure and tore down a context
// that was about to work — which is how a tap on Start could flash the
// count-in and drop straight back to the clock.
const CLOCK_ALIVE_MS = 1500;
const CLOCK_POLL_MS = 60;

// True only if the context claims to be running AND its clock actually moves.
// After an iOS interruption (screen lock, app switch, phone call) a context
// can report "running" while currentTime is frozen — and the whole scheduler
// runs off currentTime, so a frozen clock means the count-in sticks at 4 and
// reps never count even though the React timers keep going.
//
// Polls rather than sampling once, so a slow-but-healthy start counts as
// alive. Returns as soon as the clock moves; only a genuinely dead context
// costs the full window.
async function clockIsAlive(timeoutMs = CLOCK_ALIVE_MS) {
  if (!audioCtx) return false;
  const ctx = audioCtx;          // pin it: a rebuild elsewhere must not confuse us
  const t0 = ctx.currentTime;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await sleep(CLOCK_POLL_MS);
    if (ctx !== audioCtx || ctx.state === "closed") return false;
    if (ctx.state === "running" && ctx.currentTime > t0) return true;
  }
  return false;
}

// resume() + the iOS silent-buffer unlock, together and synchronously. Must
// stay await-free: mobile browsers only honor both while the user-gesture
// activation is still live, and any await can let it expire.
function resumeAndUnlock() {
  if (!audioCtx) return;
  if (audioCtx.state !== "running") {
    try { audioCtx.resume().catch(() => {}); } catch (e) {}
  }
  unlockKick();
}

async function doInitAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) throw new Error("Web Audio API not supported");
  // A closed context can never resume. Drop it rather than probing a corpse.
  if (audioCtx && audioCtx.state === "closed") audioCtx = null;
  if (!audioCtx) audioCtx = new Ctx();

  // Resume + unlock synchronously, BEFORE any await — mobile browsers only
  // honor these while the user-gesture activation is still live, and any
  // await can let it expire.
  resumeAndUnlock();

  if (audioLoading) {
    while (audioLoading) await sleep(50);
  }
  if (!clickBuffer || !hihatBuffer) {
    audioLoading = true;
    try {
      if (!clickData || !hihatData) {
        [clickData, hihatData] = await Promise.all([
          fetchSample(CLICK_URL),
          fetchSample(HIHAT_URL),
        ]);
      }
      await decodeSamples();
    } finally {
      audioLoading = false;
    }
  }

  if (await clockIsAlive()) return true;

  // Still not moving. Nudge it once more — on a slow device the samples can
  // take long enough to fetch and decode that the resume above landed while
  // the context was still mid-construction.
  resumeAndUnlock();
  if (await clockIsAlive()) return true;

  // Genuinely dead: resume was refused (no user activation) or the clock is
  // frozen after an interruption. Rebuild from the cached sample bytes and
  // try once more. Note this runs several awaits after the tap, so the
  // gesture is usually spent by now and this only rescues the frozen-clock
  // case — it is the last resort, not the normal path.
  try { await audioCtx.close(); } catch (e) {}
  audioCtx = new Ctx();
  resumeAndUnlock();
  await decodeSamples();
  return await clockIsAlive();
}

async function runInit() {
  // Single-flight: the primer and a play press often call this concurrently
  // (pointerdown + click from the same tap); share one attempt.
  if (initInFlight) return initInFlight;
  initInFlight = (async () => {
    try {
      return await doInitAudio();
    } catch (e) {
      console.warn("Metronome audio init failed:", e);
      return false;
    } finally {
      initInFlight = null;
    }
  })();
  return initInFlight;
}

// opts.userGesture — set by engine.start(), i.e. the caller is a real tap or
// key press. Such a call must never inherit the failure of a background
// primer that was already in flight: the primer runs without user activation,
// so on mobile it always fails, and sharing its `false` would sink the very
// press that was allowed to unlock audio. Retry once on our own instead.
async function initAudio({ userGesture = false } = {}) {
  const shared = initInFlight;
  const ok = await runInit();
  if (ok || !userGesture || !shared) return ok;
  return runInit();
}

function playSample(buffer, time, volume = 1) {
  if (!buffer || !audioCtx) return;
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  if (volume !== 1) {
    const gain = audioCtx.createGain();
    gain.gain.value = volume;
    source.connect(gain).connect(audioCtx.destination);
  } else {
    source.connect(audioCtx.destination);
  }
  source.start(time);
}

export function createMetronomeEngine() {
  const state = {
    bpm: 80,
    subdivision: 1,
    running: false,
    nextNoteTime: 0,
    subdivPosition: 0,    // 0 = main beat; >0 = subdivision tick
    tickIndex: 0,         // 0-based, post-count-in
    countInRemaining: 0,  // counts down 4 -> 1; 0 means count-in done
    countInSubdivide: false, // count-in ticks at the chosen subdivision
    countInSubPos: 0,     // 0 = count-in beat; >0 = count-in subdivision tick
    schedulerId: null,
    onTick: null,
    onCountIn: null,
    onScheduleTick: null,
    pendingTimeouts: [],  // setTimeout ids for visual callbacks (so stop() can cancel)
    muted: false,         // Cycle Lab uses this for "silent" blocks: the engine
                          // keeps ticking (timing + onTick fire) but no audio
                          // is scheduled. Toggle live with setMuted(bool).
  };

  function intervalSec() {
    if (state.countInRemaining > 0) {
      return 60 / state.bpm / (state.countInSubdivide ? Math.max(1, state.subdivision) : 1);
    }
    return 60 / state.bpm / Math.max(1, state.subdivision);
  }

  function loop() {
    if (!state.running || !audioCtx) return;
    if (audioCtx.currentTime - state.nextNoteTime > MAX_BEHIND_SEC) {
      state.nextNoteTime = audioCtx.currentTime + 0.05;
    }
    const horizon = audioCtx.currentTime + SCHEDULE_AHEAD_SEC;
    while (state.nextNoteTime < horizon && state.running) {
      const isCountIn = state.countInRemaining > 0;
      // Schedule-time hook, before this tick's sound / mute / interval are
      // decided. Audio is scheduled up to SCHEDULE_AHEAD_SEC early, so the
      // audible-time onTick below is too late for boundary-exact subdivision
      // or mute changes — ticks already in the lookahead window would keep
      // the old settings (Cycle Mode's block transitions hit this).
      if (!isCountIn && state.onScheduleTick) {
        try { state.onScheduleTick(state.tickIndex); } catch (e) {}
      }
      const sub = Math.max(1, state.subdivision);
      // With countInSubdivide the count-in ticks at the same rate (and with
      // the same sounds) as playback; otherwise it stays plain beat clicks.
      const countInSub = state.countInSubdivide ? sub : 1;
      const isMainBeat = isCountIn ? state.countInSubPos === 0 : state.subdivPosition === 0;

      // Click on the beat (and during count-in). Hi-hat layered on the beat
      // when subdividing; hi-hat alone on subdivision ticks between beats.
      // When muted (Cycle Lab silent block), skip audio entirely but keep
      // firing onTick so block-boundary advancement still happens on time.
      // Count-in always sounds — it's the user's only cue that play is about
      // to begin, so a count-in inside a leading silent block would surprise.
      const audible = !state.muted || isCountIn;
      if (audible) {
        if (isMainBeat) {
          playSample(clickBuffer, state.nextNoteTime, 0.95);
          if ((isCountIn ? countInSub : sub) > 1) playSample(hihatBuffer, state.nextNoteTime, 0.6);
        } else {
          playSample(hihatBuffer, state.nextNoteTime, 0.6);
        }
      }

      const when = state.nextNoteTime;
      const delayMs = Math.max(0, (when - audioCtx.currentTime) * 1000);

      if (isCountIn) {
        const remaining = state.countInRemaining;
        // The visible countdown stays one number per beat even when the
        // count-in is subdividing.
        if (isMainBeat && state.onCountIn) {
          const tid = setTimeout(() => {
            try { if (state.onCountIn) state.onCountIn(remaining); } catch (e) {}
          }, delayMs);
          state.pendingTimeouts.push(tid);
        }
      } else {
        const idx = state.tickIndex;
        if (state.onTick) {
          const tid = setTimeout(() => {
            try { if (state.onTick) state.onTick(idx); } catch (e) {}
          }, delayMs);
          state.pendingTimeouts.push(tid);
        }
        state.tickIndex += 1;
        state.subdivPosition = (state.subdivPosition + 1) % sub;
      }

      state.nextNoteTime += intervalSec();
      if (isCountIn) {
        state.countInSubPos = (state.countInSubPos + 1) % countInSub;
        if (state.countInSubPos === 0) state.countInRemaining -= 1;
      }
    }
  }

  async function start({ bpm, subdivision, countInBeats = 4, countInSubdivide = false, onTick, onCountIn, onScheduleTick } = {}) {
    // Guard against double-start. Two rapid space presses (or one press
    // during the first-run initAudio await) would otherwise spawn two
    // setInterval schedulers on the same state — that's the "two
    // metronomes at once" bug. We use a `starting` flag because
    // `state.running` doesn't flip true until after initAudio resolves.
    if (state.running || state.starting) return false;
    state.starting = true;
    const ok = await initAudio({ userGesture: true });
    if (!ok) { state.starting = false; return false; }
    if (typeof bpm === "number") state.bpm = bpm;
    if (typeof subdivision === "number") state.subdivision = subdivision;
    state.onTick = onTick || null;
    state.onCountIn = onCountIn || null;
    state.onScheduleTick = onScheduleTick || null;
    state.countInRemaining = Math.max(0, Math.floor(countInBeats));
    state.countInSubdivide = !!countInSubdivide;
    state.countInSubPos = 0;
    state.tickIndex = 0;
    state.subdivPosition = 0;
    state.nextNoteTime = audioCtx.currentTime + AUDIO_START_OFFSET;
    state.running = true;
    state.starting = false;
    requestWakeLock();
    loop();
    state.schedulerId = setInterval(loop, LOOKAHEAD_MS);
    return true;
  }

  function stop() {
    state.running = false;
    state.starting = false;
    releaseWakeLock();
    if (state.schedulerId) clearInterval(state.schedulerId);
    state.schedulerId = null;
    // Cancel any visual callbacks already scheduled but not yet fired so a
    // late tick can't bump rep counts after we've stopped.
    for (const tid of state.pendingTimeouts) clearTimeout(tid);
    state.pendingTimeouts = [];
    state.onTick = null;
    state.onCountIn = null;
    state.onScheduleTick = null;
    state.muted = false;  // Always start the next session sounding.
    // Also stop pattern mode if it happens to be running on this engine —
    // a global stop should be safe to call on unmount regardless of mode.
    if (typeof stopPattern === "function") stopPattern();
  }

  function setBpm(bpm) {
    state.bpm = Math.max(20, Math.min(300, Math.round(bpm)));
  }
  function setSubdivision(sub) {
    state.subdivision = Math.max(1, Math.min(20, Math.round(sub)));
  }
  function setMuted(m) { state.muted = !!m; }

  // ── Pattern-rhythm mode ─────────────────────────────────────────────────
  // Schedules clicks at arbitrary 16th-note positions inside a repeating
  // pattern. Used by Galamian Lab to click out long-short, short-long, etc.
  // Shares the same Web Audio scheduling loop, but uses its own state slot
  // (patternState) so it can't tangle with the standard subdivision mode.
  const patternState = {
    running: false,
    starting: false,
    bpm: 60,
    pattern: [],            // ascending list of 16th-note positions
    patternLength16ths: 16, // total length of one pattern repeat in 16ths
    beatSet: null,          // Set of position values that are beats (downbeats)
    nextNoteTime: 0,
    pIndex: 0,              // current index inside pattern[]
    repeatNum: 0,           // 0-based: how many full pattern repeats since start
    countInRemaining: 0,
    schedulerId: null,
    pendingTimeouts: [],
    onPatternTick: null,
    onPatternComplete: null,
    onCountIn: null,
  };

  function patternIntervalSec_countIn() {
    return 60 / patternState.bpm;
  }
  function sixteenthSec() {
    // 4 sixteenths per beat. 1 beat = 60/bpm seconds.
    return (60 / patternState.bpm) / 4;
  }

  function patternLoop() {
    if (!patternState.running || !audioCtx) return;
    if (audioCtx.currentTime - patternState.nextNoteTime > MAX_BEHIND_SEC) {
      patternState.nextNoteTime = audioCtx.currentTime + 0.05;
    }
    const horizon = audioCtx.currentTime + SCHEDULE_AHEAD_SEC;

    while (patternState.running && patternState.nextNoteTime < horizon) {
      // Count-in: one click per beat, all "main beat" sound.
      if (patternState.countInRemaining > 0) {
        playSample(clickBuffer, patternState.nextNoteTime, 0.95);
        const remaining = patternState.countInRemaining;
        const when = patternState.nextNoteTime;
        const delayMs = Math.max(0, (when - audioCtx.currentTime) * 1000);
        if (patternState.onCountIn) {
          const tid = setTimeout(() => {
            try { if (patternState.onCountIn) patternState.onCountIn(remaining); } catch (e) {}
          }, delayMs);
          patternState.pendingTimeouts.push(tid);
        }
        patternState.nextNoteTime += patternIntervalSec_countIn();
        patternState.countInRemaining -= 1;
        continue;
      }

      // Pattern playback. pIndex is the current click position inside the
      // current repeat. When we reach the end of pattern[], we wrap and
      // increment repeatNum, with the next click time anchored to the start
      // of the next repeat (patternLength16ths sixteenths from the start of
      // this repeat).
      const pos = patternState.pattern[patternState.pIndex];
      const isBeat = patternState.beatSet ? patternState.beatSet.has(pos) : (pos % 4 === 0);

      if (isBeat) {
        playSample(clickBuffer, patternState.nextNoteTime, 0.95);
      } else {
        playSample(hihatBuffer, patternState.nextNoteTime, 0.7);
      }

      const when = patternState.nextNoteTime;
      const delayMs = Math.max(0, (when - audioCtx.currentTime) * 1000);
      const idxSnapshot = patternState.pIndex;
      const repeatSnapshot = patternState.repeatNum;
      if (patternState.onPatternTick) {
        const tid = setTimeout(() => {
          try {
            if (patternState.onPatternTick) {
              patternState.onPatternTick({
                index: idxSnapshot,
                positionIn16ths: pos,
                isBeat,
                repeatNum: repeatSnapshot,
              });
            }
          } catch (e) {}
        }, delayMs);
        patternState.pendingTimeouts.push(tid);
      }

      // Advance.
      const nextIdx = patternState.pIndex + 1;
      if (nextIdx >= patternState.pattern.length) {
        // Last click of this repeat. Schedule the next click at the start of
        // the next repeat (anchor to repeat-start + 0 sixteenths offset).
        const remaining16ths = patternState.patternLength16ths - pos;
        patternState.nextNoteTime += remaining16ths * sixteenthSec();
        patternState.pIndex = 0;
        patternState.repeatNum += 1;

        // Fire onPatternComplete after the audio time of the last click.
        if (patternState.onPatternComplete) {
          const completedRepeat = repeatSnapshot;
          const tid = setTimeout(() => {
            try { if (patternState.onPatternComplete) patternState.onPatternComplete(completedRepeat); } catch (e) {}
          }, delayMs);
          patternState.pendingTimeouts.push(tid);
        }
      } else {
        const nextPos = patternState.pattern[nextIdx];
        patternState.nextNoteTime += (nextPos - pos) * sixteenthSec();
        patternState.pIndex = nextIdx;
      }
    }
  }

  async function startPattern({
    bpm,
    pattern,
    patternLength16ths,
    beatPositions16ths,
    countInBeats = 4,
    onCountIn,
    onPatternTick,
    onPatternComplete,
  } = {}) {
    if (state.running || state.starting) return false;
    if (patternState.running || patternState.starting) return false;
    if (!Array.isArray(pattern) || pattern.length === 0) return false;
    if (!patternLength16ths || patternLength16ths <= 0) return false;
    patternState.starting = true;
    const ok = await initAudio({ userGesture: true });
    if (!ok) { patternState.starting = false; return false; }
    if (typeof bpm === "number") patternState.bpm = bpm;
    patternState.pattern = pattern.slice().sort((a, b) => a - b);
    patternState.patternLength16ths = patternLength16ths;
    patternState.beatSet = beatPositions16ths
      ? new Set(beatPositions16ths)
      : null;
    patternState.onCountIn = onCountIn || null;
    patternState.onPatternTick = onPatternTick || null;
    patternState.onPatternComplete = onPatternComplete || null;
    patternState.countInRemaining = Math.max(0, Math.floor(countInBeats));
    patternState.pIndex = 0;
    patternState.repeatNum = 0;
    patternState.nextNoteTime = audioCtx.currentTime + AUDIO_START_OFFSET;
    patternState.running = true;
    patternState.starting = false;
    requestWakeLock();
    patternLoop();
    patternState.schedulerId = setInterval(patternLoop, LOOKAHEAD_MS);
    return true;
  }

  function stopPattern() {
    patternState.running = false;
    patternState.starting = false;
    if (!state.running) releaseWakeLock();
    if (patternState.schedulerId) clearInterval(patternState.schedulerId);
    patternState.schedulerId = null;
    for (const tid of patternState.pendingTimeouts) clearTimeout(tid);
    patternState.pendingTimeouts = [];
    patternState.onPatternTick = null;
    patternState.onPatternComplete = null;
    patternState.onCountIn = null;
  }

  function setPatternBpm(bpm) {
    patternState.bpm = Math.max(20, Math.min(300, Math.round(bpm)));
  }

  return {
    start,
    stop,
    setBpm,
    setSubdivision,
    setMuted,
    isRunning: () => state.running,
    startPattern,
    stopPattern,
    setPatternBpm,
    isPatternRunning: () => patternState.running,
  };
}

// Pre-warm audio on first user interaction so the count-in starts cleanly.
// Safe to call from anywhere; no-ops if already initialized.
export async function primeMetronomeAudio() {
  return initAudio();
}

// Attach listeners that prime audio on the first user interactions, retrying
// until the context is confirmed alive. pointerdown alone is not enough:
// WebKit only treats touchend/click (and keydown) as audio-unlock gestures,
// which is why iPads/iPhones used to start a session with a dead scheduler.
// Returns a detach function for use as a useEffect cleanup.
export function attachAudioPrimer() {
  const events = ["pointerdown", "touchend", "click", "keydown"];
  let detached = false;
  const detach = () => {
    detached = true;
    events.forEach(e => window.removeEventListener(e, onAny));
  };
  const onAny = () => {
    primeMetronomeAudio().then(ok => {
      if (ok && !detached) detach();
    });
  };
  events.forEach(e => window.addEventListener(e, onAny));
  return detach;
}
