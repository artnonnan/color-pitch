// App state shape, defaults and pure rules (unlocks, streak, week). No React here.
import { defaultChordMoods, defaultNoteColors, type ChordMoods, type NoteColors } from "./colors";
import {
  CHORD_QUALITIES,
  DEGREE_UNLOCK_ORDER,
  FIRST_NOTE_ROTATION,
  INITIAL_DEGREES,
  INITIAL_INTERVALS,
  INTERVALS,
  MODES,
  INITIAL_CHORDS,
  INITIAL_NOTES,
  INITIAL_NUMERALS,
  MELODY_LENGTHS,
  NOTE_UNLOCK_ORDER,
  NUMERALS,
  midisOfPc,
  pickWeighted,
  randInt,
  type ChordQuality,
  type Degree,
  type Interval,
  type IntervalDir,
  type Mode,
  type Numeral,
  type ProgChord,
  type PC,
} from "./music";

export const SCHEMA_VERSION = 1;
export const UNLOCK_WINDOW = 30;
export const UNLOCK_ACCURACY = 0.9;
const MAX_LOG = 6000;

/** "mix" changes the voice every question, so pitch is learned apart from timbre. */
export type Instrument = "piano" | "sine" | "mix";
export type Theme = "dark" | "light";

export interface Settings {
  noteColors: NoteColors;
  chordMoods: ChordMoods;
  instrument: Instrument;
  /** Lowest and highest MIDI note the quiz may play. Default C3–C5. */
  lowMidi: number;
  highMidi: number;
  theme: Theme;
  hardMode: boolean;
  /** Direction of the two notes in the interval exercise. */
  intervalDir: IntervalDir;
}

export interface NoteAnswer {
  t: number; // epoch ms
  target: PC;
  answer: PC;
  ms: number; // response time
}
export interface ChordAnswer {
  t: number;
  target: ChordQuality;
  answer: ChordQuality;
  ms: number;
}
export interface ModeAnswer {
  t: number;
  target: Mode;
  answer: Mode;
  /** Level the question was asked at (0–3). Missing on answers from before levels existed. */
  level?: number;
  /** Compared the choices before answering: logged, never counts toward levels. */
  hinted?: boolean;
}
export interface FirstNoteEntry {
  target: PC;
  /** Signed cents off the target pitch class, folded to ±600. null if skipped. */
  cents: number | null;
  method: "mic" | "slider" | "skip";
  freq?: number;
}
export interface TunerEntry {
  t: number;
  guess: PC;
  actual: PC;
  cents: number;
  freq: number;
}
export interface SingEntry {
  t: number;
  target: PC;
  /** Signed cents from the target pitch class (±600); null when answered by tapping. */
  cents: number | null;
  answer: PC;
}
export interface RootAnswer {
  t: number;
  target: PC;
  answer: PC;
  quality: ChordQuality;
}
export interface DegreeAnswer {
  t: number;
  /** Tonic pitch class of the key the cadence set up. */
  key: PC;
  target: Degree;
  answer: Degree;
  ms: number;
  /** Heard the walk home before answering: logged, never counts toward unlocks. */
  hinted?: boolean;
}
export interface IntervalAnswer {
  t: number;
  target: Interval;
  answer: Interval;
  dir: Exclude<IntervalDir, "mix">;
  /** Lower note's pitch class. */
  low: PC;
  ms: number;
  /** Compared candidate intervals before answering: logged, never counts toward unlocks. */
  hinted?: boolean;
}
/** One chord slot of a progression (the player names chords 2–4, one entry each). */
export interface ProgressionChordAnswer {
  t: number;
  key: PC;
  /** 1-based position in the progression (2–4; position 1 is always I). */
  pos: number;
  target: ProgChord;
  answer: ProgChord;
  /** Level the question was asked at (0–6). Missing on answers from before levels existed. */
  level?: number;
  /** The player opened the hint (heard I→IV / I→V) first: logged, but never counts toward unlocks. */
  hinted?: boolean;
  /** Asked in a level-skip test: logged, never counts toward the normal accuracy window. */
  test?: boolean;
}
/** One note slot of a dictated melody. */
export interface MelodyNoteAnswer {
  t: number;
  /** Melody length this note belonged to. */
  len: number;
  pos: number;
  target: PC;
  answer: PC;
}
/** One Color Rain game. */
export interface RainRun {
  t: number;
  score: number;
  caught: number;
  missed: number;
  wrong: number;
  maxCombo: number;
  /** Gray drops: the color was hidden, so only the sound told the note. */
  gray: boolean;
  /** Seconds survived. */
  secs: number;
}
/** One "ผสมสีคอร์ด" answer: the player taps every note of a chord. */
export interface MixChordAnswer {
  t: number;
  root: PC;
  quality: ChordQuality;
  /** Pitch classes in the chord. */
  target: PC[];
  /** Pitch classes the player tapped. */
  answer: PC[];
}
/** One "ทายจากสี" answer: see a color, pick the matching sound among `options`. */
export interface ColorPickAnswer {
  t: number;
  target: PC;
  answer: PC;
  options: PC[];
  ms: number;
}
/** One finished memory-match board. */
export interface MatchGame {
  t: number;
  pairs: number;
  /** Pairs of cards turned over (a perfect game = pairs). */
  moves: number;
  ms: number;
  /** Colors shown when a card is turned (easy) or only after a match (hard). */
  colors: boolean;
}
export interface RushRun {
  t: number;
  score: number;
  correct: number;
  total: number;
  maxCombo: number;
}
export type SessionStep = "first" | "quiz" | "chords";

