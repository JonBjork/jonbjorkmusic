# Workouts: standalone subscription app

Spec for breaking the Practice Lab Workouts section out as its own product. Written 2026-09-10 against the current state of `practice-lab/src/workouts` and the `jonbjorkmusic` repo. Hand this to Claude Code in the `jonbjorkmusic` repo.

## What we are building

A standalone web app at `workouts.jonbjorkmusic.com` containing exactly what lives in Practice Lab > Workouts today: the picking routine, the two repertoire pieces (Caprice 16, Solfeggietto), the chromatic workout, Focus Mode, Practice Room Sessions, the log, calendar and coverage views, bar and pattern assessments, tuning, and export/import. Nothing from the other labs. No dashboard.

Sold through Lemon Squeezy as a $19/month subscription with a 7-day free trial. Access is a licence key, same mechanism as `/picking-workout`. No accounts, no server-side user data. All practice data lives in the browser and in a JSON file the student can export and import.

Practice Room members keep the section inside Practice Lab as today. Both apps must run the same engine and the same workout data, so adding a workout is one data file and one deploy.

## Decisions already made

Price is $19/month, locked for as long as the subscription runs. Trial is 7 days. No accounts. Data merging across devices is a requirement, not a nice-to-have. The $29 one-time picking workout stays as a separate product and is not touched. The in-app upsell points to The Practice Room sales page at `jonbjorkmusic.com/practiceroom`.

## Repo layout

Everything new goes in the `jonbjorkmusic` repo. The engine and the data become a package that both apps consume.

```
jonbjorkmusic/
  packages/workouts/            the shared package
    engine/                     React components, metronome, guitar synth, storage, merge
    routines/                   one file per workout (picking, caprice16, solfeggietto,
                                chromatic, room sessions), plus catalog.js
    audio/                      guitar multi-samples (from practice-lab/public/audio)
    metronome-sounds/           click.wav, hihat.wav (from practice-lab/public/metronomes)
    package.json                name "@jonbjork/workouts"
  apps/workouts/                the Vite + React app shell, built to a Netlify site
  netlify/functions/
    workouts-unlock.js          licence gate, returns the catalog
    workouts-routine.js         returns one workout's data behind the key
```

Practice Lab installs the package from GitHub by tag (`"@jonbjork/workouts": "github:jonbjork/jonbjorkmusic#workouts-v1.0.0"` with a `prepare` step, or a git subtree if the monorepo install is awkward under react-scripts). Either way there is one copy of the code. Do not leave a second copy in `practice-lab/src/workouts` once the package works; replace it with imports.

What moves out of `practice-lab`: all of `src/workouts/`, `src/shared/metronome.js`, `src/shared/DataInfoIntro.jsx`, `public/audio`, `public/metronomes`, `public/workouts` (covers only, not the workbook PDF unless it is offered in the app). What is dropped from the workouts code: the four `addEvent` calls into `dashboard/practiceLog`. Make that an optional `onSession` callback prop on the top-level `Workouts` component so Practice Lab can keep feeding its dashboard and the standalone app passes nothing.

The audio and sound paths in `guitarSynth.js` and `metronome.js` are hard-coded to `/audio/...` and `SOUND_BASE`. Make them a base URL the app provides, so the same code serves from either origin.

## Access

Copy the pattern from `netlify/functions/picking-workout-unlock.js` and `picking-workout/app.js` lines 470 to 630. Public licence endpoints only, no store API token.

Flow on every app load: read `{key, instanceId}` from `localStorage["workouts.licence"]`. If present, call `workouts-unlock` with them, which runs `validate`. If absent, show the key entry screen; entering a key runs `activate` and stores the returned instance id. The function checks `product_id` against `WORKOUTS_PRODUCT_ID` (Netlify env var, set before launch) so a Looper or picking-workout key does not unlock this.

The unlock response returns the catalog: the list of workouts with id, title, short, kind, blurb, cover, `addedAt`, and default settings. Workout note data comes from `workouts-routine.js` on demand, one workout per call, behind the same key check. Cache fetched routines in memory for the session, never in localStorage. This is what makes a lapsed subscription actually stop working; the picking app already does this and it is the reason the bundled-in-client approach in Practice Lab is not acceptable for a subscription.

Validation must succeed to load. There is no offline grace, because the app needs the network for routine data and audio anyway. If the validation call fails for a network reason (not a "key invalid" response), show a retry screen, not the key entry screen, so a flaky connection does not make people think they were locked out.

Lemon Squeezy setup: one product, subscription pricing, $19/month, 7-day trial, licence keys enabled, activation limit 3. Store the product id in `WORKOUTS_PRODUCT_ID`. Lemon Squeezy's docs say subscription keys stay valid while the subscription is active and expire when it is cancelled and the billing period ends, or a payment fails and cannot be retried. The docs do not say what the key's status is during a trial. Before launch, do one checkout in test mode with the trial on and confirm `validate` returns valid while the subscription is `on_trial`. If it does not, the product cannot use a trial and needs a different first-month approach; find that out before writing the sales page.

Deactivating a device: a small "This device" section in settings with a "Sign out on this device" button that calls `deactivate`, exactly like the picking app.

## Data model and the merge

