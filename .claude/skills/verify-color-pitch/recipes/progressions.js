// Chord progressions, from a brand-new player: lesson → level 1 → level 2 → level 3.
// Proves: the lesson opens on the first visit and plays its examples; level 1 asks one
// chord (IV or V); a hinted answer is logged but never counts; tapping a slot replays
// that chord; 30 un-hinted answers at >= 90 % move up a level; level 2 offers I/IV/V;
// level 3 asks two chords (3 slots). Takes about 6 minutes.
const playCount = async () => (await audio())?.playCount ?? 0;
await go("");
await tapSel('[data-testid="card-progressions"]');
await sleep(500);
await skipGate();

// ---- lesson ----
const lessonShown = !!(await page.$('[data-testid="progressions-lesson"]'));
const lessonSteps = [];
for (let s = 0; s < 5; s++) {
  const title = await page.$eval('[data-testid="lesson-title"]', (e) => e.innerText);
  let played = null;
  if (await page.$('[data-testid="lesson-play"]')) {
    const a = await playCount();
    await tapSel('[data-testid="lesson-play"]');
    await sleep(400);
    played = (await playCount()) - a;
  }
  if (s === 2) await shot("01-lesson-v");
  if (s === 4) {
    const a = await playCount();
    await tapSel('[data-testid="lesson-compare-iv"]');
    await sleep(300);
    await tapSel('[data-testid="lesson-compare-v"]');
    await sleep(300);
    played = (await playCount()) - a;
    await shot("02-lesson-compare");
    lessonSteps.push({ title, played });
    await tapSel('[data-testid="lesson-begin"]');
    break;
  }
  lessonSteps.push({ title, played });
  await tapSel('[data-testid="lesson-next"]');
  await sleep(250);
}
const lessonSeen = (await state()).progress.progLessonSeen;

// ---- play ----
const open = () => [...document.querySelectorAll("button[data-numeral]")].some((b) => !b.disabled);
const choicesNow = () => page.$$eval("button[data-numeral]", (bs) => bs.map((b) => b.dataset.numeral));
const levelLog = [];
let n = 0, hintUsed = null, slotReplay = null, missAt = 2, levelUpText = {};
const startRound = async () => {
  if (await page.$('[data-testid="progressions-start"]')) { await tapSel('[data-testid="progressions-start"]'); return; }
  await go("");
  await tapSel('[data-testid="card-progressions"]');
  await sleep(500);
  await skipGate();
  await tapSel('[data-testid="progressions-start"]');
};
const playUntilLevel = async (target) => {
  while ((await state()).progress.progLevel < target && n < 90) {
    await waitFor(open, 15000);
    n++;
    const q = await question();
    const choices = await choicesNow();
    if (n === 1) {
      await shot("03-level1-question");
      const a = await playCount();
      await tapSel('[data-testid="progressions-hint"]');
      await sleep(200);
      await tapSel(`[data-hint-numeral="${q.choices[0]}"]`);
      await sleep(300);
      await shot("04-hint-panel");
      hintUsed = { plays: (await playCount()) - a };
    }
    if (n === 3) {
      const a = await playCount();
      await tapSel('[data-slot="2"]');
      await sleep(300);
      slotReplay = (await playCount()) - a;
    }
    const answers = q.chords.slice(1);
    if (n === missAt) answers[0] = q.choices.find((c) => c !== q.chords[1]);
    for (const x of answers) { await tapSel(`button[data-numeral="${x}"]`); await sleep(120); }
    await sleep(450);
    if (n === missAt) await shot("05-feedback-wrong");
    const body = await text();
    const up = body.match(/ขึ้นระดับ \d!/)?.[0];
    if (up) { levelUpText[up] = n; await shot(`06-${up.replace(/\D/g, "")}-levelup`); }
    levelLog.push({ n, level: q.level, len: q.chords.length, choices: choices.join(","), chords: q.chords.join("-"), miss: n === missAt });
    if (await page.$('[data-testid="progressions-feedback"]')) await tapSel('[data-testid="progressions-feedback"]');
    await sleep(300);
    if (/ถูกทั้งชุด \d+ จาก \d+ ทาง/.test(await text())) await startRound();
  }
};
await startRound();
await playUntilLevel(1);
const afterLevel2 = await state();
await playUntilLevel(2);
// One question at level 3 (index 2): three chords, two answers.
await waitFor(open, 15000);
const q3 = await question();
await shot("07-level3-question");
const s = await state();
const logged = s.progress.progressions;
const result = {
  lessonShown,
  lessonSeen,
  lessonSteps,
  hintUsed,
  hintedLogged: logged.filter((x) => x.hinted).length,
  slotReplay,
  questions: n,
  levelUpText,
  progLevel: s.progress.progLevel,
  level1Choices: [...new Set(levelLog.filter((x) => x.level === 0).map((x) => x.choices))],
  level1Lens: [...new Set(levelLog.filter((x) => x.level === 0).map((x) => x.len))],
  level2Choices: [...new Set(levelLog.filter((x) => x.level === 1).map((x) => x.choices))],
  level2HadIthenI: levelLog.some((x) => x.level === 1 && x.chords === "I-I"),
  level3: { level: q3.level, len: q3.chords.length, slots: await page.$$eval("[data-slot]", (e) => e.length), choices: await choicesNow() },
  numeralsUnlocked: s.progress.numeralsUnlocked,
  levelLog,
};
save("after", result);
return result;