export interface Progress {
  startDate: string; // YYYY-MM-DD of first launch
  notesUnlocked: number; // count into NOTE_UNLOCK_ORDER
  notesSetSince: number; // epoch ms the current note set began (answers before don't count)
  chordsUnlocked: number; // count into CHORD_QUALITIES
  chordsSetSince: number;
  noteAnswers: NoteAnswer[];
  chordAnswers: ChordAnswer[];
  modeAnswers: ModeAnswer[];
  firstNote: Record<string, FirstNoteEntry>; // by date
  tuner: TunerEntry[];
  practiceSeconds: Record<string, number>; // by date
  sessionDone: Record<string, SessionStep[]>; // by date
  sing: SingEntry[];
  roots: RootAnswer[];
  rush: RushRun[];
  rain: RainRun[];
  mixChords: MixChordAnswer[];
  matchGames: MatchGame[];
  colorPicks: ColorPickAnswer[];
  /** Extra options above 2 in "ทายจากสี" (0 → 2 options … 2 → 4 options). */
  colorPickLevel: number;
  colorPickSince: number;
  degreesUnlocked: number; // count into DEGREE_UNLOCK_ORDER
  degreesSetSince: number;
  degrees: DegreeAnswer[];
  intervalsUnlocked: number; // count into INTERVALS
  intervalsSetSince: number;
  intervals: IntervalAnswer[];
  numeralsUnlocked: number; // count into NUMERALS
  numeralsSetSince: number;
  progressions: ProgressionChordAnswer[];
  progLevel: number; // index into PROG_LEVELS
  progLevelSince: number;
  /** The intro lesson (I = home, V = tension, IV = open) was finished once. */
  progLessonSeen: boolean;
  intervalLessonSeen: boolean;
  modeLevel: number; // index into MODE_LEVELS
  modeLevelSince: number;
  modeLessonSeen: boolean;
  degreeLessonSeen: boolean;
  melodyLevel: number; // index into MELODY_LENGTHS
  melodySetSince: number;
  melodies: MelodyNoteAnswer[];
}

export interface AppState {
  version: number;
  settings: Settings;
  progress: Progress;
}

