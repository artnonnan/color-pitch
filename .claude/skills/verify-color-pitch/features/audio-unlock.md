# Audio unlock and sound diagnostics (เปิดเสียง / ข้อมูลตรวจเสียง)

Sound needs a tap first (the iOS rule). Until audio runs, a pill at the bottom reads "🔈 แตะที่ใดก็ได้เพื่อเปิดเสียง". While the piano samples load it reads "⏳ กำลังโหลดเสียงเปียโน…", and if they fail it reads "ไม่ได้ยินเสียง? ปิดโหมดเงียบ…". Settings has a "ข้อมูลตรวจเสียง" card with live diagnostics and a test tone, so a player with no sound can send a screenshot.

## Sub-features

- `audio-first-tap`: `AudioUnlock` is mounted on the profile picker too. The tap on "อาท" or "Guest" starts audio, and Tone.js starts downloading as the picker opens. Before this, the picker tap was lost, and an early tap could land before Tone loaded.
- `audio-media-channel`: on unlock, `navigator.audioSession.type` is set (Safari 17+). A looping silent `<audio>` plays while the page is visible and pauses when it's hidden. This keeps iOS on the media channel, so sound plays even with the ringer switch on silent.
- `audio-session-fallback`: if the context still isn't running 0.7 s after the second tap and `audioSession` exists, the session type switches from "playback" to "auto" for later taps. This is aimed at in-app WebKit views such as Chrome on iPhone, where "playback" may be rejected. It is unproven: there's no iPhone in the loop.
- `audio-resume`: after an iOS suspension (screen lock, app switch), the pill comes back as "แตะที่ใดก็ได้…", and the next tap wakes audio.
- `audio-pill-taps`: the pill takes taps only in the locked or error states, where a tap opens the diagnostics panel. While loading, taps pass through to the keys underneath. If a tap succeeds in waking audio, the pill disappears at once.
- `audio-diag`: Settings → "🔈 ข้อมูลตรวจเสียง" shows "เล่นเสียงทดสอบ (C)" and these fields: browser, context, sampleRate, status, audioSession, sessionMode, silentLoop, attempts, earlyAttempts, states (the context state history), lastError, pianoLoaded, instrument. `window.__cpAudio().diag` has the same data.

## How to get to it (player POV)

- It appears automatically at first open. Settings → the "ข้อมูลตรวจเสียง" card, any time.

## Driving it with drive.cjs

- Run `node scripts/drive.cjs .claude/skills/verify-color-pitch/recipes/audio-unlock.js --profile none`. `after.json` shows:
  - `pillOnPicker` = "🔈 แตะที่ใดก็ได้เพื่อเปิดเสียง"
  - `afterPick.context: "running"` (the picker tap started audio) and `silentLoop: "playing"`
  - `pillLocked` comes back after `__cpAudioSuspend()`, and `afterTap.context: "running"`
  - `diagCardHasFields: true`, `testPlays: 1`, `answered: 1` (the keyboard still takes taps)
- **Proof.**
  - `01-picker-pill.png`
  - `02-pill-locked.png`
  - `03-settings-diag.png`

## Gotchas

- Edge is not iOS. It reports `audioSession: unsupported`, a tap always succeeds, and the ringer switch doesn't exist. So these paths can only be checked on a real iPhone:
  - the "pill stays, tap opens the panel" path
  - the "auto" session fallback
  - Chrome on iPhone
- `attempts` counts both `touchend` and `click` from one tap, so 2 per tap is normal.
- `__cpAudioSuspend()` is a test hook that mimics the iOS suspension. It is not a player action, but nothing a player does in Edge can suspend audio.
