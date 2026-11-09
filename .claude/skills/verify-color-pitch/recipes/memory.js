// ความจำเสียง: one set of 10 at the 5-second hold, one deliberate miss.
// Proves: the note plays with no color, the keys stay locked through a countdown while
// distracting notes play, then the answer is graded with the color revealed.
const playCount = async () => (await audio())?.playCount ?? 0;
await go("");
await tapSel('[data-testid="card-memory"]');
await sleep(500);
await skipGate();
await shot("01-intro");
const introDelay = (await text()).match(/จำไว้ (\d+) วินาที/)?.[1] ?? null;
await tapSel('[data-testid="memory-start"]');
const rounds = [];
for (let r = 1; r <= 10; r++) {
  await waitFor(() => !!document.querySelector('[data-testid="memory-countdown"]'), 10000);
  const p0 = await playCount();
  const lockedDuringHold = await page.evaluate(() => document.querySelector('button[data-pc="0"]').getAttribute("aria-disabled") === "true");
  if (r === 1) await shot("02-hold");
  const holdStart = Date.now();
  await waitFor(() => document.querySelector('button[data-pc="0"]')?.getAttribute("aria-disabled") === "false", 15000);
  const holdMs = Date.now() - holdStart;
  const distractors = (await playCount()) - p0;
  const q = await question();
  const ans = r === 3 ? (q.pc === 0 ? 7 : 0) : q.pc;
  await tapKey(ans);
  await sleep(400);
  if (r === 3) await shot("03-feedback-wrong");
  rounds.push({ r, pc: q.pc, delay: q.delay, lockedDuringHold, holdMs, distractors, verdict: (await text()).match(/จำได้!|โน้ตแรกคือ [A-G]#?/)?.[0] ?? null });
  await tapSel('[data-testid="memory-next"]');
}
await waitFor(() => /จำได้ \d+ จาก 10 ข้อ/.test(document.body.innerText), 5000);
await shot("04-summary");
const s = await state();
const result = {
  introDelay,
  allLocked: rounds.every((x) => x.lockedDuringHold),
  minHoldMs: Math.min(...rounds.map((x) => x.holdMs)),
  minDistractors: Math.min(...rounds.map((x) => x.distractors)),
  verdicts: rounds.map((x) => x.verdict),
  logged: s.progress.memAnswers.length,
  correct: s.progress.memAnswers.filter((a) => a.answer === a.target).length,
  summary: (await text()).match(/จำได้ \d+ จาก 10 ข้อ/)?.[0] ?? null,
};
save("after", result);
return result;
