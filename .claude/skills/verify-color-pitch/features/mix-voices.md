# Mix voices (สลับเสียง)

In Settings → เครื่องดนตรี the player can pick เปียโน, คลื่นไซน์ or สลับเสียง.
- **Mix mode:** every new question in every exercise plays with a different voice: piano, sine, soft (triangle), bell (FM) or strings (filtered saw). The voice stays the same for all replays and feedback of that question.
- **Why:** pitch is then learned apart from one instrument's timbre.
- **Test button:** "ทดสอบเสียง" also changes the voice in mix mode.

## Sub-features

- `voice-setting`: the choice persists in `settings.instrument` (`"mix"`) across reloads.
- `voice-change`: each new question picks a voice different from the last one.
- `voice-all-exercises`: Quiz, Chords, Roots, Rush, Modes, Sing, Degrees and Intervals all change voice at question start.
- `voice-offline`: if piano samples never loaded, the piano voice falls back to sine.

## How to get to it (player POV)

- Bottom nav ⚙️ ตั้งค่า → the เครื่องดนตรี card → "🎨 สลับเสียง" (the full-width button, `data-instrument="mix"`).

## Driving it with drive.cjs

Preconditions:

- `doctor` passes. Fresh profile: the instrument is piano.

- **Pick mix, then quiz.** Tap สลับเสียง, reload Settings, then answer 8 quiz notes. Run `node scripts/drive.cjs .claude/skills/verify-color-pitch/recipes/voices.js`. Then `after.json` shows:
  - `persisted: "mix"`
  - `consecutiveRepeats: 0`
  - `distinctVoices` ≥ 3, with 5 seen in the first run
  - `voiceCounts` spread over the voices
  - `context: "running"`
- **Proof.** `01-settings-mix.png` shows the สลับเสียง card selected.

## Gotchas

- `__cpAudio().voice` is the voice for the *current* question. Read it after the question appears and before answering.
- You can't hear audio in headless Edge. Proof is `voiceCounts`, which shows which synth was triggered, not that the sound is good. Judging the timbre needs a human listener.
- Only the quiz has been driven in mix mode. The other exercises call the same `newVoice()` at question start, but they are not driven by this recipe.
