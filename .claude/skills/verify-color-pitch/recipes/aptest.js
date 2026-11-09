// สอบวัดเสียงจริง: one full 24-item test like a player, with 3 deliberate misses on C.
// Proves: no feedback during the test (no verdict text, no key flashes); a noise burst before
// every item; voices and octaves vary; the result shows score, per-note bars, a certificate
// for notes right every time, and the history; the Stats tile shows the last score.
const playCount = async () => (await audio())?.playCount ?? 0;
await go("");
await tapSel('[data-testid="card-aptest"]');
await sleep(500);
await skipGate();
await shot("01-intro");
await tapSel('[data-testid="aptest-start"]');
const ready = () => document.querySelector('button[data-pc="0"]')?.getAttribute("aria-disabled") === "false";
const seen = [];
let misses = 0, feedbackLeak = false, washSeen = 0;
const pStart = await playCount();
for (let i = 0; i < 24; i++) {
  // The burst is scheduled all at once, so check the wash phase rather than counting per item.
  if (i > 0 && (await page.evaluate(() => /กำลังล้างเสียง/.test(document.body.innerText)))) washSeen++;
  await waitFor(ready, 15000);
  const q = await question();
  const miss = q.target === 0 && misses < 3;
  if (miss) misses++;
  if (i === 1) await shot("02-question");
  await tapKey(miss ? 7 : q.target);
  await sleep(250);
  const body = await text();
  if (/ถูกต้อง|ยังไม่ใช่|นี่คือ/.test(body) || (await page.$(".keyflash"))) feedbackLeak = true;
  seen.push({ target: q.target, midi: q.midi, voice: q.voice });
}
await waitFor(() => !!document.querySelector('[data-testid="aptest-score"]'), 8000);
await shot("03-result", true);
const score = await page.$eval('[data-testid="aptest-score"]', (e) => e.innerText);
const cert = await page.$eval('[data-testid="aptest-cert"]', (e) => e.innerText.replace(/\s+/g, " ")).catch(() => null);
const perNote = await page.$eval('[data-testid="aptest-per-note"]', (e) => e.innerText.replace(/\s+/g, " "));
const hasHistory = !!(await page.$('[data-testid="aptest-history"]'));
const s = await state();
await go("#stats");
await sleep(300);
const tile = (await text()).match(/(\d+%|–)\s*\n?\s*สอบวัดเสียงล่าสุด/)?.[1] ?? null;
const result = {
  items: seen.length,
  misses,
  feedbackLeak,
  washSeen, // of 23 items after the first
  totalPlays: (await playCount()) - pStart, // >= 24 × (9 burst + 1 item) means a burst before every item
  voices: [...new Set(seen.map((x) => x.voice))].length,
  octaves: [...new Set(seen.map((x) => Math.floor(x.midi / 12)))].length,
  targets: [...new Set(seen.map((x) => x.target))].sort(),
  score,
  cert,
  perNote,
  hasHistory,
  logged: s.progress.apTests.length,
  loggedItems: s.progress.apTests.at(-1)?.items.length,
  noteAnswersUntouched: s.progress.noteAnswers.length === 0,
  statsTile: tile,
};
save("after", result);
return result;
