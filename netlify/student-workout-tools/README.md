# Student workouts

The shared static player is in `student-workouts/`. Student pages load a configuration from `student-workouts/students/`; Luke's route is `/lukebolton/`. Deploy through the existing GitHub-connected Netlify build. No new build step or dependency is required.

Luke has three independent routines. Alternate Picking Deep Dive contains four separately selectable sections: Six-string shapes, Two-string shapes, Single String and Picking Hand Focus. All hammers uses 24 three-finger permutations at positions 3, 7, 11, 15, 17, defaulting to 50 BPM eighth notes. Triplet picking uses the supplied Guitar Pro score at positions 1, 5, 9, 13, 17, defaulting to 60 BPM eighth-note triplets. Positions are selected independently with five buttons. Each chosen position stops at its full musical end. Pause resumes in place within the open page; reopening the page or changing routines restarts the saved position. Selecting another position starts it from the beginning with a count-in.

`triplet-score.js` preserves all 11 fingerings from the user-supplied “Guitar Gym - Alternate Picking Upgrade - Triplet Picking 2,3 & 4 Notes Per String.gp”, including its shifted descents and final whole note. The five positions contain 4,440 timing ticks. All hammers contains 4,320 ticks. Default total playing times are 24:40 and 43:12 respectively.

Audio and the metronome engine were copied from Practice Lab, with asset paths made relative to this player. Practice Lab itself is unchanged. Keep `audio/CREDITS.txt` and the upstream attribution files with the recordings.

Progress is browser-local under `jb-student-v1:<student id>`. JSON backups include version, student identifier, settings, independent routine checkpoints and practice entries. Entries use UUIDs for duplicate-safe merging; newer checkpoints win. Waiting and count-ins are excluded from credited playing time. Backgrounding pauses playback; notes are credited as played by the player, not measured through a microphone.

Validation: `node netlify/student-workout-tools/model.test.mjs`. These development files are under `netlify/` so the established build excludes them from static publishing.

Six-string shapes uses the repository C-major 3NPS chart, all 11 playable shapes from low E fret 1 through 19 on a 24-fret guitar. It uses the Practice Room Sessions shape geometry, root styling and current-note highlight, and defaults to the same grand piano and full instrument/metronome levels on first entry. Each shape has a 35-note low-to-low return and a 35-note high-to-high return, no duplicated turnaround, each starting downstroke after its own count-in. Quarter notes at 80 BPM give 9:37.5 of music for all 22 passages. Tempo can be lowered to 20 BPM but is capped at 80 for the transition-time exercise.

The long combination selector is intentionally omitted. Student-facing countdowns cover only the selected position for All hammers (8:38.4 at 50 BPM) and Triplet picking (4:56 at 60 BPM). JSON backups retain the selected positions and practice events. Triplet groups use a single lower beam and the tuplet number underneath, matching Practice Lab.

Deep Dive Section 2: `two-string-score.js` contains the exact pitches and shifts extracted from `APDD #1 Two-String Shapes.gp`. Five adjacent pairs run in order B–e, G–B, D–G, A–D, low E–A. Each pair ascends through all six-note chunks and then reverses the exact sequence. Score durations were intentionally replaced with quarter notes for the teacher's 80 BPM transition-time practice; score-filling rests are not inserted. There are 708 played notes (8:51 total), and the diagram updates each six-note group.

Deep Dive Section 3: `single-string-score.js` stores the six fret maps from `APDD #1 Single String.gp`. The high-e example is written in full in that score; the remaining strings provide the fret maps. All strings use the teacher's overlapping three-note groups up the neck and their exact reversal, with continuous alternate picking. There are 432 quarter notes (5:24 at 80 BPM). The diagram updates each three-note group.

Each Deep Dive section retains its own checkpoint under `deepdive:<section-id>`. All four assigned Deep Dive sections are implemented. Deployment is handled by the user.

Deep Dive Section 4 follows the exact opening in `APDD #1 Picking Hand Focus.gp`, continuing the demonstrated half-step zigzag from base fret 1 up to 22 (highest sounding fret 24), then back to 1. There are 43 crossings of six strings, three repeated notes per string, 774 triplet notes at 50 BPM (5:09.6). Only this section applies the 60 ms note gate; the copied synthesizer's tight release adds 12 ms. Its default is clean electric; other Deep Dive sections default to the Practice Room's grand piano. Sound choices are remembered independently. Validate envelopes with `node netlify/student-workout-tools/audio.test.mjs`.

The opening Your plan tab addresses Luke directly and explains two positions of each main routine plus all four Deep Dive sections. At default tempos this is 56:10.9 of music and 58:12.3 including the implemented count-ins, before breaks. The heading is 12-Week Guitar Mastery Program.

Vincent’s `/vincentstagliano/` page selects `player: 'chunks'`. The shared dispatcher mounts `chunk-player.js`, with pure grouping, cycle timing and backup validation in `chunk-model.js` and notation in `chunk-notation.js`. It shares the existing samples, metronome, styling and sound credits. Luke’s playback path is unchanged.

`love-gun-score.js` preserves the supplied “Love Gun Vincent Stagliano.gp”: 38 played notes, an upstroke low-E fret-12 pickup on the final triplet of the count-in, 36 eighth-note triplets spanning three 4/4 bars, then a four-beat high-e fret-19 downstroke. Leading score-filling rests are represented by the count-in. Guitar Pro string 0 maps to low E; pitches come from the score’s standard tuning and frets. The default tempo is the source’s 60 BPM.

Six base chunks each span two beats. Groups include the first note following their final chunk; groups starting at chunk 1 also include the pickup. Sliding windows have sizes 1, 2, 3, 4 and whole, giving 6+5+4+3+1=19 groups. The terminal whole note keeps its complete four beats and is not a separate one-note chunk. Timer defaults to 120 seconds for every group and runs continuously through count-ins, music and padding. Playback stops when the timer expires. Every repetition gets a two-beat count-in, with the pickup inside its final beat. Pausing freezes the timer. The daily playing-time statistic still counts only the music itself.

Chunk progress uses `jb-chunks-v1:<student>:<score>` and a separate validated JSON format. It retains each group’s timer, selected stage/group, audio settings, and per-day events (playing seconds, completed repetitions, finished timers, tempo). Pausing or returning restarts the group’s phrase with the saved timer. Resetting a timer keeps historical events. Import merges UUID events without duplication and takes newer per-group checkpoints. No teacher visibility or cross-device sync is implied.

Validate with `node netlify/student-workout-tools/chunks.test.mjs`, alongside the existing model and audio tests.
