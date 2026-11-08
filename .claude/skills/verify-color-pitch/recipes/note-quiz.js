// Note + color quiz (core loop): answer 33 notes like a player with 2 misses.
// 30 answers at >= 90% unlock the 3rd note (E) with a full-screen ceremony the player taps away.
await go("#quiz");
await skipGate();
await tap(/เริ่ม/);
await sleep(900);
await shot("01-question");
const ready = () => document.querySelector('button[data-pc="0"]')?.getAttribute("aria-disabled") === "false" && /ฟังแล้วแตะคีย์ที่ใช่/.test(document.body.innerText);
let unlockedAt = null;
for (let n = 0; n < 33; n++) {
  await waitFor(ready, 10000).catch(() => {});
  const q = await question();
  const miss = n === 3 || n === 11;
  await tapKey(miss ? (q.pc === 0 ? 7 : 0) : q.pc);
  await sleep(350);
  if (n === 0) await shot("02-feedback-correct");
  if (n === 3) await shot("03-feedback-wrong");
  for (let i = 0; i < 60; i++) {
    await sleep(150);
    if (await page.evaluate(() => /แตะเพื่อไปต่อ/.test(document.body.innerText))) {
      if (unlockedAt === null) { await sleep(900); await shot("04-unlock-ceremony"); unlockedAt = n + 1; }
      await page.touchscreen.tap(187, 650);
      await sleep(300);
      continue;
    }
    if (await page.evaluate(ready)) break;
  }
}
const s = await state();
await tap(/จบรอบนี้/);
await sleep(600);
await shot("05-summary");
const result = {
  answers: s.progress.noteAnswers.length,
  correct: s.progress.noteAnswers.filter((a) => a.answer === a.target).length,
  notesUnlocked: s.progress.notesUnlocked,
  unlockedAtAnswer: unlockedAt,
  quizDoneToday: (await state()).progress.sessionDone,
};
save("after", result);
return result;