/** Local calendar date (not UTC) — the user's "day". */
export function dayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
export function parseDay(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function daysBetween(a: string, b: string): number {
  return Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86400000);
}
export function addDays(key: string, n: number): string {
  const d = parseDay(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

export function defaultSettings(): Settings {
  return {
    noteColors: defaultNoteColors(),
    chordMoods: defaultChordMoods(),
    instrument: "piano",
    lowMidi: 48, // C3
    highMidi: 72, // C5
    theme: "dark",
    hardMode: false,
    intervalDir: "up",
  };
}
export function defaultProgress(): Progress {
  return {
    startDate: dayKey(),
    notesUnlocked: INITIAL_NOTES,
    notesSetSince: 0,
    chordsUnlocked: INITIAL_CHORDS,
    chordsSetSince: 0,
    noteAnswers: [],
    chordAnswers: [],
    modeAnswers: [],
    firstNote: {},
    tuner: [],
    practiceSeconds: {},
    sessionDone: {},
    sing: [],
    roots: [],
    rush: [],
    rain: [],
    mixChords: [],
    matchGames: [],
    colorPicks: [],
    colorPickLevel: 0,
    colorPickSince: 0,
    degreesUnlocked: INITIAL_DEGREES,
    degreesSetSince: 0,
    degrees: [],
    intervalsUnlocked: INITIAL_INTERVALS,
    intervalsSetSince: 0,
    intervals: [],
    numeralsUnlocked: INITIAL_NUMERALS,
    numeralsSetSince: 0,
    progressions: [],
    progLevel: 0,
    progLevelSince: 0,
    progLessonSeen: false,
    intervalLessonSeen: false,
    modeLevel: 0,
    modeLevelSince: 0,
    modeLessonSeen: false,
    degreeLessonSeen: false,
    melodyLevel: 0,
    melodySetSince: 0,
    melodies: [],
  };
}
export function defaultState(): AppState {
  return { version: SCHEMA_VERSION, settings: defaultSettings(), progress: defaultProgress() };
}

/** Merge a loaded/imported object over defaults so missing fields never crash the app. */
export function normalizeState(raw: unknown): AppState {
  const base = defaultState();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<AppState>;
  const s = (r.settings ?? {}) as Partial<Settings>;
  const p = (r.progress ?? {}) as Partial<Progress>;
  const arr = <T,>(v: unknown, d: T[]): T[] => (Array.isArray(v) ? (v as T[]) : d);
  const obj = <T extends object>(v: unknown, d: T): T => (v && typeof v === "object" && !Array.isArray(v) ? (v as T) : d);
  return {
    version: SCHEMA_VERSION,
    settings: {
      ...base.settings,
      ...s,
      noteColors: { ...base.settings.noteColors, ...obj(s.noteColors, {}) },
      chordMoods: Object.fromEntries(
        CHORD_QUALITIES.map((q) => [q, { ...base.settings.chordMoods[q], ...obj(s.chordMoods?.[q], {}) }]),
      ) as ChordMoods,
    },
    progress: {
      ...base.progress,
      ...p,
      noteAnswers: arr(p.noteAnswers, []),
      chordAnswers: arr(p.chordAnswers, []),
      modeAnswers: arr(p.modeAnswers, []),
      tuner: arr(p.tuner, []),
      firstNote: obj(p.firstNote, {}),
      practiceSeconds: obj(p.practiceSeconds, {}),
      sessionDone: obj(p.sessionDone, {}),
      sing: arr(p.sing, []),
      roots: arr(p.roots, []),
      rush: arr(p.rush, []),
      rain: arr(p.rain, []),
      mixChords: arr(p.mixChords, []),
      matchGames: arr(p.matchGames, []),
      colorPicks: arr(p.colorPicks, []),
      degrees: arr(p.degrees, []),
      intervals: arr(p.intervals, []),
      progressions: arr(p.progressions, []),
      melodies: arr(p.melodies, []),
    },
  };
}

// ---------- derived values ----------

export const unlockedNotes = (p: Progress): PC[] => NOTE_UNLOCK_ORDER.slice(0, p.notesUnlocked);
export const unlockedChords = (p: Progress): ChordQuality[] => CHORD_QUALITIES.slice(0, p.chordsUnlocked);
export const unlockedDegrees = (p: Progress): Degree[] => DEGREE_UNLOCK_ORDER.slice(0, p.degreesUnlocked);
export const unlockedIntervals = (p: Progress): Interval[] => INTERVALS.slice(0, p.intervalsUnlocked);
export const unlockedNumerals = (p: Progress): Numeral[] => NUMERALS.slice(0, p.numeralsUnlocked);

/**
 * Chord progression levels, easiest first. Each moves on by the usual 30-answer, >= 90 %
 * rule. Level index 3 also unlocks vi, ii and iii one at a time before moving on.
 *   0: I then one chord, IV or V           (2 choices, 1 answer)
 *   1: I then one chord, I, IV or V        (3 choices, 1 answer)
 *   2: three chords from I, IV, V          (2 answers)
 *   3: four chords from the unlocked set   (3 answers)
 *   4: minor key: i iv v III VI VII
 *   5: seventh chords: Imaj7 ii7 IVmaj7 V7 vi7
 *   6: borrowed and secondary chords: IV V ♭VII iv ♭VI V/V
 */
export const PROG_LEVELS: { len: number; choices: ProgChord[] | null; home: ProgChord; minor?: boolean }[] = [
  { len: 2, choices: ["IV", "V"], home: "I" },
  { len: 2, choices: ["I", "IV", "V"], home: "I" },
  { len: 3, choices: ["I", "IV", "V"], home: "I" },
  { len: 4, choices: null, home: "I" },
  { len: 4, choices: ["i", "iv", "v", "III", "VI", "VII"], home: "i", minor: true },
  { len: 4, choices: ["Imaj7", "ii7", "IVmaj7", "V7", "vi7"], home: "Imaj7" },
  { len: 4, choices: ["IV", "V", "bVII", "iv", "bVI", "VofV"], home: "I" },
];
/** The level where vi, ii and iii unlock. */
export const PROG_NUMERAL_LEVEL = 3;
export const PROG_LAST_LEVEL = PROG_LEVELS.length - 1;
export function progSpec(
  p: Progress,
  at?: number,
): { level: number; len: number; choices: ProgChord[]; home: ProgChord; minor: boolean } {
  const level = Math.min(Math.max((at ?? p.progLevel) | 0, 0), PROG_LAST_LEVEL);
  const L = PROG_LEVELS[level];
  const choices = L.choices ?? (level === PROG_NUMERAL_LEVEL && at !== undefined && at > p.progLevel ? [...NUMERALS] : unlockedNumerals(p));
  return { level, len: L.len, choices, home: L.home, minor: !!L.minor };
}
export const melodyLength = (p: Progress): number =>
  MELODY_LENGTHS[Math.min(Math.max(p.melodyLevel, 0), MELODY_LENGTHS.length - 1)];

/** 1-based training week since first launch (guidance only). */
export function currentWeek(p: Progress, today = dayKey()): number {
  return Math.max(1, Math.floor(daysBetween(p.startDate, today) / 7) + 1);
}
/** Mode brightness opens in week 4, or once all 7 white keys are unlocked. */
export const modesUnlocked = (p: Progress) => currentWeek(p) >= 4 || p.notesUnlocked >= 7;

/**
 * Mode levels, easiest first. Each moves on by the 30-answer, >= 90 % rule.
 *   0: bright or dark: Ionian vs Aeolian (the third decides)
 *   1: the bright family: Lydian, Ionian, Mixolydian (one note apart)
 *   2: the dark family: Dorian, Aeolian, Phrygian (one note apart)
 *   3: all seven on the brightness slider (exact position counts)
 */
export const MODE_LEVELS: { modes: Mode[] }[] = [
  { modes: ["ionian", "aeolian"] },
  { modes: ["lydian", "ionian", "mixolydian"] },
  { modes: ["dorian", "aeolian", "phrygian"] },
  { modes: [...MODES] },
];
export const MODE_LAST_LEVEL = MODE_LEVELS.length - 1;
export const modeLevelOf = (p: Progress) => Math.min(Math.max(p.modeLevel | 0, 0), MODE_LAST_LEVEL);
export const recentModeAccuracy = (p: Progress) =>
  recent(
    p.modeAnswers.filter((a) => !a.hinted && (a.level ?? MODE_LAST_LEVEL) === modeLevelOf(p)),
    p.modeLevelSince,
    (a) => a.target === a.answer,
  );
/** Record a mode answer; returns the new level if this answer completed the current one. */
export function recordModeAnswer(p: Progress, a: ModeAnswer): { progress: Progress; levelUp: number | null } {
  let next: Progress = { ...p, modeAnswers: capped(p.modeAnswers, a) };
  if (a.hinted || modeLevelOf(next) >= MODE_LAST_LEVEL) return { progress: next, levelUp: null };
  if (meetsUnlock(recentModeAccuracy(next))) {
    const levelUp = modeLevelOf(next) + 1;
    next = { ...next, modeLevel: levelUp, modeLevelSince: a.t + 1 };
    return { progress: next, levelUp };
  }
  return { progress: next, levelUp: null };
}

export function firstNoteTarget(p: Progress, today = dayKey()): PC {
  return FIRST_NOTE_ROTATION[(currentWeek(p, today) - 1) % FIRST_NOTE_ROTATION.length];
}

/** Days count as trained when any practice time or any exercise result was logged. */
export function trainedDays(p: Progress): Set<string> {
  const days = new Set<string>();
  for (const [d, s] of Object.entries(p.practiceSeconds)) if (s >= 30) days.add(d);
  for (const [d, steps] of Object.entries(p.sessionDone)) if (steps.length) days.add(d);
  for (const [d, e] of Object.entries(p.firstNote)) if (e.method !== "skip") days.add(d);
  return days;
}
/** Consecutive trained days ending today (or yesterday, if today isn't trained yet). */
export function streak(p: Progress, today = dayKey()): number {
  const days = trainedDays(p);
  let cursor = days.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (days.has(cursor)) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}

export interface RecentAccuracy {
  n: number;
  correct: number;
  pct: number;
}
function recent<T extends { t: number }>(log: T[], since: number, ok: (x: T) => boolean): RecentAccuracy {
  const win = log.filter((a) => a.t >= since).slice(-UNLOCK_WINDOW);
  const correct = win.filter(ok).length;
  return { n: win.length, correct, pct: win.length ? Math.round((correct / win.length) * 100) : 0 };
}
export const recentNoteAccuracy = (p: Progress) =>
  recent(p.noteAnswers, p.notesSetSince, (a) => a.target === a.answer);
export const recentChordAccuracy = (p: Progress) =>
  recent(p.chordAnswers, p.chordsSetSince, (a) => a.target === a.answer);

export const recentDegreeAccuracy = (p: Progress) =>
  recent(p.degrees.filter((a) => !a.hinted), p.degreesSetSince, (a) => a.target === a.answer);
export const recentIntervalAccuracy = (p: Progress) =>
  recent(p.intervals.filter((a) => !a.hinted), p.intervalsSetSince, (a) => a.target === a.answer);

export const recentProgressionAccuracy = (p: Progress) =>
  recent(
    p.progressions.filter((a) => !a.hinted && !a.test),
    p.progLevel === PROG_NUMERAL_LEVEL ? p.numeralsSetSince : p.progLevelSince,
    (a) => a.target === a.answer,
  );
export const recentMelodyAccuracy = (p: Progress) =>
  recent(p.melodies, p.melodySetSince, (a) => a.target === a.answer);

const meetsUnlock = (r: RecentAccuracy) => r.n >= UNLOCK_WINDOW && r.correct / r.n >= UNLOCK_ACCURACY;

// ---------- reducers (pure: return a new Progress) ----------

const capped = <T,>(arr: T[], item: T) => {
  const next = [...arr, item];
  return next.length > MAX_LOG ? next.slice(next.length - MAX_LOG) : next;
};

/** Record a quiz answer; returns the new progress and the newly unlocked note, if any. */
export function recordNoteAnswer(p: Progress, a: NoteAnswer): { progress: Progress; unlocked: PC | null } {
  let next: Progress = { ...p, noteAnswers: capped(p.noteAnswers, a) };
  if (next.notesUnlocked < NOTE_UNLOCK_ORDER.length && meetsUnlock(recentNoteAccuracy(next))) {
    const unlocked = NOTE_UNLOCK_ORDER[next.notesUnlocked];
    next = { ...next, notesUnlocked: next.notesUnlocked + 1, notesSetSince: a.t + 1 };
    return { progress: next, unlocked };
  }
  return { progress: next, unlocked: null };
}
export function recordChordAnswer(
  p: Progress,
  a: ChordAnswer,
): { progress: Progress; unlocked: ChordQuality | null } {
  let next: Progress = { ...p, chordAnswers: capped(p.chordAnswers, a) };
  if (next.chordsUnlocked < CHORD_QUALITIES.length && meetsUnlock(recentChordAccuracy(next))) {
    const unlocked = CHORD_QUALITIES[next.chordsUnlocked];
    next = { ...next, chordsUnlocked: next.chordsUnlocked + 1, chordsSetSince: a.t + 1 };
    return { progress: next, unlocked };
  }
  return { progress: next, unlocked: null };
}
export function recordDegreeAnswer(p: Progress, a: DegreeAnswer): { progress: Progress; unlocked: Degree | null } {
  let next: Progress = { ...p, degrees: capped(p.degrees, a) };
  if (a.hinted) return { progress: next, unlocked: null };
  if (next.degreesUnlocked < DEGREE_UNLOCK_ORDER.length && meetsUnlock(recentDegreeAccuracy(next))) {
    const unlocked = DEGREE_UNLOCK_ORDER[next.degreesUnlocked];
    next = { ...next, degreesUnlocked: next.degreesUnlocked + 1, degreesSetSince: a.t + 1 };
    return { progress: next, unlocked };
  }
  return { progress: next, unlocked: null };
}
export function recordIntervalAnswer(
  p: Progress,
  a: IntervalAnswer,
): { progress: Progress; unlocked: Interval | null } {
  let next: Progress = { ...p, intervals: capped(p.intervals, a) };
  if (a.hinted) return { progress: next, unlocked: null };
  if (next.intervalsUnlocked < INTERVALS.length && meetsUnlock(recentIntervalAccuracy(next))) {
    const unlocked = INTERVALS[next.intervalsUnlocked];
    next = { ...next, intervalsUnlocked: next.intervalsUnlocked + 1, intervalsSetSince: a.t + 1 };
    return { progress: next, unlocked };
  }
  return { progress: next, unlocked: null };
}
/**
 * Record every named chord of one progression. Hinted and test answers are logged but never
 * count. Returns the new level, or the newly unlocked chord (vi, ii, iii at level index 3).
 */
export function recordProgression(
  p: Progress,
  answers: ProgressionChordAnswer[],
): { progress: Progress; unlocked: Numeral | null; levelUp: number | null } {
  let next: Progress = p;
  let unlocked: Numeral | null = null;
  let levelUp: number | null = null;
  for (const a of answers) {
    next = { ...next, progressions: capped(next.progressions, a) };
    if (a.hinted || a.test || unlocked || levelUp !== null) continue;
    if (next.progLevel >= PROG_LAST_LEVEL || !meetsUnlock(recentProgressionAccuracy(next))) continue;
    // The rest of this progression shares the timestamp, so it counts toward the old set.
    if (next.progLevel === PROG_NUMERAL_LEVEL && next.numeralsUnlocked < NUMERALS.length) {
      unlocked = NUMERALS[next.numeralsUnlocked];
      next = { ...next, numeralsUnlocked: next.numeralsUnlocked + 1, numeralsSetSince: a.t + 1 };
    } else {
      levelUp = next.progLevel + 1;
      next = { ...next, progLevel: levelUp, progLevelSince: a.t + 1, numeralsSetSince: a.t + 1 };
    }
  }
  return { progress: next, unlocked, levelUp };
}

/** Pass mark for a level-skip test: 9 of 10 progressions fully right, no hints. */
export const SKIP_TEST_ROUNDS = 10;
export const SKIP_TEST_PASS = 9;
/** A passed skip test moves the player to `level`; passing beyond the unlock level unlocks all six triads. */
export function passSkipTest(p: Progress, level: number, t = Date.now()): Progress {
  if (level <= p.progLevel) return p;
  return {
    ...p,
    progLevel: Math.min(level, PROG_LAST_LEVEL),
    progLevelSince: t,
    numeralsSetSince: t,
    numeralsUnlocked: level > PROG_NUMERAL_LEVEL ? NUMERALS.length : p.numeralsUnlocked,
  };
}

/** Record every note of one dictated melody; returns the new melody length if it grew. */
export function recordMelody(
  p: Progress,
  answers: MelodyNoteAnswer[],
): { progress: Progress; grewTo: number | null } {
  let next: Progress = p;
  let grewTo: number | null = null;
  for (const a of answers) {
    next = { ...next, melodies: capped(next.melodies, a) };
    if (grewTo === null && next.melodyLevel < MELODY_LENGTHS.length - 1 && meetsUnlock(recentMelodyAccuracy(next))) {
      next = { ...next, melodyLevel: next.melodyLevel + 1, melodySetSince: a.t + 1 };
      grewTo = MELODY_LENGTHS[next.melodyLevel];
    }
  }
  return { progress: next, grewTo };
}
export const rushBest = (p: Progress) => p.rush.reduce((m, r) => Math.max(m, r.score), 0);
export const rainBest = (p: Progress) => p.rain.reduce((m, r) => Math.max(m, r.score), 0);
/** Fewest moves for a full board of `pairs` pairs (0 = never finished). */
export const matchBest = (p: Progress, pairs: number) =>
  p.matchGames.filter((g) => g.pairs === pairs).reduce((m, g) => (m === 0 ? g.moves : Math.min(m, g.moves)), 0);
export const COLOR_PICK_MAX_LEVEL = 2;
export const colorPickOptions = (p: Progress) => 2 + Math.min(Math.max(p.colorPickLevel | 0, 0), COLOR_PICK_MAX_LEVEL);
export const recentColorPickAccuracy = (p: Progress) =>
  recent(p.colorPicks, p.colorPickSince, (a) => a.answer === a.target);
/** Record a color-pick answer; returns the new option count if it grew. */
export function recordColorPick(p: Progress, a: ColorPickAnswer): { progress: Progress; grewTo: number | null } {
  let next: Progress = { ...p, colorPicks: capped(p.colorPicks, a) };
  if (next.colorPickLevel < COLOR_PICK_MAX_LEVEL && meetsUnlock(recentColorPickAccuracy(next))) {
    next = { ...next, colorPickLevel: next.colorPickLevel + 1, colorPickSince: a.t + 1 };
    return { progress: next, grewTo: colorPickOptions(next) };
  }
  return { progress: next, grewTo: null };
}
export const mixChordCorrect = (a: MixChordAnswer) =>
  a.answer.length === a.target.length && a.target.every((pc) => a.answer.includes(pc));
export const appendCapped = <T,>(arr: T[], item: T) => capped(arr, item);

export function markStepDone(p: Progress, step: SessionStep, today = dayKey()): Progress {
  const cur = p.sessionDone[today] ?? [];
  if (cur.includes(step)) return p;
  return { ...p, sessionDone: { ...p.sessionDone, [today]: [...cur, step] } };
}
export function addPractice(p: Progress, seconds: number, today = dayKey()): Progress {
  return {
    ...p,
    practiceSeconds: { ...p.practiceSeconds, [today]: (p.practiceSeconds[today] ?? 0) + seconds },
  };
}

/**
 * Pick the next quiz note: weaker notes and the newest unlock come up more often,
 * and the same note rarely repeats back-to-back.
 */
export function quizWeights(p: Progress, notes: PC[], last: PC | null): number[] {
  const recentLog = p.noteAnswers.slice(-200);
  return notes.map((pc, i) => {
    const mine = recentLog.filter((a) => a.target === pc);
    const acc = mine.length ? mine.filter((a) => a.answer === pc).length / mine.length : 0.5;
    let w = 1 + (1 - acc) * 2;
    if (i === notes.length - 1 && notes.length > 2) w *= 1.6; // newest note
    if (pc === last) w *= 0.35;
    return w;
  });
}

/** Pick the next quiz-style note (weighted by weakness) inside the user's octave range. */
export function pickNoteMidi(s: AppState, last: PC | null): { midi: number; pc: PC } {
  const set = unlockedNotes(s.progress);
  const pc = pickWeighted(set, quizWeights(s.progress, set, last));
  const options = midisOfPc(pc, s.settings.lowMidi, s.settings.highMidi);
  const midi = options.length ? options[randInt(0, options.length - 1)] : 60 + pc;
  return { midi, pc };
}
