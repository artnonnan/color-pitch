// Intervals, from a brand-new player: the lesson (every example played), then pick "สลับ"
// (mix) like a player and play until P4 unlocks. Question 1 uses the hint (logged, never
// counts), question 2 is a deliberate miss whose feedback plays the reference tune, so the
// unlock comes on answer 31 (1 hinted + 30 counted, 29 right).
await go("");
await tapSel('[data-testid="card-intervals"]');
await sleep(500);
await skipGate();
// ---- lesson: opens by itself for a new player; play every example on every step ----
const playCount = async () => (await audio())?.playCount ?? 0;
const lessonShown = !!(await page.$('[data-testid="lesson"]'));
const lessonSteps = [];
for (let s = 0; s < 12 && (await page.$('[data-testid="lesson"]')); s++) {
  const title = await page.$eval('[data-testid="lesson-title"]', (e) => e.innerText);
  const nActions = (await page.$$('[data-testid^="lesson-action-"]')).length;
  const a0 = await playCount();
  for (let j = 0; j < nActions; j++) { await tapSel(`[data-testid="lesson-action-${j}"]`); await sleep(250); }
  if (nActions) await page.waitForFunction((n) => window.__cpAudio().playCount > n, { timeout: 8000 }, a0).catch(() => {});
  lessonSteps.push({ title, actions: nActions, plays: (await playCount()) - a0 });
  if (s === 1) await shot("00-lesson-step2");
  if (await page.$('[data-testid="lesson-begin"]')) { await tapSel('[data-testid="lesson-begin"]'); await sleep(400); break; }
  await tapSel('[data-testid="lesson-next"]');
  await sleep(200);
}
const lessonSeen = (await state()).progress.intervalLessonSeen;
await tapSel('button[data-dir="mix"]');
await sleep(200);
await shot("01-intro-dir-mix");
const open = () => { const b = document.querySelector('button[data-interval="P8"]'); return !!b && !b.disabled; };
const seen = [];
let unlockedText = null, hint = null, wrongRef = null, newCard = null;
for (let set = 1; set <= 4 && !unlockedText; set++) {
  await waitFor(() => !!document.querySelector('[data-testid="intervals-start"]'), 8000);
  await tapSel('[data-testid="intervals-start"]');
  for (let r = 1; r <= 10; r++) {
    await waitFor(open, 10000);
    const q = await question();
    const st = await state();
    const order = ["P8", "P5", "M3", "P4", "m3", "M2", "m2", "M6", "m6", "M7", "m7", "TT"].slice(0, st.progress.intervalsUnlocked);
    if (set === 1 && r === 1) {
      const a0 = await playCount();
      await tapSel('[data-testid="intervals-hint"]');
      await sleep(200);
      await tapSel('[data-hint-interval="P8"]');
      await sleep(300);
      await shot("02b-hint-panel");
      hint = { plays: (await playCount()) - a0, buttons: await page.$$eval("[data-hint-interval]", (b) => b.map((x) => x.dataset.hintInterval)) };
    }
    const miss = set === 1 && r === 2;
    const ans = miss ? order.find((x) => x !== q.iv) : q.iv;
    if (set === 1 && r === 1) await shot("02-question");
    await tapSel(`button[data-interval="${ans}"]`);
    await sleep(400);
    if (set === 1 && r === 1) await shot("03-feedback-correct");
    if (miss) {
      await shot("04-feedback-wrong");
      const line = await page.$eval('[data-testid="intervals-remember"]', (e) => e.innerText).catch(() => null);
      const a0 = await playCount();
      if (await page.$('[data-testid="intervals-play-song"]')) { await tapSel('[data-testid="intervals-play-song"]'); await sleep(300); }
      wrongRef = { iv: q.iv, dir: q.dir, line, songPlays: (await playCount()) - a0 };
    }
    const t = await text();
    seen.push({ set, r, iv: q.iv, dir: q.dir, low: q.low, high: q.high, ans, notesLine: t.match(/[A-G]#? [→+] [A-G]#? · ห่าง \d+ ครึ่งเสียง/)?.[0] ?? null });
    const u = t.match(/ปลดล็อกคู่เสียงใหม่: [^\n]+/)?.[0];
    if (u) {
      unlockedText = u;
      await sleep(2000); // a new interval stays on screen: no auto-advance
      newCard = {
        stillOnFeedback: !!(await page.$('[data-testid="intervals-feedback"]')),
        card: await page.$eval('[data-testid="intervals-new-card"]', (e) => e.innerText).catch(() => null),
        remember: await page.$eval('[data-testid="intervals-remember"]', (e) => e.innerText).catch(() => null),
      };
      await shot("05-unlock");
    }
    await tapSel('[data-testid="intervals-feedback"]');
    await sleep(200);
    if (unlockedText) break;
  }
  if (!unlockedText) { await waitFor(() => /ถูก \d+ จาก 10 ข้อ/.test(document.body.innerText), 6000); if (set === 1) await shot("06-summary"); await tap(/เสร็จแล้ว/); await sleep(400); await tapSel('[data-testid="card-intervals"]'); await sleep(400); }
}
await sleep(600);
const s = await state();
await shot("07-after-unlock");
const result = {
  lessonShown,
  lessonSeen,
  lessonSteps,
  hint,
  hintedLogged: s.progress.intervals.filter((x) => x.hinted).length,
  wrongRef,
  newCard,
  unlockedText,
  intervalsUnlocked: s.progress.intervalsUnlocked,
  answers: s.progress.intervals.length,
  correct: s.progress.intervals.filter((x) => x.answer === x.target).length,
  dirsSeen: [...new Set(seen.map((x) => x.dir))].sort(),
  dirSetting: s.settings.intervalDir,
  rangeOk: seen.every((x) => x.low >= s.settings.lowMidi && x.high <= s.settings.highMidi && x.high - x.low === { P8: 12, P5: 7, M3: 4, P4: 5 }[x.iv]),
  sample: seen.slice(0, 4),
};
save("after", result);
return result;
