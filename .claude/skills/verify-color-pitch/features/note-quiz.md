# Note + color quiz

The player hears one note and taps the colored key they think it is.
- **Correct:** the screen washes in that note's color and particles burst from the key.
- **Wrong:** both notes play.
- **Unlock:** 30 answers at ≥ 90 % on the current set unlock the next note (C, G, E, A, D, F, B, then the black keys), with a full-screen ceremony.

## Sub-features

- `quiz-answer`: tapping a key logs an answer (target, answer, ms) and shows "ถูกต้อง!" or "ยังไม่ใช่".
- `quiz-wrong-replay`: a wrong answer marks the tapped key and the real key, and plays both notes.
- `quiz-unlock`: crossing 90 % over 30 answers raises `notesUnlocked` by 1 and shows a ceremony with "แตะเพื่อไปต่อ".
- `quiz-summary`: "จบรอบนี้" (after 5 answers), or the 5-minute timer, shows "ถูก X จาก N ข้อ" and marks the `quiz` step done today.
- `quiz-locked-keys`: locked keys are greyed out and ignore taps.

## How to get to it (player POV)

- Home → the "ทายโน้ต + สี" row in today's session, or `#quiz`.
- Home → "เริ่มฝึกวันนี้". This is step 2 of the session runner, after First Note.
- Home → "ฝึกเพิ่มอีกรอบ", once today's session is complete.

## Driving it with drive.cjs

Preconditions:

- `doctor` passes. Fresh profile: C and G are unlocked.

- **Answer and unlock.** Answer 33 notes with 2 misses (answers 4 and 12). Run `node scripts/drive.cjs .claude/skills/verify-color-pitch/recipes/note-quiz.js`. Then `after.json` shows `answers: 33`, `correct: 31`, `notesUnlocked: 3` and `unlockedAtAnswer: 30`.
- **Wrong answer.** Covered by the same run. `03-feedback-wrong.png` shows the tapped key with a red ring and the real key glowing.
- **Proof.** `04-unlock-ceremony.png` shows the E orb and "ปลดล็อกโน้ตใหม่". `05-summary.png` shows "ถูก 31 จาก 33 ข้อ".

## Gotchas

- An unlock does not auto-advance. The recipe has to tap the ceremony away, or the next question never comes.
- The unlock counts only answers since the current note set began (`notesSetSince`). Answers before an unlock do not carry over.
- With mix voices on, the quiz plays synth timbres. Assertions should not depend on the piano samples.
