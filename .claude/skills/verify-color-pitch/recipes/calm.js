// สีบำบัด: start a 5-minute session, watch notes and colors change, pause, resume, stop early.
// Proves: a new note every ~4.5 s with the whole stage in that note's color; pausing freezes
// the clock; stopping logs the session and adds the time to today's practice.
const playCount = async () => (await audio())?.playCount ?? 0;
await go("");
await tapSel('[data-testid="card-calm"]');
await sleep(500);
await skipGate();
await shot("01-intro");
const practice0 = (await state()).progress.practiceSeconds;
await tapSel('[data-testid="calm-start"]');
const p0 = await playCount();
const notes = [];
const t0 = Date.now();
while (Date.now() - t0 < 14000) {
  const q = await question();
  const bg = await page.$eval('[data-testid="calm-stage"]', (e) => getComputedStyle(e).backgroundColor);
  const label = await page.$eval('[data-testid="calm-note"]', (e) => e.innerText);
  if (q?.kind === "calm" && !notes.find((n) => n.at === q.elapsed)) notes.push({ at: q.elapsed, note: q.note, label, bg });
  await sleep(700);
}
await shot("02-playing");
const plays = (await playCount()) - p0;
await tapSel('[data-testid="calm-pause"]');
const leftA = await page.$eval('[data-testid="calm-left"]', (e) => e.innerText);
await sleep(2500);
const leftB = await page.$eval('[data-testid="calm-left"]', (e) => e.innerText);
await tapSel('[data-testid="calm-resume"]');
await sleep(2000);
await tapSel('[data-testid="calm-stop"]');
await sleep(400);
await shot("03-done");
const done = await page.$eval('[data-testid="calm-done"]', (e) => e.innerText).catch(() => null);
const s = await state();
const today = Object.keys(s.progress.practiceSeconds).sort().at(-1);
const result = {
  notesSeen: notes.length,
  distinctNotes: [...new Set(notes.map((n) => n.note))].length,
  labelsMatch: notes.every((n) => n.label === ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"][n.note]),
  colorsDiffer: new Set(notes.map((n) => n.bg)).size > 1,
  plays,
  pauseFrozen: leftA === leftB,
  leftA,
  done,
  session: s.progress.calmSessions.at(-1),
  practiceAdded: (s.progress.practiceSeconds[today] ?? 0) - (practice0[today] ?? 0),
};
save("after", result);
return result;