One JSON file, exported and imported from the app's Data screen. Version 2 of the existing workout log format.

```json
{
  "product": "workouts",
  "version": 2,
  "exportedAt": "2026-09-10T18:22:00.000Z",
  "sessions": [ ... ],
  "barRatings": { "<workoutId>:<bar>:<bpm>:<notesPerBeat>": { "rating", "bpm", "notesPerBeat", "updatedAt" } },
  "patternRatings": { "<position>:<patternId>:<stroke>": { "rating", "bpm", "position", "updatedAt" } },
  "prefs": { ... }
}
```

Sessions get a real id. Add `id: crypto.randomUUID()` in `addSession` at write time. Keep `startedAt` as it is. The current storage layer has four separate localStorage keys (`workouts.log`, `workouts.barRatings.v1`, `workouts.patternRatings.v1`, `workouts.prefs`, plus `workouts.focus.<id>` and `workouts.chromatic.settings`). They can stay separate in localStorage; the export gathers them and the import distributes them.

Import is a merge, never a replace. Rules:

Sessions: a session is a duplicate if its `id` matches one already stored. For sessions without an id (files exported before this change, and the Practice Lab export), fall back to the existing composite key `startedAt|seconds|position|startStroke`. Append what is new, sort by `startedAt`, report the count added. This is what `storage.js importLog` already does; it only needs the id check added in front.

Bar ratings and pattern ratings: per key, keep whichever record has the later `updatedAt`. `normalizeRatings` in `barRatings.js` already does exactly this inside one file, so the merge is `normalizeRatings({...local, ...incomingFilteredToNewer})`. Pattern ratings have `updatedAt` too; give them the same treatment.

Prefs: local wins. A device's own settings are not overwritten by a file. If the device has no prefs at all (fresh install), seed them from the file.

Result: a student can practise on a laptop and an iPad, export from each, import each file on the other, and both end up with the full log and the freshest assessments. No sessions are double-counted because a session that exists on both devices has the same id. Show the outcome after import in plain words: "Added 14 sessions and 6 assessments. Nothing was removed."

Accept the old formats on import: a version 1 `workouts.log` export, and a Practice Lab unified backup (`tool: "practiceLab"` with a `data` object keyed by localStorage names). For the latter, pull only the `workouts.*` keys. This lets a Practice Room member who later moves to the standalone app, or the reverse, carry their history.

Practice Lab's own Data page keeps its wipe-and-replace backup for the other labs, but the Workouts section inside Practice Lab should use this same merge import for workout files. That is a small change in `practice-lab` once the package is in place.

## Storage durability

Safari on iPhone and iPad deletes localStorage for a site the user has not visited in 7 days of Safari use, unless the site is installed to the home screen. This is the real risk of the no-accounts model and it needs two things.

Make the app installable: a web manifest with name, icons, `display: standalone`, theme colour `#0D0D0D`, and a minimal service worker (it does not need to work offline, it needs to exist so the install prompt appears). On iOS Safari, when not running in standalone mode, show a one-time dismissible note explaining Share > Add to Home Screen and why it matters.

Backup nudge: track `workouts.lastExportAt`. When there are sessions newer than the last export and the last export is more than 7 days old (or never), show a quiet banner on the home screen with an Export button. Practice Lab already has `getLastBackupAt` / `setLastBackupAt` for this; reuse the idea.

## Catalogue and "new this week"

`catalog.js` in the package lists every workout with an `addedAt` date. The home screen sorts Practice Room Sessions and any workout added in the last 14 days into a "New" row at the top. This is the visible proof that the subscription keeps growing, and it costs nothing beyond the date field. Adding a workout is: add the data file, add the catalog entry with today's date, tag the package, deploy. Practice Lab picks it up on its next dependency bump.

## In-app upsell

One card on the home screen and one line on the Data screen, both linking to `https://jonbjorkmusic.com/practiceroom?ref=workouts-app`. Copy is short and in Jon's voice: this app is part of The Practice Room, which adds the courses, the community and everything else. No price in the app copy, so it does not go stale. Use the real destination URL, not a redirect.

## Out of scope for version 1

Cloud sync, accounts, offline mode, the workbook PDF, any content from the other labs, a discount for existing picking-workout buyers (worth doing, but it is a Lemon Squeezy discount code and an email, not app work).

## Pre-launch checklist

Trial behaviour of licence keys confirmed in test mode (see Access). `WORKOUTS_PRODUCT_ID` set on Netlify. Export from Practice Lab, import into the standalone app, confirm the merge counts. Export from two devices, cross-import, confirm no duplicate sessions and newest ratings win. Install to home screen on an iPhone and confirm the log survives a week. A lapsed test subscription is refused at the gate. Practice Lab builds and runs with the package instead of the local folder, and its dashboard still receives workout sessions through the `onSession` callback.

## Sources checked

`practice-lab/src/workouts/storage.js` (existing merge import, session composite key), `barRatings.js` and `PickingSetup.jsx` (rating shapes with `updatedAt`), `dashboard/practiceLog.js` (unified backup is wipe-and-replace), `netlify/functions/picking-workout-unlock.js` and `picking-workout/app.js` (licence flow), Lemon Squeezy docs on licence keys and subscriptions.
