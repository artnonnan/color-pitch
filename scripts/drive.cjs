// Drive Color Pitch in Edge like a player on a 375px iPhone, and keep the evidence.
// Adapted from D:/Engine/featuremap/harness/web/drive.cjs, but it drives a running
// Next.js server (npm start) instead of serving static files.
//
// usage: node scripts/drive.cjs <recipe.js | doctor> [--url http://localhost:3123]
//                               [--out verification/<date>-<name>] [--mic c4 | deny | none]
//
// The recipe is the body of an async function with these in scope:
//   page, sleep(ms), log(key, value), out
//   go(hash)          open "#quiz", "#degrees"… (or "" for home) and wait for it to settle
//   tap(regex)        tap the first enabled <button> whose text matches
//   tapSel(css)       tap the element matching a CSS selector
//   tapKey(pc)        tap keyboard key for pitch class 0–11
//   skipGate()        tap "ข้ามวันนี้" if the first-note gate is showing
//   state()           window.__colorPitch()   (read-only app state)
//   question()        window.__cpQuestion     (the answer to the current question)
//   audio()           window.__cpAudio()      (context state, voice, play counts)
//   text()            document.body.innerText
//   waitFor(fn, ms)   poll an in-page predicate until true (throws on timeout)
//   shot(name, full)  save <out>/<name>.png ; save(name, obj) → <out>/<name>.json
// Whatever the recipe returns is printed as JSON. Page errors make the exit code 1.
//
// Every run uses a fresh browser profile, so localStorage starts empty (a new player).
const fs = require("fs"), path = require("path"), net = require("net"), { spawn } = require("child_process");
const puppeteer = require(process.env.PUPPETEER_CORE || "D:/Engine/featuremap/harness/web/node_modules/puppeteer-core");

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const recipe = argv[0];
if (!recipe) { console.error("usage: node scripts/drive.cjs <recipe.js|doctor> [--url u] [--out dir] [--mic c4|deny|none]"); process.exit(2); }
const URL = opt("--url", "http://localhost:3123").replace(/\/$/, "");
const name = recipe === "doctor" ? "doctor" : path.basename(recipe, ".js");
const out = path.resolve(opt("--out", path.join(__dirname, "..", "verification", `${new Date().toISOString().slice(0, 10)}-${name}`)));
const mic = opt("--mic", "c4");
const EDGE = process.env.EDGE_PATH || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

