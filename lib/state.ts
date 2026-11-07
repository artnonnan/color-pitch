// App state shape, defaults and pure rules (unlocks, streak, week). No React here.
import { defaultChordMoods, defaultNoteColors, type ChordMoods, type NoteColors } from "./colors";
import {
  CHORD_QUALITIES,
  FIRST_NOTE_ROTATION,
  INITIAL_CHORDS,
  INITIAL_NOTES,
  NOTE_UNLOCK_ORDER,
  midisOfPc,
  pickWeighted,
  randInt,
  type ChordQuality,
  type Mode,
  type PC,
} from "./music";

export const SCHEMA_VERSION = 1;
export const UNLOCK_WINDOW = 30;
export const UNLOCK_ACCURACY = 0.9;
const MAX_LOG = 6000;

export type Instrument = "piano" | "sine";
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
    },
  };
}

// ---------- derived values ----------

export const unlockedNotes = (p: Progress): PC[] => NOTE_UNLOCK_ORDER.slice(0, p.notesUnlocked);
export const unlockedChords = (p: Progress): ChordQuality[] => CHORD_QUALITIES.slice(0, p.chordsUnlocked);

/** 1-based training week since first launch (guidance only). */
export function currentWeek(p: Progress, today = dayKey()): number {
  return Math.max(1, Math.floor(daysBetween(p.startDate, today) / 7) + 1);
}
/** Mode brightness opens in week 4, or once all 7 white keys are unlocked. */
export const modesUnlocked = (p: Progress) => currentWeek(p) >= 4 || p.notesUnlocked >= 7;

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
export const rushBest = (p: Progress) => p.rush.reduce((m, r) => Math.max(m, r.score), 0);
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
