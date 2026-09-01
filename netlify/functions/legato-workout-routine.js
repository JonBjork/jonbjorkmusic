// =============================================================================
// The Legato Workout — the routine itself.
//
// Written to Jon's spec, Sept 2026. This replaces the routine decoded from the
// 2020 Guitar Pro file, which was kept but judged too much material.
//
// Strings are numbered the way tab numbers them: 6 = low E, 1 = high e. The
// routine starts on the low E and works up to the high e.
//
// Everything stays in one position, so the fret written is the finger number.
// The app names the position rather than transposing the tab.
//
// THE TURNAROUND. Every exercise goes up the strings and back down, and the
// high e is played twice in a row at the top. That is deliberate: come straight
// back to the B string and the high e would get one rep where every other
// string gets two.
//
// TWO MODES, decided by the player, not baked in here:
//   Normal Legato  picks the first note of each string, down going up the
//                  strings, up coming back. Positions 1, 5, 9, 13, 17.
//   All Hammers    no pick at all, every string entered with a hammer-on from
//                  nowhere. Positions 3, 7, 11, 15, 17, because open strings
//                  make muting a nuisance and nothing should run past fret 20.
// The notes are identical in both. This file marks where each string visit
// starts and which way it is moving; the app turns that into a pick stroke or
// a tap.
//
// This file is only ever reached through legato-workout-unlock.js, behind a
// valid license key. It must not be copied into the public site folder.
// =============================================================================

const TWO = [[1,2],[1,3],[1,4],[2,3],[2,4],[3,4]];
const TWO_ALL = [...TWO, ...TWO.map(f => [...f].reverse())];   // 12: pairs, then reversed

// Lexicographic, lowest number first, which is the order on Jon's cheat sheet
// read down the columns: 1234 1243 1324 1342 1423 1432, then 2134 ...
function permutations(a) {
  if (a.length <= 1) return [a];
  const out = [];
  [...a].sort((x, y) => x - y).forEach((x, i, sorted) =>
    permutations(sorted.filter((_, j) => j !== i)).forEach(p => out.push([x, ...p])));
  return out;
}
const THREE_ALL = [[1,2,3],[1,2,4],[1,3,4],[2,3,4]].flatMap(permutations);   // 24
const FOUR_ALL  = permutations([1,2,3,4]);                                    // 24

const UP   = [6,5,4,3,2,1];
const DOWN = [1,2,3,4,5,6];

// One entry per string visit: which string, how many times the fingering is
// played on it, and which way the hand is travelling.
//   Two fingers   four reps a string, eight on the high e because you turn
//                 around there, so every string ends up with an even number.
//   Three, four   one rep a string, the high e visited twice at the top.
function visits(reps, topReps) {
  const out = [];
  UP.forEach((s, i) => out.push({ string: s, reps: s === 1 ? topReps : reps, dir: "up" }));
  DOWN.slice(1).forEach(s => out.push({ string: s, reps, dir: "down" }));
  return out;
}
const TWO_VISITS   = visits(4, 8);   // high e picked once, eight reps straight through
const GROUP_VISITS = [                // three and four fingers: the high e twice over
  ...UP.map(s => ({ string: s, reps: 1, dir: "up" })),
  ...DOWN.map(s => ({ string: s, reps: 1, dir: "down" })),
];

function notesFor(fingering, visitList) {
  const notes = [];
  visitList.forEach(v => {
    for (let r = 0; r < v.reps; r++)
      fingering.forEach((f, i) => notes.push({
        string: v.string,
        fret: f,
        // The app picks or taps the first note of a string visit and slurs the
        // rest. dir tells it which way the pick stroke goes.
        stringStart: r === 0 && i === 0,
        dir: v.dir,
      }));
  });
  return notes;
}

function section(id, name, subtitle, list, visitList) {
  return {
    id, name, subtitle, noteValue: "8ths",
    exercises: list.map(f => ({
      id: `${id}-${f.join("")}`,
      fingering: f,
      fingeringLabel: f.join(""),
      notes: notesFor(f, visitList),
    })),
  };
}

function buildRoutine() {
  return [
    section("two",   "Two fingers",   "Six pairs, then the same six turned around",
            TWO_ALL,   TWO_VISITS),
    section("three", "Three fingers", "All 24 combinations",
            THREE_ALL, GROUP_VISITS),
    section("four",  "Four fingers",  "All 24 combinations",
            FOUR_ALL,  GROUP_VISITS),
  ];
}

const ROUTINE_META = {
  title: "The Legato Workout",
  defaultBpm: 50,
  noteValue: "8ths",
  modes: [
    { id: "legato",  name: "Normal Legato", positions: [1, 5, 9, 13, 17],
      blurb: "Pick the first note of each string. Down going up the strings, up coming back." },
    { id: "hammers", name: "All Hammers",   positions: [3, 7, 11, 15, 17],
      blurb: "No pick at all. Every string starts with a hammer-on from nowhere, so mute what you are not playing." },
  ],
  // A full workout is the two-finger set plus one of the others. All three is
  // for when someone wants a longer session.
  defaultSections: ["two", "three"],
};

module.exports = { buildRoutine, ROUTINE_META, TWO_ALL, THREE_ALL, FOUR_ALL };
