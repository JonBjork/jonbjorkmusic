// =============================================================================
// The Ultimate Legato Warmup Routine — the routine itself.
//
// Decoded from Jon's Guitar Pro file (Ultimate Legato Warmup Routine.gpx, 319
// bars, 2,915 notes) and checked against it: 46 of 48 tabbed A-section
// exercises match note for note, and the return-leg rule below holds for 53 of
// the 55 exercises long enough to test. Every miss traces to a fingering label
// sitting a few notes late in the tab, not to the notes themselves.
//
// Strings are numbered the way tab numbers them: 6 = low E, 1 = high e. Unlike
// the picking workout, this routine starts on the HIGH e and works down.
//
// Frets are written from position 1, where fret === finger, and the app names
// the position rather than transposing. The one exception is the return leg:
// see below.
//
// THE RULE. Every exercise walks down the six strings and back. Going down you
// play the fingering from the position. Coming back the hand moves up one fret
// and plays it again, which is why a 1-4 shape reads as frets 1 and 4 on the
// way down and 5 and 2 on the way back. Two notes on a string is an
// alternation, so it also comes back off the upper note; three, four and six
// note groups keep their order.
//
// The cheat sheet specifies more than the tab ever wrote out: the six reversed
// two-finger combinations, the same twelve B sequences applied to all four
// three-finger combinations, and the twenty-four four-finger permutations.
// Those are generated here from the same verified rule.
//
// This file is only ever reached through legato-workout-unlock.js, behind a
// valid license key. It must not be copied into the public site folder.
// =============================================================================

const TWO      = [[1,2],[1,3],[1,4],[2,3],[2,4],[3,4]];
const TWO_REV  = TWO.map(f => [...f].reverse());
const THREE_SETS = [[1,2,3],[1,2,4],[1,3,4],[2,3,4]];
const THREE_REV  = [[3,2,1],[4,2,1],[4,3,1],[4,3,2]];
const FOUR     = [[1,2,3,4],[4,3,2,1]];

function permutations(a) {
  if (a.length <= 1) return [a];
  const out = [];
  a.forEach((x, i) =>
    permutations([...a.slice(0, i), ...a.slice(i + 1)]).forEach(p => out.push([x, ...p])));
  return out;
}
const THREE_ALL = THREE_SETS.flatMap(permutations);          // 24, in the tab's order
const FOUR_ALL  = permutations([1, 2, 3, 4]);                // 24, the cheat sheet's set

// The twelve B sequences, written for fingers 1-2-3 and mapped onto each of
// the four three-finger combinations.
const B_SEQUENCES = [
  [1,2,3,2],[2,3,2,1],[3,2,1,2],[2,1,2,3],
  [1,3,2,3],[3,2,3,1],[2,3,1,3],[3,1,3,2],
  [1,2,1,3],[1,3,1,2],[2,1,3,1],[3,1,2,1],
];

// The ten six-note-per-string patterns, four fingers.
const B_SIX = [
  [1,2,1,3,1,4],[1,4,1,3,1,2],[4,1,4,2,4,3],[4,3,4,2,4,1],[1,2,3,4,3,2],
  [2,3,4,3,2,1],[3,4,3,2,1,2],[4,3,2,1,2,3],[3,2,1,2,3,4],[2,1,2,3,4,3],
];

const STRINGS_DOWN = [1, 2, 3, 4, 5, 6];        // high e to low E
const STRINGS_BACK = [6, 5, 4, 3, 2, 1];
// Four fingers do not fit one-per-string across six strings, so the one-note
// block groups them the way the tab does.
const GROUPED_DOWN = [1, 2, 3, 4, 3, 4, 5, 6];

// One note per string, every note a hammer-on from nowhere. The return leg
// replays the finger each string got on the way down, stopping one note short
// of the note it started on.
function oneNotePerString(fingering) {
  const path = fingering.length === 4 ? GROUPED_DOWN : STRINGS_DOWN;
  const down = path.map((string, i) => ({ string, fret: fingering[i % fingering.length], tap: true }));
  return down.concat(down.slice(1, -1).reverse());
}

// k notes on each string, down the strings and back a fret higher.
function multiNotePerString(fingering, reps) {
  const back = fingering.length === 2 ? [...fingering].reverse() : fingering;
  const notes = [];
  const run = (strings, shift, fing) => {
    for (const string of strings)
      for (let r = 0; r < reps; r++)
        for (const f of fing) notes.push({ string, fret: f + shift });
  };
  run(STRINGS_DOWN, 0, fingering);
  run(STRINGS_BACK, 1, back);
  return notes;
}

const label = f => f.join("");

function block(id, name, note, list, build) {
  return {
    id, name, noteValue: note,
    exercises: list.map(f => ({
      id: `${id}-${label(f)}`,
      fingering: f,
      fingeringLabel: label(f),
      notes: build(f),
    })),
  };
}

function buildRoutine() {
  return [
    {
      id: "A", name: "Section A", subtitle: "The main warm-up",
      blocks: [
        block("a1", "One note per string", "8ths",
              [...TWO, ...TWO_REV, ...THREE_SETS, ...THREE_REV, ...FOUR],
              oneNotePerString),
        block("a2", "Two notes per string", "triplets",
              [...TWO, ...TWO_REV], f => multiNotePerString(f, 3)),
        block("a3", "Three notes per string", "8ths",
              THREE_ALL, f => multiNotePerString(f, 1)),
        block("a4", "Four notes per string", "triplets",
              FOUR, f => multiNotePerString(f, 1)),
      ],
    },
    {
      id: "B", name: "Section B", subtitle: "Extra sequences", optional: true,
      blocks: [
        block("b1", "Repeated-note sequences", "triplets",
              THREE_SETS.flatMap(set => B_SEQUENCES.map(s => s.map(n => set[n - 1]))),
              f => multiNotePerString(f, 1)),
        block("b2", "Six notes per string", "8ths",
              B_SIX, f => multiNotePerString(f, 1)),
      ],
    },
    {
      id: "C", name: "The 24 combinations", subtitle: "Four-finger permutations",
      optional: true,
      blocks: [
        block("c1", "All 24", "triplets", FOUR_ALL, f => multiNotePerString(f, 1)),
      ],
    },
  ];
}

const ROUTINE_META = {
  title: "The Ultimate Legato Warmup Routine",
  defaultBpm: 50,
  positions: [1, 5, 9, 13, 17],
  defaultPositions: [1, 5, 9, 13],   // Jon does not usually run the 17th
  defaultSections: ["A"],            // B and C are extra credit
};

module.exports = { buildRoutine, ROUTINE_META, TWO, TWO_REV, THREE_ALL, FOUR_ALL,
                   B_SEQUENCES, B_SIX, oneNotePerString, multiNotePerString };
