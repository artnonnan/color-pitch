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

// ---------- scale degrees (functional ear training) ----------

/** Semitones above the tonic for major-scale degrees 1–7. */
export const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11] as const;
/** Degree numbers 1–7. */
export type Degree = 1 | 2 | 3 | 4 | 5 | 6 | 7;
/** Unlock order: the tonic triad first, then the steps around it, then the leading tone. */
export const DEGREE_UNLOCK_ORDER: Degree[] = [1, 5, 3, 2, 4, 6, 7];
export const INITIAL_DEGREES = 3;

/**
 * I–IV–V–I cadence in a major key, voiced close with a bass note, so the key is
 * clear before the test note. `tonic` should sit in C3–B3.
 */
export function cadence(tonic: number): number[][] {
  return [
    [tonic - 12, tonic, tonic + 4, tonic + 7], // I
    [tonic - 7, tonic, tonic + 5, tonic + 9], // IV (2nd inversion)
    [tonic - 5, tonic - 1, tonic + 2, tonic + 7], // V (1st inversion)
    [tonic - 12, tonic, tonic + 4, tonic + 7], // I
  ];
}

/**
 * Walk from a degree home to the tonic: 2–5 step down to 1, 6–7 step up to 8.
 * Returns MIDI notes starting at the degree's note.
 */
export function resolution(tonic: number, degree: Degree): number[] {
  const steps = MAJOR_STEPS.map((s) => tonic + s);
  const i = degree - 1;
  if (i === 0) return [steps[0]];
  if (i >= 5) return [...steps.slice(i), tonic + 12];
  return steps.slice(0, i + 1).reverse();
}

// ---------- intervals ----------

export const INTERVALS = ["P8", "P5", "M3", "P4", "m3", "M2", "m2", "M6", "m6", "M7", "m7", "TT"] as const;
export type Interval = (typeof INTERVALS)[number];
/** Unlock order is the array order above: wide, consonant contrasts first. */
export const INTERVAL_SEMITONES: Record<Interval, number> = {
  m2: 1, M2: 2, m3: 3, M3: 4, P4: 5, TT: 6, P5: 7, m6: 8, M6: 9, m7: 10, M7: 11, P8: 12,
};
export const INITIAL_INTERVALS = 3;
export type IntervalDir = "up" | "down" | "together" | "mix";

// ---------- chord progressions ----------

/** Diatonic triads of a major key. Unlock order: the three primary chords, then vi, ii, iii. */
export const NUMERALS = ["I", "IV", "V", "vi", "ii", "iii"] as const;
export type Numeral = (typeof NUMERALS)[number];
export const NUMERAL_DEGREE: Record<Numeral, Degree> = { I: 1, ii: 2, iii: 3, IV: 4, V: 5, vi: 6 };
export const NUMERAL_QUALITY: Record<Numeral, ChordQuality> = {
  I: "major", IV: "major", V: "major", vi: "minor", ii: "minor", iii: "minor",
};
export const INITIAL_NUMERALS = 3;
/** Chords per progression. The first is always I, so the player names the rest. */
export const PROGRESSION_LEN = 4;

/**
 * Every chord the progression exercise can use, relative to the key's tonic:
 * `root` = semitones above the tonic, `iv` = chord intervals, `deg` = scale degree of the
 * root (for the degree color), `sym` = chord-name suffix. Minor-key chords are relative
 * to the minor tonic (i = the tonic minor chord).
 */
