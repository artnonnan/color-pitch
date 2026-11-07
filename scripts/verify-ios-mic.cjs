// usage: npm start -- -p 3123, then node scripts/verify-ios-mic.cjs (needs c4.wav next to it)
// Simulates iOS 17 audio-session rules in Edge: getUserMedia throws InvalidStateError
// while navigator.audioSession.type === "playback" (what real iOS Safari does).
const path = require("path"), fs = require("fs");
const puppeteer = require(process.env.PUPPETEER_CORE || "D:/Engine/featuremap/harness/web/node_modules/puppeteer-core");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const profile = fs.mkdtempSync(path.join(__dirname, "profile-"));
  const browser = await puppeteer.launch({
    executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    headless: "new",
    args: [`--user-data-dir=${profile}`, "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream",
      `--use-file-for-fake-audio-capture=${path.join(__dirname, "c4.wav").split(String.fromCharCode(92)).join("/")}`],
  });
  const page = await browser.newPage();
  await page.emulate({ viewport: { width: 375, height: 812, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" });
  await page.evaluateOnNewDocument(() => {
    let type = "auto";
    window.__sessionLog = [];
    Object.defineProperty(navigator, "audioSession", { value: { get type() { return type; }, set type(v) { type = v; window.__sessionLog.push(v); } } });
    const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = (c) => {
      window.__sessionLog.push(`gUM@${type}`);
      if (type === "playback") return Promise.reject(new DOMException("AudioSession category is not compatible with audio capture", "InvalidStateError"));
      return real(c);
    };
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const tap = async (re) => {
    const h = await page.evaluateHandle((src) => [...document.querySelectorAll("button")].find((b) => new RegExp(src).test(b.textContent) && !b.disabled), re.source);
    await h.asElement().tap();
  };
  await page.goto("http://localhost:3123/", { waitUntil: "networkidle0" });
  await tap(/เริ่มฝึกวันนี้/); await sleep(1500);   // first tap: unlockAudio sets "playback"
  await tap(/ฮัมใส่ไมค์/); await sleep(5200);
  const st = await page.evaluate(() => window.__colorPitch());
  console.log("firstNote", JSON.stringify(Object.values(st.progress.firstNote)[0]));
  console.log("alert", await page.evaluate(() => document.querySelector("[role=alert]")?.innerText ?? "(none)"));
  console.log("sessionLog", JSON.stringify(await page.evaluate(() => window.__sessionLog)));
  console.log("typeAfterStop", await page.evaluate(() => navigator.audioSession.type));
  console.log("audio", JSON.stringify(await page.evaluate(() => window.__cpAudio())));
  await page.screenshot({ path: path.join(__dirname, "ev", "ios-sim-first-note.png") });
  console.log("errors", JSON.stringify(errors));
  await browser.close();
})().catch((e) => { console.error("FAILED", e); process.exit(1); });
