# Intervals (ขั้นคู่เสียง)

The player picks a direction (ขาขึ้น, ขาลง, พร้อมกัน or สลับ), then hears two notes inside their octave range and taps the interval name.
- **Answer grid:** the buttons sit in size order (m2 … P8), and locked ones show 🔒.
- **Feedback:** the screen washes in the blend of the two notes' colors, and the two colored dots show with their names and the semitone count.
- **Unlock order:** P8, P5, M3, then P4, m3, M2, m2, M6, m6, M7, m7, TT, by the 30-answer, ≥ 90 % rule.

## Sub-features

- `int-direction`: the direction chips persist in `settings.intervalDir`. `mix` picks up, down or together per question.
- `int-answer`: an answer logs `{target, answer, dir, low, ms}` to `progress.intervals`.
- `int-reveal`: the feedback shows "A → B · ห่าง N ครึ่งเสียง", or "A + B" for together, with both colors.
- `int-wrong-replay`: a wrong answer replays the interval, and the right button glows.
- `int-range`: both notes stay inside the Settings octave range (low ≥ `lowMidi`, high ≤ `highMidi`).
- `int-unlock`: crossing the unlock rule shows "🔓 ปลดล็อกคู่เสียงใหม่: …", and `intervalsUnlocked` goes up by 1.
- `int-stats`: Stats → the "ขั้นคู่เสียง" tile.

## How to get to it (player POV)

- Home → "แบบฝึกอื่นๆ" → the card with two color dots and 📏 (`data-testid="card-intervals"`), or `#intervals`.

## Driving it with drive.cjs

Preconditions:

- `doctor` passes. Fresh profile: P8, P5 and M3 are unlocked, and the direction is `up`.

- **Mix and unlock.** Choose สลับ, then play sets of 10 until the unlock (one miss in set 1). Run `node scripts/drive.cjs .claude/skills/verify-color-pitch/recipes/intervals.js`. Then `after.json` shows:
  - `unlockedText: "ปลดล็อกคู่เสียงใหม่: คู่ 4 เพอร์เฟกต์"`, `intervalsUnlocked: 4`
  - `answers: 30`, `correct: 29`
  - `dirsSeen: ["down", "together", "up"]`, `dirSetting: "mix"`
  - `rangeOk: true`
- **Proof.**
  - `01-intro-dir-mix.png`: the สลับ chip is selected.
  - `03-feedback-correct.png`: two dots and a burst.
  - `04-feedback-wrong.png`
  - `05-unlock.png`

## Gotchas

- The unlock lands on answer 30, which is the end of set 3. The recipe checks for the unlock text before it waits for the summary.
- P8 shows the same note name twice (for example "B + B"). That is correct, not a bug.
- `mix` is random per question. Over 30 questions all three directions appear in practice, but a 10-question run may miss one.
