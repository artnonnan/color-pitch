// โน้ตประจำตัว: choose G as the anchor, then one set of 15 yes/no answers (one miss).
// Proves: the chooser shows all 12 notes; questions are the anchor about half the time and
// decoys are at least 3 semitones away at level 1; voices and octaves vary; feedback reveals
// the note and its color.
const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const circ = (a, b) => Math.min((a - b + 12) % 12, (b - a + 12) % 12);
await go("");
await tapSel('[data-testid="card-anchor"]');
await sleep(500);
await skipGate();
const chooserCount = (await page.$$("[data-anchor]")).length;
await shot("01-choose");
await tapSel('[data-anchor="7"]');
await sleep(300);
const chosen = (await state()).progress.anchorPc;
await tapSel('[data-testid="anchor-start"]');
const rounds = [];
for (let r = 1; r <= 15; r++) {
  await waitFor(() => !!document.querySelector('[data-answer="yes"]'), 8000);
  const q = await question();
  const truth = q.played === q.anchor;
  const say = r === 4 ? !truth : truth;
  if (r === 1) await shot("02-question");
  await tapSel(`[data-answer="${say ? "yes" : "no"}"]`);
  await sleep(350);
  if (r === 4) await shot("03-feedback-wrong");
  const reveal = await page.$eval('[data-testid="anchor-note"]', (e) => e.innerText);
  rounds.push({ r, played: q.played, midi: q.midi, voice: q.voice, truth, say, revealOk: reveal === NAMES[q.played] });
  await tapSel('[data-testid="anchor-next"]');
}
await waitFor(() => /ถูก \d+ จาก 15 ข้อ/.test(document.body.innerText), 5000);
await shot("04-summary");
const s = await state();
const result = {
  chooserCount,
  chosen,
  anchorShare: rounds.filter((x) => x.truth).length,
  decoysFarEnough: rounds.filter((x) => !x.truth).every((x) => circ(x.played, 7) >= 3),
  voices: [...new Set(rounds.map((x) => x.voice))].length,
  octaves: [...new Set(rounds.map((x) => Math.floor(x.midi / 12)))].length,
  allRevealed: rounds.every((x) => x.revealOk),
  logged: s.progress.anchorAnswers.length,
  correct: s.progress.anchorAnswers.filter((a) => a.said === (a.played === a.anchor)).length,
};
save("after", result);
return result;
