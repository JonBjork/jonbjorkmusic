import WorkoutProgress from './WorkoutProgress';
import FingerLegatoWorkout from './FingerLegatoWorkout';
import {catalog} from '../../routines/catalog';
import NpsWorkout from './NpsWorkout';
import Tuning from './Tuning';
import MetronomeSubdivisions, {readSubdivision} from './MetronomeSubdivisions';
// ─────────────────────────────────────────────────────────────────────────────
// WORKOUTS
// ─────────────────────────────────────────────────────────────────────────────
//
// The workouts Jon publishes, run in time with the tab on screen. Same app as
// the standalone at jonbjorkmusic.com/picking-workout, living inside Practice
// Lab so a member never has to keep a second practice log.
//
// Logging is deliberately double. The section keeps its own log — calendar,
// coverage grid, export and import — and every finished session ALSO writes one
// addEvent into the cross-lab log, so the time lands in the Dashboard's streak
// and totals like any other lab.
//
// Each workout says how it ticks. The picking routine runs in eighths
// (subdivision 2: click on the beat, hi-hat on the offbeat) with no picker, on
// purpose — it is about accuracy. A piece runs in sixteenths and is chunked:
// every chunk lands on the downbeat of the bar after it, the engine halts on
// that note, and after a bar of silence the next chunk counts itself in. A
// piece can also sound its tab through the plucked-string synth, scheduled on
// the metronome's own clock, and lets the player choose which subdivision the
// click sounds on.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBarRatings } from "./barRatings";
import { readPause, chunkPauseSeconds, estimatePieceSeconds } from "./timing";
import RatingControl from "./RatingControl";
import LiveBarRating from "./LiveBarRating";
import RatedBars from "./RatedBars";
import PieceSetup from "./PieceSetup";
import PracticeRoomSessions from "./PracticeRoomSessions";
import PickingSetup, { PatternRating } from "./PickingSetup";
import { pickingCoverageRound } from "./pickingProgress";
import "./piece-workspace.css";

import { createMetronomeEngine, attachAudioPrimer, primeMetronomeAudio, getAudioContext } from "../shared/metronome";
import VolumeControls, { volumePercent } from "./VolumeControls";
import { pluck, stopGuitar, setInstrumentVolume as applyInstrumentVolume } from "./guitarSynth";
import {SessionProvider,useSessionReporter} from "../shared/sessionEvents";
import TabView from "./TabView";
import { WORKOUTS, getWorkout } from "./routines";
import {
  C, MIN_LOGGED_SEC,
  readLog, addSession, readPrefs, workoutPrefs, saveWorkoutPrefs,
  sessionsByDay, streakOf, dayKey, fmtClock, fmtDur, shadeFor,
  exportLog, importLog,
} from "./storage";

const COUNT_IN_BEATS = 4;       // for a workout that does not say how long its bars are
const RING_MS = 700;            // let a piece's final note ring before the summary
const NPB_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8].map(n => ({ v: n, label: String(n) }));
const LOOP_OPTIONS = [{ v: "off", label: "Off" }, { v: "reps", label: "Reps" }, { v: "timer", label: "Timer" }];

const WK_STYLES = `
  .wk-cal { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; max-width: 560px; }
  .wk-cov { display: grid; grid-template-columns: auto repeat(5, 1fr); gap: 6px; max-width: 620px; }
  .wk-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 18px; }
  .wk-stats { display: flex; gap: 14px; flex-wrap: wrap; }
  .wk-stats > div { flex: 1; min-width: 150px; }
  .wk-bars { display: grid; grid-template-columns: repeat(auto-fill, minmax(42px, 1fr)); gap: 5px; max-width: 640px; }
  @media (max-width: 640px) { .wk-tempo input { width: 130px !important; } }
`;

// ── small shared bits ────────────────────────────────────────────────────────

function ToolHeader({ title, onBack }) {
  return (
    <div style={{
      background: "rgba(13,13,13,0.96)",
      borderBottom: `1px solid ${C.border}`,
      backdropFilter: "blur(12px)",
      position: "sticky", top: 0, zIndex: 30,
    }}>
      <div style={{
        maxWidth: 1280, margin: "0 auto", padding: "20px 32px",
        display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
      }}>
        <button onClick={onBack} style={{
          background: "transparent", color: C.muted, border: `1px solid ${C.border}`,
          borderRadius: 8, padding: "8px 14px", cursor: "pointer",
          fontFamily: "'Oswald',sans-serif", fontSize: "0.78rem",
          letterSpacing: "0.18em", textTransform: "uppercase", flexShrink: 0,
        }}>← Home</button>
        <span style={{
          fontFamily: "'Oswald',sans-serif", fontWeight: 700,
          letterSpacing: "0.06em", textTransform: "uppercase",
          fontSize: "1.4rem", color: C.white, lineHeight: 1,
        }}>{title}</span>
      </div>
    </div>
  );
}

const panel = {
  background: C.card, border: `1px solid ${C.border}`,
  borderRadius: 10, padding: "22px 24px", marginBottom: 16,
};
const label = {
  fontFamily: "'Oswald',sans-serif", fontSize: "0.78rem", letterSpacing: "0.18em",
  textTransform: "uppercase", color: C.muted, marginBottom: 8, display: "block",
};
const btn = (variant) => ({
  background: variant === "ghost" ? "transparent" : C.purple,
  color: variant === "ghost" ? C.muted : "#fff",
  border: variant === "ghost" ? `1px solid ${C.border}` : 0,
  borderRadius: 7, padding: variant === "sm" ? "9px 16px" : "13px 26px",
  fontFamily: "'Oswald',sans-serif", fontSize: variant === "sm" ? "0.82rem" : "0.98rem",
  letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer",
});

function Seg({ options, value, onChange }) {
  return (
    <div style={{
      display: "flex", border: `1px solid ${C.border}`, borderRadius: 7,
      overflow: "hidden", width: "fit-content",
    }}>
      {options.map((o, i) => {
        const on = String(o.v) === String(value);
        return (
          <button
            key={o.v}
            onClick={() => onChange(o.v)}
            style={{
              background: on ? C.purple : C.card2,
              color: on ? "#fff" : C.muted,
              border: 0,
              borderRight: i === options.length - 1 ? 0 : `1px solid ${C.border}`,
              padding: "10px 16px", cursor: "pointer",
              fontFamily: "'Oswald',sans-serif", fontSize: "0.88rem", letterSpacing: "0.06em",
            }}
          >{o.label}</button>
        );
      })}
    </div>
  );
}

// − / number / + for a bar count. Typing is allowed, and clamped.
function Stepper({ value, min, max, onChange }) {
  const clamp = (v) => Math.max(min, Math.min(max, Math.round(Number(v)) || min));
  const side = {
    background: C.card2, color: C.muted, border: 0, cursor: "pointer",
    padding: "9px 15px", fontFamily: "'Oswald',sans-serif", fontSize: "1rem",
  };
  return (
    <div style={{
      display: "flex", alignItems: "stretch", border: `1px solid ${C.border}`,
      borderRadius: 7, overflow: "hidden", width: "fit-content",
    }}>
      <button onClick={() => onChange(clamp(value - 1))} style={side} aria-label="fewer">−</button>
      <input
        type="number" min={min} max={max} value={value}
        onChange={e => onChange(clamp(e.target.value))}
        style={{
          width: 58, textAlign: "center", background: C.card, color: C.off,
          border: 0, borderLeft: `1px solid ${C.border}`, borderRight: `1px solid ${C.border}`,
          fontFamily: "'Oswald',sans-serif", fontSize: "1.05rem", fontWeight: 600,
        }}
      />
      <button onClick={() => onChange(clamp(value + 1))} style={side} aria-label="more">+</button>
    </div>
  );
}

