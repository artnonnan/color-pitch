// Pitch-class, chord and mode definitions. Pure data + math, no audio.

export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
export type NoteName = (typeof NOTE_NAMES)[number];
/** Pitch class 0–11 (C = 0). */
export type PC = number;

export const WHITE_PCS: PC[] = [0, 2, 4, 5, 7, 9, 11];
export const isBlack = (pc: PC) => !WHITE_PCS.includes(((pc % 12) + 12) % 12);

/** Order in which notes unlock in the quiz: C, G, E, A, D, F, B, then the black keys. */
export const NOTE_UNLOCK_ORDER: PC[] = [0, 7, 4, 9, 2, 5, 11, 6, 1, 10, 3, 8];
export const INITIAL_NOTES = 2;

/** Notes the daily first-note exercise rotates through, one per week. */
export const FIRST_NOTE_ROTATION: PC[] = [0, 7, 4, 9, 2, 5, 11];

export const pcOf = (midi: number) => ((midi % 12) + 12) % 12;
export const nameOf = (pcOrMidi: number) => NOTE_NAMES[pcOf(pcOrMidi)];
export const octaveOf = (midi: number) => Math.floor(midi / 12) - 1;
export const midiName = (midi: number) => `${nameOf(midi)}${octaveOf(midi)}`;
export const midiToFreq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
export const freqToMidiFloat = (f: number) => 69 + 12 * Math.log2(f / 440);

/**
 * Signed distance in cents from a target pitch class, folded into one octave
 * (-600..+600), so humming C in any octave counts.
 */
export function centsFromPc(freq: number, targetPc: PC): number {
  const cents = (freqToMidiFloat(freq) - targetPc) * 100;
  let d = cents % 1200;
  if (d > 600) d -= 1200;
  if (d <= -600) d += 1200;
  return d;
}

/** Signed semitone difference between two pitch classes, folded to -6..+6. */
export function pcDiff(answer: PC, target: PC): number {
  let d = (((answer - target) % 12) + 12) % 12;
  if (d > 6) d -= 12;
  return d;
}

export const CHORD_QUALITIES = ["major", "minor", "maj7", "sus4", "dim", "aug"] as const;
export type ChordQuality = (typeof CHORD_QUALITIES)[number];
export const CHORD_INTERVALS: Record<ChordQuality, number[]> = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  maj7: [0, 4, 7, 11],
  sus4: [0, 5, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
};
export const CHORD_SYMBOL: Record<ChordQuality, string> = {
  major: "",
  minor: "m",
  maj7: "maj7",
  sus4: "sus4",
  dim: "dim",
  aug: "aug",
};
export const INITIAL_CHORDS = 2;

/** Brightest → darkest. */
export const MODES = ["lydian", "ionian", "mixolydian", "dorian", "aeolian", "phrygian", "locrian"] as const;
export type Mode = (typeof MODES)[number];
export const MODE_INTERVALS: Record<Mode, number[]> = {
  lydian: [0, 2, 4, 6, 7, 9, 11, 12],
  ionian: [0, 2, 4, 5, 7, 9, 11, 12],
  mixolydian: [0, 2, 4, 5, 7, 9, 10, 12],
  dorian: [0, 2, 3, 5, 7, 9, 10, 12],
  aeolian: [0, 2, 3, 5, 7, 8, 10, 12],
  phrygian: [0, 1, 3, 5, 7, 8, 10, 12],
  locrian: [0, 1, 3, 5, 6, 8, 10, 12],
};
export const MODE_LABEL: Record<Mode, string> = {
  lydian: "Lydian",
  ionian: "Ionian",
  mixolydian: "Mixolydian",
  dorian: "Dorian",
  aeolian: "Aeolian",
  phrygian: "Phrygian",
  locrian: "Locrian",
};

export function randInt(lo: number, hi: number) {
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}
export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
/** Weighted random pick; weights need not sum to 1. */
export function pickWeighted<T>(items: readonly T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

/** All MIDI notes of a pitch class inside [lo, hi]. */
export function midisOfPc(pc: PC, lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let m = lo; m <= hi; m++) if (pcOf(m) === pc) out.push(m);
  return out;
}
