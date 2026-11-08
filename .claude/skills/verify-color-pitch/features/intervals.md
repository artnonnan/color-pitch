# Intervals (ขั้นคู่เสียง)

The player picks a direction (ขาขึ้น, ขาลง, พร้อมกัน or สลับ), then hears two notes inside their octave range and taps the interval name.
- **Answer grid:** the buttons sit in size order (m2 … P8), and locked ones show 🔒.
- **Feedback:** the screen washes in the blend of the two notes' colors, and the two colored dots show with their names and the semitone count.
- **Unlock order:** P8, P5, M3, then P4, m3, M2, m2, M6, m6, M7, m7, TT, by the 30-answer, ≥ 90 % rule.

## Sub-features

- `int-lesson`: shown automatically until `progress.intervalLessonSeen`, then from "📖 เรียนก่อน" on the intro. It uses the shared `components/Lesson.tsx`. The steps are:
  1. Intervals are distances, with near (C → D) and far (C → C high) examples.
  2. One step per unlocked interval: its feel, "ฟังคู่เสียง", and its reference tunes (up, and down if there is one).
  3. Compare all unlocked intervals.
  4. Up and down sound different.

  The steps grow with the unlocked set. "เริ่มฝึก" sets the flag and returns to the intro.
- `int-refs`: reference tunes live in `lib/references.ts`. All of them are public domain, and the app plays the opening notes itself. Some have no tune (P8, TT, m7, M7, P5 down, m6 down, M6 down), and the feel text stands in for them. Change songs only in that table.
- `int-hint`: "💡 ใบ้" opens "ฟังเทียบ: จากโน้ตแรกเดียวกัน", with one button per unlocked interval. It plays that interval from the question's first note in the question's direction. The answer is logged with `hinted: true` and never counts toward unlocks.
- `int-ref-card`: every feedback shows a card with the feel, "จำด้วยเพลง: <song> (<dir>)" or "ไม่มีเพลงอ้างอิง", and "🎵 เพลงอ้างอิง". Tapping it stops the auto-advance. A wrong answer waits 4.2 s, so there is time to tap.
- `int-new-card`: on an unlock, the card reads "รู้จักคู่ใหม่: …" and has ▶ ฟังคู่เสียง and 🎵 buttons. There is no auto-advance, so the player taps "ต่อไป".
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

- **Lesson, hint, mix and unlock.** Run `node scripts/drive.cjs .claude/skills/verify-color-pitch/recipes/intervals.js`. It walks the lesson and taps every example. Then it chooses สลับ. Question 1 uses the hint, and question 2 is a miss that plays the reference tune. Then it plays until the unlock. `after.json` shows:
  - `lessonShown`, `lessonSeen`
  - `lessonSteps`: 6 steps. Every step with buttons has plays > 0.
  - `hint.buttons` = [P8, P5, M3], `hintedLogged: 1`
  - `wrongRef.line` = "จำด้วยเพลง: …", `wrongRef.songPlays` > 0
  - `newCard.stillOnFeedback: true`, `newCard.card` = "รู้จักคู่ใหม่: คู่ 4 เพอร์เฟกต์", `newCard.remember` mentions Here Comes the Bride
  - `unlockedText: "ปลดล็อกคู่เสียงใหม่: คู่ 4 เพอร์เฟกต์"`, `intervalsUnlocked: 4`
  - `answers: 31`, `correct: 30` (1 hinted + 30 counted with 1 miss)
  - `dirsSeen: ["down", "together", "up"]`, `dirSetting: "mix"`
  - `rangeOk: true`
- **Proof.**
  - `01-intro-dir-mix.png`: the สลับ chip is selected.
  - `03-feedback-correct.png`: two dots and a burst.
  - `04-feedback-wrong.png`
  - `05-unlock.png`: the new-interval card.
  - `00-lesson-step2.png`, `02b-hint-panel.png`

## Gotchas

- The unlock lands on answer 31, because the hinted answer doesn't count. That is in set 4. The recipe checks for the unlock text before it waits for the summary.
- P8 shows the same note name twice (for example "B + B"). That is correct, not a bug.
- `mix` is random per question. Over 30 questions all three directions appear in practice, but a 10-question run may miss one.
