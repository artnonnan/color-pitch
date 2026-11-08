// Chord progressions: one set of 8, answered like a player.
// Round 2 taps a wrong chord, undoes it, then answers right (undo must not log).
// Round 3 names chord 2 wrong on purpose. Everything else is right.
// Proves: buttons stay closed while the progression plays, 3 picks grade the set,
// the reveal names each chord in its key, the summary counts sets, the stats tile fills.
await go("");
await tapSel('[data-testid="card-progressions"]');
await sleep(500);
await skipGate();
await shot("01-intro");
await tapSel('[data-testid="progressions-start"]');
await sleep(700);
await shot("02-playing");
const closedWhilePlaying = await page.evaluate(() => document.querySelector('button[data-numeral="I"]').disabled);
const open = () => { const b = document.querySelector('button[data-numeral="I"]'); return !!b && !b.disabled; };
const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const STEPS = { I: 0, ii: 2, iii: 4, IV: 5, V: 7, vi: 9 };
const MINOR = { ii: 1, iii: 1, vi: 1 };
const expectName = (key, n) => NAMES[(key + STEPS[n]) % 12] + (MINOR[n] ? "m" : "");
const rounds = [];
for (let r = 1; r <= 8; r++) {
  const t0 = Date.now();
  await waitFor(open, 15000);
  const waited = Date.now() - t0;
  const q = await question();
  const unlocked = (await state()).progress.numeralsUnlocked;
  const pickable = ["I", "IV", "V", "vi", "ii", "iii"].slice(0, unlocked);
  const answers = q.chords.slice(1);
  if (r === 3) answers[0] = pickable.find((n) => n !== q.chords[1]);
  if (r === 2) {
    await tapSel(`button[data-numeral="${pickable.find((n) => n !== answers[0])}"]`);
    await sleep(200);
    await shot("03-one-picked");
    await tapSel('[data-testid="progressions-undo"]');
    await sleep(200);
  }
  for (const a of answers) { await tapSel(`button[data-numeral="${a}"]`); await sleep(150); }
  await sleep(500);
  if (r === 1) await shot("04-feedback-correct");
  if (r === 3) await shot("05-feedback-wrong");
  const slots = await page.$$eval("[data-slot]", (els) => els.map((e) => e.innerText.replace(/\s+/g, " ").trim()));
  const wrongLabel = slots.some((x) => /คุณตอบ/.test(x));
  if (r === 3 && !wrongLabel) log("missingWrongLabel", r);
  const namesOk = q.chords.every((n, i) => slots[i].includes(expectName(q.key, n)));
  rounds.push({ r, key: NAMES[q.key], chords: q.chords.join("-"), answers: answers.join("-"), waitedMs: waited, slots, namesOk });
  await sleep(800);
  if (await page.$('[data-testid="progressions-feedback"]')) await tapSel('[data-testid="progressions-feedback"]');
}
await waitFor(() => /ถูกทั้งชุด \d+ จาก 8 ทาง/.test(document.body.innerText), 8000);
await shot("06-summary");
const s = await state();
const summary = (await text()).match(/ถูกทั้งชุด \d+ จาก 8 ทาง/)?.[0];
await go("#stats");
await shot("07-stats", true);
const tile = (await text()).match(/(\d+%|–)\s*\n?\s*ทางเดินคอร์ด/)?.[1] ?? null;
const logged = s.progress.progressions;
const result = {
  closedWhilePlaying,
  summary,
  logged: logged.length,
  correctLogged: logged.filter((x) => x.answer === x.target).length,
  positions: [...new Set(logged.map((x) => x.pos))].sort(),
  chordsAsked: [...new Set(logged.map((x) => x.target))].sort(),
  allStartOnI: rounds.every((x) => x.chords.startsWith("I-")),
  noRepeats: rounds.every((x) => x.chords.split("-").every((c, i, a) => i === 0 || c !== a[i - 1])),
  allNamesOk: rounds.every((x) => x.namesOk),
  distinctKeys: new Set(rounds.map((x) => x.key)).size,
  statsTile: tile,
  rounds,
};
save("after", result);
return result;
