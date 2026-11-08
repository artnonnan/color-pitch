---
name: verify-color-pitch
description: "Launch Color Pitch (Next.js PWA), drive it like a player on a 375px iPhone in headless Edge through scripts/drive.cjs, and capture proof. Use before claiming any player-facing change works, and when running maintain-game-verification for this project."
---

# Verify Color Pitch

The feature map in `features/` lists what the player can do. Read `features/README.md` first, then the feature file you need. Recipes for `scripts/drive.cjs` live in `recipes/`.

## Launch

All paths are relative to the repo root `D:\Engine\color-pitch`.

- **Build:** `npm run build`
  - It is built when the output ends with the route table (`○ /`) and `.next/BUILD_ID` exists.
  - Run `npx tsc --noEmit` first. It is faster and catches type errors.
- **Run:** `npx next start -p 3123`
  - Start it as a background command and record the PID that listens on the port: `netstat -ano | grep ":3123" | grep LISTEN`.
  - Production only. The service worker and the real audio-unlock path do not run under `npm run dev`.
  - If port 3123 is already taken by a server you did not start, use another port and pass `--url http://localhost:<port>` to every command. Never drive or kill a server you did not start.
- **Ready:** `curl -s localhost:3123` returns HTML, and `doctor` passes.
- **Teardown:** `taskkill //PID <pid> //T //F`, using the recorded PID only.
- **Rebuild:** after a rebuild you must restart the server. A running `next start` keeps serving the old build, and `doctor` catches this as `buildIdServed: false`.

## Doctor

`node scripts/drive.cjs doctor --out <scratch>/doctor`

It passes, with exit code 0 and `"ok": true`, when:

- `status` is 200,
- `buildIdServed` is true (the served HTML contains `.next/BUILD_ID`, so this is the build you just made),
- `hooks.state` and `hooks.audio` are both `"function"`, and
- `freshProfile` is true.

Run it before the first drive and again after anything surprising.

## Drive

`node scripts/drive.cjs <recipe.js> [--url http://localhost:3123] [--out <dir>] [--mic c4|deny|none]`

- **Fresh player every run.** Each run opens headless Edge on a new browser profile, so localStorage is empty. That means notes C and G, 2 chords, 3 degrees, 3 intervals and 3 progression chords (I, IV, V) are unlocked, and melodies are 3 notes long.
- **Profile picker and cloud.** The app opens on a profile picker. The driver taps **guest** after every page load (`--profile guest|art|none`). It also sets localStorage `color-pitch:nocloud` so runs never touch the real Supabase rows. `--cloud` turns sync on for a deliberate sync check. `window.__cpSync()` reads profile and sync status.
- **Phone setup.** The viewport is a 375×812 iPhone with touch, and every tap is a real touch tap.
- **Fake microphone.** `--mic c4` (the default) feeds a steady C4 into the mic. `deny` refuses mic permission. `none` adds no fake device.
- **Recipe helpers.** These are documented in the header of `scripts/drive.cjs`:
  - `go`, `tap`, `tapSel`, `tapKey`, `skipGate`
  - `state`, `question`, `audio`, `text`, `waitFor`
  - `shot`, `save`, `log`
- **Read-only hooks.** These are the observe API. They read state and never write it:
  - `window.__colorPitch()`: the app state.
  - `window.__cpQuestion`: the answer to the current question. The recipe reads it to "know" the answer the way a perfect player would.
  - `window.__cpAudio()`: the context state, current voice, play counts and voice counts.
- **Edge only, outside the sandbox.** Chrome is blocked on this machine. Edge must run outside the Claude Code sandbox, because inside it Edge fails to launch. The driver starts Edge itself on a free DevTools port and connects to it, because `puppeteer.launch` cannot attach to Edge 156.
- **The app has no seeded RNG.** Questions are random, so recipes read `__cpQuestion` and assert on properties (counts, ranges, correctness), not exact sequences.

Existing recipes:

| Recipe | Feature |
|---|---|
| `recipes/note-quiz.js` | [note-quiz](features/note-quiz.md) |
| `recipes/degrees.js` | [scale-degrees](features/scale-degrees.md) |
| `recipes/intervals.js` | [intervals](features/intervals.md) |
| `recipes/voices.js` | [mix-voices](features/mix-voices.md) |
| `recipes/progressions.js` | [progressions](features/progressions.md) |
| `recipes/melody.js` | [melody](features/melody.md) |
| `recipes/modes.js` (clock +28 days to pass the week-4 lock) | [modes](features/modes.md) |
| `recipes/profiles.js` (`--profile none`) | [profiles](features/profiles.md) |
| `recipes/sync-write.js` then `sync-read.js` (`--cloud --profile none`, writes the real guest row) | [profiles](features/profiles.md) |

Older single-purpose scripts are still in `scripts/`. Each needs the server on port 3123 and a `c4.wav` next to it:
- `verify-edge.cjs`: daily session, mic, offline, denied mic
- `verify-ios-mic.cjs`
- `verify-resume.cjs`
- `verify-new-exercises.cjs`: Rush, Sing, Roots

They still use `puppeteer.launch`, so they fail on Edge 156 until they are moved to `drive.cjs`.

## Evidence

- **Location:** evidence goes to `verification/<date>-<recipe>/` by default. The folder is gitignored and kept after cleanup.
- **What a run writes:** screenshots, `after.json` (what the recipe returns), and `run-log.json` (recipe, URL, mic, log lines, page errors, result).
- **Page errors:** any `pageerror` or console error makes `ok: false` and exit code 1.
- **Only the player's path counts.** That means taps, waiting, and tapping "ต่อไป" to skip the feedback delay. Writing to localStorage or calling setters to skip ahead is not proof. To reach a locked state, play through it: 30 answers at ≥ 90 % is the unlock rule.

## Cleanup

- The driver kills its own Edge process tree by PID and deletes its scratch profile under `verification/.profiles/`.
- Kill the `next start` PID you recorded.
- Keep `verification/<date>-*`.
- If a run crashed and Edge processes were left behind, kill only the ones whose command line contains `color-pitch\verification\.profiles` (PowerShell: `Get-CimInstance Win32_Process -Filter "Name='msedge.exe'"`, filtered on `CommandLine`).

## Helpers

| Script | Invocation |
|---|---|
| `scripts/drive.cjs` | `node scripts/drive.cjs doctor` · `node scripts/drive.cjs .claude/skills/verify-color-pitch/recipes/<name>.js` |
| puppeteer-core | It is loaded from `D:/Engine/featuremap/harness/web/node_modules`. If that folder is missing, run `cd D:/Engine/featuremap/harness/web && npm install`, or set `PUPPETEER_CORE`. |
