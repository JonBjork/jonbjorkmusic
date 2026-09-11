# Standalone Workouts starter

Local first copy of the approved library, 2026-09-10:

- The Ultimate Alternate Picking Workout.
- The Practice Room Sessions collection, initially Classic Alternate Picked Shred Sequence (five days / five keys).

Caprice 16, Solfeggietto, and The Vinnie Moore Picking Workout are not included. Their note data and covers are not copied. The existing Practice Lab and the separate paid picking-workout product are unchanged.

## Local preview

Run `npm install` and `npm run build` in this folder, then serve `dist` with a local HTTP server. Open the HTTP address, rather than opening index.html as a file.

The initial lightweight build uses webpack, with no minification and a single build worker. To reuse Practice Lab's installed dependencies without installing a second set:

```
WORKOUTS_DEPENDENCY_ROOT=/Users/jonbjork/Documents/GitHub/practice-lab node build.cjs
python3 -m http.server 4324 --bind 127.0.0.1 --directory dist
```

## Boundaries of this starter

The engine is in `packages/workouts`. Relative asset paths allow the app to run on its own origin. `configureAssets` configures the instrument and click sample origin. The optional `onSession` callback on Workouts receives session events; this app has no Practice Lab dashboard dependency.

Practice Lab still uses its original source. This is an initial copied starter, not the completed shared-package migration. Before maintaining both products in production, consolidate the source and make Practice Lab import the shared package, passing its dashboard callback. Do not update the two copies independently.

The existing session player, sound controls, tuning, per-workout history and assessments are preserved. The revised My Practice screen, category navigation, unified version-2 merge import/export and optional introductions have not yet been built.

No billing gate or subscription access is implemented in this local starter. Workout data is currently bundled for local review. Before launch it must be served behind validated licence access, as described in the revised product plan. No production deployment is configured for this app yet. The main website build excludes both apps/ and packages/ so its normal deployment does not expose this prototype.

Next content can be added here once Jon provides the four new workouts. The current standalone catalog is `packages/workouts/routines/catalog.js`; the initial legacy builders still live under engine/workouts pending the shared-package migration.

## 3NPS addition

The 3-Notes-Per-String Alternate Picking Workout #1 is now included. It uses the supplied GP sequence notes mapped to adjacent scale shapes for all twelve keys, reversible initial picking, and a two-beat count-in at the selected tempo between sequences. The starting stroke alternates per position. Written sequences omit the isolated return note; the builder appends the opening note as instructed in the transcript. Defaults: C major/A minor, 80 BPM, eighth notes, grand piano. Supports 22/24 frets. Targeted tests: `npm test`.
