"use client";
// Audio playback: Tone.js Sampler with Salamander Grand Piano samples, or a sine synth.
//
// iOS rules this file follows:
//  - The AudioContext may only start inside a user gesture, so `unlockAudio()` is
//    called synchronously from the first touchend/click (see AudioUnlock.tsx).
//    Tone is imported ahead of time (`preloadAudio`) so no `await` sits between
//    the gesture and `Tone.start()`.
//  - The ringer/silent switch mutes Web Audio by default. Setting
//    `navigator.audioSession.type = "playback"` (Safari 17+) and playing a silent
//    <audio> element in the gesture moves the page to the media channel.
import { midiToFreq } from "./music";

type ToneModule = typeof import("tone");
type Instrument = "piano" | "sine";
export type AudioStatus = "locked" | "loading" | "ready" | "error";

export const SALAMANDER_URL = "https://tonejs.github.io/audio/salamander/";
// One sample every minor third from C2 to A6; Sampler repitches the rest.
const SAMPLE_NOTES = ["C", "D#", "F#", "A"].flatMap((n) => [2, 3, 4, 5, 6].map((o) => `${n}${o}`));
const sampleUrls = Object.fromEntries(SAMPLE_NOTES.map((n) => [n, `${n.replace("#", "s")}.mp3`]));

let Tone: ToneModule | null = null;
let tonePromise: Promise<ToneModule> | null = null;
let piano: import("tone").Sampler | null = null;
let pianoLoaded: Promise<void> | null = null;
let sine: import("tone").PolySynth | null = null;
let instrument: Instrument = "piano";
let unlocked = false;
let status: AudioStatus = "locked";
const listeners = new Set<(s: AudioStatus) => void>();

function setStatus(s: AudioStatus) {
  status = s;
  listeners.forEach((l) => l(s));
}
export function getAudioStatus() {
  return status;
}
export function onAudioStatus(fn: (s: AudioStatus) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
export const isAudioUnlocked = () => unlocked;

export function preloadAudio(): Promise<ToneModule> {
  if (!tonePromise) {
    tonePromise = import("tone").then((m) => {
      Tone = m;
      return m;
    });
  }
  return tonePromise;
}

// 0.1 s of silence as a WAV data URI (built once, no network).
let silentSrc: string | null = null;
function silentWav(): string {
  if (silentSrc) return silentSrc;
  const rate = 8000, n = 800;
  const buf = new ArrayBuffer(44 + n);
  const v = new DataView(buf);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF"); v.setUint32(4, 36 + n, true); w(8, "WAVE"); w(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  w(36, "data"); v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
  let bin = "";
  new Uint8Array(buf).forEach((b) => (bin += String.fromCharCode(b)));
  silentSrc = "data:audio/wav;base64," + btoa(bin);
  return silentSrc;
}

/** Call synchronously inside a user gesture handler. Safe to call repeatedly. */
export function unlockAudio() {
  try {
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    if (nav.audioSession) nav.audioSession.type = "playback";
  } catch {
    /* ignore */
  }
  if (isAudioRunning()) return;
  // Re-played on every unlock, not just the first: after the screen locks or the
  // app goes to the background, iOS needs it again to get the media channel back.
  try {
    const a = new Audio(silentWav());
    a.setAttribute("playsinline", "");
    void a.play().catch(() => {});
  } catch {
    /* ignore */
  }
  if (Tone) {
    watchContext();
    // Tone.start() calls context.resume() synchronously — that's what iOS needs.
    void Tone.start().then(onRunning, () => {});
    if (isAudioRunning()) onRunning();
  } else {
    void preloadAudio().then(() => unlockAudio());
  }
}

/** True only while the AudioContext is actually producing sound. */
export function isAudioRunning(): boolean {
  return !!Tone && Tone.getContext().state === "running";
}

function onRunning() {
  if (!isAudioRunning()) return;
  unlocked = true;
  void ensureInstrument().then(() => {
    if (isAudioRunning()) setStatus(instrument === "piano" && !piano?.loaded ? "error" : "ready");
  });
}

// iOS suspends ("suspended") or interrupts ("interrupted", Safari-only) the context
// when the screen locks, another app plays audio, or a call comes in. It does not
// resume on its own, so show the "tap to enable sound" pill again until a tap.
let watching = false;
function watchContext() {
  if (watching || !Tone) return;
  watching = true;
  const raw = Tone.getContext().rawContext as unknown as BaseAudioContext;
  raw.addEventListener("statechange", () => {
    if (isAudioRunning()) onRunning();
    else if (unlocked) setStatus("locked");
  });
  const tryResume = () => {
    if (document.visibilityState !== "visible" || isAudioRunning() || !unlocked) return;
    // Works without a gesture on some browsers; on iOS the next tap does it.
    void Tone?.start().then(onRunning, () => {});
    window.setTimeout(() => {
      if (!isAudioRunning() && unlocked) setStatus("locked");
    }, 300);
  };
  document.addEventListener("visibilitychange", tryResume);
  window.addEventListener("pageshow", tryResume);
  window.addEventListener("focus", tryResume);
}

function ensureInstrument(): Promise<void> {
  if (!Tone) return Promise.resolve();
  if (instrument === "sine") {
    if (!sine) {
      sine = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "sine" },
        envelope: { attack: 0.02, decay: 0.1, sustain: 0.8, release: 0.6 },
        volume: -8,
      }).toDestination();
    }
    setStatus("ready");
    return Promise.resolve();
  }
  if (!piano) {
    setStatus("loading");
    const T = Tone;
    pianoLoaded = new Promise<void>((resolve) => {
      piano = new T.Sampler({
        urls: sampleUrls,
        baseUrl: SALAMANDER_URL,
        release: 1.2,
        onload: () => {
          setStatus("ready");
          resolve();
        },
        onerror: () => {
          // Offline before samples were cached: fall back to sine so practice continues.
          setStatus("error");
          resolve();
        },
      }).toDestination();
      piano.volume.value = -2;
    });
  }
  return pianoLoaded ?? Promise.resolve();
}

