# Mode brightness (ความสว่างของโหมด)

The player hears a scale on C in one of the seven modes and names it. It starts with a short lesson, then four levels from "bright or dark" up to placing all seven modes on a bright-to-dark slider.
- **Feedback:** the scale with the notes that differ from major or minor highlighted, plus "ฟังเทียบกับ Ionian/Aeolian".

| Level | Choices | Answer by |
|---|---|---|
| 1 | Ionian, Aeolian (the third decides) | buttons |
| 2 | Lydian, Ionian, Mixolydian (one note apart) | buttons |
| 3 | Dorian, Aeolian, Phrygian | buttons |
| 4 | all seven | slider, exact position |

- **Unlock:** opens in week 4, or once all 7 white keys are unlocked. Before that, the screen shows "ปลดล็อกในสัปดาห์ 4".
- **Moving up:** each level moves on by the 30-answer, ≥ 90 % rule, counting only answers at the current level that weren't hinted.

## Sub-features

- `mode-lock`: `modesUnlocked(p)` = week ≥ 4 or `notesUnlocked` ≥ 7. The Home card shows 🔒 and the lock text until then.
- `mode-lesson`: opens automatically until `progress.modeLessonSeen`, then from "📖 เรียนก่อน" on the intro. It uses the shared `Lesson` component:
  1. Modes are the same scale with some notes changed (Ionian vs Aeolian).
  2. Bright or dark comes from the third (C D E vs C D Eb).
  3. The bright family (Lydian F#, Mixolydian Bb).
  4. The dark family (Dorian A, Phrygian Db, Locrian).
  5. Trick: listen for the odd note (C D E F G vs C D E F# G).
- `mode-levels`: the card shows "ระดับ N/4" and the level description, plus accuracy and progress for levels 1–3.
- `mode-choices`: levels 1–3 show one big button per mode, colored by brightness, with its feel ("ลอย ฝัน (ตัวที่ 4 สูงขึ้น)"…).
- `mode-slider`: level 4 is the original slider plus "ยืนยันตำแหน่ง". The verdict reads "ตรงตำแหน่ง!" or "ห่างไป N ช่อง".
- `mode-hint`: "💡 ใบ้" plays each choice's scale. The answer is logged with `hinted: true` and never counts.
- `mode-reveal`: the verdict reads "ถูกต้อง!" or "ยังไม่ใช่" (levels 1–3). The scale card shows "สเกลนี้คือ X · feel". The notes are spelled with flats, and the differing notes are highlighted (`data-diff="1"`). "โน้ตที่ไฮไลต์คือตัวที่ต่างจาก Ionian/Aeolian" appears below, with ▶ X and ▶ ฟังเทียบกับ ref buttons.
- `mode-levelup`: "🔓 ขึ้นระดับ N!" with fireworks.
- `mode-log`: `progress.modeAnswers` gets `{t, target, answer, level, hinted?}`.

## How to get to it (player POV)

- Home → "แบบฝึกอื่นๆ" → the gradient card 🌗 "ความสว่างของโหมด", or `#modes`.

## Driving it with drive.cjs

- **Recipe.** Run `node scripts/drive.cjs .claude/skills/verify-color-pitch/recipes/modes.js` (about 3 min).
- **Getting past the lock.** A fresh player is locked (`lockedToday: true`). The recipe opens the app once, then reopens it with the browser clock 28 days ahead (`evaluateOnNewDocument` Date offset). This is a player coming back 4 weeks later. No state is written.
- **What it does.** It walks the lesson. Question 1 uses the hint, question 2 is a miss that taps "ฟังเทียบ", and play continues to level 2.
- **What `after.json` shows:**
  - `lessonSteps` plays: [16, 6, 24, 32, 10]
  - `hintedLogged: 1`
  - `miss.verdict: "ยังไม่ใช่"`
  - `miss.diff` = [Eb, Ab, Bb] for Aeolian
  - `levelUpAt: 31` (1 hinted + 30 counted)
  - `modeLevel: 1`
  - `level2.choices` = [lydian, ionian, mixolydian], with `diff` [F#] for Lydian or [Bb] for Mixolydian
- **Proof.**
  - `01-lesson-bright.png`
  - `03-level1-question.png`
  - `04-hint.png`
  - `05-feedback-wrong.png`
  - `06-levelup.png`
  - `07-level2-reveal.png`
- **Not driven yet:** levels 3–4. Level 4 is the slider, which is the original UI.

## Gotchas

- `__cpQuestion` is `{kind: "mode", mode, level, choices}`.
- Old answers have no `level` and count as level 4, so they never move a player up at levels 1–3.
- The page background follows brightness. `ScreenHeader` forces `text-ink`, so the title stays readable on light shades (this was fixed on 2026-11-08).
