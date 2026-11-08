# Color Rain

An arcade game. Drops in the note's color fall into a field, and each one plays its note as it spawns. The player taps that note's key before the drop reaches the ground.
- **Scoring:** catching earlier scores more. Combos multiply the score (x2 at every 5, up to x5).
- **Lives:** there are 3 lives. A landed drop costs a life, and a wrong tap resets the combo.
- **Speed:** it ramps up over 2 minutes. Fall time goes from 5.6 s to 2.4 s, and the gap between drops from 3.2 s to 1.3 s. At most 1 drop is in the air until 30 s, then 2 until 75 s, then 3.
- **Notes:** drops are drawn from the unlocked notes, weighted toward weak notes (`pickNoteMidi`). They don't go into the quiz answer log.
- **Gray mode:** "หยดสีเทา" hides the drop color and the key colors, so the note is told by its sound alone.

## Sub-features

- `rain-intro`: rules, the gray toggle (defaults to Settings hard mode), and ▶ เริ่ม.
- `rain-drop`: each drop falls at a random x (20–80 %), so its position never gives away the key.
- `rain-catch`: tapping a key catches the lowest drop of that note. You get a burst, a "+N" floater and a key flash. A tap with no matching drop counts as `wrong`.
- `rain-land`: a landed drop flashes its key (reveal), costs a life and resets the combo. At 0 lives the game is over.
- `rain-pause`: ⏸ in the header, or the app going to the background, freezes the game clock. "▶ เล่นต่อ" resumes.
- `rain-replay`: "↻ ฟังหยดล่างสุด" plays the lowest drop's note again.
- `rain-over`: shows the score, "รับได้ N หยด · อยู่รอด S วินาที", and the max combo. A new best gets 🏆 and fireworks. Each game logs `{score, caught, missed, wrong, maxCombo, gray, secs}` to `progress.rain`.
- `rain-best`: the Home card (`card-rain`) shows the best score, and so does the Stats tile "Color Rain สูงสุด".

## How to get to it (player POV)

- Home → "แบบฝึกอื่นๆ" → the wide card with three falling drops (`data-testid="card-rain"`), or `#rain`.

## Driving it with drive.cjs

- Run `node scripts/drive.cjs .claude/skills/verify-color-pitch/recipes/rain.js` (about 2 min). It plays two games.
- **Game 1 (colored).** It catches 18 drops once each has fallen 25 %, makes one wrong tap, and pauses for 1.5 s. Then it stops tapping until the game ends.
- **Game 2 (gray).** It checks the colors are hidden, then lets the game end.
- `after.json` shows:
  - `run1` = {caught 18, missed 3, wrong 1, gray false, score > 0}
  - `pauseCheck.yBefore === yAfter` (frozen while paused)
  - `grayDropIsGray: true`, `keyHidesColor: true`
  - `run2.gray: true`, `runs: 2`
  - `statsTile` = run 1's score
- **Proof:** `02-playing.png`, `03-paused.png`, `04-game-over.png`, `05-gray.png`.

## Gotchas

- `__cpQuestion` is `{kind: "rain", drops: [{id, pc, y}], lives, score}`, refreshed every frame. `y` runs from 0 (top) to 1 (the ground).
- Rendering is driven by `requestAnimationFrame`. In headless Edge it runs at full speed, so the timings are real time.
