// Intervals: pick "สลับ" (mix) direction like a player, then 3 sets of 10 all correct
// except one miss in set 1, then 21 more correct, to cross the 90%/30 unlock for P4.
await go("");
await tapSel('[data-testid="card-intervals"]');
await sleep(500);
await skipGate();
await tapSel('button[data-dir="mix"]');
await sleep(200);
await shot("01-intro-dir-mix");
const open = () => { const b = document.querySelector('button[data-interval="P8"]'); return !!b && !b.disabled; };
const seen = [];
let unlockedText = null;
for (let set = 1; set <= 4 && !unlockedText; set++) {
  await waitFor(() => !!document.querySelector('[data-testid="intervals-start"]'), 8000);
  await tapSel('[data-testid="intervals-start"]');
  for (let r = 1; r <= 10; r++) {
    await waitFor(open, 10000);
    const q = await question();
    const st = await state();
    const order = ["P8", "P5", "M3", "P4", "m3", "M2", "m2", "M6", "m6", "M7", "m7", "TT"].slice(0, st.progress.intervalsUnlocked);
    const miss = set === 1 && r === 2;
    const ans = miss ? order.find((x) => x !== q.iv) : q.iv;
    if (set === 1 && r === 1) await shot("02-question");
    await tapSel(`button[data-interval="${ans}"]`);
    await sleep(400);
    if (set === 1 && r === 1) await shot("03-feedback-correct");
    if (miss) await shot("04-feedback-wrong");
    const t = await text();
    seen.push({ set, r, iv: q.iv, dir: q.dir, low: q.low, high: q.high, ans, notesLine: t.match(/[A-G]#? [→+] [A-G]#? · ห่าง \d+ ครึ่งเสียง/)?.[0] ?? null });
    const u = t.match(/ปลดล็อกคู่เสียงใหม่: [^\n]+/)?.[0];
    if (u) { unlockedText = u; await shot("05-unlock"); }
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
