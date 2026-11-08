// Cloud sync, device A. Run with --cloud --profile none. WRITES the real "guest" row.
// Plays 3 quiz notes as Guest and waits until the save reaches Supabase.
// Then run sync-read.js (a fresh browser = device B) to see the same progress arrive.
await go("");
await pickProfile("guest");
await waitFor(() => window.__cpSync().sync !== "syncing", 15000);
const before = { sync: await page.evaluate(() => window.__cpSync()), answers: (await state()).progress.noteAnswers.length };
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
const answers = (await state()).progress.noteAnswers.length;
await page.goto(page.url().split("#")[0] + "#");
await sleep(300);
// Wait for the debounced save (2.5 s of quiet) to land.
await waitFor(() => { const s = window.__cpSync(); return s.sync === "synced" && s.pushedTs >= s.ts; }, 20000);
await shot("01-home-synced");
const after = await page.evaluate(() => window.__cpSync());
const chip = (await page.$eval('[data-testid="profile-chip"]', (e) => e.innerText)).replace(/\s+/g, " ");
const result = { before, answers, after, chip };
save("after", result);
return result;