export const PROG_CHORDS = {
  // major key, diatonic triads
  I: { root: 0, iv: [0, 4, 7], deg: 1, sym: "" },
  ii: { root: 2, iv: [0, 3, 7], deg: 2, sym: "m" },
  iii: { root: 4, iv: [0, 3, 7], deg: 3, sym: "m" },
  IV: { root: 5, iv: [0, 4, 7], deg: 4, sym: "" },
  V: { root: 7, iv: [0, 4, 7], deg: 5, sym: "" },
  vi: { root: 9, iv: [0, 3, 7], deg: 6, sym: "m" },
  // minor key (natural minor)
  i: { root: 0, iv: [0, 3, 7], deg: 1, sym: "m" },
  iv: { root: 5, iv: [0, 3, 7], deg: 4, sym: "m" },
  v: { root: 7, iv: [0, 3, 7], deg: 5, sym: "m" },
  III: { root: 3, iv: [0, 4, 7], deg: 3, sym: "" },
  VI: { root: 8, iv: [0, 4, 7], deg: 6, sym: "" },
  VII: { root: 10, iv: [0, 4, 7], deg: 7, sym: "" },
  // major key, seventh chords
  Imaj7: { root: 0, iv: [0, 4, 7, 11], deg: 1, sym: "maj7" },
  ii7: { root: 2, iv: [0, 3, 7, 10], deg: 2, sym: "m7" },
  IVmaj7: { root: 5, iv: [0, 4, 7, 11], deg: 4, sym: "maj7" },
  V7: { root: 7, iv: [0, 4, 7, 10], deg: 5, sym: "7" },
  vi7: { root: 9, iv: [0, 3, 7, 10], deg: 6, sym: "m7" },
  // major key, borrowed and secondary chords (iv above doubles as the borrowed minor iv)
  bVII: { root: 10, iv: [0, 4, 7], deg: 7, sym: "" },
  bVI: { root: 8, iv: [0, 4, 7], deg: 6, sym: "" },
  VofV: { root: 2, iv: [0, 4, 7], deg: 2, sym: "" },
} as const;
export type ProgChord = keyof typeof PROG_CHORDS;
/** How a chord is written on buttons and slots. */
export const progLabel = (c: ProgChord): string => (c === "bVII" ? "♭VII" : c === "bVI" ? "♭VI" : c === "VofV" ? "V/V" : c);

/**
 * A chord voiced for the progression exercise: a bass root plus close upper voices kept in
 * one window above the tonic, so chords move smoothly. `tonic` should sit in C3–B3.
 */
export function progChordMidis(tonic: number, c: ProgChord): number[] {
  const d = PROG_CHORDS[c];
  const lo = tonic + 4;
  const upper = d.iv.map((s) => {
    let m = tonic + d.root + s;
    while (m < lo) m += 12;
    while (m >= lo + 12) m -= 12;
    return m;
  });
  return [tonic - 12 + d.root, ...[...new Set(upper)].sort((a, b) => a - b)];
}
/** Back-compat name for the triads of the first levels. */
export const diatonicTriad = (tonic: number, n: Numeral) => progChordMidis(tonic, n);

/**
 * `home` followed by random chords from `set`. With `noRepeat`, never the same chord twice in
 * a row. Two-chord levels allow home → home, so "it stayed home" is a real answer.
 */
export function randomProgression(
  set: readonly ProgChord[],
  len = PROGRESSION_LEN,
  noRepeat = true,
  home: ProgChord = "I",
): ProgChord[] {
  const out: ProgChord[] = [home];
  while (out.length < len) {
    const prev = out[out.length - 1];
    const options = noRepeat ? set.filter((x) => x !== prev) : [...set];
    out.push(pick(options.length ? options : set));
  }
  return out;
}

// ---------- melodic dictation ----------

/** Melody length levels: start with 3 notes, grow one at a time on the unlock rule. */
export const MELODY_LENGTHS = [3, 4, 5, 6] as const;

/**
 * A short melody from `pcs`, played in C4–B4. No pitch class appears three times
 * in a row, and with two or more notes the melody is never a single repeated note.
 */
export function randomMelody(pcs: readonly PC[], len: number): number[] {
  const out: PC[] = [];
  while (out.length < len) {
    let pc = pick(pcs);
    const n = out.length;
    if (n >= 2 && out[n - 1] === pc && out[n - 2] === pc && pcs.length > 1) pc = pick(pcs.filter((x) => x !== pc));
    out.push(pc);
  }
  if (pcs.length > 1 && out.every((x) => x === out[0])) out[out.length - 1] = pick(pcs.filter((x) => x !== out[0]));
  return out.map((pc) => 60 + pc);
}
