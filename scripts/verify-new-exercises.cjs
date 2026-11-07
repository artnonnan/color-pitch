// usage: npm start -- -p 3123, then node scripts/verify-new-exercises.cjs (needs c4.wav next to it)
// New exercises: Color Rush (60 s), Sing the Color (fake C4 mic), Chord Root. Plus home/stats visuals.
const path = require("path"), fs = require("fs");
const puppeteer = require(process.env.PUPPETEER_CORE || "D:/Engine/featuremap/harness/web/node_modules/puppeteer-core");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = path.join(__dirname, "ev");
(async () => {
  const profile = fs.mkdtempSync(path.join(__dirname, "profile-"));
  const wav = path.join(__dirname, "c4.wav").split(String.fromCharCode(92)).join("/");
  const browser = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: "new",
    args: [`--user-data-dir=${profile}`, "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-audio-capture=${wav}`] });
  const page = await browser.newPage();
  await page.emulate({ viewport: { width: 375, height: 812, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" });
  const errors = []; page.on("pageerror", (e) => errors.push(String(e))); page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  const shot = (n, full) => page.screenshot({ path: path.join(out, `${n}.png`), fullPage: !!full });
  const state = () => page.evaluate(() => window.__colorPitch());
  const qn = () => page.evaluate(() => window.__cpQuestion);
  const text = () => page.evaluate(() => document.body.innerText);
  const tap = async (re) => { const h = await page.evaluateHandle((s) => [...document.querySelectorAll("button")].find((b) => new RegExp(s).test(b.textContent) && !b.disabled) || null, re.source); if (!h.asElement()) throw new Error("no button " + re); await h.asElement().tap(); };
  const tapKey = async (pc) => (await page.$(`button[data-pc="${pc}"]`)).tap();
  const keyReady = () => page.evaluate(() => document.querySelector('button[data-pc="0"]')?.getAttribute("aria-disabled") === "false");

  await page.goto("http://localhost:3123/", { waitUntil: "networkidle0" });
  await sleep(600);
  await shot("n01-home-top");
  await shot("n02-home-full", true);

  // ---- Color Rush ----
  await page.goto("http://localhost:3123/#rush", { waitUntil: "networkidle0" });
  await tap(/ข้ามวันนี้/); await sleep(300);
  await tap(/เริ่ม/); await sleep(900);
  let answered = 0, sawCombo = false;
  const t0 = Date.now();
  while (Date.now() - t0 < 62000) {
    if (await page.evaluate(() => /หมดเวลา|สถิติใหม่/.test(document.body.innerText))) break;
    if (!(await keyReady())) { await sleep(60); continue; }
    const q = await qn();
    const wrong = answered === 4;
    await tapKey(wrong ? (q.pc === 0 ? 7 : 0) : q.pc);
    answered++;
    await sleep(120);
    if (answered === 1) await shot("n03-rush-burst");
    if (!sawCombo && /คอมโบ/.test(await text())) { await sleep(150); await shot("n04-rush-combo"); sawCombo = true; }
    await sleep(200);
  }
  await sleep(1200);
  let s = await state();
  console.log("rush.run", JSON.stringify(s.progress.rush.at(-1)), "answersLogged", s.progress.noteAnswers.length, "notesUnlocked", s.progress.notesUnlocked, "sawCombo", sawCombo);
  if (/แตะเพื่อไปต่อ/.test(await text())) { await shot("n05-rush-unlock-ceremony"); await page.touchscreen.tap(187, 650); await sleep(500); }
  await shot("n06-rush-result");
  console.log("rush.resultText", (await text()).match(/(สถิติใหม่!|หมดเวลา!)/)?.[0]);

  // ---- Sing the Color (fake mic sings C4 every time) ----
  await page.goto("http://localhost:3123/#sing", { waitUntil: "networkidle0" });
  await sleep(500);
  await shot("n07-sing-prompt");
  for (let r = 0; r < 8; r++) {
    await tap(/ร้องเลย/);
    await sleep(r === 0 ? 1200 : 3300);
    if (r === 0) { await shot("n08-sing-listening"); await sleep(2100); }
    if (r < 2) await shot(`n09-sing-result-${r}`);
    await tap(/ต่อไป/); await sleep(400);
  }
  s = await state();
  console.log("sing.entries", s.progress.sing.length, JSON.stringify(s.progress.sing.map((x) => [x.target, Math.round(x.cents)])));
  await shot("n10-sing-summary");

  // ---- Chord Root ----
  await page.goto("http://localhost:3123/#roots", { waitUntil: "networkidle0" });
  await tap(/เริ่ม/); await sleep(800);
  await shot("n11-roots-question");
  for (let r = 0; r < 10; r++) {
    for (let i = 0; i < 40 && !(await keyReady()); i++) await sleep(150);
    const q = await qn();
    await tapKey(r === 3 ? (q.pc === 0 ? 7 : 0) : q.pc);
    await sleep(350);
    if (r === 0) await shot("n12-roots-correct");
    if (r === 3) await shot("n13-roots-wrong");
    for (let i = 0; i < 40; i++) { await sleep(150); if (await keyReady() || /ถูก \d+ จาก/.test(await text())) break; }
  }
  await sleep(800);
  s = await state();
  console.log("roots.entries", s.progress.roots.length, "correct", s.progress.roots.filter((x) => x.answer === x.target).length);
  console.log("roots.summary", (await text()).match(/ถูก \d+ จาก \d+ ข้อ/)?.[0]);
  await shot("n14-roots-summary");

  // ---- Stats ----
  await page.goto("http://localhost:3123/#stats", { waitUntil: "networkidle0" }); await sleep(600);
  console.log("stats.tiles", (await text()).match(/แบบฝึกเพิ่มเติม[\s\S]{0,120}/)?.[0].replace(/\n/g, " | "));
  await shot("n15-stats", true);
  console.log("aurora", await page.evaluate(() => document.querySelectorAll(".aurora").length), "canvas", await page.evaluate(() => !!document.querySelector("canvas")));
  console.log("errors", JSON.stringify(errors));
  await browser.close();
})().catch((e) => { console.error("FAILED", e); process.exit(1); });
