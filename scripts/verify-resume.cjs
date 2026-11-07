// usage: npm start -- -p 3123, then node scripts/verify-resume.cjs
// Screen lock / app switch: audio is suspended behind the app's back, then the user comes back.
const path = require("path"), fs = require("fs");
const puppeteer = require(process.env.PUPPETEER_CORE || "D:/Engine/featuremap/harness/web/node_modules/puppeteer-core");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const profile = fs.mkdtempSync(path.join(__dirname, "profile-"));
  const browser = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: "new", args: [`--user-data-dir=${profile}`] });
  const page = await browser.newPage();
  await page.emulate({ viewport: { width: 375, height: 812, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" });
  const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
  const audio = () => page.evaluate(() => window.__cpAudio());
  const tap = async (re) => { const h = await page.evaluateHandle((s) => [...document.querySelectorAll("button")].find((b) => new RegExp(s).test(b.textContent) && !b.disabled), re.source); await h.asElement().tap(); };
  const pill = () => page.evaluate(() => /แตะที่ใดก็ได้เพื่อเปิดเสียง/.test(document.body.innerText));
  await page.goto("http://localhost:3123/#quiz", { waitUntil: "networkidle0" });
  await tap(/ข้ามวันนี้/); await sleep(300);           // skip the first-note gate
  await tap(/เริ่ม/);
  for (let i = 0; i < 20 && !(await audio()).pianoLoaded; i++) await sleep(500);
  await sleep(500);
  const a1 = await audio(); console.log("1 playing      ", a1.context, "plays", a1.playCount, "pill", await pill());
  // iOS locks the screen
  await page.evaluate(() => window.__cpAudioSuspend()); await sleep(300);
  console.log("2 suspended    ", (await audio()).context, "status", (await audio()).status, "pill", await pill());
  await page.screenshot({ path: path.join(__dirname, "ev", "resume-1-suspended.png") });
  // user comes back and taps "replay"
  await tap(/ฟังอีกครั้ง/); await sleep(800);
  const a3 = await audio(); console.log("3 after replay ", a3.context, "status", a3.status, "plays", a3.playCount, "pill", await pill());
  // suspend again, then tap somewhere neutral (not a sound button)
  await page.evaluate(() => window.__cpAudioSuspend()); await sleep(300);
  await page.touchscreen.tap(187, 300); await sleep(600);
  const a4 = await audio(); console.log("4 after any tap", a4.context, "status", a4.status, "pill", await pill());
  // and a key answer plays sound again
  const q = await page.evaluate(() => window.__cpQuestion);
  await (await page.$(`button[data-pc="${q.pc}"]`)).tap(); await sleep(1600);
  const a5 = await audio(); console.log("5 next question", a5.context, "plays", a5.playCount);
  console.log("errors", JSON.stringify(errors));
  await browser.close();
})().catch((e) => { console.error("FAILED", e); process.exit(1); });