function Tempo({ bpm, onChange }) {
  return (
    <div className="wk-tempo" style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <input
        type="range" min="40" max="200" step="1" value={bpm}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: 200, accentColor: C.purple }}
      />
      <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: "1.6rem", fontWeight: 600, minWidth: 88 }}>
        {bpm}
        <em style={{ fontStyle: "normal", fontSize: "0.7rem", color: C.dim, letterSpacing: "0.14em", marginLeft: 5 }}>BPM</em>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function Workouts({onSession,...props}) {
 return <SessionProvider value={onSession}><WorkoutLibrary {...props}/></SessionProvider>;
}
function WorkoutLibrary({ onBack }) {
 const addEvent=useSessionReporter();
  const initialId = useRef(getWorkout(readPrefs().workoutId).id).current;
  const prefs = useRef(workoutPrefs(getWorkout(initialId))).current;
  const enhanced = true;

  const [collection, setCollection] = useState(null);
  const [screen, setScreen]   = useState("list");   // list | setup | run | done | log
  const [workoutId, setWorkoutId] = useState(initialId);
  const [position, setPosition]   = useState(prefs.position || 1);
  const [startStroke, setStroke]  = useState(prefs.startStroke || "D");
  const [groups, setGroups]       = useState(prefs.groups && prefs.groups.length ? prefs.groups : [2, 3, 4]);
  const [bpm, setBpm]             = useState(prefs.bpm || (enhanced ? 60 : 50));   // start slow
  // Piece settings. The click subdivision is how many ticks per beat SOUND;
  // the tab always advances every tick.
  const [chunkSize, setChunkSize] = useState(prefs.chunkSize || 1);
  const [startBar, setStartBar]   = useState(prefs.startBar || 1);
  const [endBar, setEndBar] = useState(prefs.endBar || getWorkout(initialId).piece?.bars.length || 1);
  const [instrumentVolume, setInstrumentVolume] = useState(volumePercent(prefs.instrumentVolume));
  const [metronomeVolume, setMetronomeVolume] = useState(volumePercent(prefs.metronomeVolume));
  const [tone, setTone] = useState(prefs.tone || "piano");
  const [sound, setSound]         = useState(prefs.sound !== false);
  const [clickOn, setClickOn]     = useState(prefs.clickOn !== false);
  const [clickEvery, setClickEvery] = useState(prefs.clickEvery === "all" ? "all" : "beat");
  const [clickSubdivision,setClickSubdivision]=useState(readSubdivision(prefs.clickSubdivision,readSubdivision(prefs.notesPerBeat)));
  const [notesPerBeat, setNotesPerBeat] = useState(prefs.notesPerBeat || 4);
  // How a chunk repeats before the run moves on: not at all, a number of
  // passes, or as many passes as fit in a number of minutes.
  const [loopMode, setLoopMode]   = useState(["off", "reps", "timer"].includes(prefs.loopMode) ? prefs.loopMode : "reps");
  const [loopReps, setLoopReps]   = useState(prefs.loopReps || 4);
  const [loopMin, setLoopMin]     = useState(prefs.loopMin || 3);
  const [repsDone, setRepsDone]   = useState(0);
  const [now, setNow]             = useState(Date.now());
  const [gapNext, setGapNext]     = useState(null);   // label of the chunk about to count in
  // Count-in: a full bar or two beats, plain clicks or the chosen
  // subdivision. Same two choices the Technique Lab offers.
  const [pauseSeconds, setPauseSeconds] = useState(readPause(prefs.pauseSeconds));
  const pauseRef = useRef(pauseSeconds); pauseRef.current = pauseSeconds;
  const [countInChoice, setCountInChoice] = useState(prefs.countIn === 2 ? 2 : "bar");
  const [countInSubdiv, setCountInSubdiv] = useState(prefs.countInSubdiv === true);

  const [practiceMode,setPracticeMode]=useState(prefs.practiceMode || "full");
  const [focusCombo,setFocusCombo]=useState(prefs.focusCombo || "12");
  const [focusCrossing,setFocusCrossing]=useState(prefs.focusCrossing || "arpeggiated");
  const [bothStrokes,setBothStrokes]=useState(prefs.bothStrokes===true);
  const seenNotes=useRef(new Map());
  const patternsPlayed=useRef(new Map());
  const [cursor, setCursor]   = useState(0);
  const [playing, setPlaying] = useState(false);
  const [countIn, setCountIn] = useState(null);
  const [logTick, setLogTick] = useState(0);        // bump to re-read the log
  const [calMonth, setCalMonth] = useState(() => {
    const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [summary, setSummary] = useState(null);
  const [ioMsg, setIoMsg] = useState("");

  const assessment = useBarRatings(workoutId);
  const touchedBars = useRef(new Set());
  const completedBars = useRef(new Set());
  const completedChunks = useRef(new Set());
  const finishedRef = useRef(false);
  const workout = getWorkout(workoutId);
  const isPiece = workout.kind === "piece";
  // A piece ticks at whatever the player chose per beat; a routine as written.
  const chunked = isPiece || practiceMode === "focus";
  const resolution = isPiece ? workout.piece.ticksPerSixteenth || 1 : 1;
  const ticksPerBeat = isPiece ? notesPerBeat * resolution : (workout.ticksPerBeat || 2);
  const beatsPerBar = workout.beatsPerBar || COUNT_IN_BEATS;
  const totalBars = isPiece ? workout.piece.bars.length : 0;

  const exercises = useMemo(
    () => workout.build({ startStroke, groups, practiceMode, focusCombo, focusCrossing, bothStrokes, position, chunkSize, startBar, endBar: enhanced ? endBar : undefined }),
    [workout, startStroke, groups, practiceMode, focusCombo, focusCrossing, bothStrokes, position, chunkSize, startBar, endBar, enhanced]
  );
  const flat = useMemo(() => {
    const out = [];
    exercises.forEach((ex, ei) => ex.notes.forEach((n, ni) => out.push({ ...n, ei, ni })));
    return out;
  }, [exercises]);

  const engineRef = useRef(null);
  if (!engineRef.current) engineRef.current = createMetronomeEngine();

  useEffect(()=>{applyInstrumentVolume(getAudioContext(),instrumentVolume/100);},[instrumentVolume]);
  useEffect(()=>{engineRef.current.setVolume(metronomeVolume/100);},[metronomeVolume]);

  const flatRef      = useRef(flat);      flatRef.current = flat;
  const baseRef      = useRef(0);
  const activeMsRef  = useRef(0);
  const runStartRef  = useRef(null);
  const startedAtRef = useRef(null);
  const finishRef    = useRef(() => {});
  const playRef      = useRef(() => {});
  const fileRef      = useRef(null);
  const exercisesRef = useRef(exercises); exercisesRef.current = exercises;
  const bpmRef       = useRef(bpm);       bpmRef.current = bpm;
  const soundRef     = useRef(sound);     soundRef.current = sound;
  const clickOnRef   = useRef(clickOn);   clickOnRef.current = clickOn;
  const loopRef      = useRef({});        loopRef.current = { mode: chunked ? loopMode : "off", reps: loopReps, min: loopMin };
  const repsRef      = useRef(0);         // passes finished on the current chunk
  const chunkStartRef = useRef(null);     // when the current chunk's first pass began
  // Between chunks: the index the next chunk starts at, and the timer that
  // will count it in. halt() clears the timer; resume() uses the index.
  const gapRef       = useRef(null);

  useEffect(() => attachAudioPrimer(), []);
  // Leaving the section (Home) mid-run: stop the engine AND the timers that
  // would otherwise start the next pass after the screen is gone, with no
  // Pause left to press. That was the "it keeps looping" bug.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;     // StrictMode runs this cleanup once on mount, too
    return () => {
      mountedRef.current = false;
      stopGuitar();
      if (gapRef.current && gapRef.current.timer) clearTimeout(gapRef.current.timer);
      gapRef.current = null;
      try { engineRef.current.stop(); } catch (e) {}
    };
  }, []);

  useEffect(() => {
    // Tempo is remembered per workout as well: a routine at 50 and a piece
    // at 60 should each come back where they were left.
    saveWorkoutPrefs(workoutId, {
      practiceMode, focusCombo, focusCrossing, bothStrokes, position, startStroke, groups, bpm, chunkSize, startBar, endBar, tone,
      instrumentVolume, metronomeVolume, sound, clickOn, clickEvery, clickSubdivision,
      notesPerBeat, loopMode, loopReps, loopMin, pauseSeconds, countIn: countInChoice, countInSubdiv,
    });
  }, [practiceMode, focusCombo, focusCrossing, bothStrokes, workoutId, position, startStroke, groups, bpm, chunkSize, startBar, endBar, tone, instrumentVolume, metronomeVolume, sound, clickOn, clickEvery, clickSubdivision,
      notesPerBeat, loopMode, loopReps, loopMin, pauseSeconds, countInChoice, countInSubdiv]);
  const countInBeats = countInChoice === 2 ? 2 : beatsPerBar;

  // A half-second clock while running, for the session time and the loop timer.
  useEffect(() => {
    if (screen !== "run") return undefined;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [screen]);

  const secPerNote = (60 / bpm) / ticksPerBeat;
  const gapSec = chunkPauseSeconds({fixed:enhanced,pauseSeconds,bpm,beatsPerBar});          // the silence before each count-in
  const totalSec = useMemo(() => {
    if (!chunked) return flat.length * secPerNote + (bothStrokes?2:1)*countInBeats*60/bpm + (bothStrokes?gapSec:0);
    return estimatePieceSeconds({exercises,bpm,notesPerBeat:ticksPerBeat,countInBeats,pauseSeconds:gapSec,loopMode,loopReps,loopMin});
  }, [isPiece, chunked, bothStrokes, flat.length, secPerNote, loopMode, loopMin, loopReps, exercises, gapSec, countInBeats, bpm, ticksPerBeat]);

  // ── transport ──────────────────────────────────────────────────────────────

  const halt = useCallback(() => {
    stopGuitar();
    try { engineRef.current.stop(); } catch (e) {}
    if (gapRef.current && gapRef.current.timer) {
      clearTimeout(gapRef.current.timer);
      gapRef.current.timer = null;
    }
    setGapNext(null);
    if (runStartRef.current) {
      activeMsRef.current += Date.now() - runStartRef.current;
      runStartRef.current = null;
    }
    setPlaying(false);
    setCountIn(null);
  }, []);

  const play = useCallback(async (fromIndex, withCountIn) => {
    if (!mountedRef.current) return;
    gapRef.current = null;
    setGapNext(null);
    baseRef.current = fromIndex;
    setCursor(fromIndex);
    setPlaying(true);
    // Still set from before the gap when a chunk counts itself in; the gap
    // is practice time too.
    if (!runStartRef.current) runStartRef.current = Date.now();
    if (!chunkStartRef.current) chunkStartRef.current = Date.now();
    const stopBetween = true;
    // stop() resets the mute, so it is set again before every start. The
    // count-in sounds regardless: it is the only cue that play is coming.
    try { engineRef.current.setMuted(!clickOnRef.current); } catch (e) {}
    await engineRef.current.start({
      bpm,
      subdivision: ticksPerBeat,
      audibleSubdivision: clickEvery === "all" ? (isPiece ? clickSubdivision : ticksPerBeat) : 1,
      countInBeats: withCountIn ? countInBeats : 0,
      countInSubdivide: countInSubdiv,
      countInSubdivision: isPiece ? clickSubdivision : ticksPerBeat,
      onCountIn: (num) => setCountIn(num),
      // Schedule time. The tab's sound goes on the metronome's clock here so
      // it lands on the click, and a chunked workout halts before the tick
      // after its landing note so no stray click follows it.
      onScheduleTick: (i, when) => {
        const list = flatRef.current;
        const idx = baseRef.current + i;
        const col = list[idx];
        if (!col) return !stopBetween;
        if (stopBetween && i > 0 && list[idx - 1].last) return false;
        if (soundRef.current && col.midi) {
          const ctx = getAudioContext();
          const secs = (col.len || 1) * (60 / bpmRef.current) / ticksPerBeat;
          col.midi.forEach((m, k) => pluck(ctx, m, when + k * 0.012, secs, 0.5));
        }
        return true;
      },
      onTick: (i) => {
        const list = flatRef.current;
        const idx = baseRef.current + i;
        if (idx >= list.length) { finishRef.current(true); return; }
        setCountIn(null);
        setCursor(idx);
        if (list[idx].bar && !list[idx].landing) touchedBars.current.add(list[idx].bar);
        if (list[idx].barEnd) completedBars.current.add(list[idx].barEnd);
        if(!isPiece) {
          const col=list[idx], exercise=exercisesRef.current[col.ei];
          const visited=seenNotes.current.get(exercise.id)||new Set();visited.add(col.ni);seenNotes.current.set(exercise.id,visited);
          if(visited.size===exercise.notes.length)patternsPlayed.current.set(exercise.id,{id:exercise.baseId,stroke:exercise.startStroke});
        }
        if (!list[idx].last) return;
        // Landed. One pass done: go round again if the loop says so, else
        // on to the next chunk, else the piece is over. Either way a bar of
        // silence, then the count-in.
        const cur = list[idx].ei;
        completedChunks.current.add(cur);
        const loop = loopRef.current;
        repsRef.current += 1;
        setRepsDone(repsRef.current);
        const elapsedMs = Date.now() - (chunkStartRef.current || Date.now());
        const again = loop.mode === "reps" ? repsRef.current < loop.reps
          : loop.mode === "timer" ? elapsedMs < loop.min * 60000
          : false;
        let next;
        if (again) {
          next = list.findIndex(c => c.ei === cur);
        } else {
          next = idx + 1;
          if (next >= list.length) {
            gapRef.current = { next: null, timer: setTimeout(() => { if (mountedRef.current) finishRef.current(true); }, RING_MS) };
            return;
          }
          repsRef.current = 0;
          setRepsDone(0);
          chunkStartRef.current = null;
        }
        const nextEx = exercisesRef.current[list[next].ei];
        setGapNext(nextEx ? (again ? `${nextEx.label} again` : nextEx.label) : null);
        const gapMs = chunkPauseSeconds({fixed:enhanced,pauseSeconds:pauseRef.current,bpm:bpmRef.current,beatsPerBar}) * 1000;
        gapRef.current = { next, timer: setTimeout(() => { if (mountedRef.current) playRef.current(next, true); }, gapMs) };
      },
    });
  }, [bpm, workout, isPiece, ticksPerBeat, beatsPerBar, clickEvery, countInBeats, countInSubdiv, enhanced, notesPerBeat, clickSubdivision]);
  playRef.current = play;

  const finish = useCallback((completed) => {
    if(finishedRef.current)return;finishedRef.current=true;
    halt();
    const seconds = Math.round(activeMsRef.current / 1000);
    const list = flatRef.current;
    const done = isPiece ? completedChunks.current.size : patternsPlayed.current.size;
    const playedPatterns=[...patternsPlayed.current.values()];
    const fullyPlayed = completed && (isPiece || done===exercises.length);
    // For a piece: the bars actually played through, first to last.
    const barsPlayed = [...completedBars.current].sort((a,b)=>a-b);
    const barsDone = barsPlayed.length && barsPlayed.every((b,i)=>b===barsPlayed[0]+i) ? [barsPlayed[0],barsPlayed[barsPlayed.length-1]] : null;
    const saved = completed || seconds >= MIN_LOGGED_SEC;

    if (saved) {
      const session = {
        startedAt: startedAtRef.current || new Date().toISOString(),
        workoutId, workoutTitle: workout.title,
        seconds, bpm, position, startStroke, groups: groups.slice(),
        chunkSize, startBar, endBar, barsDone, barsPlayed, notesPerBeat, loopMode,
        exercisesDone: done, exercisesTotal: exercises.length,
        complete: !!fullyPlayed, patternsPlayed:isPiece?undefined:playedPatterns, practiceMode, bothStrokes,
      };
      addSession(session);
      // The cross-lab log. durationSec is the field the Dashboard totals, and
      // lab: "workouts" is what gives the card its "last practiced" stamp.
      addEvent({
        lab: "workouts",
        kind: "session",
        payload: {
          workoutId,
          workoutName: workout.short || workout.title,
          position, startStroke, bpm,
          barsDone, barsPlayed,
          exercisesDone: done,
          exercisesTotal: exercises.length,
          complete: !!fullyPlayed, patternsPlayed:isPiece?undefined:playedPatterns,
          durationSec: seconds,
        },
      });
      setLogTick(t => t + 1);
    }
    setSummary({ patternsPlayed:playedPatterns, completed: !!fullyPlayed, saved, barsPlayed, currentChunk:(list[cursor]?.ei || 0)+1, seconds, done, total: exercises.length, assessedBars: [...touchedBars.current].sort((a,b)=>a-b), bpm, notesPerBeat });
    setScreen("done");
  }, [halt, cursor, exercises, workoutId, workout, bpm, position, startStroke, groups, isPiece, chunkSize, startBar, endBar, notesPerBeat, loopMode, practiceMode, bothStrokes]);
  finishRef.current = finish;

  const startSession = useCallback(async () => {
    await primeMetronomeAudio();
    activeMsRef.current = 0;seenNotes.current.clear();patternsPlayed.current.clear();
    touchedBars.current.clear();completedBars.current.clear();completedChunks.current.clear();finishedRef.current=false;
    startedAtRef.current = new Date().toISOString();
    repsRef.current = 0;
    setRepsDone(0);
    chunkStartRef.current = null;
    setScreen("run");
    await play(0, true);
  }, [play]);

  const jump = useCallback((delta) => {
    const list = flatRef.current;
    const cur = (list[cursor] || {}).ei || 0;
    const target = Math.min(exercises.length - 1, Math.max(0, cur + delta));
    const idx = list.findIndex(n => n.ei === target);
    const wasPlaying = playing;
    halt();
    setCursor(idx);
    repsRef.current = 0;              // a fresh chunk, a fresh loop
    setRepsDone(0);
    chunkStartRef.current = null;
    if (wasPlaying) play(idx, true);   // a chunk always gets its count-in
  }, [cursor, exercises.length, playing, halt, play, workout]);

  // Picking up mid-exercise from a standing start does not work, so resuming
  // restarts the exercise you paused in, from its first note, after a count-in.
  const resume = useCallback(() => {
    const list = flatRef.current;
    // Paused in the gap after a chunk: carry on with the next one.
    if (gapRef.current && gapRef.current.next != null) { play(gapRef.current.next, true); return; }
    const ei = (list[cursor] || {}).ei || 0;
    const first = list.findIndex(n => n.ei === ei);
    play(first < 0 ? cursor : first, true);
  }, [cursor, play]);

  const changeBpm = useCallback((v) => {
    setBpm(v);
    bpmRef.current = v;
    if (playing) { try { engineRef.current.setBpm(v); } catch (e) {} }
  }, [playing]);

  const changeClickEvery = useCallback((v) => {
    setClickEvery(v);
    if (playing) { try { engineRef.current.setAudibleSubdivision(v === "all" ? (isPiece ? clickSubdivision : ticksPerBeat) : 1); } catch (e) {} }
  }, [playing, clickSubdivision, isPiece, ticksPerBeat]);
  const changeClickSubdivision = useCallback(v => {
    setClickSubdivision(v);
    engineRef.current.setAudibleSubdivision(clickEvery === 'all' ? v : 1);
  }, [clickEvery]);
  const changeClickOn = useCallback((on) => {
    setClickOn(on);
    if (playing) { try { engineRef.current.setMuted(!on); } catch (e) {} }
  }, [playing]);

  // ── log views ──────────────────────────────────────────────────────────────

  const log = useMemo(() => readLog(), [logTick, screen]);
  // Progress is per workout: the calendar, the streak and the coverage grid all
  // answer "how am I doing on THIS one", so they only count its own sessions.
  const sessions = useMemo(
    () => log.sessions.filter(s => s.workoutId === workoutId),
    [log, workoutId]
  );
  const byDay = useMemo(() => sessionsByDay(sessions), [sessions]);
  const totals = useMemo(() => {
    const now = new Date();
    const allMs = sessions.reduce((a, s) => a + s.seconds * 1000, 0);
    const monthMs = sessions
      .filter(s => {
        const d = new Date(s.startedAt);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      })
      .reduce((a, s) => a + s.seconds * 1000, 0);
    return { allMs, monthMs, streak: streakOf(byDay), count: sessions.length };
  }, [sessions, byDay]);

  function doImport(file) {
    const reader = new FileReader();
    reader.onload = () => {
      let parsed = null;
      try { parsed = JSON.parse(String(reader.result)); }
      catch (e) { setIoMsg("That file isn't valid JSON."); return; }
      const res = importLog(parsed);
      if (!res.ok) { setIoMsg(res.error); return; }
      setLogTick(t => t + 1);
      setIoMsg(res.added
        ? `Added ${res.added} session${res.added === 1 ? "" : "s"}.`
        : "Nothing new in that file, your log already had all of it.");
    };
    reader.readAsText(file);
  }

  // ── render ─────────────────────────────────────────────────────────────────

  // The Practice tab covers setup, run and done.
  const isTab = (k) => k === screen || (k === "setup" && ["run", "done"].includes(screen));

  const ex = exercises[(flat[cursor] || {}).ei || 0];
  const nextEx = exercises[((flat[cursor] || {}).ei || 0) + 1];


  if (screen === "progress") return <WorkoutProgress onBack={()=>setScreen("list")}/>;
  if (collection === "finger-legato" && screen === "list") return <FingerLegatoWorkout onBack={()=>setCollection(null)}/>;
  if (collection === "chops-legato-1" && screen === "list") return <NpsWorkout legato onBack={()=>setCollection("chops-builders")}/>;
  if (collection === "chops-sweep-3string-1" && screen === "list") return <NpsWorkout sweep onBack={()=>setCollection("chops-builders")}/>;
  if (collection === "chops-sweep-5string-1" && screen === "list") return <NpsWorkout sweep five onBack={()=>setCollection("chops-builders")}/>;
  if (collection === "3nps" && screen === "list") return <NpsWorkout onBack={()=>setCollection("chops-builders")}/>;

  if (collection === "practice-room-sessions" && screen === "list") return <PracticeRoomSessions onBack={() => setCollection(null)} onHome={onBack}/>;

  return (
    <div style={{ background: C.bg, color: C.white, minHeight: "100vh", fontFamily: "'Lato', sans-serif", fontWeight: 300, lineHeight: 1.6 }}>
      <style>{WK_STYLES}</style>


      <header className="cp-header"><button className="cp-home" onClick={onBack}>← JON BJORK <span>/ WORKOUTS</span></button><div style={{display:"flex",alignItems:"center",gap:18}}><span><span className="cp-dot" /> WORKOUTS</span>{screen === "list" && <><button onClick={()=>setScreen("progress")}>My Progress</button><Tuning/></>}</div></header>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 32px 64px" }}>

        {/* Inside a workout: its name, a way back to the list, and its own
            tabs. The list itself has none of this, because a walkthrough and a
            progress record belong to one workout, not to the section. */}
        {screen !== "list" && screen !== "run" && !(enhanced && isPiece && screen === "setup") && (
          <div style={{ marginBottom: 22 }}>
            <button
              onClick={() => {setCollection(workout.collection || null);setScreen("list");}}
              style={{
                background: "transparent", border: 0, color: C.muted, cursor: "pointer",
                fontFamily: "'Oswald',sans-serif", fontSize: "0.78rem", letterSpacing: "0.14em",
                textTransform: "uppercase", padding: 0, marginBottom: 10, display: "block",
              }}
            >&larr; All workouts</button>
            <div style={{
              fontFamily: "'Oswald',sans-serif", fontWeight: 600, fontSize: "1.5rem",
              letterSpacing: "0.03em", textTransform: "uppercase", marginBottom: 14, lineHeight: 1.15,
            }}>{workout.title}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                { k: "setup", label: "Practice" },
                ...(workout.walkthroughVideoId || workout.workbookUrl ? [{ k: "video", label: "Walkthrough" }] : []),
                { k: "log", label: "Progress" },
              ].map(t => (
                <button
                  key={t.k}
                  onClick={() => setScreen(t.k)}
                  style={{
                    background: isTab(t.k) ? C.card : "transparent",
                    color: isTab(t.k) ? C.white : C.muted,
                    border: `1px solid ${isTab(t.k) ? C.purple : C.border}`,
                    borderRadius: 7, padding: "9px 18px", cursor: "pointer",
                    fontFamily: "'Oswald',sans-serif", fontSize: "0.82rem",
                    letterSpacing: "0.12em", textTransform: "uppercase",
                  }}
                >{t.label}</button>
              ))}
            </div>
          </div>
        )}

        {/* ── LIST ─────────────────────────────────────────────────────────── */}
        {screen === "list" && (
          <>
            <div style={{
              fontFamily: "'Oswald',sans-serif", fontSize: "0.85rem", letterSpacing: "0.28em",
              textTransform: "uppercase", color: C.purpleLt, marginBottom: 10,
            }}>Run it, don't remember it</div>
            <p style={{ color: C.muted, maxWidth: 760, marginBottom: 26 }}>
              The app holds the order and the time so you can put everything into how it sounds. Whatever you play here counts toward your practice log.
            </p>
            {collection === "chops-builders" && <><button style={btn("ghost")} onClick={()=>setCollection(null)}>← All workouts</button><h1 style={{fontFamily:"Oswald",textTransform:"uppercase"}}>The Practice Room Chops Builders</h1><p>Choose a workout and start practising.</p></>}
            <div className="wk-grid">
              {!collection && <button onClick={() => setCollection("practice-room-sessions")}
                aria-label="Open The Practice Room Sessions"
                style={{...panel,marginBottom:0,textAlign:"left",cursor:"pointer",color:C.white,display:"block",width:"100%",padding:0,overflow:"hidden"}}>
                <img src="/workouts/practice-room-sessions.png" alt="The Practice Room Sessions — Guided Guitar Play-Alongs" style={{display:"block",width:"100%",height:"auto"}} />
                <div style={{padding:"22px 24px"}}>
                  <div style={{fontFamily:"'Oswald',sans-serif",fontSize:"0.7rem",letterSpacing:"0.2em",textTransform:"uppercase",color:C.purpleLt,marginBottom:8}}>Guided play-alongs</div>
                  <div style={{fontFamily:"'Oswald',sans-serif",fontWeight:600,fontSize:"1.25rem",textTransform:"uppercase",marginBottom:8}}>The Practice Room Sessions ↗</div>
                  <div style={{color:C.muted,fontSize:"1rem",lineHeight:1.55}}>Open the sessions collection.</div>
                </div>
              </button>}
              {!collection && <button onClick={()=>setCollection("finger-legato")} style={{...panel,textAlign:"left",cursor:"pointer",color:C.white}}><div style={{fontSize:36,color:C.purpleLt,letterSpacing:6}}>1 · 2 · 3 · 4</div><h2 style={{fontFamily:"Oswald"}}>The Legato Workout ↗</h2><p>Two, three and four fingers. Normal Legato or All Hammers.</p><span style={{color:C.purpleLt}}>Choose your combinations and position</span></button>}
              {!collection && <button onClick={()=>setCollection("chops-builders")} aria-label="Open The Practice Room Chops Builders" style={{...panel,marginBottom:0,textAlign:"left",cursor:"pointer",color:C.white,display:"block",width:"100%",padding:0,overflow:"hidden"}}>
                <img src="/workouts/chops-builders.png" alt="The Practice Room Chops Builders" style={{display:"block",width:"100%",height:"auto"}}/>
                <div style={{padding:"22px 24px"}}><h2 style={{fontFamily:"Oswald",textTransform:"uppercase"}}>The Practice Room Chops Builders ↗</h2><p style={{color:C.muted}}>Open the workouts collection.</p></div>
              </button>}
              {collection === "chops-builders" && catalog.filter(w=>w.collection === "chops-builders").map(w=><button key={w.id} onClick={()=>setCollection(w.id==='chops-3nps-1'?'3nps':w.id)} style={{...panel,textAlign:"left",cursor:"pointer",color:C.white,padding:0,overflow:"hidden"}}>
                {w.cover && <img src={w.cover} alt="" style={{display:"block",width:"100%",height:"auto"}}/>}
                <div style={{padding:"22px 24px"}}><div style={{color:C.purpleLt}}>{w.category}</div><h2 style={{fontFamily:"Oswald"}}>{w.title} ↗</h2><p>{w.id==='chops-sweep-5string-1'?'14 exercises · All twelve keys · Five-string sweeps.':w.id==='chops-sweep-3string-1'?'56 one-minute exercises · A minor & E major · Sweep picking.':w.id==='chops-legato-1'?'Thirteen sequences · Twelve keys · Hammer-ons & pull-offs.':'Eleven sequences · Twelve keys · Your choice of starting stroke.'}</p></div>
              </button>)}
              {WORKOUTS.filter(w => (w.collection || null) === collection).map(w => (
                <button
                  key={w.id}
                  onClick={() => {
                    const saved=workoutPrefs(w);
                    setWorkoutId(w.id);setBpm(saved.bpm);
                    setPracticeMode(saved.practiceMode || "full");setFocusCombo(saved.focusCombo || "12");setFocusCrossing(saved.focusCrossing || "arpeggiated");setBothStrokes(saved.bothStrokes===true);
                    setStartBar(saved.startBar);setEndBar(saved.endBar);setChunkSize(saved.chunkSize);
                    setStroke(saved.startStroke || "D");setPosition(saved.position || 1);setGroups(saved.groups?.length?saved.groups:[2,3,4]);
                    setNotesPerBeat(saved.notesPerBeat || 4);setClickSubdivision(readSubdivision(saved.clickSubdivision,readSubdivision(saved.notesPerBeat)));setLoopMode(saved.loopMode || "reps");setLoopReps(saved.loopReps || 4);setLoopMin(saved.loopMin || 3);
                    setSound(saved.sound!==false);setClickOn(saved.clickOn!==false);setClickEvery(saved.clickEvery || "beat");
                    setTone(saved.tone || "piano");setInstrumentVolume(volumePercent(saved.instrumentVolume));setMetronomeVolume(volumePercent(saved.metronomeVolume));
                    setCountInChoice(saved.countIn===2?2:"bar");setCountInSubdiv(saved.countInSubdiv===true);setPauseSeconds(readPause(saved.pauseSeconds));
                    setScreen("setup");
                  }}
                  style={{
                    ...panel, marginBottom: 0, textAlign: "left", cursor: "pointer",
                    color: C.white, display: "block", width: "100%", padding: 0, overflow: "hidden",
                  }}
                >
                  {/* Cover art, edge to edge, when the workout has one. */}
                  {w.cover && (
                    <img
                      src={w.cover} alt=""
                      style={{ display: "block", width: "100%", aspectRatio: "16 / 9", objectFit: w.coverFit || "cover", background:"#080808" }}
                    />
                  )}
                  <div style={{ padding: "22px 24px" }}>
                    <div style={{
                      fontFamily: "'Oswald',sans-serif", fontSize: "0.7rem", letterSpacing: "0.2em",
                      textTransform: "uppercase", color: C.purpleLt, marginBottom: 8,
                    }}>{w.kicker}</div>
                    <div style={{
                      fontFamily: "'Oswald',sans-serif", fontWeight: 600, fontSize: "1.25rem",
                      letterSpacing: "0.03em", textTransform: "uppercase", marginBottom: 8, lineHeight: 1.15,
                    }}>{w.title}</div>
                    <div style={{ color: C.muted, fontSize: "1rem", lineHeight: 1.55 }}>{w.blurb}</div>
                  </div>
                </button>
              ))}
            </div>
            <footer style={{marginTop:32,paddingTop:18,borderTop:`1px solid ${C.border}`,textAlign:"right"}}>
              <a href="/audio/CREDITS.txt" target="_blank" rel="noreferrer" style={{color:C.muted,fontSize:"0.8rem",textUnderlineOffset:3}}>Credits</a>
            </footer>
          </>
        )}

        {screen === "setup" && enhanced && isPiece && <PieceSetup key={workout.id}
          {...{ workout, startBar, setStartBar, endBar, setEndBar, chunkSize, setChunkSize, bpm, notesPerBeat, setNotesPerBeat,
          loopMode, setLoopMode, loopReps, setLoopReps, loopMin, setLoopMin, sound, setSound,
          clickOn, clickEvery, clickSubdivision, countInChoice, setCountInChoice, countInSubdiv, setCountInSubdiv, tone, setTone, pauseSeconds, setPauseSeconds, instrumentVolume, metronomeVolume, setInstrumentVolume, setMetronomeVolume, exercises, sessions }}
          setBpm={changeBpm} setClickOn={changeClickOn} setClickEvery={changeClickEvery} setClickSubdivision={changeClickSubdivision}
          assessment={assessment}
          onStart={startSession} onProgress={() => setScreen("log")} onBack={() => setScreen("list")} />}

        {screen === "setup" && !isPiece && <PickingSetup key={workout.id} {...{workout,exercises,practiceMode,setPracticeMode,focusCombo,setFocusCombo,focusCrossing,setFocusCrossing,bothStrokes,setBothStrokes,position,setPosition,startStroke,setStroke,groups,setGroups,bpm,loopMode,setLoopMode,loopReps,setLoopReps,loopMin,setLoopMin,pauseSeconds,setPauseSeconds,countInChoice,setCountInChoice,countInSubdiv,setCountInSubdiv,tone,setTone,sound,setSound,clickOn,clickEvery,instrumentVolume,metronomeVolume,setInstrumentVolume,setMetronomeVolume,totalSec}} setBpm={changeBpm} setClickOn={changeClickOn} setClickEvery={changeClickEvery} onStart={startSession}/>}

        {/* ── SETUP ────────────────────────────────────────────────────────── */}
        {screen === "setup" && isPiece && !enhanced && (
          <>
            <p style={{ color: C.muted, maxWidth: 760, marginBottom: 22, fontSize: "1rem", lineHeight: 1.6 }}>{workout.intro}</p>

            <div style={panel}>
              {isPiece ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 26 }}>
                  <div>
                    <span style={label}>Bars per chunk</span>
                    <Stepper value={chunkSize} min={1} max={totalBars} onChange={setChunkSize} />
                  </div>
                  <div>
                    <span style={label}>Start at bar</span>
                    <Stepper value={startBar} min={1} max={totalBars} onChange={setStartBar} />
                  </div>
                  <div>
                    <span style={label}>Notes per beat</span>
                    <Seg options={NPB_OPTIONS} value={notesPerBeat} onChange={v => setNotesPerBeat(Number(v))} />
                  </div>
                  <div style={{ flexBasis: "100%", height: 0 }} />
                  <div>
                    <span style={label}>Loop each chunk</span>
                    <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                      <Seg options={LOOP_OPTIONS} value={loopMode} onChange={setLoopMode} />
                      {loopMode === "reps" && (
                        <span style={{ display: "flex", gap: 10, alignItems: "center", color: C.muted, fontSize: "0.95rem" }}>
                          <Stepper value={loopReps} min={1} max={50} onChange={setLoopReps} /> reps, then move on
                        </span>
                      )}
                      {loopMode === "timer" && (
                        <span style={{ display: "flex", gap: 10, alignItems: "center", color: C.muted, fontSize: "0.95rem" }}>
                          <Stepper value={loopMin} min={1} max={60} onChange={setLoopMin} /> minutes, then move on
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ flexBasis: "100%", height: 0 }} />
                  <div>
                    <span style={label}>Guitar sound</span>
                    <Seg
                      options={[{ v: "on", label: "On" }, { v: "off", label: "Off" }]}
                      value={sound ? "on" : "off"}
                      onChange={v => setSound(v === "on")}
                    />
                  </div>
                  <div>
                    <span style={label}>Metronome</span>
                    <Seg
                      options={[{ v: "on", label: "On" }, { v: "off", label: "Off" }]}
                      value={clickOn ? "on" : "off"}
                      onChange={v => changeClickOn(v === "on")}
                    />
                  </div>
                  <div>
                    <span style={label}>Click on</span>
                    <Seg
                      options={[{ v: "beat", label: "The beat" }, { v: "all", label: "Subdivisions" }]}
                      value={clickEvery}
                      onChange={changeClickEvery}
                    />
                  </div>
                </div>
              ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 26 }}>
                <div>
                  <span style={label}>Position</span>
                  <Seg
                    options={workout.positions.map(p => ({ v: p, label: String(p) }))}
                    value={position}
                    onChange={v => setPosition(Number(v))}
                  />
                </div>
                <div>
                  <span style={label}>Start on</span>
                  <Seg
                    options={[{ v: "D", label: "Downstroke" }, { v: "U", label: "Upstroke" }]}
                    value={startStroke}
                    onChange={setStroke}
                  />
                </div>
              </div>
              )}

              <div style={{ display: "flex", flexWrap: "wrap", gap: 26, marginTop: 22 }}>
                <div>
                  <span style={label}>Count-in</span>
                  <Seg
                    options={[{ v: "bar", label: `${beatsPerBar} beats` }, { v: 2, label: "2 beats" }]}
                    value={countInChoice}
                    onChange={v => setCountInChoice(String(v) === "2" ? 2 : "bar")}
                  />
                </div>
                <div>
                  <span style={label}>Count-in subs</span>
                  <Seg
                    options={[{ v: "on", label: "On" }, { v: "off", label: "Off" }]}
                    value={countInSubdiv ? "on" : "off"}
                    onChange={v => setCountInSubdiv(v === "on")}
                  />
                </div>
              </div>

              {workout.groupOptions && (
                <div style={{ marginTop: 22 }}>
                  <span style={label}>Fingerings</span>
                  <div style={{ display: "flex", gap: 18, flexWrap: "wrap", paddingTop: 3 }}>
                    {workout.groupOptions.map(g => (
                      <label key={g.size} style={{
                        display: "flex", alignItems: "center", gap: 8,
                        fontSize: "1.02rem", color: C.off, cursor: "pointer",
                      }}>
                        <input
                          type="checkbox"
                          checked={groups.includes(g.size)}
                          onChange={() => {
                            const next = groups.includes(g.size)
                              ? groups.filter(x => x !== g.size)
                              : [...groups, g.size].sort();
                            if (next.length) setGroups(next);   // never leave it empty
                          }}
                          style={{ accentColor: C.purple, width: 16, height: 16 }}
                        />
                        {g.label} · {g.count}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {isPiece ? (
                <>
                  <p style={{ color: C.muted, fontSize: "1rem", marginTop: 16, marginBottom: 0, lineHeight: 1.6 }}>
                    {exercises.length === 1
                      ? <>One chunk: <b style={{ color: C.off, fontWeight: 400 }}>{exercises[0].label}</b>.</>
                      : <>{exercises.length} chunks: <b style={{ color: C.off, fontWeight: 400 }}>
                          {exercises.slice(0, 3).map(e => e.label).join(", ")}
                          {exercises.length > 4 ? ", …" : ""}
                          {exercises.length > 3 ? `, ${exercises[exercises.length - 1].label}` : ""}
                        </b>.</>}
                    {" "}Each chunk lands on the first note of the bar after it and stops there, then counts in again
                    {loopMode === "reps" ? ` until you have played it ${loopReps} time${loopReps === 1 ? "" : "s"}` : loopMode === "timer" ? ` for ${loopMin} minute${loopMin === 1 ? "" : "s"}` : ""}
                    {loopMode === "off" ? " on the next chunk." : ", then moves on."}
                  </p>
                  <p style={{ color: C.muted, fontSize: "1rem", marginTop: 8, marginBottom: 0, lineHeight: 1.6 }}>
                    About <b style={{ color: C.off, fontWeight: 400 }}>{fmtClock(totalSec)}</b> at <b style={{ color: C.off, fontWeight: 400 }}>{bpm}</b> BPM
                    with <b style={{ color: C.off, fontWeight: 400 }}>{notesPerBeat}</b> note{notesPerBeat === 1 ? "" : "s"} on every click
                    {notesPerBeat === 4 ? ", which is the piece as written." : `. As written it is four, so this is the same line regrouped in ${notesPerBeat}s against the click.`}
                  </p>
                </>
              ) : (
                <>
              <p style={{ color: C.muted, fontSize: "1rem", marginTop: 16, marginBottom: 0, lineHeight: 1.6 }}>
                The tab is always written at the first position, so the fret numbers are the finger
                numbers. You are playing it with the <b style={{ color: C.off, fontWeight: 400 }}>index finger on fret {position}</b>.
              </p>
              {/* Time is the only number that matters. The note and exercise
                  counts were noise. */}
              <p style={{ color: C.muted, fontSize: "1rem", marginTop: 8, marginBottom: 0, lineHeight: 1.6 }}>
                This will take <b style={{ color: C.off, fontWeight: 400 }}>{fmtClock(totalSec)}</b> per
                position at <b style={{ color: C.off, fontWeight: 400 }}>{bpm}</b> BPM.
                Play it through starting on a downstroke, then again starting on an upstroke.
              </p>
                </>
              )}
            </div>

            {/* The first chunk, as it will run, so the start bar is chosen by
                eye and not by number. Follows every setting above live. */}
            {isPiece && exercises[0] && (
              <div style={panel}>
                <span style={label}>
                  Starting here · {exercises[0].label}
                  {exercises.length > 1 ? ` · then ${exercises[1].label}` : ""}
                </span>
                <TabView
                  notes={exercises[0].notes} cursor={-1}
                  tuning={workout.piece.tuning}
                  resolution={resolution}
                  notesPerBeat={notesPerBeat}
                />
              </div>
            )}

            <div style={{ ...panel, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <button style={btn()} onClick={startSession}>{isPiece ? "Start from bar " + startBar : "Start the workout"}</button>
              <button style={btn("ghost")} onClick={() => {setCollection(workout.collection || null);setScreen("list");}}>← All workouts</button>
              <Tempo bpm={bpm} onChange={changeBpm} />
            </div>

            <div style={{ display: "flex", border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden", flexWrap: "wrap" }}>
              {[
                ["Relaxed", "Feel tension anywhere, stop and shake it out."],
                ["Accurate", "Never faster than you can play it perfectly."],
                ["Tone", "Play it the way you want to sound for real."],
              ].map(([t, s], i) => (
                <div key={t} style={{
                  flex: 1, minWidth: 200, padding: "13px 18px", background: C.card,
                  borderRight: i === 2 ? 0 : `1px solid ${C.border}`,
                }}>
                  <b style={{
                    display: "block", fontFamily: "'Oswald',sans-serif", color: C.purpleLt,
                    letterSpacing: "0.16em", textTransform: "uppercase", fontSize: "0.82rem", marginBottom: 2,
                  }}>{t}</b>
                  <span style={{ color: C.muted, fontSize: "0.95rem" }}>{s}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── RUN ──────────────────────────────────────────────────────────── */}
        {screen === "run" && ex && (
          <>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "flex-end",
              gap: 20, flexWrap: "wrap", marginBottom: 14,
            }}>
              <div>
                <div style={{
                  color: C.purpleLt, fontFamily: "'Oswald',sans-serif", letterSpacing: "0.16em",
                  textTransform: "uppercase", fontSize: "0.82rem",
                }}>{ex.kicker}</div>
                <div style={{
                  fontFamily: "'Oswald',sans-serif", fontSize: "2.1rem", fontWeight: 600,
                  letterSpacing: "0.06em", lineHeight: 1.1,
                }}>{ex.label}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                {isPiece ? (
                  <span style={{
                    display: "inline-block", border: `1px solid ${C.border}`, borderRadius: 6,
                    padding: "8px 14px", fontFamily: "'Oswald',sans-serif", fontSize: "0.85rem",
                    letterSpacing: "0.12em", textTransform: "uppercase", color: C.off, background: C.card,
                  }}>{beatsPerBar}/4 · <b style={{ color: C.purpleLt, fontWeight: 600 }}>{chunkSize}</b> bar{chunkSize === 1 ? "" : "s"} at a time · <b style={{ color: C.purpleLt, fontWeight: 600 }}>{notesPerBeat}</b> per beat</span>
                ) : (
                <span style={{
                  display: "inline-block", border: `1px solid ${C.border}`, borderRadius: 6,
                  padding: "8px 14px", fontFamily: "'Oswald',sans-serif", fontSize: "0.85rem",
                  letterSpacing: "0.12em", textTransform: "uppercase", color: C.off, background: C.card,
                }}>Position <b style={{ color: C.purpleLt, fontWeight: 600 }}>{position}</b> · {ex.startStroke === "D" ? "Downstroke" : "Upstroke"} start · index on fret {position}</span>
                )}
                {/* In the bar of silence after a chunk this lights up: the
                    next chunk is about to count in. */}
                <div style={{
                  color: gapNext ? C.purpleLt : C.muted, fontSize: "0.84rem", fontFamily: "'Oswald',sans-serif",
                  letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 9,
                }}>
                  {gapNext ? "Counting in next" : chunked && loopMode !== "off" ? "This chunk" : "Up next"}
                  <b style={{ display: "block", color: gapNext ? C.purpleLt : C.off, fontWeight: gapNext ? 600 : 400, fontSize: "1.05rem", marginTop: 2, letterSpacing: "0.04em" }}>
                    {gapNext ? gapNext
                      : chunked && loopMode === "reps" ? `Rep ${Math.min(repsDone + 1, loopReps)} of ${loopReps}`
                      : chunked && loopMode === "timer" ? `${fmtClock(Math.max(0, loopMin * 60 - (chunkStartRef.current ? (now - chunkStartRef.current) / 1000 : 0)))} left`
                      : nextEx ? (isPiece ? nextEx.label : `${nextEx.comboLabel} · ${nextEx.modeLabel}`) : "Last one"}
                  </b>
                </div>
              </div>
            </div>

            <div style={{ position: "relative" }}>
              <TabView
                notes={ex.notes} cursor={(flat[cursor] || {}).ni ?? -1}
                tuning={isPiece ? workout.piece.tuning : undefined}
                resolution={resolution}
                notesPerBeat={isPiece ? notesPerBeat : undefined}
              />

              {/* Sits in the corner rather than over the tab, so the fret
                  numbers stay readable while it counts you in. */}
              {countIn != null && (
                <div style={{
                  position: "absolute", top: 14, right: 22, display: "flex",
                  alignItems: "baseline", gap: 12, zIndex: 2, pointerEvents: "none",
                  fontFamily: "'Oswald',sans-serif",
                }}>
                  <span style={{
                    fontSize: "0.78rem", letterSpacing: "0.18em",
                    textTransform: "uppercase", color: C.muted,
                  }}>Count in</span>
                  <b style={{ fontSize: "3.4rem", fontWeight: 700, lineHeight: 0.9, color: C.purpleLt }}>{countIn}</b>
                </div>
              )}
            </div>

            {isPiece && <LiveBarRating key={`${workoutId}:${ex.id}`} notes={ex.notes}
              cursor={(flat[cursor] || {}).ni ?? -1} workoutId={workoutId}
              bpm={bpm} notesPerBeat={notesPerBeat} assessment={assessment} />}

            <div style={{ height: 3, background: C.border, borderRadius: 2, margin: "14px 0 6px", overflow: "hidden" }}>
              <div style={{ height: "100%", background: C.purple, width: `${(cursor / Math.max(1, flat.length)) * 100}%` }} />
            </div>
            <div style={{
              display: "flex", justifyContent: "space-between", color: C.muted, fontSize: "0.86rem",
              fontFamily: "'Oswald',sans-serif", letterSpacing: "0.1em", textTransform: "uppercase",
            }}>
              <span>{isPiece ? "Chunk" : "Exercise"} {((flat[cursor] || {}).ei || 0) + 1} of {exercises.length}</span>
              <span>{fmtClock((activeMsRef.current + (runStartRef.current ? now - runStartRef.current : 0)) / 1000)} / {fmtClock(totalSec)}</span>
            </div>

            <div style={{ ...panel, marginTop: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <button style={btn()} onClick={() => (playing ? halt() : resume())}>
                {playing ? "Pause" : "Resume"}
              </button>
              <button style={btn("ghost")} onClick={() => jump(-1)}>← Previous</button>
              <button style={btn("ghost")} onClick={() => jump(1)}>Next →</button>
              <button style={btn("ghost")} onClick={() => finish(false)}>Finish</button>
              <Tempo bpm={bpm} onChange={changeBpm} />
              {enhanced && <VolumeControls {...{instrumentVolume,metronomeVolume,setInstrumentVolume,setMetronomeVolume}}/>}
              {(
                <>
                  <button style={btn(sound ? undefined : "ghost")} onClick={() => setSound(v => !v)}>
                    {sound ? "Instrument on" : "Instrument off"}
                  </button>
                  <button style={btn(clickOn ? undefined : "ghost")} onClick={() => changeClickOn(!clickOn)}>
                    {clickOn ? "Click on" : "Click off"}
                  </button>
                  {isPiece ? <MetronomeSubdivisions enabled={clickEvery==='all'} onToggle={on=>changeClickEvery(on?'all':'beat')} value={clickSubdivision} onChange={changeClickSubdivision}/> : <Seg options={[{v:'beat',label:'The beat'},{v:'all',label:'Subdivisions'}]} value={clickEvery} onChange={changeClickEvery}/>}
                </>
              )}
            </div>
          </>
        )}

        {/* ── DONE ─────────────────────────────────────────────────────────── */}
        {screen === "done" && summary && (
          <div style={panel}>
            <h2 style={{
              fontFamily: "'Oswald',sans-serif", fontWeight: 600, fontSize: "1rem",
              letterSpacing: "0.14em", textTransform: "uppercase", color: C.off, marginBottom: 14,
            }}>{summary.completed ? "That's the workout" : summary.saved ? "Session saved" : "Session ended"}</h2>
            <p style={{ color: C.muted, margin: 0 }}>
              {isPiece
                ? (summary.completed
                  ? `Bars ${startBar} to ${exercises[exercises.length - 1].barTo} in ${summary.total} chunk${summary.total === 1 ? "" : "s"} of ${chunkSize}, ${notesPerBeat} per beat at ${bpm} BPM, in ${fmtClock(summary.seconds)}.`
                  : `Stopped in chunk ${summary.currentChunk} of ${summary.total}. ${summary.barsPlayed.length} full bars played through. ${fmtClock(summary.seconds)}${summary.saved ? " logged" : " practiced"}.`)
                : `${summary.done} of ${summary.total} patterns played through at position ${position}, in ${fmtClock(summary.seconds)}. ${bothStrokes ? "Downstroke and upstroke passes." : ""}`}
            </p>
            <p style={{ color: C.muted, fontSize: "0.98rem", marginTop: 10, marginBottom: 0 }}>
              {summary.saved ? "Counted toward your practice log." : `Sessions of ${MIN_LOGGED_SEC} seconds or longer are logged.`}
            </p>
            {enhanced && isPiece && <RatingControl bars={summary.assessedBars || []} bpm={summary.bpm} notesPerBeat={summary.notesPerBeat} onMark={assessment.mark} ratings={assessment.ratings} workoutId={workoutId} notice={assessment.notice} canUndo={assessment.canUndo} onUndo={assessment.undoMark} afterSession />}
            {!isPiece && summary.patternsPlayed?.length>0 && <PatternRating records={summary.patternsPlayed} position={position} bpm={summary.bpm}/>}
            <div style={{ display: "flex", gap: 12, marginTop: 18, flexWrap: "wrap" }}>
              <button style={btn()} onClick={() => setScreen("setup")}>Go again</button>
              <button style={btn("ghost")} onClick={() => setScreen("log")}>See progress</button>
            </div>
          </div>
        )}

        {/* ── WALKTHROUGH ──────────────────────────────────────────────────── */}
        {screen === "video" && (
          <>
            <div style={{
              fontFamily: "'Oswald',sans-serif", fontSize: "0.85rem", letterSpacing: "0.28em",
              textTransform: "uppercase", color: C.purpleLt, marginBottom: 10,
            }}>Watch this first</div>
            <p style={{ color: C.muted, maxWidth: 760, marginBottom: 22, fontSize: "1rem", lineHeight: 1.6 }}>
              How the routine is built and how to run it. Worth the few minutes before your first pass.
            </p>

            {workout.walkthroughVideoId && <div style={{
              position: "relative", width: "100%", maxWidth: 900, paddingTop: "min(56.25%, 506px)",
              background: "#000", borderRadius: 10, overflow: "hidden", marginBottom: 22,
            }}>
              <iframe
                title="Walkthrough"
                src={`https://www.youtube-nocookie.com/embed/${workout.walkthroughVideoId}?rel=0`}
                allow="accelerometer; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                loading="lazy"
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
              />
            </div>}

            {workout.workbookUrl && <div style={panel}>
              <h2 style={{
                fontFamily: "'Oswald',sans-serif", fontWeight: 600, fontSize: "1rem",
                letterSpacing: "0.14em", textTransform: "uppercase", color: C.off, marginBottom: 10,
              }}>The workbook</h2>
              <p style={{ color: C.muted, fontSize: "1rem", lineHeight: 1.6, marginBottom: 16, maxWidth: 700 }}>
                Twelve pages on why the routine is worth doing properly, the eleven fingerings, the three
                ways through the strings and how long a session takes. Print it or keep it on a stand.
              </p>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <a href={workout.workbookUrl} target="_blank" rel="noreferrer" style={{ ...btn(), textDecoration: "none", display: "inline-block" }}>
                  Open the workbook
                </a>
                <a href={workout.workbookUrl} download style={{ ...btn("ghost"), textDecoration: "none", display: "inline-block" }}>
                  Download PDF
                </a>
                <button style={btn("ghost")} onClick={() => setScreen("setup")}>Go to the routine</button>
              </div>
            </div>}
          </>
        )}

        {/* ── LOG ──────────────────────────────────────────────────────────── */}
        {screen === "log" && (
          <>
            <div className="wk-stats" style={{ marginBottom: 16 }}>
              {[
                [totals.allMs ? fmtDur(totals.allMs) : "0m", "Total time"],
                [totals.monthMs ? fmtDur(totals.monthMs) : "0m", "This month"],
                [String(totals.streak), "Day streak"],
                [String(totals.count), "Sessions"],
              ].map(([v, k]) => (
                <div key={k} style={{ ...panel, marginBottom: 0 }}>
                  <b style={{
                    display: "block", fontFamily: "'Oswald',sans-serif", fontSize: "1.9rem",
                    fontWeight: 600, color: C.white, lineHeight: 1.1,
                  }}>{v}</b>
                  <span style={{
                    fontFamily: "'Oswald',sans-serif", fontSize: "0.78rem", letterSpacing: "0.16em",
                    textTransform: "uppercase", color: C.muted,
                  }}>{k}</span>
                </div>
              ))}
            </div>

            {isPiece && <RatedBars key={workoutId} workout={workout} ratings={assessment.ratings} bpm={bpm} notesPerBeat={notesPerBeat}
              tone={tone} instrumentVolume={instrumentVolume} metronomeVolume={metronomeVolume}
              onFocusClose={() => setLogTick(t => t + 1)} />}

            <div style={panel}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, maxWidth: 520 }}>
                <button style={btn("sm")} onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))}>←</button>
                <h3 style={{
                  fontFamily: "'Oswald',sans-serif", fontWeight: 600, letterSpacing: "0.1em",
                  textTransform: "uppercase", fontSize: "1.05rem", margin: 0,
                }}>{calMonth.toLocaleString(undefined, { month: "long", year: "numeric" })}</h3>
                <button style={btn("sm")} onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))}>→</button>
              </div>
              <Calendar month={calMonth} byDay={byDay} />
            </div>

            <div style={panel}>
              <h2 style={{
                fontFamily: "'Oswald',sans-serif", fontWeight: 600, fontSize: "1rem",
                letterSpacing: "0.14em", textTransform: "uppercase", color: C.off, marginBottom: 8,
              }}>Ground covered</h2>
              <p style={{ color: C.muted, fontSize: "0.99rem", marginBottom: 14, lineHeight: 1.6 }}>
                {isPiece
                  ? "Every bar you have played through, and how often. The ones you skip are the ones to start from."
                  : "Every position feels different, and so does starting on an upstroke. This is what you have actually played."}
              </p>
              {isPiece
                ? <BarCoverage sessions={sessions} totalBars={totalBars} />
                : <Coverage sessions={sessions} positions={workout.positions} />}
            </div>

            <div style={panel}>
              <h2 style={{
                fontFamily: "'Oswald',sans-serif", fontWeight: 600, fontSize: "1rem",
                letterSpacing: "0.14em", textTransform: "uppercase", color: C.off, marginBottom: 14,
              }}>Your workout log</h2>
              <p style={{ color: C.muted, fontSize: "0.92rem", marginBottom: 14 }}>
                Kept in this browser. Export it on its own to move it between computers, or to bring in a log
                from the standalone app.
              </p>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button style={btn("ghost")} onClick={() => {
                  const n = exportLog();
                  setIoMsg(`Exported ${n} session${n === 1 ? "" : "s"}.`);
                }}>Export JSON</button>
                <button style={btn("ghost")} onClick={() => fileRef.current && fileRef.current.click()}>Import JSON</button>
                <input
                  ref={fileRef} type="file" accept="application/json,.json"
                  style={{ display: "none" }}
                  onChange={e => { if (e.target.files[0]) doImport(e.target.files[0]); e.target.value = ""; }}
                />
              </div>
              {ioMsg && <div style={{ color: C.purpleLt, fontSize: "0.92rem", marginTop: 10 }}>{ioMsg}</div>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── log sub-views ────────────────────────────────────────────────────────────

function Calendar({ month, byDay }) {
  const now = new Date();
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const daysIn = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7;   // weeks start Monday

  const cells = [];
  ["M", "T", "W", "T", "F", "S", "S"].forEach((d, i) => cells.push(
    <div key={`h${i}`} style={{
      fontFamily: "'Oswald',sans-serif", fontSize: "0.74rem", letterSpacing: "0.12em",
      textTransform: "uppercase", color: C.dim, textAlign: "center", paddingBottom: 4,
    }}>{d}</div>
  ));
  for (let i = 0; i < lead; i++) cells.push(<div key={`b${i}`} />);
  for (let d = 1; d <= daysIn; d++) {
    const key = dayKey(new Date(month.getFullYear(), month.getMonth(), d));
    const list = byDay[key];
    const ms = list ? list.reduce((a, s) => a + s.seconds * 1000, 0) : 0;
    const isToday = key === dayKey(now);
    cells.push(
      <div key={key} title={list ? `${list.length} session${list.length > 1 ? "s" : ""}, ${fmtDur(ms)}` : ""} style={{
        height: 58, borderRadius: 6, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        fontFamily: "'Oswald',sans-serif", fontSize: "0.82rem",
        background: list ? shadeFor(ms) : C.card2,
        color: list ? "#fff" : C.dim,
        border: `1px solid ${list ? "transparent" : C.border}`,
        outline: isToday ? `1px solid ${C.purpleLt}` : "none",
        outlineOffset: -1,
      }}>
        {d}
        {list && <em style={{ fontStyle: "normal", fontSize: "0.62rem", color: "rgba(255,255,255,0.75)", marginTop: 1 }}>
          {Math.max(1, Math.round(ms / 60000))}m
        </em>}
      </div>
    );
  }
  return <div className="wk-cal">{cells}</div>;
}

// Walk the finished sessions in order. Each time all ten squares are covered
// the round closes and the grid starts empty again, so it keeps meaning
// something instead of sitting permanently full.
function Coverage({ sessions, positions }) {
  const { round, done, target, covered } = pickingCoverageRound(sessions, positions);
  const cells = [<div key="corner" />];
  positions.forEach(p => cells.push(
    <div key={`p${p}`} style={{
      fontFamily: "'Oswald',sans-serif", fontSize: "0.8rem", letterSpacing: "0.1em",
      textTransform: "uppercase", color: C.dim, display: "flex",
      alignItems: "center", justifyContent: "center", padding: "9px 4px",
    }}>Pos {p}</div>
  ));
  ["D", "U"].forEach(stroke => {
    cells.push(
      <div key={`l${stroke}`} style={{
        fontFamily: "'Oswald',sans-serif", fontSize: "0.8rem", letterSpacing: "0.1em",
        textTransform: "uppercase", color: C.dim, display: "flex",
        alignItems: "center", justifyContent: "flex-end", paddingRight: 10,
      }}>{stroke === "D" ? "Downstroke" : "Upstroke"}</div>
    );
    positions.forEach(p => {
      const hit = done.has(p + stroke);
      cells.push(
        <div key={`${stroke}${p}`} style={{
          fontFamily: "'Oswald',sans-serif", fontSize: "0.85rem", display: "flex",
          alignItems: "center", justifyContent: "center", padding: "9px 4px",
          borderRadius: 6,
          background: hit ? C.purple : C.card2,
          color: hit ? "#fff" : C.dim,
          border: `1px solid ${hit ? "transparent" : C.border}`,
        }}>{hit ? "\u2713" : `${covered[p+stroke]?.size || 0}/33`}</div>
      );
    });
  });
  return (
    <>
      <div style={{
        fontFamily: "'Oswald',sans-serif", fontSize: "0.82rem", letterSpacing: "0.14em",
        textTransform: "uppercase", color: C.purpleLt, marginBottom: 10,
      }}>Round {round} &middot; {done.size} of {target}</div>
      <p style={{color:C.muted,fontSize:"0.9rem"}}>Patterns played out of 33. A check means every pattern at that position and starting stroke.</p>
      <div className="wk-cov">{cells}</div>
    </>
  );
}

// One cell per bar, shaded by how many times a session played through it.
function BarCoverage({ sessions, totalBars }) {
  const counts = new Array(totalBars).fill(0);
  for (const s of sessions) {
    const played=Array.isArray(s.barsPlayed)?s.barsPlayed:Array.isArray(s.barsDone)?Array.from({length:s.barsDone[1]-s.barsDone[0]+1},(_,i)=>s.barsDone[0]+i):[];
    for(const b of played)if(b>=1 && b<=totalBars)counts[b-1]++;
  }
  const played = counts.filter(Boolean).length;
  const shade = (c) => c >= 8 ? C.purple : c >= 4 ? "rgba(124,58,237,.8)" : c >= 2 ? "rgba(124,58,237,.55)" : "rgba(124,58,237,.3)";
  return (
    <>
      <div style={{
        fontFamily: "'Oswald',sans-serif", fontSize: "0.82rem", letterSpacing: "0.14em",
        textTransform: "uppercase", color: C.purpleLt, marginBottom: 10,
      }}>{played} of {totalBars} bars played</div>
      <div className="wk-bars">
        {counts.map((c, i) => (
          <div key={i} title={`Bar ${i + 1}: ${c} time${c === 1 ? "" : "s"}`} style={{
            height: 38, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "'Oswald',sans-serif", fontSize: "0.82rem",
            background: c ? shade(c) : C.card2,
            color: c ? "#fff" : C.dim,
            border: `1px solid ${c ? "transparent" : C.border}`,
          }}>{i + 1}</div>
        ))}
      </div>
    </>
  );
}
