# Color Pitch 🎨🎹

A mobile-first ear-training web app, inspired by Jacob Collier, that trains two skills together:

1. **Absolute pitch**: naming a note with no reference note.
2. **Sound–color association (trained synesthesia)**: linking each note and chord to a color and a mood.

The UI is in Thai (note names stay as C, D, E, F#…). All strings live in [`i18n/th.ts`](i18n/th.ts).

## Local development

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npm start          # serve the production build (the service worker only runs here)
```

Requires Node ≥ 20.9. Tailwind is pinned to 4.2.x because 4.3 needs Node ≥ 20.19.

To try the microphone on a phone, the page must be served over **https** (or `localhost`). The easiest route is to deploy to Vercel.

## Deploy to Vercel (zero config)

**Option A: GitHub import**
1. Push this repo to GitHub.
2. Go to <https://vercel.com/new>, import the repo, and click **Deploy**. Vercel detects Next.js and needs no settings.

**Option B: CLI**
```bash
npm i -g vercel
vercel          # preview deploy
vercel --prod   # production
```

Then open the URL on your phone and choose **Add to Home Screen** (iOS Safari: Share → Add to Home Screen). The app installs as a PWA and works offline after the first load.

## How the training works

The research behind the method: daily, repeated associative training (for example 30 min/day for 9 weeks) can build synesthesia-like experiences. Some adults also learn absolute pitch from about 4 hours a week of note identification with immediate feedback. **Daily consistency matters more than session length**, so the home screen leads with a streak.

Daily session (~10–15 min), started with one button:

| # | Exercise | What happens |
|---|---|---|
| 1 | **Daily first note** (~1 min) | Before hearing anything else, hum the target note (C in week 1; it rotates weekly through C G E A D F B). The mic (pitchy, McLeod pitch method) measures your error in cents, folded into one octave, then plays the real note. If the mic is denied, a silent-start pitch slider is the fallback. Logged once per day and charted. |
| 2 | **Note + color quiz** (~5 min) | A random piano note in C3–C5. Answer on a colored keyboard. A correct answer flashes the note's color across the screen. A wrong answer plays both notes. **Progressive unlock:** start with C and G; ≥ 90 % over the last 30 answers on the current set unlocks the next note (C, G, E, A, D, F, B, then the black keys). Hard mode hides the colors. |
| 3 | **Chord colors & moods** (~3 min) | Name the chord quality (major/minor first, then maj7, sus4, dim, aug, using the same 90 %/30 rule). Every answer shows a full-screen mood card (color + image + mood word) for about 1.7 s. |
| 4 | **Mode brightness** | Unlocks in week 4, or once all 7 white keys are unlocked. Hear a C scale in one of 7 modes and place it on a bright-to-dark slider (Lydian → Locrian). The background shifts with your choice. |
| 6 | **Color Rush** | A 60-second speed round. Combos raise the multiplier (x2 every 5 in a row, capped at x5), fast answers earn a bonus, and the high score is saved. Answers count toward the normal unlocks. |
| 7 | **Sing the Color** | See only a color, with no note name, and sing its pitch. The mic grades it (within ±50¢ of the right note counts). This trains color → pitch, the reverse direction. If the mic fails, tap the key instead (keys have no colors). |
| 8 | **Chord Root** | Hear a chord and tap its root note. This is absolute pitch inside harmony. |
| 9 | **Scale Degrees** | A I–IV–V–I cadence sets a random major key, then one note plays. Tap its degree (1–7, with solfège and a feeling word). Feedback names the real note in its own color, then the note walks home to 1 (2–5 down, 6–7 up). Degrees unlock 1, 5, 3 → 2, 4, 6, 7 by the same 90 %/30 rule. This is "functional ear training": relative hearing, linked back to absolute colors. |
| 10 | **Intervals** | Hear two notes (up, down, together, or mixed) and name the distance. The feedback blends the two notes' colors. Unlock order: P8, P5, M3, then P4, m3, M2, m2, M6, m6, M7, m7, tritone. |
| 11 | **Chord Progressions** | Hear four chords in a random major key. The first is always I. Tap the function of chords 2–4 (I, IV, V first, then vi, ii, iii by the 90 %/30 rule). Feedback reveals each chord's name in the key, its major/minor mood, and its root note's color, then replays the progression. Common practice in ear-training courses: start with the three primary chords, then add vi. |
| 12 | **Melody** | Melodic dictation with absolute pitch. Hear a short melody made only of your unlocked notes, then tap it back on the colored keyboard. Nothing plays while you answer, so each note is named from memory, not by its distance from the note before. Melodies start at 3 notes and grow to 6 by the 90 %/30 rule (each note counts). |
| 5 | **Pocket tuner** | Hear a sound in daily life: tap your guess, then measure. Shows the real note and its color, and logs your accuracy. |

**Visual feedback:** particle bursts in the note's color on correct answers, a combo counter (its color is fixed so it never gives away the answer), a full-screen ceremony when a note unlocks, a slowly drifting aurora in your unlocked colors, and fireworks for new high scores and finished sessions. All of it respects "reduce motion".

The 4-week curriculum on the home screen is guidance only. Unlocks follow your accuracy.

**Mix voices (Settings → Instrument → Mix):** every new question uses a different voice (piano, sine, soft triangle, FM bell, filtered strings). A 2025 University of Surrey study found that adults' pitch-label training carried over to an instrument they had not trained on. Mixing timbres here pushes the same way: learn the note, not the piano.

**Default colors:** C red, D orange, E yellow, F green, G sky blue, A blue, B purple. Black keys blend their neighbors (C# = red-orange). Change them in Settings, because self-chosen colors stick better.

## Data and profiles

- **Picker on every open:** the app shows a picker: **1. อาท** or **2. Guest**. Each profile has its own progress and settings. There is no login and no PIN, by choice, and Guest is shared by everyone who picks it.
- **Local copy:** each profile is kept in `localStorage` (`color-pitch:v1:<profile>` plus a `:ts` timestamp). Progress from before profiles existed (`color-pitch:v1`) moves into อาท. Every read and write is wrapped in try/catch, and private mode shows a warning.
- **Cloud sync (Supabase):**
  - Each profile is one row in `cp_profiles`.
  - Writes go only through the `cp_save` RPC, which accepts only `art`/`guest` and never replaces a newer copy with an older one.
  - Changes are sent after 2.5 s of quiet and when the app is hidden. On open, the newer of local and cloud wins.
  - Schema: [`supabase/migrations/001_profiles.sql`](supabase/migrations/001_profiles.sql).
- **Config:** set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local` and in Vercel. Without them the app is local-only. Never put the secret key or DB password in the app.
- **Settings → Export / Import JSON** to back up or move devices. **Reset** clears progress but keeps your colors.

## Tech

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Tone.js `Sampler` with [Salamander Grand Piano](https://tonejs.github.io/audio/salamander/) samples (or a sine synth) · `pitchy` · a hand-written service worker (`public/sw.js`).

### iOS audio notes
- Web Audio is unlocked on the **first tap anywhere** (`touchend`/`click`). Tone.js is preloaded so `Tone.start()` runs synchronously inside the gesture.
- `navigator.audioSession.type = "playback"` (Safari 17+) plus a silent `<audio>` element let sound play with the ringer switch on silent. If you hear nothing, check the volume and silent switch.

## Project layout

```
app/                 layout, page, global styles
components/App.tsx   screens, hash navigation, first-note gate, session runner
components/exercises FirstNote, Quiz, Chords, Modes, Tuner, Rush, Sing, Roots, Degrees, Intervals, Progressions, Melody
components/screens   Home, Stats, Settings
lib/music.ts         notes, chords, modes
lib/state.ts         state shape + pure rules (unlocks, streak, week)
lib/audio.ts         Tone.js playback + iOS unlock
lib/pitch.ts         microphone pitch detection
lib/cloud.ts         Supabase sync for the อาท / Guest profiles (fetch, no SDK)
lib/storage.ts       per-profile localStorage
i18n/th.ts           all UI strings
public/sw.js         offline service worker
```

## Verification scripts

With a production server on port 3123 (`npm run build && npm start -- -p 3123`), drive the app in Edge: `scripts/verify-edge.cjs` (main flow / mic denied), `verify-new-exercises.cjs`, `verify-resume.cjs` (audio after screen lock), `verify-ios-mic.cjs` (simulated iOS audio-session rules). The mic tests need a `c4.wav` next to the script.

## Verification hooks

For automated checks (read-only): `window.__colorPitch()` returns the app state, `window.__cpAudio()` returns the audio status, and `window.__cpQuestion` holds the current quiz/chord question.

## Verification

The project skill [`.claude/skills/verify-color-pitch/`](.claude/skills/verify-color-pitch/SKILL.md) launches the production build and drives it in headless Edge like a player on a 375 px iPhone. It runs through [`scripts/drive.cjs`](scripts/drive.cjs). The feature map is in `features/`, and the recipes are in `recipes/`. Evidence goes to `verification/` (gitignored).
