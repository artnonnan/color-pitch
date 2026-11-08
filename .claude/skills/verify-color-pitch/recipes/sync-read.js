// Cloud sync, device B. Run with --cloud --profile none right after sync-write.js.
// A fresh browser has no local data, so anything it shows came from Supabase.
await go("");
await pickProfile("guest");
await waitFor(() => window.__cpSync().sync === "synced", 15000);
await sleep(300);
await shot("01-home-from-cloud", true);
const s = await state();
const result = {
  sync: await page.evaluate(() => window.__cpSync()),
  answers: s.progress.noteAnswers.length,
  lastAnswers: s.progress.noteAnswers.slice(-3).map((a) => ({ target: a.target, answer: a.answer })),
};
save("after", result);
return result;
