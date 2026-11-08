# Melody (ทำนองสี)

Melodic dictation with absolute pitch. The player hears a short melody made only of their unlocked notes (C4–B4), then taps the notes in order on the colored keyboard. Nothing plays while they answer, so every note is named from memory, not by comparing it with the note before.
- **Feedback:** two rows, "ทำนองจริง" (the real melody as colored dots) and "ที่คุณตอบ" (the player's taps). Wrong taps get a red ring. The real melody plays again.
- **Round:** a round is 10 melodies.
- **Growth:** melodies start at 3 notes and grow to 4, 5 and 6 by the 30-answer, ≥ 90 % rule. Each note counts as one answer.

## Sub-features

- `mel-play`: "กำลังเล่นทำนอง…" shows and the keys are disabled until the melody ends.
- `mel-generate`: notes come only from `unlockedNotes`. With 2 or more notes unlocked, a melody is never one repeated note, and no note appears 3 times in a row.
- `mel-pick`: each tap fills the next dashed slot with that note's colored dot (grey in hard mode) and flashes the key. No sound plays. "⌫ ลบ" removes the last tap, and a removed tap is never logged.
- `mel-answer`: the last tap grades. It logs one entry per note `{t, len, pos, target, answer}` to `progress.melodies`. The headline is "ถูกทั้งทำนอง!" or "ถูก N จาก L โน้ต".
- `mel-grow`: crossing the rule shows "🔓 ทำนองยาวขึ้นเป็น N โน้ต" with fireworks, and the intro header then reads "ทำนองยาว N โน้ต".
- `mel-summary`: "ถูกทั้งทำนอง X จาก 10 ข้อ", with a 🏆 at ≥ 8.
- `mel-stats`: the "ทำนองสี" tile in Stats shows the all-time per-note %.

## How to get to it (player POV)

- Home → "แบบฝึกอื่นๆ" → the card with three rising colored bars and 🎼 (`data-testid="card-melody"`), or `#melody`.

## Driving it with drive.cjs

Preconditions:

- `doctor` passes. Fresh profile: notes C and G, melody length 3.

- **Play one set and grow the melody.** Run `node scripts/drive.cjs .claude/skills/verify-color-pitch/recipes/melody.js`. Round 2 taps a wrong note and undoes it. Round 3 gets its last note wrong. 30 notes at 29/30 cross the rule on round 10. `after.json` shows:
  - `introLen: "3"`, `closedWhilePlaying: true`
  - `logged: 30`, `correctLogged: 29`, `summary: "ถูกทั้งทำนอง 9 จาก 10 ข้อ"`, `statsTile: "97%"`
  - `notesAsked` = [0, 7]
  - `melodyLevel: 1`, `grewText: "ทำนองยาวขึ้นเป็น 4 โน้ต"`, `nextLen: "4"`
  - `silentWhileAnswering: true` (`playCount` doesn't change during the taps)
  - `noSingleNoteMelody: true`
- **Proof.**
  - `02-playing.png`.
  - `03-one-picked.png`.
  - `04-feedback-correct.png`.
  - `05-feedback-wrong.png`: both rows, with a red ring on the wrong dot.
  - `06-grew.png`.
  - `07-summary.png`.
  - `08-stats.png`.

## Gotchas

- `__cpQuestion` is `{kind: "melody", midis, pcs}`. Answers are graded by pitch class.
- Reloading the page (`go("")`) brings the first-note gate back, so call `skipGate()` again before reading the intro.
- After grading, the auto-advance waits about 2.4 s plus 0.6 s per note. Tap `melody-feedback` to skip.
