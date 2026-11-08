# Chord progressions (ทางเดินคอร์ด)

The player hears four chords in a random major key. The first is always I. They tap the function of chords 2, 3 and 4 in order.
- **Slots:** four slots sit above the answer grid. Slot 1 already shows I with its root color. Each slot lights up while its chord plays, and the slots fill with the player's picks.
- **Feedback:** each slot reveals the real numeral, the chord name in that key (vi in G → "Em"), the ☀️/🌧️ mood of its quality, and its root note's color. A wrong slot gets a red ring and "คุณตอบ X". The progression then plays again with the names showing.
- **Round:** a round is 8 progressions. The summary counts fully correct sets.
- **Unlock:** I, IV and V start unlocked, then vi, ii and iii unlock by the 30-answer, ≥ 90 % rule. Each named chord counts as one answer, so one progression adds 3.

## Sub-features

- `prog-play`: while the progression plays, the prompt reads "กำลังเล่นทางเดินคอร์ด…" and the numeral buttons are disabled. They open after about 4.4 s (4 chords × 1.1 s).
- `prog-generate`: every progression starts on I and never repeats a chord back to back. Chords come only from the unlocked set. The key is random across all 12.
- `prog-pick`: tapping a numeral fills the next slot. "⌫ ลบ" removes the last pick, and a removed pick is never logged. The third pick grades the set.
- `prog-answer`: grading logs 3 entries `{t, key, pos: 2|3|4, target, answer}` to `progress.progressions`. The headline is "ถูกทั้งหมด!" or "ถูก N จาก 3 คอร์ด".
- `prog-reveal`: the slots show the numeral, the chord name, the mood emoji and the root color, plus "คีย์ X เมเจอร์".
- `prog-unlock`: crossing the unlock rule shows "🔓 ปลดล็อกคอร์ดใหม่: vi" with fireworks.
- `prog-summary`: "ถูกทั้งชุด X จาก 8 ทาง", with a 🏆 at ≥ 6.
- `prog-stats`: Stats → "แบบฝึกเพิ่มเติม" → the "ทางเดินคอร์ด" tile shows the all-time per-chord %.

## How to get to it (player POV)

- Home → "แบบฝึกอื่นๆ" → the card with I·IV·V chips and 🛤️ (`data-testid="card-progressions"`), or `#progressions`.

## Driving it with drive.cjs

Preconditions:

- `doctor` passes. Fresh profile: I, IV and V are unlocked.

- **Play one set.** Run `node scripts/drive.cjs .claude/skills/verify-color-pitch/recipes/progressions.js`. Round 2 taps a wrong chord and undoes it. Round 3 names chord 2 wrong. `after.json` shows:
  - `closedWhilePlaying: true`
  - `logged: 24`, `correctLogged: 23` (the undo did not log), `summary: "ถูกทั้งชุด 7 จาก 8 ทาง"`, `statsTile: "96%"`
  - `chordsAsked` ⊆ [I, IV, V], `positions` = [2, 3, 4]
  - `allStartOnI`, `noRepeats` and `allNamesOk` (each slot's chord name matches key + numeral) are true
  - `distinctKeys` > 1
- **Proof.**
  - `02-playing.png`: buttons dimmed.
  - `03-one-picked.png`: slot 2 holds a pick, and slots 3–4 show "?".
  - `04-feedback-correct.png`.
  - `05-feedback-wrong.png`: slot 2 has a red ring and "คุณตอบ X".
  - `06-summary.png`, and `07-stats.png` with the tile.
- **Unlock** (not in the recipe yet). 10 progressions at ≥ 90 % → `numeralsUnlocked: 4` (vi). It uses the same `meetsUnlock` rule as melody, which has been driven.

## Gotchas

- `__cpQuestion` is `{kind: "progression", key, tonic, chords}`. `chords[0]` is always "I", and the player answers `chords[1..3]`.
- All 3 entries of one progression share a timestamp. If the unlock fires on the first of them, the other two count toward the old set (`numeralsSetSince = t + 1`). That is intended.
- After grading, the progression replays and the auto-advance waits about 6.5 s. Tap `progressions-feedback` to skip.