export function setInstrument(i: Instrument) {
  instrument = i;
  if (unlocked) void ensureInstrument();
}

/** Plays MIDI notes. `at` = seconds from now. Resolves once scheduled. */
let playCount = 0;
// Read-only probe for automated checks: is the context running, which instrument played.
if (typeof window !== "undefined") {
  (window as unknown as { __cpAudio?: () => unknown }).__cpAudio = () => ({
    status,
    unlocked,
    context: Tone?.getContext().state ?? "not-loaded",
    pianoLoaded: !!piano?.loaded,
    instrument,
    playCount,
  });
  // Test hook: suspend the context the way iOS does on screen lock / app switch.
  (window as unknown as { __cpAudioSuspend?: () => Promise<void> }).__cpAudioSuspend = async () => {
    if (Tone) await (Tone.getContext().rawContext as unknown as AudioContext).suspend();
  };
}

async function trigger(midis: number[], dur: number, at = 0, velocity = 0.8) {
  // Before any await, so a tap that plays a note (replay, start…) also resumes a
  // context iOS suspended while the app was in the background.
  if (!isAudioRunning()) unlockAudio();
  const T = Tone ?? (await preloadAudio());
  if (!isAudioRunning()) {
    // iOS may leave resume() pending until a gesture, so never wait more than 400 ms.
    await Promise.race([T.getContext().resume().catch(() => {}), wait(400)]);
  }
  await ensureInstrument();
  const when = T.now() + 0.05 + at;
  playCount++;
  const usePiano = instrument === "piano" && piano && piano.loaded;
  if (usePiano) {
    piano!.triggerAttackRelease(midis.map((m) => midiToFreq(m)), dur, when, velocity);
  } else {
    if (!sine) {
      sine = new T.PolySynth(T.Synth, {
        oscillator: { type: "sine" },
        envelope: { attack: 0.02, decay: 0.1, sustain: 0.8, release: 0.6 },
        volume: -8,
      }).toDestination();
    }
    sine.triggerAttackRelease(midis.map((m) => midiToFreq(m)), dur, when, velocity);
  }
}

export const playNote = (midi: number, dur = 1.4) => trigger([midi], dur);
export const playChord = (midis: number[], dur = 2.2) => trigger(midis, dur, 0, 0.7);

/** Play notes one after another (scales, "your answer vs the real note"). */
export async function playSequence(midis: number[], step = 0.42, dur = 0.5) {
  for (let i = 0; i < midis.length; i++) await trigger([midis[i]], dur, i * step);
}

/** Wait helper for UI pacing. */
export const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function stopAll() {
  try {
    piano?.releaseAll();
    sine?.releaseAll();
  } catch {
    /* ignore */
  }
}
