// โน้ตทุกอ็อกเทฟ: one set of 10 (one miss). Proves notes come from C1–C7 across registers
// in several voices, feedback names the octave and voice, and the register card fills in.
await go("");
await tapSel('[data-testid="card-wide"]');
await sleep(500);
await skipGate();
await shot("01-intro");
await tapSel('[data-testid="wide-start"]');
const rounds = [];
for (let r = 1; r <= 10; r++) {
  await waitFor(() => document.querySelector('button[data-pc="0"]')?.getAttribute("aria-disabled") === "false", 8000);
  const q = await question();
  const ans = r === 2 ? (q.pc === 0 ? 7 : 0) : q.pc;
  await tapKey(ans);
  await sleep(350);
  if (r === 1) await shot("02-feedback");
  if (r === 2) await shot("03-feedback-wrong");
  const where = await page.$eval('[data-testid="wide-where"]', (e) => e.innerText);
  rounds.push({ r, midi: q.midi, voice: q.voice, where });
  await tapSel('[data-testid="wide-next"]');
}
await waitFor(() => /ถูก \d+ จาก 10 ข้อ/.test(document.body.innerText), 5000);
const registers = await page.$$eval("[data-register]", (els) => els.map((e) => e.innerText.replace(/\s+/g, " ")));
await shot("04-summary");
const s = await state();
const result = {
  minMidi: Math.min(...rounds.map((x) => x.midi)),
  maxMidi: Math.max(...rounds.map((x) => x.midi)),
  inRange: rounds.every((x) => x.midi >= 24 && x.midi <= 96),
  octaves: [...new Set(rounds.map((x) => Math.floor(x.midi / 12) - 1))].sort(),
  voices: [...new Set(rounds.map((x) => x.voice))],
  whereOk: rounds.every((x) => x.where.includes(`อ็อกเทฟ ${Math.floor(x.midi / 12) - 1}`)),
  registers,
  logged: s.progress.wideAnswers.length,
  correct: s.progress.wideAnswers.filter((a) => a.answer === a.target).length,
  noteAnswersUntouched: s.progress.noteAnswers.length === 0,
};
save("after", result);
return result;
