// ─────────────────────────────────────────────────────────────────────────────
// WORKOUTS — the routines
// ─────────────────────────────────────────────────────────────────────────────
//
// The catalogue Jon publishes into the Workouts section. Each entry is data:
// adding the legato / sweep / hybrid workouts later means adding a builder and
// an entry here, with no UI work.
//
// Two kinds. A "routine" is generated (the picking workout below) and played
// straight through. A "piece" is tab read from a Guitar Pro file by
// scripts/gp-to-bars.py, played in chunks of whole bars with a stop and a
// fresh count-in between them (see buildPieceChunks).
//
// This is the same routine that the standalone app at
// jonbjorkmusic.com/picking-workout serves from its Netlify function. Every
// note was checked against Jon's Guitar Pro file (Ultimate Alternate Picking
// Warmup Routine.gpx, 40 bars): all 297 written notes match, nothing left over.
// If you change the model here, change it there too.
//
// Strings are numbered the way tab numbers them: 6 = low E, 1 = high e.
// Frets are written from position 1, where fret === finger number, exactly as
// Jon wrote it. The app names the position rather than transposing the tab.
// ─────────────────────────────────────────────────────────────────────────────

const COMBOS = [
  [1, 2], [1, 3], [1, 4], [2, 3], [2, 4], [3, 4],   // 6 two-finger
  [1, 2, 3], [1, 2, 4], [1, 3, 4], [2, 3, 4],       // 4 three-finger
  [1, 2, 3, 4],                                     // 1 four-finger
];


const MODES = ["arpeggiated", "adjacent", "skipping"];
const MODE_LABELS = {
  arpeggiated: "Arpeggiated",
  adjacent: "Adjacent Strings",
  skipping: "String Skipping",
};

// One note per string. Four fingers don't fit across six strings, so the
// four-finger version runs 6-5-4-3 and then restarts on the D string.
const ARP_STRINGS  = { 2: [6,5,4,3,2,1], 3: [6,5,4,3,2,1], 4: [6,5,4,3,4,3,2,1] };
const ADJ_STRINGS  = [6,5,4,3,2,1];
const SKIP_STRINGS = [6,4,5,3,4,2,3,1];   // jump every other string, then fall back

function ascending(combo, mode) {
  const k = combo.length;
  if (mode === "arpeggiated") {
    return ARP_STRINGS[k].map((string, i) => ({ string, fret: combo[i % k] }));
  }
  const strings = mode === "adjacent" ? ADJ_STRINGS : SKIP_STRINGS;
  const out = [];
  for (const string of strings) for (const fret of combo) out.push({ string, fret });
  return out;
}

// Up, then back down without picking the top note twice, ending on the note it
// started on. That returning note is the first note of the next exercise, so
// it is dropped everywhere except at the very end of the routine.
function mirror(asc) {
  return asc.concat(asc.slice(0, -1).reverse());
}

export function buildPickingWorkout({ startStroke = "D", groups = [2, 3, 4], practiceMode = "full", focusCombo = "12", focusCrossing = "arpeggiated", bothStrokes = false, position = 1 } = {}) {
  const chosen = COMBOS.filter(c => practiceMode === "focus" || groups.includes(c.length));
  const exercises = [];
  let strokeIndex = 0;   // strict alternate runs unbroken across the whole session

  chosen.forEach((combo, ci) => {
    MODES.forEach((mode, mi) => {
      const last = ci === chosen.length - 1 && mi === MODES.length - 1;
      const full = mirror(ascending(combo, mode));
      const raw = last ? full : full.slice(0, -1);
      exercises.push({
        id: `${combo.join("")}-${mode}`,
        combo,
        comboLabel: combo.join("–"),
        mode,
        modeLabel: MODE_LABELS[mode],
        // What the run screen shows: the big line and the small one above it.
        label: combo.join("–"),
        kicker: MODE_LABELS[mode],
        groupSize: combo.length,
        notes: raw.map(n => {
          const down = (strokeIndex++ % 2 === 0) === (startStroke === "D");
          return { string: n.string, fret: n.fret, stroke: down ? "D" : "U" };
        }),
      });
    });
  });
  const selected = practiceMode === "focus"
    ? exercises.filter(ex => ex.combo.join("") === focusCombo && ex.mode === focusCrossing)
    : exercises;
  const strokes = bothStrokes ? ["D", "U"] : [startStroke];
  return strokes.flatMap((stroke, pass) => selected.map((ex, i) => {
    const raw = practiceMode === "focus" ? mirror(ascending(ex.combo, ex.mode)) : ex.notes;
    const prior = selected.slice(0,i).reduce((n,e)=>n+e.notes.length,0);
    return {...ex, baseId:ex.id, id:`${ex.id}-${stroke}`, startStroke:stroke, pass,
      notes:raw.map((n,j)=>({...n, midi:[ [64,59,55,50,45,40][n.string-1]+n.fret+position-1 ],
        stroke:((prior+j)%2===0)===(stroke==="D")?"D":"U",
        last:j===raw.length-1 && (practiceMode==="focus" || i===selected.length-1)
      }))};
  }));
}

