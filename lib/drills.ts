// Small audio helpers shared by the pitch-memory drills.
import { playNote, playSequence, setVoiceOverride, VOICES, wait, type Voice } from "./audio";
import { pick, randInt } from "./music";

/**
 * A quick run of random notes across the range, in a plain sine voice. Played between
 * questions so the previous note can't be used as a reference (no relative pitch).
 */
export async function noiseBurst(count = 9, step = 0.11) {
  const notes = Array.from({ length: count }, () => randInt(40, 88));
  setVoiceOverride("sine");
  await playSequence(notes, step, step * 1.3);
  setVoiceOverride(null);
  await wait(count * step * 1000 + 150);
}

/** Play a note in a given voice, then go back to the instrument setting. */
export async function playIn(midi: number, voice: Voice, dur = 1.3) {
  setVoiceOverride(voice);
  await playNote(midi, dur);
  setVoiceOverride(null);
}

export const randomVoice = (): Voice => pick(VOICES);
