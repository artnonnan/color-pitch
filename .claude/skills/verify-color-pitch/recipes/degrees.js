// Scale degrees: one set of 10, answered like a player (one deliberate miss on round 3).
// Proves: cadence + note play before the buttons open, answers log with the key,
// feedback names key/degree/note, the walk home plays, summary counts hits, stats tile fills.
await go("");
await shot("01-home-cards", true);
await tapSel('[data-testid="card-degrees"]');
await sleep(500);
await skipGate();
await shot("02-intro");
const a0 = (await audio()).playCount;
await tapSel('[data-testid="degrees-start"]');
await sleep(600);
await shot("03-playing-cadence");
const open = () => { const b = document.querySelector('button[data-degree="1"]'); return !!b && !b.disabled; };
const rounds = [];
for (let r = 1; r <= 10; r++) {
  const t0 = Date.now();
  await waitFor(open, 15000);
  const waited = Date.now() - t0;
  const q = await question();
  const before = (await audio()).playCount;
  const unlocked = (await state()).progress.degreesUnlocked;
  const pickable = [1, 5, 3, 2, 4, 6, 7].slice(0, unlocked);
  const ans = r === 3 ? pickable.find((d) => d !== q.degree) : q.degree;
  if (r === 2) await shot("04-question");
  await tapSel(`button[data-degree="${ans}"]`);
  await sleep(450);
  if (r === 1) await shot("05-feedback-correct");
  if (r === 3) await shot("06-feedback-wrong");
  const fb = (await text()).match(/คีย์ [A-G]#?: ขั้น \d คือโน้ต [A-G]#?/)?.[0] ?? null;
  await sleep(1800); // let the walk home play
  const after = (await audio()).playCount;
  rounds.push({ r, key: q.key, degree: q.degree, midi: q.midi, ans, waitedForCadenceMs: waited, feedback: fb, walkNotes: after - before });
  if (await page.$('[data-testid="degrees-feedback"]')) await tapSel('[data-testid="degrees-feedback"]');
}
await waitFor(() => /ถูก \d+ จาก 10 ข้อ/.test(document.body.innerText), 8000);
await shot("07-summary");
const s = await state();
const summary = (await text()).match(/ถูก \d+ จาก 10 ข้อ/)?.[0];
await go("#stats");
await shot("08-stats", true);
const tile = (await text()).match(/(\d+%|–)\s*\n?\s*ระดับเสียงในคีย์/)?.[1] ?? null;
const logged = s.progress.degrees;
const result = {
  summary,
  logged: logged.length,
  correctLogged: logged.filter((x) => x.answer === x.target).length,
  distinctKeys: new Set(logged.map((x) => x.key)).size,
  degreesAsked: [...new Set(logged.map((x) => x.target))].sort(),
  audioPlaysTotal: (await audio()).playCount - a0,
  statsTile: tile,
  rounds,
};
save("after", result);
return result;
