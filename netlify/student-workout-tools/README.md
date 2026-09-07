# Student workouts

The shared static player is in `student-workouts/`. Student pages load a configuration from `student-workouts/students/`; Luke's route is `/lukebolton/`. Deploy through the existing GitHub-connected Netlify build. No new build step or dependency is required.

Luke currently has two independent routines and an empty, selectable Alternate Picking Deep Dive section awaiting source material. All hammers uses 24 three-finger permutations at positions 3, 7, 11, 15, 17, defaulting to 50 BPM eighth notes. Triplet picking uses the supplied Guitar Pro score at positions 1, 5, 9, 13, 17, defaulting to 60 BPM eighth-note triplets. Each position stops at its full musical end and is manually continued with a count-in.

`triplet-score.js` preserves all 11 fingerings from the user-supplied “Guitar Gym - Alternate Picking Upgrade - Triplet Picking 2,3 & 4 Notes Per String.gp”, including its shifted descents and final whole note. The five positions contain 4,440 timing ticks. All hammers contains 4,320 ticks. Default total playing times are 24:40 and 43:12 respectively.

Audio and the metronome engine were copied from Practice Lab, with asset paths made relative to this player. Practice Lab itself is unchanged. Keep `audio/CREDITS.txt` and the upstream attribution files with the recordings.

Progress is browser-local under `jb-student-v1:<student id>`. JSON backups include version, student identifier, settings, independent routine checkpoints and practice entries. Entries use UUIDs for duplicate-safe merging; newer checkpoints win. Waiting and count-ins are excluded from credited playing time. Backgrounding pauses playback; notes are credited as played by the player, not measured through a microphone.

Validation: `node netlify/student-workout-tools/model.test.mjs`. These development files are under `netlify/` so the established build excludes them from static publishing.
