# Profiles and cloud sync (ผู้ใช้ อาท / Guest)

Every time the app opens, it shows "ใครกำลังฝึก?" with two big cards, **1. อาท** and **2. Guest**. Each profile has its own progress and settings.
- **Sync:** when Supabase is configured, each profile is one row in `public.cp_profiles` and syncs across devices.
- **No PIN, by the owner's choice:** anyone with the site can play as either profile. Guest is shared by everyone who picks it.

## Sub-features

- `prof-picker`: shown on every cold open, before any screen, including a deep link like `#quiz`. The card chosen last on this device shows "ใช้ล่าสุด". The subtitle says whether progress syncs ("ซิงก์ทุกเครื่อง") or stays local.
- `prof-separate`: local copies live under `color-pitch:v1:<id>` plus `:ts`. Switching profiles swaps the whole app state.
- `prof-legacy`: progress saved before profiles existed (`color-pitch:v1`) becomes อาท's local copy at ts 1. The cloud wins if อาท already has a cloud copy.
- `prof-switch`: the chip under the title on Home ("อาท · ซิงก์แล้ว") and Settings → "⇄ สลับผู้ใช้" both save, then return to the picker.
- `sync-load`: picking a profile shows the local copy at once, then fetches the cloud copy. The newer one (by client timestamp) wins. A profile never saved on a device has ts 0, so a blank device can never overwrite cloud progress.
- `sync-save`: every change saves locally at once. It goes to the cloud after 2.5 s of quiet, and also when the app is hidden or closed (keepalive) and when it comes back online. The `cp_save` RPC refuses an older copy and the client then adopts the newer one.
- `sync-status`: the chip dot and label show off (เก็บในเครื่องนี้), syncing, synced, or offline.

## How to get to it (player POV)

- Open the site → the picker. Home chip, or Settings → "สลับผู้ใช้", to come back.

## Driving it with drive.cjs

- **Cloud is off by default.** `drive.cjs` sets localStorage `color-pitch:nocloud` = 1 and picks **guest** on the picker after every page load (`--profile guest|art|none`). Pass `--cloud` only for a deliberate sync check.
- **Local profiles.** Run `node scripts/drive.cjs .claude/skills/verify-color-pitch/recipes/profiles.js --profile none`. `after.json` shows:
  - `pickerOnOpen`, `pickerHasBoth`, `pickerAfterSwitch`, `pickerOnReopen`, `lastMarked`: all true
  - `artLegacy: 1` (the legacy answer moved into อาท)
  - `artAfter: 4`, `guestFresh: 0`, `artReloaded: 4`
  - Step 1 writes the legacy key directly. No action in the new build can create it, so this is a precondition, not a shortcut.
- **Cross-device sync. This writes the real guest row, so delete it afterwards.**
  - Run `sync-write.js --cloud --profile none`, then `sync-read.js --cloud --profile none`. Each run is a fresh browser, so it acts as a separate device.
  - `sync-read` must show the 3 answers and the same `ts` that `sync-write` saved.
  - Proven on 2026-11-08 against project `dqttpuoexfplfdrtfgxb`. The test row was deleted after.

## Gotchas

- The cloud config is baked in at build time (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local` or Vercel env). Without them the app is local-only and the chip reads "เก็บในเครื่องนี้".
- `window.__cpSync()` is read-only: `{profile, sync, cloud, ts, pushedTs}`. `sync === "synced" && pushedTs >= ts` means the latest change is in the cloud.
- A recipe's `go("#x")` on an already-open page changes only the hash, so the picker does not reappear. `go` picks only when no profile is selected.
- Conflicts are resolved by last write: if two devices change the same profile while both are offline, the later save wins whole, and the other device's changes are lost.
- The secret key and DB password in `config.txt` are never used by the app. The file is gitignored.
