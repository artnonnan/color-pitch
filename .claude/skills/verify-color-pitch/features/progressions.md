# Chord progressions (ทางเดินคอร์ด)

The player hears chords in a random key. The first chord is always the level's home chord (I, i or Imaj7). They name the rest by function.
- **Lesson:** a short lesson comes first.
- **Levels:** seven levels, easiest first.
- **Hint:** a "💡 ใบ้" button lets the player compare home → each choice before answering.
- **Skip test:** "🚀 สอบข้ามไประดับ N" lets a strong player jump ahead.

| Level | Plays | Choices | Answers |
|---|---|---|---|
| 1 | I + 1 chord | IV, V | 1 |
| 2 | I + 1 chord (I → I allowed) | I, IV, V | 1 |
| 3 | I + 2 chords, no repeats | I, IV, V | 2 |
| 4 | I + 3 chords, no repeats | unlocked set (I, IV, V, then vi, ii, iii) | 3 |
| 5 | minor key: i + 3 chords | i, iv, v, III, VI, VII | 3 |
| 6 | sevenths: Imaj7 + 3 chords | Imaj7, ii7, IVmaj7, V7, vi7 | 3 |
| 7 | borrowed and secondary: I + 3 chords | IV, V, ♭VII, iv, ♭VI, V/V | 3 |

- **Moving up:** every level moves on by the 30-answer, ≥ 90 % rule (each named chord is one answer). Only level 4 unlocks vi, ii and iii.
- **Hinted answers** are logged with `hinted: true` but never count toward a level or an unlock.

## Sub-features

- `prog-chords`: every chord is defined in `PROG_CHORDS` (`lib/music.ts`) by root offset, intervals, degree color and name suffix. `progChordMidis` voices triads and sevenths around the tonic, and `progLabel` writes ♭VII, ♭VI and V/V.
- `prog-advanced`:
  - Level 4 still unlocks vi, ii and iii one by one. Once all six are unlocked, the next 30-answer, ≥ 90 % run moves the player to level 5. Levels 5→6→7 move up by the same rule.
  - Level 5 says "คีย์ X ไมเนอร์" in the reveal.
- `prog-skip`:
  - From the intro, "🚀 สอบข้ามไประดับ N" runs 10 questions at the next level. Each answer is logged with `test: true`, and test answers never enter the accuracy window.
  - The card shows "ถูกทั้งชุดแล้ว N ข้อ (ต้องได้ 9)". A hinted question doesn't count as a hit.
  - The summary says "ผ่าน! ข้ามไประดับ N" (`passSkipTest`; passing beyond level 4 also unlocks all six triads), or "ได้ N ข้อ ยังไม่ถึง 9…".
  - "เสร็จแล้ว" returns to the intro.

- `prog-lesson`: it opens automatically until `progress.progLessonSeen`, and later from "📖 เรียนก่อน" on the intro. There are 5 steps, all in C major:
  1. Chords have functions.
  2. I = home: plays I.
  3. V = tension: plays I → V → I.
  4. IV = open: plays I → IV → I.
  5. Compare: "I → IV" and "I → V" buttons.

  Each chord chip lights up as it plays. "เริ่มฝึก" sets `progLessonSeen` and starts the first question.
- `prog-levels`: the card shows "ระดับ N/4" and the level description. Levels 1–3 show only their own choice buttons (2 or 3 large buttons). Level 4 shows all six with 🔒.
- `prog-play`: buttons stay disabled while the chords play (1.1 s each). Each slot lights up as its chord sounds.
- `prog-slot-replay`: tapping a slot during the question or the feedback plays that one chord.
- `prog-hint`: "💡 ใบ้" opens "ฟังเทียบ: เริ่มจาก I แล้วไปที่…" with "▶ I → X" for each choice, in the question's key. The note says the question won't count.
- `prog-pick`: picks fill the slots in order. "⌫ ลบ" appears only when there are 2 or more answers. The last pick grades.
- `prog-answer`: grading logs `{t, key, pos, target, answer, level, hinted?}` per named chord to `progress.progressions`. The headline is "ถูกทั้งหมด!" or "ถูก N จาก M คอร์ด".
- `prog-reveal`: each slot shows the numeral, the chord name in the key, the ☀️/🌧️ mood and the root note's color. A wrong slot gets a red ring and "คุณตอบ X". The progression replays.
- `prog-levelup`: "🔓 ขึ้นระดับ N!" plus the new level's description, with fireworks.
- `prog-unlock`: at level 4, "🔓 ปลดล็อกคอร์ดใหม่: vi".
- `prog-summary`: after 10 questions, "ถูกทั้งชุด X จาก 10 ทาง".
- `prog-stats`: the Stats tile "ทางเดินคอร์ด" shows the all-time per-chord %, hinted answers included.

## How to get to it (player POV)

- Home → "แบบฝึกอื่นๆ" → the card with I·IV·V chips and 🛤️ (`data-testid="card-progressions"`), or `#progressions`.

## Driving it with drive.cjs

Preconditions:

- `doctor` passes. Fresh profile: level 1, lesson not seen.

- **Lesson → level 2 → level 3.** Run `node scripts/drive.cjs .claude/skills/verify-color-pitch/recipes/progressions.js` (about 6 min). Question 1 uses the hint, question 2 is a deliberate miss, and question 3 taps slot 2. `after.json` shows:
  - `lessonShown: true`, `lessonSeen: true`.
  - `lessonSteps` plays: null, 1, 3, 3, 4.
  - `hintUsed.plays: 2`, `hintedLogged: 1`, `slotReplay: 1`.
  - `levelUpText` = {"ขึ้นระดับ 2!": 31, "ขึ้นระดับ 3!": 61}. That is 1 hinted plus 30 counted, then 30 more.
  - `level1Choices` = ["IV,V"], `level1Lens` = [2], `level2Choices` = ["I,IV,V"].
  - `level3` = {len 3, slots 3, choices I/IV/V}.
  - `numeralsUnlocked: 3`.
- **Proof.**
  - `01-lesson-v.png`.
  - `02-lesson-compare.png`.
  - `03-level1-question.png`.
  - `04-hint-panel.png`.
  - `05-feedback-wrong.png`.
  - `06-2-levelup.png`.
  - `06-3-levelup.png`.
  - `07-level3-question.png`.
- **Level 4 and vi** have not been driven yet: it takes another 30 + 30 answers. Level 4 uses the same rule path, with `numeralsSetSince` reset at the level change.

## Gotchas

- **Advanced recipe.** `recipes/progressions-advanced.js` (about 7 min) fails one skip test on purpose (8/10), then passes six tests up to level 7 (one with a hint). It checks every revealed chord name against theory. On 2026-11-08: 230 names checked, 0 wrong, `progLevel: 6`, `numeralsUnlocked: 6`. Normal-play level-ups 5→6→7 have not been driven.
- `__cpQuestion` now also has `minor` and `test`.

- `__cpQuestion` is `{kind: "progression", key, tonic, chords, choices, level}`. The player answers `chords[1..]`.
- `recentProgressionAccuracy` drops hinted answers, then windows from `progLevelSince` (levels 1–3) or `numeralsSetSince` (level 4).
- Players from before levels existed start at level 1 and see the lesson once. Their old answers have no `level`, and with `progLevelSince = 0` they sit inside the level-1 window. That's harmless, because the window is only the last 30 answers and new play pushes them out.
- After a summary, the round restarts from the intro ("▶ เริ่ม"), not the lesson.
