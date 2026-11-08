# Sound match (จับคู่การ์ดเสียง)

A memory game. Cards lie face down. Tapping one plays its note. The player finds the two cards that are the same note, which are in different octaves, so the match is by pitch class and not by height.
- **Matched pairs:** they show the note's color and name.
- **Board:** 3 pairs (6 cards) or 6 pairs (12 cards).
- **Colors:** by default, colors appear only after a match. "โชว์สีตอนเปิดการ์ด" shows them when a card is turned.
- **Goal:** the fewest moves. A perfect game takes as many moves as there are pairs.

## Sub-features

- `match-deal`: the notes are the unlocked notes first (shuffled), then the rest in unlock order. One card of each pair is in C3–B3, and the other one or two octaves up.
- `match-flip`: a tap plays the note. An open card shows 🔊 (or its color in color mode), with a white border and glow. A third tap is ignored while two cards are open.
- `match-pair`: if the two cards are the same pitch class, they stay up with their color and name, and a burst plays. If not, both get a red border, glow and shake, then turn back after 1 s. Every second card counts as one move.
- `match-done`: "ใช้ N รอบ · S วินาที" and "ถ้าจำได้หมด จะใช้แค่ P รอบ". A new best for that board size gets 🏆. Each game logs `{pairs, moves, ms, colors}` to `progress.matchGames`.
- `match-best`: the header and intro show "ดีที่สุด N รอบ" for the chosen size. The Stats tile "จับคู่ 6 คู่ (รอบน้อยสุด)" shows the 6-pair best.

## How to get to it (player POV)

- Home → "แบบฝึกอื่นๆ" → the card with ♪ and two same-color cards 🃏 (`data-testid="card-match"`), or `#match`.

## Driving it with drive.cjs

- Run `node scripts/drive.cjs .claude/skills/verify-color-pitch/recipes/match.js`. It plays a 3-pair board with one deliberate mismatch, then a perfect 6-pair board.
- **What `after.json` shows:**
  - `sizes` = {three: 6, six: 12}
  - `openFace` = {state "open", text "🔊"}
  - `flipPlays: 2`
  - `missLook` = [true, true] (red border and shake)
  - `closedAgain` = ["closed", "closed"]
  - `result3` = "ใช้ 4 รอบ…", `result6` = "ใช้ 6 รอบ…"
  - `games` = [{3, 4}, {6, 6}]
  - `statsTile: "6"`
- **Proof:**
  - `02-board-closed.png`
  - `03-mismatch.png`
  - `04-done-3.png`
  - `05-six-one-matched.png`
  - `06-done-6.png`

## Gotchas

- `__cpQuestion` is `{kind: "match", cards: [{id, pc, matched}]}`. It's the answer key, read-only, and the recipe uses it to play like a perfect memory.
- An inline `boxShadow` overrides Tailwind `ring-*` (both are box-shadow). That's why a mismatch uses a border plus a red glow, not a ring (fixed on 2026-11-08).
