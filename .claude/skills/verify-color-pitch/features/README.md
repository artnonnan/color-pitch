# Color Pitch verification map

This folder is the maintained source for what a player can see and do in Color Pitch. Read this index before you drive the app, then use the matching feature file as the recipe.

## Baseline preconditions

- Launch the production server as described in `../SKILL.md`. `doctor` must pass with the right build id.
- Each `drive.cjs` run uses a fresh browser profile, so the player is new.
  - Unlocked: notes C and G, chords major and minor, scale degrees 1, 5 and 3, intervals P8, P5 and M3, progression chords I, IV and V.
  - Melody length is 3.
  - Interval direction is `up`, and the instrument is `piano`.
- The driver picks the **guest** profile on the picker and keeps cloud sync off (see [profiles](./profiles.md)).
- Never drive a server this verification run did not start.

## Driving conventions

- Every exercise screen except First Note is gated: a fresh player sees "ทำโน้ตแรกของวันก่อน". Call `skipGate()`, or do the first note, before the exercise appears.
- Use player actions only: taps on buttons and keys, waiting, and tapping the feedback to advance. To reach a locked state, play through the 30-answer, ≥ 90 % unlock.
- Read answers from `window.__cpQuestion` (read-only). Never write `localStorage` to skip ahead.
- The first tap anywhere unlocks audio (the iOS rule). `audio().context` is `"running"` after that.

## Proof and skip reporting

- Capture the action and the result: state or `after.json` from before and after, screenshots, and `run-log.json`.
- Record the feature ID and the entry point used with every artifact.
- If a path is unreachable, report the command you tried and the precondition that was missing.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph that describes what the player sees. Then come exactly four H2 sections, in this order: `Sub-features`, `How to get to it (player POV)`, `Driving it with drive.cjs`, and `Gotchas`.

## Features

- [Note + color quiz](./note-quiz.md) covers the core loop: hear a note, tap its colored key, and unlock notes by accuracy.
- [Scale degrees](./scale-degrees.md) covers functional ear training: a cadence sets the key, then the player names the degree of one note.
- [Intervals](./intervals.md) covers hearing two notes and naming the distance, in four directions, with unlocks.
- [Profiles and cloud sync](./profiles.md) covers the อาท / Guest picker on every open, separate progress per profile, and Supabase sync across devices.
- [Chord progressions](./progressions.md) covers an intro lesson (I = home, V = tension, IV = open), then four levels from "I then IV or V" up to four chords, with a hint that doesn't count and per-slot replay.
- [Melody](./melody.md) covers melodic dictation with absolute pitch: hearing a melody of unlocked notes and tapping it back, with melodies growing from 3 to 6 notes.
- [Audio unlock and sound diagnostics](./audio-unlock.md) covers the first-tap unlock (from the profile picker), the silent media-channel loop, the session fallback, and the Settings diagnostics card.
- [Mode brightness](./modes.md) covers the week-4 lock, an intro lesson, and four levels from bright/dark up to the seven-mode slider, with the differing notes highlighted.
- [Mix voices](./mix-voices.md) covers the "สลับเสียง" instrument setting, which changes timbre on every question.

Not mapped yet. Each still has an older script in `scripts/` that needs porting to `drive.cjs`:
- daily session runner and First Note (`verify-edge.cjs`)
- Chords
- Color Rush, Sing, Roots (`verify-new-exercises.cjs`)
- Tuner
- Stats
- Settings colors and import/export
- audio resume after background (`verify-resume.cjs`; the suspension path is now covered by `audio-unlock.js`)
- iOS mic session (`verify-ios-mic.cjs`)
