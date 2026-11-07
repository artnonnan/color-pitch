"use client";
// Microphone pitch detection with pitchy (McLeod pitch method) + Web Audio.
import { PitchDetector } from "pitchy";

export type MicError = "denied" | "unsupported" | "failed";

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
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw "unsupported" as MicError;
  }
  const Ctx: typeof AudioContext =
    window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  void ctx.resume();
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
  } catch (e) {
    void ctx.close();
    const name = (e as DOMException)?.name;
    throw (name === "NotAllowedError" || name === "SecurityError" ? "denied" : "failed") as MicError;
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
