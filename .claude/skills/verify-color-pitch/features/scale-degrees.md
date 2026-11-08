# Scale degrees (ระดับเสียงในคีย์)

The player hears an I–IV–V–I cadence in a random major key, then one note, and taps which degree it is (1–7, with solfege and a feeling word).
- **Feedback:** the screen washes in the note's own absolute color and shows "คีย์ X: ขั้น N คือโน้ต Y". The note then walks home stepwise: 2–5 walk down to 1, and 6–7 walk up to 8.
- **Round:** a round is 10 questions.
- **Unlock:** degrees unlock in the order 1, 5, 3, then 2, 4, 6, 7, by the same 30-answer, ≥ 90 % rule.

## Sub-features

- `deg-cadence`: during the cadence the prompt reads "กำลังเล่นคอร์ดตั้งคีย์…" and the answer buttons are disabled. They open about 3 s later, after the test note.
- `deg-answer`: an answer logs `{key, target, answer, ms}` to `progress.degrees` and shows "ใช่เลย!" or "นี่คือขั้น N".
- `deg-reveal`: the feedback names the key, the degree and the real note, with that note's color dot.
- `deg-resolve`: after the answer, the resolution walk plays: 1 note for degree 1, 3 for degree 3, 5 for degree 5.
- `deg-replay`: "ฟังคีย์อีกครั้ง" replays cadence + note. "ฟังโน้ตอีกครั้ง" replays the note only. Both are disabled while the cadence plays.
- `deg-unlock`: crossing the unlock rule shows "🔓 ปลดล็อกขั้นใหม่: N" with fireworks.
- `deg-summary`: after 10 questions, "ถูก X จาก 10 ข้อ" appears, with a 🏆 at ≥ 8.
- `deg-stats`: Stats → "แบบฝึกเพิ่มเติม" → the "ระดับเสียงในคีย์" tile shows the all-time %.

## How to get to it (player POV)

- Home → "แบบฝึกอื่นๆ" → the card with 1·3·5 chips and 🏠 (`data-testid="card-degrees"`), or `#degrees`.

## Driving it with drive.cjs

Preconditions:

- `doctor` passes. Fresh profile: degrees 1, 5 and 3 are unlocked.

- **Play one set.** Play 10 questions with one deliberate miss on round 3. Run `node scripts/drive.cjs .claude/skills/verify-color-pitch/recipes/degrees.js`. Then `after.json` shows:
  - `logged: 10`, `correctLogged: 9`, `summary: "ถูก 9 จาก 10 ข้อ"`, `statsTile: "90%"`
  - `degreesAsked` ⊆ [1, 3, 5]
  - `distinctKeys` > 1
  - each round's `waitedForCadenceMs` is about 2–3 s
  - each `feedback` line is musically right (key + major-scale step = the note named)
- **Proof.**
  - `03-playing-cadence.png`: buttons dimmed.
  - `05-feedback-correct.png` and `06-feedback-wrong.png`: the wrong tap gets a red ring, and the right degree glows.
  - `07-summary.png`, and `08-stats.png` with the tile.
- **Unlock** (not in the recipe yet). 30 answers at ≥ 90 % → `degreesUnlocked: 4` (degree 2). It takes about 4 minutes of play and has not been driven yet. It uses the same rule code as intervals, which has been driven.

## Gotchas

- `walkNotes` in the recipe counts all plays during a fixed wait. For a short walk (degree 1), the next question's cadence starts inside that wait and inflates the count. Trust the walk length only for the last round, or for degrees 3 and 5.
- The keys are random across all 12 (tonic C3–B3). Assert on relations, never on absolute keys.
- Tapping the feedback skips the rest of the wait. The recipe waits 1.8 s before tapping, so the walk is still heard.