/** 3 s of C4 (261.63 Hz) as 48 kHz mono 16-bit WAV, for the fake microphone. */
function writeC4(file) {
  const rate = 48000, n = rate * 3, buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 261.63 * i) / rate) * 12000), 44 + i * 2);
  fs.writeFileSync(file, buf);
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const profDir = path.join(__dirname, "..", "verification", ".profiles");
  fs.mkdirSync(profDir, { recursive: true });
  const profile = fs.mkdtempSync(path.join(profDir, "p-"));
  const args = ["--no-first-run", "--no-default-browser-check", `--user-data-dir=${profile}`];
  if (mic === "c4") {
    const wav = path.join(profile, "c4.wav");
    writeC4(wav);
    args.push("--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-audio-capture=${wav.replace(/\\/g, "/")}`);
  } else if (mic === "deny") {
    args.push("--use-fake-device-for-media-stream", "--deny-permission-prompts");
  }
  // Edge 156 + puppeteer-core 22: launch() never sees the DevTools line (and pipe mode
  // closes the target), so start Edge ourselves on a free port and connect to it.
  const port = await new Promise((r) => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => r(p)); }); });
  const edge = spawn(EDGE, ["--headless=new", `--remote-debugging-port=${port}`, ...args, "about:blank"], { stdio: "ignore" });
  let ws = null;
  for (let i = 0; i < 100 && !ws; i++) {
    await new Promise((r) => setTimeout(r, 150));
    ws = await fetch(`http://127.0.0.1:${port}/json/version`).then((r) => r.json()).then((j) => j.webSocketDebuggerUrl, () => null);
  }
  if (!ws) { edge.kill(); throw new Error("Edge did not open its DevTools port"); }
  const browser = await puppeteer.connect({ browserWSEndpoint: ws, protocolTimeout: 600000, defaultViewport: null });
  let code = 0;
  const lines = [];
  const log = (k, v) => { lines.push({ k, v }); console.error(k, typeof v === "string" ? v : JSON.stringify(v)); };
  try {
    const page = await browser.newPage();
    await page.emulate({
      viewport: { width: 375, height: 812, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const go = async (hash) => {
      await page.goto(`${URL}/${hash ? (hash.startsWith("#") ? hash : "#" + hash) : ""}`, { waitUntil: "networkidle0" });
      await page.waitForFunction(() => typeof window.__colorPitch === "function", { timeout: 15000 });
      await sleep(400);
    };
    const tap = async (re) => {
      const src = re instanceof RegExp ? re.source : String(re);
      const h = await page.evaluateHandle((s) => [...document.querySelectorAll("button")].find((b) => new RegExp(s).test(b.textContent || "") && !b.disabled) || null, src);
      const el = h.asElement();
      if (!el) throw new Error(`no enabled button matching /${src}/`);
      await el.tap();
    };
    const tapSel = async (sel) => {
      const el = await page.$(sel);
      if (!el) throw new Error(`no element ${sel}`);
      await el.tap();
    };
    const tapKey = (pc) => tapSel(`button[data-pc="${pc}"]`);
    const skipGate = async () => {
      if (await page.evaluate(() => /ข้ามวันนี้/.test(document.body.innerText))) { await tap(/ข้ามวันนี้/); await sleep(300); }
    };
    const state = () => page.evaluate(() => window.__colorPitch());
    const question = () => page.evaluate(() => window.__cpQuestion ?? null);
    const audio = () => page.evaluate(() => (window.__cpAudio ? window.__cpAudio() : null));
    const text = () => page.evaluate(() => document.body.innerText);
    const waitFor = async (fn, ms = 10000) => {
      await page.waitForFunction(fn, { timeout: ms, polling: 100 });
    };
    const shot = async (n, full) => { const p = path.join(out, `${n}.png`); await page.screenshot({ path: p, fullPage: !!full }); return p; };
    const save = (n, obj) => { const p = path.join(out, `${n}.json`); fs.writeFileSync(p, JSON.stringify(obj, null, 1)); return p; };

    let result;
    if (recipe === "doctor") {
      const res = await page.goto(`${URL}/`, { waitUntil: "networkidle0" });
      const html = await res.text();
      const expected = fs.readFileSync(path.join(__dirname, "..", ".next", "BUILD_ID"), "utf8").trim();
      await page.waitForFunction(() => typeof window.__colorPitch === "function", { timeout: 15000 });
      const s = await state();
      result = {
        status: res.status(),
        buildId: expected,
        buildIdServed: html.includes(expected),
        title: await page.title(),
        hooks: await page.evaluate(() => ({ state: typeof window.__colorPitch, audio: typeof window.__cpAudio })),
        freshProfile: s.progress.noteAnswers.length === 0,
        audio: await audio(),
      };
      if (!(result.status === 200 && result.buildIdServed && result.hooks.state === "function" && result.hooks.audio === "function")) code = 1;
    } else {
      const body = fs.readFileSync(recipe, "utf8");
      const ctx = { page, sleep, log, out, go, tap, tapSel, tapKey, skipGate, state, question, audio, text, waitFor, shot, save };
      result = await new Function(...Object.keys(ctx), `return (async () => { ${body} })();`)(...Object.values(ctx));
    }
    save("run-log", { recipe, url: URL, mic, lines, pageErrors: errors, result });
    console.log(JSON.stringify({ ok: code === 0 && !errors.length, out, pageErrors: errors, result }, null, 1));
    if (errors.length) code = 1;
  } catch (e) {
    console.log(JSON.stringify({ ok: false, out, error: String((e && e.stack) || e), lines }, null, 1));
    code = 1;
  } finally {
    await browser.close().catch(() => {});
    // Kill only the Edge tree this run started (its crashpad/GPU children hold profile files).
    try { require("child_process").execFileSync("taskkill", ["/PID", String(edge.pid), "/T", "/F"], { stdio: "ignore" }); } catch { /* already gone */ }
    // Scratch profile only; evidence stays in `out`.
    for (let i = 0; i < 10; i++) {
      try { fs.rmSync(profile, { recursive: true, force: true }); break; } catch { await new Promise((r) => setTimeout(r, 300)); }
    }
    process.exit(code);
  }
})();
