// Chord progressions, advanced: skip tests up to level 7 (minor keys, seventh chords,
// borrowed chords), the way a strong player would. About 7 minutes.
// Test 1 (to level 2) misses 2 on purpose → fails. Then tests to levels 2…7 pass; the test to
// level 5 also uses the hint once (that question doesn't count, 9 of the other 9 still pass).
// Every revealed slot's chord name is checked against music theory.
const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const CH = {
  I: [0, ""], ii: [2, "m"], iii: [4, "m"], IV: [5, ""], V: [7, ""], vi: [9, "m"],
  i: [0, "m"], iv: [5, "m"], v: [7, "m"], III: [3, ""], VI: [8, ""], VII: [10, ""],
  Imaj7: [0, "maj7"], ii7: [2, "m7"], IVmaj7: [5, "maj7"], V7: [7, "7"], vi7: [9, "m7"],
  bVII: [10, ""], bVI: [8, ""], VofV: [2, ""],
};
const expectName = (key, c) => NAMES[(key + CH[c][0]) % 12] + CH[c][1];

await go("");
await tapSel('[data-testid="card-progressions"]');
await sleep(500);
await skipGate();
while (await page.$('[data-testid="lesson-next"]')) { await tapSel('[data-testid="lesson-next"]'); await sleep(120); }
await tapSel('[data-testid="lesson-begin"]');
await sleep(600);
// lesson-begin starts a normal set; leave it and come back to the intro.
await go("");
await tapSel('[data-testid="card-progressions"]');
await sleep(500);
await skipGate();
await shot("01-intro-skip");

const open = () => [...document.querySelectorAll("button[data-numeral]")].some((b) => !b.disabled);
const tests = [];
const levelSamples = {};
let namesChecked = 0, namesWrong = [];

const runTest = async (missCount, hintAt) => {
  const before = (await state()).progress.progLevel;
  await tapSel('[data-testid="progressions-skip"]');
  for (let r = 1; r <= 10; r++) {
    await waitFor(open, 15000);
    const q = await question();
    if (!levelSamples[q.level]) {
      levelSamples[q.level] = { home: q.chords[0], minor: q.minor, choices: await page.$$eval("button[data-numeral]", (b) => b.map((x) => x.innerText.split("\n")[0])) };
      await shot(`02-level${q.level + 1}-question`);
    }
    if (r === hintAt) {
      await tapSel('[data-testid="progressions-hint"]');
      await sleep(150);
      await tapSel(`[data-hint-numeral="${q.choices[0]}"]`);
      await sleep(300);
    }
    const answers = q.chords.slice(1);
    if (r <= missCount) answers[0] = q.choices.find((c) => c !== q.chords[1]);
    for (const a of answers) { await tapSel(`button[data-numeral="${a}"]`); await sleep(100); }
    await sleep(400);
    const slots = await page.$$eval("[data-slot]", (els) => els.map((e) => e.innerText.replace(/\s+/g, " ").trim()));
    q.chords.forEach((c, i) => {
      namesChecked++;
      if (!slots[i].includes(expectName(q.key, c))) namesWrong.push({ level: q.level, key: q.key, c, slot: slots[i] });
    });
    if (q.level >= 4 && !levelSamples[q.level].feedbackShot) { levelSamples[q.level].feedbackShot = true; await shot(`03-level${q.level + 1}-reveal`); }
    await tapSel('[data-testid="progressions-feedback"]');
    await sleep(200);
  }
  await waitFor(() => !!document.querySelector('[data-testid="progressions-test-result"]'), 8000);
  const msg = await page.$eval('[data-testid="progressions-test-result"]', (e) => e.innerText);
  const after = (await state()).progress.progLevel;
  tests.push({ from: before, to: after, msg });
  await shot(`04-test-${tests.length}`);
  await tapSel('[data-testid="progressions-summary-ok"]');
  await sleep(300);
};

await runTest(2, 0); // fail
for (let i = 0; i < 6; i++) await runTest(0, i === 3 ? 2 : 0);

// One normal question at the last level.
await tapSel('[data-testid="progressions-start"]');
await waitFor(open, 15000);
const last = await question();
const lastButtons = await page.$$eval("button[data-numeral]", (b) => b.map((x) => x.innerText.split("\n")[0]));
await shot("05-level7-normal");
const s = await state();
const result = {
  tests,
  progLevel: s.progress.progLevel,
  numeralsUnlocked: s.progress.numeralsUnlocked,
  testAnswersLogged: s.progress.progressions.filter((a) => a.test).length,
  hintedLogged: s.progress.progressions.filter((a) => a.hinted).length,
  levelSamples,
  namesChecked,
  namesWrong,
  last: { level: last.level, home: last.chords[0], test: last.test, buttons: lastButtons },
  levelHeader: await page.$eval('[data-testid="progressions-level"]', (e) => e.innerText),
};
save("after", result);
return result;
