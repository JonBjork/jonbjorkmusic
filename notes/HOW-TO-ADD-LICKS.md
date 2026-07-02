# How to add a Lick of the Day to the website

The lick library is an Eleventy collection in this `notes/` folder, deployed on Netlify.
Each lick is one markdown file in `notes/src/licks/` that renders to `/licks/{number}-{slug}/`.
The library is at `/licks/`, with auto-generated technique tag pages at `/licks/technique/{technique}/`.

## What you need per lick
- The lick **number** (e.g. 31)
- The **YouTube video ID** (the part after `watch?v=`)
- A short **note** in Jon's voice
- The **tab PNG**, found in the "Lick Of The Day" folder (one `.png` per lick folder)

Add as many as you like, then do ONE git push at the end (Netlify bills credits per build).

## Step 1 — Copy the tab image
Copy the lick folder's `.png` into `notes/src/images/`, renamed to match the slug:
`notes/src/images/lotd-{N}-{slug}.png`
(The source files are Dropbox cloud-synced. If a copy comes out as 0 bytes, the file isn't downloaded locally yet — in Dropbox, right-click the "Lick Of The Day" folder and choose "Make Available Offline," then retry. Verify the copied size matches the source.)

## Step 2 — Create the markdown page
File: `notes/src/licks/{N}-{slug}.md`
Slug = number + keyword title, lowercase and hyphenated, with sharps written out (e.g. `15-f-sharp-minor-...`).

```
---
title: "Lick Of The Day #{N}: {Title}"
date: 2026-06-25
techniques: ["Alternate Picking", "Sweep Picking"]
key: "A Minor"
youtube: "VIDEO_ID"
tab_image: /notes/images/lotd-{N}-{slug}.png
summary: "One sentence shown on the library list and as the meta description."
download_url: ""
download_label: ""
---

{Body: the note, lightly formatted, with the key musical terms in bold.}

Jon
```

## Technique tags (controlled vocabulary)
`techniques` is a LIST — a lick can carry several. Use only these (they match the CMS dropdown,
and each value gets its own tag page automatically):
Alternate Picking, Legato, Sweep Picking, Hybrid Picking, Economy Picking, Tapping, String Skipping, Bending & Vibrato.
If a genuinely new technique comes up, add it here and in `admin/config.yml`.

## Style rules
- **No em dashes** in visible copy — use commas or periods.
- **Flat/sharp keys use the glyphs** B♭, E♭, A♭, F♯, C♯ (not "Bb" / "F#") in the title, key, and summary.
  The titles and key meta are CSS-uppercased, which would otherwise turn "Bb" into "BB".
- End the body with `Jon` on its own line (not "/Jon", no dash).
- No "comment below" — each page has a built-in "Email me" link, so phrase invites as "let me know if you have any questions."
- Keep Jon's voice and any emojis.

## Step 3 — Build and verify
```
cd notes && npx @11ty/eleventy
```
(Ignore the harmless `EPERM ... _site/images/.gitkeep` line; it doesn't happen on Netlify.)
Confirm: the page built with the right video + tab image, the library lists it (newest number first),
and each technique it carries lists it on the matching tag page. Check no em dashes leaked into visible copy.

## Step 4 — Deploy (batched)
```
cd ~/Documents/GitHub/jonbjorkmusic
rm -f .git/index.lock
git add -A
git commit -m "Add licks ..."
git push
```
Netlify auto-deploys on push.

## Related
- The "download all licks" zip lives at `/downloads/all-licks.zip`, delivered behind an email opt-in
  (Kit form → "Lick Library — Free Download" sequence). Adding a lick doesn't require touching this.
- Each lick page leads with a Practice Room Pro CTA; the nav and library already link everything.
