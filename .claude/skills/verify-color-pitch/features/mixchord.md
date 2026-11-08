# Chord color mix (ผสมสีคอร์ด)

The player hears a 3-note chord and taps every note in it, in any order, then taps "ตรวจ". The tapped notes' colors blend into "สีที่คุณผสม". After checking, the real chord's blend appears beside it, together with the chord name.
- **Chords:** the root comes from the unlocked notes, and the quality from the unlocked 3-note chord types (major and minor first).
- **Keys:** all 12 keys are tappable, because chord tones go beyond the unlocked set.
- **Round:** a round is 10 chords.

## Sub-features

- `mix-play`: the chord plays as it's asked. "↻ ฟังคอร์ด" replays it, and "♪ ฟังทีละตัว" plays it as an arpeggio.
- `mix-pick`: tapping a key toggles it. Picked keys glow, and "เลือกแล้ว N / 3 ตัว" counts them. "ตรวจ" stays disabled until something is picked.
- `mix-check`: the answer logs `{root, quality, target[], answer[]}` to `progress.mixChords`. It is correct only when the picked set equals the chord's set (`mixChordCorrect`).
- `mix-feedback`:
  - The headline reads "ครบทุกตัว!" or "ถูก N จาก 3 ตัว", plus " · เกินมา K ตัว" for extra notes.
  - The keys show correct (green), missed (reveal) and extra (red).
  - "คอร์ดนี้คือ Gm" appears.
  - The chord plays as an arpeggio, then whole.
- `mix-summary`: "ครบทุกตัว X จาก 10 ข้อ".
- `mix-stats`: the Stats tile "ผสมสีคอร์ด" shows the % fully right.

## How to get to it (player POV)

- Home → "แบบฝึกอื่นๆ" → the card with three overlapping color circles (`data-testid="card-mixchord"`), or `#mixchord`.

## Driving it with drive.cjs

- Run `node scripts/drive.cjs .claude/skills/verify-color-pitch/recipes/mixchord.js`.
- **What it does.**
  - Round 1 picks a wrong key and un-picks it.
  - Round 2 leaves a note out.
  - Round 3 adds an extra note.
- **What `after.json` shows:**
  - `logged: 10`, `correct: 8`
  - `round1Answer` = exactly the chord's 3 notes
  - `verdicts[1]` = "ถูก 2 จาก 3 ตัว"
  - `verdicts[2]` = "ถูก 3 จาก 3 ตัว · เกินมา 1 ตัว"
  - `allNamesOk: true`
  - `statsTile: "80%"`
- **Proof:**
  - `02-picked.png`
  - `03-feedback-correct.png`
  - `04-feedback-partial.png`
  - `05-feedback-extra.png`
  - `06-summary.png`

## Gotchas

- `__cpQuestion` is `{kind: "mixchord", root, quality, midis, pcs}`.
- Roots G#–B are voiced an octave lower, and the base octave is random (C3 or C4 region), so the chord stays mid-range.
