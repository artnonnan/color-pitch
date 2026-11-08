// Mix voices: choose "สลับเสียง" in Settings, reload (setting must persist), then answer
// 8 quiz notes and record which voice played each one.
await go("#settings");
await tapSel('button[data-instrument="mix"]');
await sleep(300);
await shot("01-settings-mix");
await go("#settings");
const persisted = (await state()).settings.instrument;
await go("#quiz");
await skipGate();
await tap(/เริ่ม/);
const open = () => { const b = document.querySelector('button[data-pc="0"]'); return !!b && b.getAttribute("aria-disabled") === "false"; };
const per = [];
for (let i = 0; i < 8; i++) {
  await waitFor(open, 10000);
  await sleep(250);
  const q = await question();
  const a = await audio();
  per.push({ i, pc: q.pc, voice: a.voice });
  await tapKey(q.pc);
  await sleep(1500);
}
await shot("02-quiz-after");
const a = await audio();
const result = {
  persisted,
  voicesPerQuestion: per.map((x) => x.voice),
  distinctVoices: new Set(per.map((x) => x.voice)).size,
  consecutiveRepeats: per.filter((x, i) => i && x.voice === per[i - 1].voice).length,
  voiceCounts: a.voiceCounts,
  context: a.context,
  status: a.status,
};
save("after", result);
return result;
