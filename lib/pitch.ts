"use client";
// Microphone pitch detection with pitchy (McLeod pitch method) + Web Audio.
import { PitchDetector } from "pitchy";

/**
 * Why the microphone could not start. Each one gets its own message, because
 * "permission denied" is only one of many causes (no mic, mic busy, OS privacy
 * setting, in-app browser, non-https page…).
 */
export type MicErrorCode =
  | "denied" // the user (or the site setting) blocked it
  | "system-denied" // the OS blocks the browser from the mic
  | "in-app" // LINE / Facebook / Instagram in-app browser
  | "insecure" // not https
  | "unsupported" // browser has no getUserMedia
  | "not-found" // no microphone
  | "in-use" // another app is using it
  | "audio-session" // iOS audio session still can't record
  | "failed"; // anything else
export interface MicError {
  code: MicErrorCode;
  detail: string; // raw error name/message, shown small for troubleshooting
}

/**
 * iOS Safari 17+: the page's audio session category. lib/audio.ts sets "playback"
 * so sound plays with the silent switch on, but "playback" forbids capture —
 * getUserMedia then fails with InvalidStateError ("AudioSession category is not
 * compatible with audio capture"). So: "play-and-record" while the mic is open,
 * back to "playback" after.
 */
type AudioSessionType = "auto" | "playback" | "play-and-record";
function setAudioSession(type: AudioSessionType) {
  try {
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session && session.type !== type) session.type = type;
  } catch {
    /* not supported */
  }
}
const hasAudioSession = () =>
  typeof navigator !== "undefined" && "audioSession" in (navigator as Navigator & { audioSession?: unknown });

export function isInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Line\/|FBAN|FBAV|FB_IAB|Instagram|Messenger|TikTok|Twitter|MicroMessenger/i.test(navigator.userAgent);
}

async function classify(e: unknown): Promise<MicError> {
  const name = (e as DOMException)?.name ?? "";
  const message = (e as Error)?.message ?? String(e);
  const detail = [name, message].filter(Boolean).join(": ");
  if (name === "NotFoundError" || name === "DevicesNotFoundError" || name === "OverconstrainedError")
    return { code: "not-found", detail };
  if (name === "InvalidStateError") return { code: "audio-session", detail };
  if (name === "NotReadableError" || name === "TrackStartError" || name === "AbortError")
    return { code: "in-use", detail };
  if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") {
    if (isInAppBrowser()) return { code: "in-app", detail };
    // Chrome: "Permission denied by system" = the OS privacy setting blocks the browser.
    if (/system/i.test(message)) return { code: "system-denied", detail };
    return { code: "denied", detail };
  }
  return { code: isInAppBrowser() ? "in-app" : "failed", detail };
}

export interface PitchFrame {
  freq: number | null; // null when no clear pitch
  clarity: number;
  level: number; // 0..1 RMS-ish loudness for a meter
}

export interface MicSession {
  read(): PitchFrame;
  stop(): void;
}

const MIN_FREQ = 60;
const MAX_FREQ = 2000;

/**
 * Must be called directly from a user gesture (the AudioContext is created and
 * resumed before the first await, which iOS requires).
 */
export async function startMic(): Promise<MicSession> {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    throw { code: "insecure", detail: location.protocol } as MicError;
  }
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw { code: isInAppBrowser() ? "in-app" : "unsupported", detail: "no mediaDevices.getUserMedia" } as MicError;
  }
  const Ctx: typeof AudioContext =
    window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  void ctx.resume();
  // Must be set before getUserMedia (see setAudioSession).
  setAudioSession("play-and-record");
  const constraints: MediaStreamConstraints = {
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  };
  let stream: MediaStream;
  try {
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (e) {
      const name = (e as DOMException)?.name;
      if (name === "InvalidStateError" && hasAudioSession()) {
        // Category still incompatible — let iOS pick one itself, then retry.
        setAudioSession("auto");
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } else if (name === "OverconstrainedError" || name === "TypeError") {
        // Some devices reject the processing constraints; retry with plain audio.
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } else throw e;
    }
  } catch (e) {
    void ctx.close();
    setAudioSession("playback");
    throw await classify(e);
  }
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(analyser);
  const buf = new Float32Array(analyser.fftSize);
  const detector = PitchDetector.forFloat32Array(analyser.fftSize);
  detector.minVolumeDecibels = -45;

  return {
    read() {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);
      const level = Math.min(1, rms * 8);
      const [freq, clarity] = detector.findPitch(buf, ctx.sampleRate);
      const ok = clarity > 0.88 && freq > MIN_FREQ && freq < MAX_FREQ;
      return { freq: ok ? freq : null, clarity, level };
    },
    stop() {
      stream.getTracks().forEach((t) => t.stop());
      setAudioSession("playback"); // back to silent-switch-proof playback
      try {
        source.disconnect();
      } catch {
        /* ignore */
      }
      void ctx.close();
    },
  };
}

export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Listen for `ms` and return the median of all clear pitch readings, or null if
 * fewer than `minFrames` clear frames were heard. `onFrame` drives the UI meter.
 */
export function capturePitch(
  mic: MicSession,
  ms: number,
  minFrames: number,
  onFrame?: (f: PitchFrame, progress: number) => void,
): Promise<number | null> {
  return new Promise((resolve) => {
    const freqs: number[] = [];
    const t0 = performance.now();
    const tick = () => {
      const f = mic.read();
      const progress = Math.min(1, (performance.now() - t0) / ms);
      if (f.freq) freqs.push(f.freq);
      onFrame?.(f, progress);
      if (progress >= 1) {
        if (freqs.length < minFrames) return resolve(null);
        // Drop octave-jump outliers: keep readings within 1.5 semitones of the median.
        const m = median(freqs);
        const kept = freqs.filter((x) => Math.abs(12 * Math.log2(x / m)) < 1.5);
        resolve(median(kept.length ? kept : freqs));
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
