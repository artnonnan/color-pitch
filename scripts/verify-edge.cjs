// Drives Color Pitch in Edge like a player on a 375px phone and records evidence.
// usage: (npm start -- -p 3123) then: node scripts/verify-edge.cjs <main|denied> <outDir>
// The fake microphone plays c4.wav from this folder (a 261.63 Hz sine, 48 kHz mono 16-bit).
const path = require("path");
const fs = require("fs");
const puppeteer = require(process.env.PUPPETEER_CORE || "D:/Engine/featuremap/harness/web/node_modules/puppeteer-core");

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const URL = "http://localhost:3123/";
const [flow = "main", out = path.join(__dirname, "ev")] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = [];
const note = (k, v) => {
  log.push({ k, v });
  console.log(k, typeof v === "string" ? v : JSON.stringify(v));
};

(async () => {
  const profile = fs.mkdtempSync(path.join(__dirname, "profile-"));
  const args = ["--no-first-run", "--no-default-browser-check", `--user-data-dir=${profile}`];
  if (flow === "main") {
    args.push(
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      `--use-file-for-fake-audio-capture=${path.join(__dirname, "c4.wav").replace(/\\/g, "/")}`,
    );
  } else {
    args.push("--use-fake-device-for-media-stream", "--deny-permission-prompts");
  }
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: "new", args });
  const page = await browser.newPage();
  await page.emulate({
    viewport: { width: 375, height: 812, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  const samples = [];
  page.on("response", (r) => r.url().includes("salamander") && samples.push(`${r.status()} ${r.url().split("/").pop()}`));

  const shot = async (name) => {
    await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: false });
  };
  const shotFull = async (name) => page.screenshot({ path: path.join(out, `${name}.png`), fullPage: true });
  const state = () => page.evaluate(() => window.__colorPitch && window.__colorPitch());
  const audio = () => page.evaluate(() => window.__cpAudio && window.__cpAudio());
  const tapText = async (re) => {
    const handle = await page.evaluateHandle((src) => {
      const r = new RegExp(src);
      return [...document.querySelectorAll("button")].find((b) => r.test(b.textContent || "") && !b.disabled) || null;
    }, re.source);
    const el = handle.asElement();
    if (!el) throw new Error(`no button matching ${re}`);
    await el.tap();
  };
  const bodyText = () => page.evaluate(() => document.body.innerText);

  await page.goto(URL, { waitUntil: "networkidle0" });
  await sleep(500);

  if (flow === "denied") {
    await tapText(/เริ่มฝึกวันนี้/);
    await sleep(600);
    await tapText(/ฮัมใส่ไมค์/);
    await sleep(2500);
    const txt = await bodyText();
    note("denied.sliderShown", /เลื่อนแถบ/.test(txt));
    note("denied.message", txt.match(/ไม่ได้รับอนุญาต[^\n]*/)?.[0] ?? "(none)");
    await shot("denied-01-slider-fallback");
    // Use the slider fallback like a player: drag via keyboard steps, then confirm.
    await page.focus('input[aria-label="pitch slider"]');
    for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
    await sleep(400);
    await tapText(/^ยืนยัน$/);
    await sleep(900);
    const s = await state();
    const today = Object.keys(s.progress.firstNote)[0];
    note("denied.firstNoteEntry", s.progress.firstNote[today]);
    await shot("denied-02-slider-result");
    note("errors", errors);
    await browser.close();
    fs.writeFileSync(path.join(out, `log-${flow}.json`), JSON.stringify(log, null, 2));
    return;
  }

  // ---------- main flow ----------
  note("audio.beforeTap", await audio());
  await shot("01-home-first-visit");

  await tapText(/เริ่มฝึกวันนี้/);
  await sleep(1500);
  note("audio.afterFirstTap", await audio());

  // 1. Daily first note via (fake) microphone playing C4
  await shot("02-first-note-intro");
  await tapText(/ฮัมใส่ไมค์/);
  await sleep(1500);
  await shot("03-first-note-listening");
  await sleep(3200);
  let s = await state();
  const today = Object.keys(s.progress.firstNote)[0];
  note("firstNote.entry", s.progress.firstNote[today]);
  await shot("04-first-note-result");
  for (let i = 0; i < 20 && !(await audio()).pianoLoaded; i++) await sleep(500);
  note("audio.afterFirstNote", await audio());
  await tapText(/ต่อไป/);
  await sleep(700);

  // 2. Note + color quiz: answer like a perfect player, with 2 deliberate mistakes.
  await tapText(/เริ่ม/);
  await sleep(1000);
  await shot("05-quiz-question");
  let wrongShot = false, unlockShot = false;
  for (let q = 0; q < 33; q++) {
    const qn = await page.evaluate(() => window.__cpQuestion);
    const wrong = q === 3 || q === 11;
    const pc = wrong ? (qn.pc === 0 ? 7 : 0) : qn.pc;
    const key = await page.$(`button[data-pc="${pc}"]`);
    await key.tap();
    await sleep(350);
    if (wrong && !wrongShot) {
      await shot("06-quiz-wrong-feedback");
      wrongShot = true;
    }
    if (q === 0) await shot("07-quiz-correct-feedback");
    const txt = await bodyText();
    if (!unlockShot && /ปลดล็อกโน้ตใหม่/.test(txt)) {
      await shot("08-quiz-unlock");
      note("quiz.unlockedAtAnswer", q + 1);
      unlockShot = true;
    }
    // wait until the next question is on screen (keys enabled + prompt shown)
    for (let i = 0; i < 60; i++) {
      await sleep(150);
      const ready = await page.evaluate(
        () => document.querySelector('button[data-pc="0"]').getAttribute("aria-disabled") === "false" && /ฟังแล้วแตะคีย์ที่ใช่/.test(document.body.innerText),
      );
      if (ready) break;
    }
  }
  s = await state();
  note("quiz.after", {
    answers: s.progress.noteAnswers.length,
    correct: s.progress.noteAnswers.filter((a) => a.answer === a.target).length,
    notesUnlocked: s.progress.notesUnlocked,
    newestTargets: s.progress.noteAnswers.slice(-3).map((a) => a.target),
  });
  await shot("09-quiz-after-unlock");
  await tapText(/จบรอบนี้/);
  await sleep(600);
  await shot("10-quiz-summary");
  await tapText(/ต่อไป/);
  await sleep(700);

  // 3. Chords
  await tapText(/เริ่ม/);
  await sleep(800);
  await shot("11-chords-question");
  for (let q = 0; q < 6; q++) {
    const cq = await page.evaluate(() => window.__cpQuestion);
    const ans = q === 2 ? (cq.quality === "major" ? "minor" : "major") : cq.quality;
    await (await page.$(`button[data-quality="${ans}"]`)).tap();
    await sleep(450);
    if (q === 0) await shot("12-chords-mood-card");
    if (q === 2) await shot("13-chords-mood-card-wrong");
    await sleep(1600);
  }
  await tapText(/จบรอบนี้/);
  await sleep(600);
  await tapText(/ต่อไป/);
  await sleep(700);
  await shot("14-session-complete");
  s = await state();
  note("session.done", s.progress.sessionDone);

  // Progress survives reload
  const before = { notes: s.progress.notesUnlocked, answers: s.progress.noteAnswers.length, chords: s.progress.chordAnswers.length };
  await page.goto(URL, { waitUntil: "networkidle0" });
  await sleep(800);
  s = await state();
  const after = { notes: s.progress.notesUnlocked, answers: s.progress.noteAnswers.length, chords: s.progress.chordAnswers.length };
  note("reload.before", before);
  note("reload.after", after);
  note("reload.homeText", (await bodyText()).match(/ฝึกต่อเนื่อง[^\n]*|ฝึกครบแล้ว[^\n]*/g));
  await shotFull("15-home-after-reload");

  // Stats / settings / light mode
  await tapText(/สถิติ/);
  await sleep(600);
  await shotFull("16-stats");
  await tapText(/ตั้งค่า/);
  await sleep(600);
  await shotFull("17-settings");
  await tapText(/สว่าง$/);
  await sleep(500);
  await tapText(/หน้าแรก/);
  await sleep(500);
  await shot("18-home-light");
  note("theme.attr", await page.evaluate(() => document.documentElement.dataset.theme));

  // Tuner with the C4 fake mic: guess C first, then detect.
  await tapText(/จับเสียง/);
  await sleep(500);
  await (await page.$('button[data-pc="0"]')).tap();
  await sleep(200);
  await tapText(/วัดเสียง/);
  await sleep(3800);
  s = await state();
  note("tuner.last", s.progress.tuner.at(-1));
  await shot("19-tuner-result");

  // Mode brightness is locked in week 1 with 3 notes
  await page.goto(URL + "#modes", { waitUntil: "networkidle0" });
  await sleep(500);
  note("modes.lockedText", /ปลดล็อกในสัปดาห์ 4/.test(await bodyText()));

  // Offline: service worker should serve the app shell.
  await page.goto(URL, { waitUntil: "networkidle0" });
  await sleep(1500);
  note("sw.controller", await page.evaluate(() => !!navigator.serviceWorker.controller));
  note("sw.caches", await page.evaluate(async () => {
    const out = {};
    for (const k of await caches.keys()) out[k] = (await (await caches.open(k)).keys()).length;
    return out;
  }));
  await page.setOfflineMode(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await sleep(1500);
  const offTxt = await bodyText();
  note("offline.rendered", /Color Pitch/.test(offTxt) && /การฝึกวันนี้/.test(offTxt));
  note("offline.progressKept", (await state())?.progress.notesUnlocked);
  await shot("20-offline-home");
  await page.setOfflineMode(false);

  note("samples", samples.slice(0, 30));
  note("errors", errors);
  fs.writeFileSync(path.join(out, `log-${flow}.json`), JSON.stringify(log, null, 2));
  await browser.close();
})().catch((e) => {
  console.error("FAILED", e);
  process.exit(1);
});
