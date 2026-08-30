// =============================================================================
// The Ultimate Alternate Picking Workout — the routine itself.
//
// Every note here was checked against Jon's Guitar Pro file
// (Ultimate Alternate Picking Warmup Routine.gpx, 40 bars): all 297 written
// notes match, with nothing left over.
//
// Strings are numbered the way tab numbers them: 6 = low E, 1 = high e.
// Frets are written from position 1, where fret === finger number, exactly as
// Jon wrote it. The app names the position rather than transposing the tab.
//
// Each exercise runs the shape up, mirrors it back down without repeating the
// top note, and returns to the note it started on. That returning note is the
// first note of the next exercise, so the app drops it everywhere except at
// the very end of the routine.
//
// This file is only ever reached through picking-workout-unlock.js, behind a
// valid license key. It must not be copied into the public site folder.
// =============================================================================

const COMBOS = [
  [1,2],[1,3],[1,4],[2,3],[2,4],[3,4],   // 6 two-finger
  [1,2,3],[1,2,4],[1,3,4],[2,3,4],       // 4 three-finger
  [1,2,3,4],                             // 1 four-finger
];

const MODES = ["arpeggiated", "adjacent", "skipping"];
const MODE_LABELS = {
  arpeggiated: "Arpeggiated",
  adjacent: "Adjacent Strings",
  skipping: "String Skipping",
};

// One note per string. Four fingers don't fit across six strings, so the
// four-finger version runs 6-5-4-3 and then restarts on the D string.
const ARP_STRINGS  = { 2:[6,5,4,3,2,1], 3:[6,5,4,3,2,1], 4:[6,5,4,3,4,3,2,1] };
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
// started on.
function mirror(asc) {
  return asc.concat(asc.slice(0, -1).reverse());
}

// The full set, in Jon's order. Notes carry no pick strokes: strict alternate
// picking runs unbroken across whichever exercises the player selected, so the
// app assigns the strokes once it knows the stream.
function buildRoutine() {
  const exercises = [];
  for (const combo of COMBOS) {
    for (const mode of MODES) {
      exercises.push({
        id: `${combo.join("")}-${mode}`,
        combo,
        comboLabel: combo.join("–"),
        mode,
        modeLabel: MODE_LABELS[mode],
        groupSize: combo.length,
        notes: mirror(ascending(combo, mode)),   // includes the returning note
      });
    }
  }
  return exercises;
}

const ROUTINE_META = {
  title: "The Ultimate Alternate Picking Workout",
  defaultBpm: 50,                  // start slow. The .gpx says 100, but Jon rarely
                                   // goes above 80 and mostly sits around 60.
  positions: [1, 5, 9, 13, 17],
  noteValue: "8ths",
};

module.exports = { buildRoutine, ROUTINE_META, COMBOS, MODES, MODE_LABELS };