// ── Pieces ───────────────────────────────────────────────────────────────────
// One column per tick (a 16th for the caprice). A note longer than a tick is
// followed by `hold` columns so the playhead keeps moving through it; a rest
// is a `rest` column plus holds. `midi` carries the sounding pitches for the
// playback synth, `len` the written length in ticks.

function pieceMidi(piece, string, fret) {
  return piece.tuning[piece.tuning.length - string] + fret;
}

// `landing`: only the first event of the bar, as a single column. That is the
// downbeat a chunk lands on before it stops.
function barColumns(piece, barIndex, { landing = false } = {}) {
  const events = landing ? piece.bars[barIndex].slice(0, 1) : piece.bars[barIndex];
  const cols = [];
  events.forEach(([, len, stroke, frets, meta = {}], ei) => {
    const col = frets.length
      ? {
          ...meta, string: frets[0][0], fret: frets[0][1], stroke, len,
          extra: frets.slice(1).map(([string, fret]) => ({ string, fret })),
          midi: frets.map(([string, fret]) => pieceMidi(piece, string, fret)),
        }
      : { ...meta, rest: true, len };
    if (ei === 0) col.bar = barIndex + 1;
    if (landing) col.landing = true;
    cols.push(col);
    if (!landing) for (let k = 1; k < len; k++) cols.push({ hold: true });
  });
  if (!landing && cols.length) cols[cols.length - 1].barEnd = barIndex + 1;
  return cols;
}

// Chunks cover startBar through inclusive endBar. Every chunk also lands on
// the first note of the following bar, even beyond the selected section. Only
// the end of the piece has no landing note. barTo still tracks full bars only.
export function buildPieceChunks(piece, { chunkSize = 1, startBar = 1, endBar = piece.bars.length } = {}) {
  const total = piece.bars.length;
  const size = Math.max(1, Math.min(total, Math.round(chunkSize) || 1));
  const first = Math.max(1, Math.min(total, Math.round(startBar) || 1));
  const last = Math.max(first, Math.min(total, Math.round(endBar) || total));
  const chunks = [];
  for (let from = first; from <= last; from += size) {
    const to = Math.min(last, from + size - 1);
    const notes = [];
    for (let b = from; b <= to; b++) notes.push(...barColumns(piece, b - 1));
    if (to < total) notes.push(...barColumns(piece, to, { landing: true }));
    notes[notes.length - 1].last = true;
    chunks.push({
      id: `bars-${from}-${to}`,
      barFrom: from, barTo: to,
      label: from === to ? `Bar ${from}` : `Bars ${from}–${to}`,
      notes,
    });
  }
  chunks.forEach((c, i) => { c.kicker = `Chunk ${i + 1} of ${chunks.length}`; });
  return chunks;
}

// ── The catalogue ────────────────────────────────────────────────────────────
// `groupOptions` drives the fingerings picker; a workout that has no such
// choice simply omits it.
export const WORKOUTS = [
  {
    id: "picking",
    cover: "/workouts/ultimate-alternate-cover.png",
    coverFit: "contain",
    kind: "routine",
    title: "The Ultimate Alternate Picking Workout",
    short: "Alternate Picking",
    blurb: "This routine will systematically take you through all possible left-hand fingerings and the three most common string crossings you'll come across in real music.",
    kicker: "Alternate picking",
    intro: "This routine will systematically take you through all possible left-hand fingerings and the three most common string crossings you'll come across in real music. The tab is written at the first position, so the fret numbers are the finger numbers. Play it wherever the position badge says.",
    defaultBpm: 50,              // start slow. The .gpx says 100, but Jon rarely
                                // goes above 80 and mostly sits around 60.
    // Each workout carries its own walkthrough and workbook. Leave either out
    // and the Walkthrough tab adapts, or disappears if there is neither.
    walkthroughVideoId: "a4UkxRIcMNI",
    positions: [1, 5, 9, 13, 17],
    noteValue: "8ths",
    beatsPerBar: 4,
    ticksPerBeat: 2,             // eighth notes: click on the beat, hi-hat on the offbeat
    build: buildPickingWorkout,
    groupOptions: [
      { size: 2, label: "Two-finger", count: 6 },
      { size: 3, label: "Three-finger", count: 4 },
      { size: 4, label: "Four-finger", count: 1 },
    ],
  },

];

export function getWorkout(id) {
  return WORKOUTS.find(w => w.id === id) || WORKOUTS[0];
}
