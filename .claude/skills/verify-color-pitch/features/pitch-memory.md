# Pitch and color core drills (สีกับการจำเสียง)

There are five drills in the Home section "สีกับการจำเสียง". All of them are listen-and-tap, with no singing. Voices are forced per note through `setVoiceOverride` (`lib/audio.ts`), and the shared helpers live in `lib/drills.ts`:
- `noiseBurst`: 9 random sine notes that wash out the last pitch.
- `playIn`: plays a note in a given voice.
- `randomVoice`: picks a random voice.

## Sub-features

### สอบวัดเสียงจริง (`#aptest`, `ApTest.tsx`)

24 items with **no feedback** during the test.
- **Items:** every unlocked note comes up equally often. Each item has a random octave (C3–B5) and a random voice.
- **Each item:** "🌫️ กำลังล้างเสียง…" (noise burst), then 0.5 s of silence, then the note. Replaying is allowed.
- **Result:**
  - score %
  - per-note bars in note colors
  - "สับสนบ่อย" (the top confusions)
  - "ใบประกาศ · จำเสียงได้แม่น N โน้ต" for notes right every time (at least 2 times), with the date in the Thai calendar
  - a history of the last 8 tests
- **Log:** each test goes to `progress.apTests` (`items: [{target, answer, midi, ms}]`). It never touches `noteAnswers` or unlocks.
- **Stats tile:** "สอบวัดเสียงล่าสุด".

### สีบำบัด (`#calm`, `Calm.tsx`)

Passive listening.
- **Options:** 5, 10 or 15 minutes. Note names on or off. Unlocked notes only, or all 12.
- **Playback:** a note every 4.5 s in the soft voice. The whole stage fades (2 s) to that note's color. The screen is kept awake (Wake Lock) where supported.
- **Pausing:** ⏸ pauses, and so does the app going to the background. ■ ends the session.
- **Ending:** the session logs `{secs}` to `calmSessions` and adds the seconds to today's practice (`addPractice`), so it counts toward the streak.
- **Stats tile:** "นาทีสีบำบัด".

### ความจำเสียง (`#memory`, `Memory.tsx`)

- **Flow:** hear one note (no color), then a hold of N seconds with the keys locked, a countdown, and a random sine note every 0.7 s. Then name the note.
- **Delays:** 5 → 10 → 20 → 30 s by the 30-answer, ≥ 90 % rule (`MEM_DELAYS`, `memLevel`).
- **Feedback:** the color is revealed and the note plays again.
- **Log:** `memAnswers`. Stats tile "ความจำเสียง".

### โน้ตประจำตัว (`#anchor`, `Anchor.tsx`)

- **Setup:** choose an anchor from all 12 notes (`progress.anchorPc`). Changing it resets the level.
- **Questions:** each one is a note in octaves C2–B5 and a random voice. Half are the anchor. Answer ✓ ใช่ (colored like the anchor) or ✗ ไม่ใช่.
- **Decoy distance:** at least 3 semitones, then 2, then neighbors (`ANCHOR_MIN_DISTANCE`, `anchorLevel`), by the 30/90 rule.
- **Feedback:** reveals the note and color, with buttons to replay it and to hear the anchor.
- **Round:** 15 questions. Log: `anchorAnswers`.

### โน้ตทุกอ็อกเทฟ (`#wide`, `Wide.tsx`)

- **Questions:** the quiz across C1–C7 (MIDI 24–96). A random voice every question, and no octave twice in a row.
- **Feedback:** "อ็อกเทฟ N · เสียง". A miss replays the note.
- **Register card:** a card shows all-time accuracy for low (< C3), mid and high (≥ C5).
- **Log:** `wideAnswers`, not the quiz log.

## How to get to it (player POV)

- Home → "สีกับการจำเสียง": the wide 🎓 card, then 🌈 🧠 ⚓ 🎚️. Or the hashes above.

## Driving it with drive.cjs

On 2026-11-09, all passing:

- **`recipes/aptest.js`** (about 2 min): 24 items with 3 misses on C.
  - `feedbackLeak: false`
  - `washSeen: 23` and `totalPlays: 231` (24 × 10 minus the first burst, which was counted before the start)
  - `voices: 5`, `octaves: 3`
  - `score: "88%"`, `perNote` "C 9/12 G 12/12"
  - a certificate for G
  - `noteAnswersUntouched: true`, Stats tile "88%"
- **`recipes/calm.js`:**
  - 3 notes in 14 s, labels match, colors differ
  - pause freezes the clock ("4:45" stays)
  - stop logs `secs: 16` and `practiceAdded: 16`, with "ฟังไป 16 วินาที…"
- **`recipes/memory.js`:**
  - `introDelay: "5"`
  - keys locked during every hold, holds ≥ 5.6 s, ≥ 7 distractor notes
  - 9 of 10, with the miss reading "โน้ตแรกคือ G"
- **`recipes/anchor.js`:**
  - 12 choices, anchor G
  - decoys ≥ 3 semitones away
  - 5 voices, 3 octaves
  - every reveal right, 14 of 15
- **`recipes/wide.js`:**
  - MIDI 31–96, octaves 1–7, 3 voices
  - every "อ็อกเทฟ N" right
  - register card filled in, 9 of 10
  - quiz log untouched

**Not driven:** the delay and decoy level-ups, which take 30 answers each and use the same rule code as the other drills.

## Gotchas

- `__cpQuestion` kinds:
  - `aptest` `{i, target, midi, voice}`
  - `calm` `{note, elapsed}`
  - `memory` `{pc, midi, delay}`
  - `anchor` `{anchor, played, midi, voice}`
  - `wide` `{pc, midi, voice}`
- `noiseBurst` schedules all its notes at once, so `playCount` jumps right after an answer. Count across the whole test, not per item.
- On the calm stage the name changes instantly while the color fades over 2 s. A screenshot can catch the new name on the old color.
