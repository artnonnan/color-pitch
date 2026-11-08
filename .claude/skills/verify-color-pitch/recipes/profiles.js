// Profiles: run with --profile none (the recipe drives the picker itself). Cloud is off.
// Proves: the picker shows on every open with 1. อาท and 2. Guest, each profile keeps its own
// progress, "สลับผู้ใช้" returns to the picker, the last choice is marked, and progress
// saved before profiles existed (legacy key) becomes อาท's.
const onPicker = () => page.evaluate(() => !!document.querySelector('[data-testid="profile-art"]') && !!document.querySelector('[data-testid="profile-guest"]'));
const pickerText = async () => (await text()).replace(/\s+/g, " ");

// 1. Upgrade path: a player who used the app before profiles has data under the old key.
//    No action in the new build can create that key, so this precondition is written directly.
await go("");
await page.evaluate(() => {
  const s = window.__colorPitch();
  s.progress.noteAnswers = [{ t: Date.now() - 86400000, target: 0, answer: 0, ms: 900 }];
  localStorage.setItem("color-pitch:v1", JSON.stringify(s));
});
await go("");
const pickerOnOpen = await onPicker();
await shot("01-picker");
const pickerCopy = await pickerText();
await pickProfile("art");
const artLegacy = (await state()).progress.noteAnswers.length;
await shot("02-art-home", true);
const chipArt = (await page.$eval('[data-testid="profile-chip"]', (e) => e.innerText)).replace(/\s+/g, " ");

// 2. Play as อาท: answer 3 quiz notes.
await page.goto(page.url().split("#")[0] + "#quiz");
await sleep(500);
await skipGate();
await tap(/เริ่ม/);
const ready = () => document.querySelector('button[data-pc="0"]')?.getAttribute("aria-disabled") === "false";
for (let i = 0; i < 3; i++) {
  await waitFor(ready, 10000);
  const q = await question();
  await tapKey(q.pc);
  await sleep(1900);
}
const artAfter = (await state()).progress.noteAnswers.length;

// 3. Switch to Guest from Settings.
await page.goto(page.url().split("#")[0] + "#settings");
await sleep(500);
await tapSel('[data-testid="switch-profile"]');
await sleep(400);
const pickerAfterSwitch = await onPicker();
await pickProfile("guest");
const guestFresh = (await state()).progress.noteAnswers.length;
const syncGuest = await page.evaluate(() => window.__cpSync());

// 4. Reopen: the picker is back, marks Guest as last used, and อาท's progress is still there.
await go("");
const pickerOnReopen = await onPicker();
const lastMarked = await page.$eval('[data-testid="profile-guest"]', (e) => /ใช้ล่าสุด/.test(e.innerText));
await shot("03-picker-last-guest");
await pickProfile("art");
const artReloaded = (await state()).progress.noteAnswers.length;

const result = {
  pickerOnOpen,
  pickerHasBoth: /1\. อาท/.test(pickerCopy) && /2\. Guest/.test(pickerCopy),
  pickerCopy,
  artLegacy,
  chipArt,
  artAfter,
  pickerAfterSwitch,
  guestFresh,
  syncGuest,
  pickerOnReopen,
  lastMarked,
  artReloaded,
};
save("after", result);
return result;
