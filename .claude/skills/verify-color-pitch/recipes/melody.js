// Melody (melodic dictation): one set of 10 three-note melodies from C and G.
// Round 2 taps a wrong note, undoes it, then answers right (undo must not log).
// Round 3 gets its last note wrong on purpose.
// 30 note answers at 29/30 (97 %) cross the unlock rule on the last round, so the
// melody length grows from 3 to 4 through play alone.
await go("");
await tapSel('[data-testid="card-melody"]');
await sleep(500);
await skipGate();
await shot("01-intro");
const introLen = (await text()).match(/ทำนองยาว (\d) โน้ต/)?.[1] ?? null;
await tapSel('[data-testid="melody-start"]');
await sleep(500);
await shot("02-playing");
const closedWhilePlaying = await page.evaluate(() => document.querySelector('button[data-pc="0"]').getAttribute("aria-disabled") === "true");
const open = () => document.querySelector('button[data-pc="0"]')?.getAttribute("aria-disabled") === "false";
const rounds = [];
let grewText = null;
for (let r = 1; r <= 10; r++) {
  await waitFor(open, 15000);
  const q = await question();
  const ans = [...q.pcs];
  if (r === 3) ans[ans.length - 1] = ans[ans.length - 1] === 0 ? 7 : 0;
  if (r === 2) {
    await tapKey(ans[0] === 0 ? 7 : 0);
    await sleep(150);
    await shot("03-one-picked");
    await tapSel('[data-testid="melody-undo"]');
    await sleep(150);
  }
  const playsBefore = (await audio()).playCount;
  for (const pc of ans) { await tapKey(pc); await sleep(150); }
  const playsWhileAnswering = (await audio()).playCount - playsBefore;
  await sleep(450);
  if (r === 1) await shot("04-feedback-correct");
  if (r === 3) await shot("05-feedback-wrong");
  const body = await text();
  if (r === 10) { grewText = body.match(/ทำนองยาวขึ้นเป็น \d โน้ต/)?.[0] ?? null; await shot("06-grew"); }
  rounds.push({ r, melody: q.pcs.join(","), ans: ans.join(","), playsWhileAnswering, verdict: body.match(/ถูกทั้งทำนอง!|ถูก \d จาก \d โน้ต|ทำนองยาวขึ้นเป็น \d โน้ต/)?.[0] ?? null });
  await sleep(1500);
  if (await page.$('[data-testid="melody-feedback"]')) await tapSel('[data-testid="melody-feedback"]');
}
await waitFor(() => /ถูกทั้งทำนอง \d+ จาก 10 ข้อ/.test(document.body.innerText), 8000);
await shot("07-summary");
const s = await state();
const summary = (await text()).match(/ถูกทั้งทำนอง \d+ จาก 10 ข้อ/)?.[0];
await go("");
await tapSel('[data-testid="card-melody"]');
await sleep(500);
await skipGate();
const nextLen = (await text()).match(/ทำนองยาว (\d) โน้ต/)?.[1] ?? null;
await go("#stats");
await shot("08-stats", true);
const tile = (await text()).match(/(\d+%|–)\s*\n?\s*ทำนองสี/)?.[1] ?? null;
const logged = s.progress.melodies;
const result = {
  introLen,
  closedWhilePlaying,
  summary,
  logged: logged.length,
  correctLogged: logged.filter((x) => x.answer === x.target).length,
  notesAsked: [...new Set(logged.map((x) => x.target))].sort(),
  melodyLevel: s.progress.melodyLevel,
  grewText,
  nextLen,
  silentWhileAnswering: rounds.every((x) => x.playsWhileAnswering === 0),
  noSingleNoteMelody: rounds.every((x) => new Set(x.melody.split(",")).size > 1),
  statsTile: tile,
  rounds,
};
save("after", result);
return result;
