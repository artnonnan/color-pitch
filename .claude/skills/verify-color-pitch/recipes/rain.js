// Color Rain: one colored game played like a player, then a gray-drop game.
// Game 1: catch drops by tapping their key once they have fallen a little (one deliberate
// wrong tap), pause and resume once, then stop tapping so three drops land → game over.
// Game 2 (gray): check the drops are gray and the keys hide their colors, then let it end.
const playCount = async () => (await audio())?.playCount ?? 0;
const drops = () => page.evaluate(() => (window.__cpQuestion?.kind === "rain" ? window.__cpQuestion.drops : []));
await go("");
await tapSel('[data-testid="card-rain"]');
await sleep(500);
await skipGate();
await shot("01-intro");
const p0 = await playCount();
await tapSel('[data-testid="rain-start"]');
await waitFor(() => window.__cpQuestion?.kind === "rain" && window.__cpQuestion.drops.length > 0, 5000);
const firstDropPlays = (await playCount()) - p0;
let caught = 0, wrongDone = false, pauseCheck = null;
const t0 = Date.now();
while (caught < 18 && Date.now() - t0 < 120000) {
  const ds = await drops();
  const low = [...ds].sort((a, b) => b.y - a.y)[0];
  if (!low) { await sleep(100); continue; }
  if (caught === 4 && !wrongDone) {
    const other = [0, 7].find((pc) => !ds.some((d) => d.pc === pc));
    if (other !== undefined) { await tapKey(other); wrongDone = true; await sleep(150); continue; }
  }
  if (caught === 6 && !pauseCheck) {
    await tapSel('[data-testid="rain-pause"]');
    const a = await drops();
    await sleep(1500);
    const b = await drops();
    await shot("03-paused");
    await tapSel('[data-testid="rain-resume"]');
    pauseCheck = { yBefore: a[0]?.y ?? null, yAfter: b[0]?.y ?? null };
    await sleep(200);
    continue;
  }
  if (low.y < 0.25) { await sleep(80); continue; }
  await tapKey(low.pc);
  caught++;
  if (caught === 3) await shot("02-playing");
  await sleep(120);
}
const mid = await page.evaluate(() => window.__cpQuestion);
// Stop tapping: drops land, three lives go.
await waitFor(() => /หมดชีวิตแล้ว|สถิติใหม่/.test(document.body.innerText), 60000);
await shot("04-game-over");
const run1 = (await state()).progress.rain.at(-1);
const finalText = await page.$eval('[data-testid="rain-final"]', (e) => e.innerText);

// Game 2: gray drops.
// Back to the intro to switch gray drops on.
await go("");
await tapSel('[data-testid="card-rain"]');
await sleep(500);
await skipGate();
await tapSel('[data-testid="rain-gray"]');
await tapSel('[data-testid="rain-start"]');
await waitFor(() => !!document.querySelector("[data-drop]"), 5000);
await sleep(800);
const grayDrop = await page.$eval("[data-drop]", (e) => getComputedStyle(e).backgroundImage);
const keyBg = await page.$eval('button[data-pc="0"]', (e) => getComputedStyle(e).backgroundImage);
await shot("05-gray");
await waitFor(() => /หมดชีวิตแล้ว|สถิติใหม่/.test(document.body.innerText), 60000);
const s = await state();
await go("#stats");
await sleep(300);
const tile = (await text()).match(/(\d+|–)\s*\n?\s*Color Rain สูงสุด/)?.[1] ?? null;
const result = {
  firstDropPlays,
  caughtTapped: caught,
  wrongDone,
  pauseCheck,
  midLives: mid?.lives,
  run1,
  finalText,
  run2: s.progress.rain.at(-1),
  grayDropIsGray: /138, 134, 150/.test(grayDrop),
  keyHidesColor: !/239, 68, 68/.test(keyBg),
  runs: s.progress.rain.length,
  statsTile: tile,
};
save("after", result);
return result;
