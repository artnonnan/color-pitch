// จับคู่การ์ดเสียง: a 3-pair board with one deliberate mismatch, then a perfect 6-pair board.
// Reads which cards pair up from window.__cpQuestion (the answer key, read-only) the way a
// player with a perfect memory would, and taps cards like a player.
const playCount = async () => (await audio())?.playCount ?? 0;
const board = () => page.evaluate(() => window.__cpQuestion.cards);
const flip = async (id) => { await tapSel(`[data-card="${id}"]`); await sleep(200); };

await go("");
await tapSel('[data-testid="card-match"]');
await sleep(500);
await skipGate();
await shot("01-intro");
await tapSel('button[data-pairs="3"]');
await tapSel('[data-testid="match-start"]');
await sleep(300);
let cards = await board();
const sizes = { three: cards.length };
await shot("02-board-closed");

// One mismatch first.
const a = cards[0];
const b = cards.find((c) => c.pc !== a.pc);
const p0 = await playCount();
await flip(a.id);
const openFace = await page.$eval(`[data-card="${a.id}"]`, (e) => ({ state: e.dataset.state, text: e.innerText }));
await flip(b.id);
const flipPlays = (await playCount()) - p0;
await shot("03-mismatch");
const missLook = await page.$$eval(`[data-card="${a.id}"], [data-card="${b.id}"]`, (es) => es.map((e) => e.className.includes("border-bad") && e.className.includes("shake")));
await sleep(1100);
const closedAgain = await page.$$eval(`[data-card="${a.id}"], [data-card="${b.id}"]`, (es) => es.map((e) => e.dataset.state));

// Then every pair.
for (const pc of [...new Set(cards.map((c) => c.pc))]) {
  const [x, y] = cards.filter((c) => c.pc === pc);
  await flip(x.id);
  await flip(y.id);
  await sleep(500);
}
await waitFor(() => !!document.querySelector('[data-testid="match-result"]'), 5000);
const result3 = await page.$eval('[data-testid="match-result"]', (e) => e.innerText);
await shot("04-done-3");

// A perfect 6-pair board.
await go("");
await tapSel('[data-testid="card-match"]');
await sleep(500);
await skipGate();
await tapSel('button[data-pairs="6"]');
await tapSel('[data-testid="match-start"]');
await sleep(300);
cards = await board();
sizes.six = cards.length;
const octavesDiffer = [...new Set(cards.map((c) => c.pc))].length === 6;
for (const pc of [...new Set(cards.map((c) => c.pc))]) {
  const [x, y] = cards.filter((c) => c.pc === pc);
  await flip(x.id);
  await flip(y.id);
  if (pc === cards[0].pc) await shot("05-six-one-matched");
  await sleep(500);
}
await waitFor(() => !!document.querySelector('[data-testid="match-result"]'), 5000);
const result6 = await page.$eval('[data-testid="match-result"]', (e) => e.innerText);
await shot("06-done-6");
const s = await state();
await go("#stats");
await sleep(300);
const tile = (await text()).match(/(\d+|–)\s*\n?\s*จับคู่ 6 คู่/)?.[1] ?? null;
const result = {
  sizes,
  openFace,
  flipPlays,
  closedAgain,
  missLook,
  result3,
  result6,
  octavesDiffer,
  games: s.progress.matchGames.map((g) => ({ pairs: g.pairs, moves: g.moves, colors: g.colors })),
  statsTile: tile,
};
save("after", result);
return result;
