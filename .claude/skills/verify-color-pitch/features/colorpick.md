# Color → sound (ทายจากสี)

This is the reverse of the quiz, and it needs no singing. The player sees only a color, with no note name. 2–4 notes play in a row, and the player picks the one that is that color. They can tap any option card to hear it again, then tap "ตอบ".
- **Notes:** the target comes from the unlocked notes, weighted toward weak notes (`quizWeights`). Decoys are other unlocked notes first, then the next notes in unlock order.
- **Octaves:** each option sits in its own random octave (C3–B5), so pitch height gives nothing away.
- **Options:** the count grows 2 → 3 → 4 by the 30-answer, ≥ 90 % rule.

## Sub-features

- `cp-play`: options play in order (0.95 s apart), and each card lights with 🔊 as it sounds. Cards are disabled while they play. "↻ ฟังทั้งหมดอีกครั้ง" repeats the sequence.
- `cp-pick`: tapping a card plays it and selects it (accent border). The answer button reads "แตะการ์ดเพื่อฟังและเลือก" until a card is selected, then "✓ ตอบ".
- `cp-answer`: the answer logs `{target, answer, options[], ms}` to `progress.colorPicks`.
- `cp-feedback`:
  - The swatch shows the note name, and every card turns its own color with its name.
  - The right card gets a green border and glow. A wrong pick gets a red border and shakes.
  - The headline reads "ใช่เลย!" or "สีนี้คือ X". The right note plays again.
- `cp-grow`: crossing the rule shows "🔓 ตัวเลือกเพิ่มเป็น N เสียง" with fireworks. `colorPickLevel` goes 0 → 2 (4 options).
- `cp-summary`: after 10 questions, "ถูก X จาก 10 ข้อ".
- `cp-stats`: the Stats tile "ทายจากสี" shows the all-time %.

## How to get to it (player POV)

- Home → "แบบฝึกอื่นๆ" → the card with a color dot "→ 👂" (`data-testid="card-colorpick"`), or `#colorpick`.

## Driving it with drive.cjs

- Run `node scripts/drive.cjs .claude/skills/verify-color-pitch/recipes/colorpick.js`. A fresh player (C and G) plays until the options grow. Question 1 re-taps every card. Question 2 is a miss.
- **What `after.json` shows:**
  - `introOptions: "2"`
  - `swatchBlank: true` (no name before answering)
  - `retapPlays: 2`
  - `miss.verdict` = "สีนี้คือ C" (or G)
  - `answered: 30`, `grewText: "ตัวเลือกเพิ่มเป็น 3 เสียง"`, `nextOptions: 3`
  - `allTargetsUnlocked`, `allOptionsDistinct`, `octavesVary`: all true
  - `logged: 30`, `correct: 29`, `statsTile: "97%"`
- **Proof:**
  - `02-question.png`
  - `03-feedback-correct.png`
  - `04-feedback-wrong.png`
  - `05-grew.png`
  - `06-three-options.png`

## Gotchas

- `__cpQuestion` is `{kind: "colorpick", target, options: [{pc, midi}]}`.
- The card border uses one class at a time (green, red, white, accent or line). Stacking `border-line` with `border-good` let the neutral one win, which hid the green border. Fixed on 2026-11-08.
