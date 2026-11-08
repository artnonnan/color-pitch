// Mode brightness, from a brand-new player: unlock by time, lesson, level 1 → level 2.
// Modes open in week 4. A new player can't be there today, so the run lets time pass the
// way a player would: open the app once (startDate = today), then reopen with the browser
// clock 28 days later. No state is written directly.
// Question 1 uses the hint (logged, never counts), question 2 is a deliberate miss, so
// level 2 arrives on answer 31.
const playCount = async () => (await audio())?.playCount ?? 0;
await go("");
const startDate = (await state()).progress.startDate;
const lockedToday = await (async () => { await go("#modes"); await sleep(400); await skipGate(); return /ปลดล็อกในสัปดาห์ 4/.test(await text()); })();
await page.evaluateOnNewDocument((off) => {
  const R = Date;
  class D extends R {
    constructor(...a) { if (a.length === 0) super(R.now() + off); else super(...a); }
    static now() { return R.now() + off; }
  }
  window.Date = D;
}, 28 * 864e5);
const openModes = async () => {
  await go("");
  await go("#modes");
  await sleep(400);
  await skipGate();
};
await openModes();
const week = await page.evaluate(() => { const s = window.__colorPitch(); return { startDate: s.progress.startDate, today: new Date().toISOString().slice(0, 10) }; });

// ---- lesson ----
const lessonShown = !!(await page.$('[data-testid="lesson"]'));
const lessonSteps = [];
for (let s = 0; s < 8 && (await page.$('[data-testid="lesson"]')); s++) {
  const title = await page.$eval('[data-testid="lesson-title"]', (e) => e.innerText);
  const nActions = (await page.$$('[data-testid^="lesson-action-"]')).length;
  const a0 = await playCount();
  for (let j = 0; j < nActions; j++) { await tapSel(`[data-testid="lesson-action-${j}"]`); await sleep(250); }
  if (nActions) await page.waitForFunction((n) => window.__cpAudio().playCount > n, { timeout: 8000 }, a0).catch(() => {});
  lessonSteps.push({ title, actions: nActions, plays: (await playCount()) - a0 });
  if (s === 2) await shot("01-lesson-bright");
  if (await page.$('[data-testid="lesson-begin"]')) { await tapSel('[data-testid="lesson-begin"]'); await sleep(400); break; }
  await tapSel('[data-testid="lesson-next"]');
  await sleep(200);
}
const lessonSeen = (await state()).progress.modeLessonSeen;
await shot("02-intro-level1");

// ---- level 1 until level 2 ----
let n = 0, hint = null, miss = null, levelUpAt = null;
const levelLog = [];
const startSet = async () => {
  if (!(await page.$('[data-testid="modes-start"]'))) await openModes();
  await tapSel('[data-testid="modes-start"]');
  await sleep(300);
};
await startSet();
while ((await state()).progress.modeLevel < 1 && n < 45) {
  await waitFor(() => !!document.querySelector("[data-mode-choice]:not([disabled])"), 10000);
  n++;
  const q = await question();
  const choices = await page.$$eval("[data-mode-choice]", (b) => b.map((x) => x.dataset.modeChoice));
  if (n === 1) {
    await shot("03-level1-question");
    const a0 = await playCount();
    await tapSel('[data-testid="modes-hint"]');
    await sleep(200);
    await tapSel(`[data-hint-mode="${choices[0]}"]`);
    await sleep(400);
    hint = { plays: (await playCount()) - a0 };
    await shot("04-hint");
  }
  const ans = n === 2 ? choices.find((c) => c !== q.mode) : q.mode;
  await tapSel(`[data-mode-choice="${ans}"]`);
  await sleep(400);
  const diff = await page.$$eval('[data-testid="modes-scale"] [data-diff="1"]', (e) => e.map((x) => x.innerText));
  if (n === 2) {
    await shot("05-feedback-wrong");
    const a0 = await playCount();
    await tapSel('[data-testid="modes-compare"]');
    await sleep(400);
    miss = { mode: q.mode, ans, diff, comparePlays: (await playCount()) - a0, verdict: (await text()).match(/ยังไม่ใช่|ถูกต้อง!|สเกลนี้คือ [A-Za-z]+/)?.[0] ?? null };
  }
  levelLog.push({ n, mode: q.mode, level: q.level, choices: choices.join(","), diff: diff.join(" "), verdict: (await text()).match(/ยังไม่ใช่|ถูกต้อง!|ตรงตำแหน่ง!|ขึ้นระดับ [0-9]!/)?.[0] ?? null });
  if (/ขึ้นระดับ 2!/.test(await text())) { levelUpAt = n; await shot("06-levelup"); }
  if (await page.$('[data-testid="modes-next"]')) await tapSel('[data-testid="modes-next"]');
  else await startSet();
  await sleep(200);
}

// ---- one level-2 question ----
if (!(await page.$("[data-mode-choice]"))) await startSet();
await waitFor(() => !!document.querySelector("[data-mode-choice]:not([disabled])"), 10000);
const q2 = await question();
const level2Choices = await page.$$eval("[data-mode-choice]", (b) => b.map((x) => x.dataset.modeChoice));
await tapSel(`[data-mode-choice="${q2.mode}"]`);
await sleep(400);
const level2Diff = await page.$$eval('[data-testid="modes-scale"] [data-diff="1"]', (e) => e.map((x) => x.innerText));
await shot("07-level2-reveal");
const s = await state();
const result = {
  startDate,
  lockedToday,
  week,
  lessonShown,
  lessonSeen,
  lessonSteps,
  hint,
  hintedLogged: s.progress.modeAnswers.filter((x) => x.hinted).length,
  miss,
  levelUpAt,
  modeLevel: s.progress.modeLevel,
  level1Modes: [...new Set(levelLog.map((x) => x.mode))].sort(),
  verdicts: [...new Set(levelLog.map((x) => x.verdict))],
  level1Diffs: [...new Set(levelLog.map((x) => `${x.mode}:${x.diff}`))].sort(),
  level2: { mode: q2.mode, level: q2.level, choices: level2Choices, diff: level2Diff },
  answers: s.progress.modeAnswers.length,
};
save("after", result);
return result;
