// ทายจากสี: a new player (C and G) plays until the option count grows from 2 to 3.
// Question 1 taps both options to hear them again before answering; question 2 is a
// deliberate miss. 30 answers at 29/30 cross the rule, so the 31st question has 3 options.
const playCount = async () => (await audio())?.playCount ?? 0;
const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
await go("");
await tapSel('[data-testid="card-colorpick"]');
await sleep(500);
await skipGate();
await shot("01-intro");
const introOptions = (await text()).match(/ตัวเลือก (\d) เสียง/)?.[1] ?? null;
await tapSel('[data-testid="colorpick-start"]');

const ready = () => !!document.querySelector('[data-testid="colorpick-answer"]') && ![...document.querySelectorAll("[data-option]")].some((b) => b.disabled);
const log = [];
let n = 0, grewText = null, retap = null, miss = null, swatchBlank = null;
while (n < 40 && !grewText) {
  if (await page.$('[data-testid="colorpick-done"]')) {
    await tapSel('[data-testid="colorpick-done"]');
    await sleep(300);
    await tapSel('[data-testid="card-colorpick"]');
    await sleep(400);
    await tapSel('[data-testid="colorpick-start"]');
  }
  await waitFor(ready, 10000);
  n++;
  const q = await question();
  if (n === 1) {
    swatchBlank = (await page.$eval('[data-testid="colorpick-swatch"]', (e) => e.innerText)).trim() === "";
    await shot("02-question");
    const p0 = await playCount();
    for (let i = 0; i < q.options.length; i++) { await tapSel(`[data-option="${i}"]`); await sleep(250); }
    retap = (await playCount()) - p0;
  }
  const right = q.options.findIndex((o) => o.pc === q.target);
  const pickIdx = n === 2 ? q.options.findIndex((o) => o.pc !== q.target) : right;
  await tapSel(`[data-option="${pickIdx}"]`);
  await sleep(150);
  await tapSel('[data-testid="colorpick-answer"]');
  await sleep(450);
  const body = await text();
  if (n === 1) await shot("03-feedback-correct");
  if (n === 2) {
    await shot("04-feedback-wrong");
    miss = { target: NAMES[q.target], verdict: body.match(/สีนี้คือ [A-G]#?/)?.[0] ?? null };
  }
  grewText = body.match(/ตัวเลือกเพิ่มเป็น \d เสียง/)?.[0] ?? null;
  if (grewText) await shot("05-grew");
  log.push({ n, target: q.target, options: q.options.map((o) => o.pc), midis: q.options.map((o) => o.midi) });
  await tapSel('[data-testid="colorpick-next"]');
  await sleep(250);
}
// The next question after growing.
if (await page.$('[data-testid="colorpick-done"]')) {
  await tapSel('[data-testid="colorpick-done"]');
  await sleep(300);
  await tapSel('[data-testid="card-colorpick"]');
  await sleep(400);
  await tapSel('[data-testid="colorpick-start"]');
}
await waitFor(ready, 10000);
const after = await question();
await shot("06-three-options");
const s = await state();
await go("#stats");
await sleep(300);
const tile = (await text()).match(/(\d+%|–)\s*\n?\s*ทายจากสี/)?.[1] ?? null;
const result = {
  introOptions,
  swatchBlank,
  retapPlays: retap,
  miss,
  answered: n,
  grewText,
  colorPickLevel: s.progress.colorPickLevel,
  nextOptions: after.options.length,
  allTargetsUnlocked: log.every((x) => [0, 7].includes(x.target)),
  allOptionsDistinct: log.every((x) => new Set(x.options).size === x.options.length && x.options.includes(x.target)),
  octavesVary: new Set(log.flatMap((x) => x.midis.map((m) => Math.floor(m / 12)))).size > 1,
  logged: s.progress.colorPicks.length,
  correct: s.progress.colorPicks.filter((a) => a.answer === a.target).length,
  statsTile: tile,
};
save("after", result);
return result;
