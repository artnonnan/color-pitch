// Audio unlock and sound diagnostics. Run with --profile none.
// Proves: the very first tap (on the profile picker) starts audio; the silent loop that
// keeps iOS on the media channel is playing; after an iOS-style suspension the pill reads
// "แตะที่ใดก็ได้เพื่อเปิดเสียง" and a tap wakes audio; Settings → "ข้อมูลตรวจเสียง" shows
// live diagnostics and a test tone plays; keyboard taps still reach the keys.
// Edge is not iOS: this cannot show the ringer switch or Chrome-on-iPhone behaviour, and
// in Edge a tap always succeeds, so the pill-opens-diagnostics path (unlock failing) can't
// be reached here.
await go("");
const beforePick = await audio();
const pillOnPicker = await page.$eval('[data-testid="audio-pill"]', (e) => e.innerText).catch(() => null);
await shot("01-picker-pill");
await pickProfile("guest");
await page.waitForFunction(() => window.__cpAudio().context === "running", { timeout: 8000 }).catch(() => {});
const afterPick = await audio();

// iOS suspends audio on screen lock; the test hook does the same.
await page.evaluate(() => window.__cpAudioSuspend());
await page.waitForFunction(() => /แตะที่ใดก็ได้เพื่อเปิดเสียง/.test(document.body.innerText), { timeout: 5000 }).catch(() => {});
const pillLocked = await page.$eval('[data-testid="audio-pill"]', (e) => e.innerText).catch(() => null);
await shot("02-pill-locked");
await page.touchscreen.tap(187, 300);
await page.waitForFunction(() => window.__cpAudio().context === "running", { timeout: 5000 }).catch(() => {});
const afterTap = await audio();

// Settings: diagnostics card and test tone.
await go("#settings");
await sleep(500);
const card = await page.$eval('[data-testid="audio-check"]', (e) => e.innerText).catch(() => null);
const p0 = (await audio()).playCount;
await tapSel('[data-testid="audio-test"]');
await sleep(500);
const testPlays = (await audio()).playCount - p0;
await page.$eval('[data-testid="audio-check"]', (e) => e.scrollIntoView({ block: "center" }));
await sleep(300);
await shot("03-settings-diag");

// The keyboard still works (a quiz answer through the real UI).
await go("#quiz");
await skipGate();
await tap(/เริ่ม/);
await waitFor(() => document.querySelector('button[data-pc="0"]')?.getAttribute("aria-disabled") === "false", 10000);
const q = await question();
await tapKey(q.pc);
await sleep(500);
const answered = (await state()).progress.noteAnswers.length;

const result = {
  beforePick: { context: beforePick.context, status: beforePick.status },
  pillOnPicker,
  afterPick: { context: afterPick.context, attempts: afterPick.diag.attempts, early: afterPick.diag.earlyAttempts, silentLoop: afterPick.diag.silentLoop, session: afterPick.diag.audioSession },
  pillLocked,
  afterTap: { context: afterTap.context, states: afterTap.diag.states },
  diagCardHasFields: !!card && ["context", "audioSession", "attempts", "silentLoop", "browser"].every((k) => card.includes(k)),
  testPlays,
  answered,
};
save("after", result);
return result;
