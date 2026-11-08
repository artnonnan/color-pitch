// ผสมสีคอร์ด: one set of 10 played like a player.
// Round 1 taps a wrong key and taps it again to un-pick it, then answers right.
// Round 2 leaves one note out (partial), round 3 adds an extra wrong note. The rest are right.
const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const SYM = { major: "", minor: "m", maj7: "maj7", sus4: "sus4", dim: "dim", aug: "aug" };
await go("");
await tapSel('[data-testid="card-mixchord"]');
await sleep(500);
await skipGate();
await shot("01-intro");
await tapSel('[data-testid="mix-start"]');
const rounds = [];
for (let r = 1; r <= 10; r++) {
  await waitFor(() => !!document.querySelector('[data-testid="mix-check"]'), 8000);
  const q = await question();
  let taps = [...q.pcs];
  const outside = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].find((pc) => !q.pcs.includes(pc));
  if (r === 1) { await tapKey(outside); await sleep(120); await tapKey(outside); await sleep(120); }
  if (r === 2) taps = taps.slice(0, -1);
  if (r === 3) taps = [...taps, outside];
  for (const pc of taps) { await tapKey(pc); await sleep(120); }
  const pickedLine = await page.$eval('[data-testid="mix-picked"]', (e) => e.innerText);
  if (r === 1) await shot("02-picked");
  await tapSel('[data-testid="mix-check"]');
  await sleep(500);
  const body = await text();
  if (r === 1) await shot("03-feedback-correct");
  if (r === 2) await shot("04-feedback-partial");
  if (r === 3) await shot("05-feedback-extra");
  const name = await page.$eval('[data-testid="mix-chord-name"]', (e) => e.innerText);
  rounds.push({
    r,
    chord: NAMES[q.root] + SYM[q.quality],
    pcs: q.pcs.join(","),
    pickedLine,
    verdict: body.match(/ครบทุกตัว!|ถูก \d จาก \d ตัว( · เกินมา \d ตัว)?/)?.[0] ?? null,
    nameOk: name.includes(NAMES[q.root] + SYM[q.quality]),
  });
  await tapSel('[data-testid="mix-next"]');
  await sleep(250);
}
await waitFor(() => /ครบทุกตัว \d+ จาก 10 ข้อ/.test(document.body.innerText), 5000);
await shot("06-summary");
const s = await state();
await go("#stats");
await sleep(300);
const tile = (await text()).match(/(\d+%|–)\s*\n?\s*ผสมสีคอร์ด/)?.[1] ?? null;
const logged = s.progress.mixChords;
const result = {
  summary: (await state()) && rounds.length,
  logged: logged.length,
  correct: logged.filter((a) => a.answer.length === a.target.length && a.target.every((pc) => a.answer.includes(pc))).length,
  round1Answer: logged[0]?.answer,
  allNamesOk: rounds.every((x) => x.nameOk),
  verdicts: rounds.map((x) => x.verdict),
  statsTile: tile,
  rounds,
};
save("after", result);
return result;
