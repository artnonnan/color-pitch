"use client";
import { useEffect, useRef, useState } from "react";
import { useStore, usePracticeTimer } from "@/lib/store";
import { colorOf, DEGREE_COLORS, inkOn, type NoteColors, type ChordMoods } from "@/lib/colors";
import {
  NUMERALS,
  PROG_CHORDS,
  nameOf,
  progChordMidis,
  progLabel,
  randInt,
  randomProgression,
  type Numeral,
  type PC,
  type ProgChord,
} from "@/lib/music";
import { newVoice, playChord, playChords, stopAll, wait } from "@/lib/audio";
import {
  PROG_LAST_LEVEL,
  PROG_LEVELS,
  PROG_NUMERAL_LEVEL,
  SKIP_TEST_PASS,
  SKIP_TEST_ROUNDS,
  passSkipTest,
  progSpec,
  recentProgressionAccuracy,
  recordProgression,
  unlockedNotes,
  unlockedNumerals,
  UNLOCK_WINDOW,
} from "@/lib/state";
import { Button, Card, ColorWash, ProgressBar, ScreenHeader, cx } from "../ui";
import { burstFrom, fireworks } from "../fx/Burst";
import { ComboBadge } from "../fx/Celebration";
import { t } from "@/i18n";

const ROUNDS = 10;
const STEP = 1.1; // seconds between chords
const LESSON_TONIC = 48; // C3: the lesson always uses C major
type Phase = "intro" | "lesson" | "playing" | "question" | "feedback" | "summary";
interface Q {
  key: PC; // tonic pitch class (the minor tonic on minor levels)
  tonic: number; // MIDI, C3–B3
  chords: ProgChord[];
  choices: ProgChord[];
  level: number;
  minor: boolean;
}
/** A level-skip test in progress: 10 questions at `level`, `hits` fully right without hints. */
interface Test {
  level: number;
  hits: number;
}

/** Root pitch class of a chord in a key. */
const rootOf = (key: PC, c: ProgChord) => (key + PROG_CHORDS[c].root) % 12;
/** Chord name in the key, e.g. vi in G → "Em", V7 in C → "G7". */
const chordName = (key: PC, c: ProgChord) => nameOf(rootOf(key, c)) + PROG_CHORDS[c].sym;
const playSeq = (tonic: number, seq: ProgChord[]) => playChords(seq.map((c) => progChordMidis(tonic, c)), STEP, STEP * 0.95);

/**
 * Hear chords that start on the home chord and name the rest by function. A short lesson
 * comes first, then seven levels: one chord (IV or V) up to four-chord progressions, then
 * minor keys, seventh chords, and borrowed chords. A level-skip test lets strong players move up.
 */
export function Progressions({ onBack }: { onBack: () => void }) {
  const { state, setProgress, getState } = useStore();
  const { settings, progress } = state;
  usePracticeTimer(true);

  const [phase, setPhase] = useState<Phase>(() => (progress.progLessonSeen ? "intro" : "lesson"));
  const [q, setQ] = useState<Q | null>(null);
  const [picks, setPicks] = useState<ProgChord[]>([]);
  const [hinted, setHinted] = useState(false);
  const [round, setRound] = useState(0);
  const [hits, setHits] = useState(0);
  const [combo, setCombo] = useState(0);
  const [verdict, setVerdict] = useState<{ correct: number; unlocked: Numeral | null; levelUp: number | null } | null>(null);
  const [playingAt, setPlayingAt] = useState<number | null>(null);
  const [wash, setWash] = useState<{ color: string; k: number } | null>(null);
  const [test, setTest] = useState<Test | null>(null);
  const [testResult, setTestResult] = useState<{ level: number; hits: number; passed: boolean } | null>(null);
  const k = useRef(0);
  const qid = useRef(0);
  const timer = useRef<number | null>(null);
  const roundRef = useRef(0);
  const hitsRef = useRef(0);
  const testRef = useRef<Test | null>(null);

  useEffect(
    () => () => {
      qid.current++;
      if (timer.current) window.clearTimeout(timer.current);
      stopAll();
    },
    [],
  );

  /** Play the progression and light each slot as its chord sounds. */
  const playProgression = async (x: Q, id: number) => {
    await playSeq(x.tonic, x.chords);
    for (let i = 0; i < x.chords.length; i++) {
      if (id !== qid.current) return;
      setPlayingAt(i);
      await wait(STEP * 1000);
    }
    if (id === qid.current) setPlayingAt(null);
  };

  const playQuestion = async (x: Q) => {
    const id = qid.current;
    setPhase("playing");
    await playProgression(x, id);
    if (id !== qid.current) return;
    setPhase("question");
  };

  const ask = () => {
    qid.current++;
    newVoice();
    const spec = progSpec(getState().progress, testRef.current?.level);
    const key = randInt(0, 11);
    const x: Q = {
      key,
      tonic: 48 + key,
      chords: randomProgression(spec.choices, spec.len, spec.len > 2, spec.home),
      choices: spec.choices,
      level: spec.level,
      minor: spec.minor,
    };
    (window as unknown as { __cpQuestion?: unknown }).__cpQuestion = { kind: "progression", ...x, test: !!testRef.current };
    setQ(x);
    setPicks([]);
    setHinted(false);
    setVerdict(null);
    roundRef.current++;
    setRound(roundRef.current);
    void playQuestion(x);
  };

  const startSet = (testLevel?: number) => {
    roundRef.current = 0;
    hitsRef.current = 0;
    setHits(0);
    setCombo(0);
    setTestResult(null);
    const tst = testLevel !== undefined ? { level: testLevel, hits: 0 } : null;
    testRef.current = tst;
    setTest(tst);
    ask();
  };

  const finishLesson = () => {
    setProgress((p) => (p.progLessonSeen ? p : { ...p, progLessonSeen: true }));
    stopAll();
    startSet();
  };

  const grade = (x: Q, ans: ProgChord[]) => {
    const now = Date.now();
    const need = x.chords.length - 1;
    const inTest = !!testRef.current;
    const answers = ans.map((a, i) => ({
      t: now,
      key: x.key,
      pos: i + 2,
      target: x.chords[i + 1],
      answer: a,
      level: x.level,
      ...(hinted ? { hinted: true } : {}),
      ...(inTest ? { test: true } : {}),
    }));
    const correct = answers.filter((a) => a.answer === a.target).length;
    let unlocked: Numeral | null = null;
    let levelUp: number | null = null;
    setProgress((p) => {
      const r = recordProgression(p, answers);
      unlocked = r.unlocked;
      levelUp = r.levelUp;
      return r.progress;
    });
    const u = unlocked as Numeral | null;
    const lv = levelUp as number | null;
    const all = correct === need;
    if (inTest && all && !hinted) testRef.current = { ...testRef.current!, hits: testRef.current!.hits + 1 };
    if (inTest) setTest(testRef.current);
    k.current++;
    setVerdict({ correct, unlocked: u, levelUp: lv });
    setPhase("feedback");
    setWash({ color: colorOf(settings.noteColors, rootOf(x.key, x.chords[need])), k: k.current });
    if (all) {
      hitsRef.current++;
      setHits(hitsRef.current);
      setCombo((c) => c + 1);
      burstFrom(
        document.querySelector('[data-testid="progressions-slots"]'),
        x.chords.map((c) => colorOf(settings.noteColors, rootOf(x.key, c))),
        1.2 + combo / 4,
      );
    } else {
      setCombo(0);
    }
    if (u) window.setTimeout(() => fireworks([DEGREE_COLORS[PROG_CHORDS[u].deg], "#ffffff"], 6), 200);
    if (lv !== null) window.setTimeout(() => fireworks([DEGREE_COLORS[1], DEGREE_COLORS[4], DEGREE_COLORS[5], "#ffffff"], 7), 200);
    // Hear it again with the names showing, so the sound and the function connect.
    const id = qid.current;
    void wait(500).then(() => (id === qid.current ? playProgression(x, id) : undefined));
    timer.current = window.setTimeout(next, 900 + x.chords.length * STEP * 1000 + 1200);
  };

  const choose = (c: ProgChord) => {
    if (phase !== "question" || !q) return;
    const need = q.chords.length - 1;
    if (picks.length >= need) return;
    const nextPicks = [...picks, c];
    setPicks(nextPicks);
    if (nextPicks.length === need) grade(q, nextPicks);
  };

  /** Tap a slot to hear just that chord again. */
  const hearSlot = (i: number) => {
    if (!q || (phase !== "question" && phase !== "feedback")) return;
    void playChord(progChordMidis(q.tonic, q.chords[i]), STEP);
  };

  function next() {
    if (timer.current) window.clearTimeout(timer.current);
    const tst = testRef.current;
    const total = tst ? SKIP_TEST_ROUNDS : ROUNDS;
    if (roundRef.current >= total) {
      qid.current++;
      setPlayingAt(null);
      setPhase("summary");
      if (tst) {
        const passed = tst.hits >= SKIP_TEST_PASS;
        setTestResult({ level: tst.level, hits: tst.hits, passed });
        if (passed) {
          setProgress((p) => passSkipTest(p, tst.level));
          fireworks([DEGREE_COLORS[1], DEGREE_COLORS[4], DEGREE_COLORS[5], DEGREE_COLORS[6], "#ffffff"], 10);
        }
        testRef.current = null;
        setTest(null);
      } else if (hitsRef.current >= ROUNDS * 0.8) {
        fireworks(unlockedNotes(getState().progress).map((pc) => colorOf(settings.noteColors, pc)), 6);
      }
      return;
    }
    ask();
  }

  const spec = progSpec(progress);
  const acc = recentProgressionAccuracy(progress);
  const done = spec.level >= PROG_LAST_LEVEL;
  const active = phase === "playing" || phase === "question" || phase === "feedback";
  const need = q ? q.chords.length - 1 : spec.len - 1;
  const total = test ? SKIP_TEST_ROUNDS : ROUNDS;
  // The unlock level shows all six triads with locks; every other level shows only its own choices.
  const atNumeralLevel = q?.level === PROG_NUMERAL_LEVEL && !test;
  const grid: ProgChord[] = q ? (atNumeralLevel ? [...NUMERALS] : q.choices) : [];
  const unlockedSet: ProgChord[] = q ? (atNumeralLevel ? unlockedNumerals(progress) : q.choices) : [];
  const nextLevel = spec.level + 1;

  return (
    <div className="flex min-h-[calc(100dvh-1rem)] flex-col">
      <ScreenHeader
        title={t.exercises.progressions.title}
        onBack={onBack}
        sub={
          phase === "intro" || phase === "lesson"
            ? t.progressions.level(spec.level + 1, PROG_LEVELS.length)
            : `${test ? `${t.progressions.testing(test.level + 1)} · ` : ""}${t.progressions.round(Math.min(Math.max(round, 1), total), total)}`
        }
      />
      {wash && <ColorWash color={wash.color} k={wash.k} />}
      <div className="relative z-[11] flex flex-1 flex-col gap-4">
        {phase === "lesson" ? (
          <Lesson colors={settings.noteColors} onBegin={finishLesson} />
        ) : (
          <>
            <Card className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-bold" data-testid="progressions-level">
                  {test ? t.progressions.testing(test.level + 1) : t.progressions.level(spec.level + 1, PROG_LEVELS.length)}
                </span>
                <span className="text-right text-xs text-ink-3">{t.progressions.levelDesc[test ? test.level : spec.level]}</span>
              </div>
              {test ? (
                <div className="text-sm text-ink-2" data-testid="progressions-test-score">
                  {t.progressions.testScore(test.hits, SKIP_TEST_PASS)}
                </div>
              ) : (
                !done && (
                  <>
                    <div className="text-sm text-ink-2">
                      {acc.n
                        ? t.progressions.accuracyRecent(acc.pct, acc.n)
                        : spec.level === PROG_NUMERAL_LEVEL && progress.numeralsUnlocked < NUMERALS.length
                          ? t.progressions.unlockNeed
                          : t.progressions.levelNeed}
                    </div>
                    <ProgressBar value={acc.n >= UNLOCK_WINDOW ? acc.pct / 100 / 0.9 : acc.n / UNLOCK_WINDOW} />
                  </>
                )
              )}
            </Card>

            <div className="flex min-h-44 flex-1 flex-col items-center justify-center gap-3 text-center">
              {phase === "intro" && (
                <>
                  <div className="text-6xl">🛤️</div>
                  <p className="text-ink-2">{t.exercises.progressions.desc}</p>
                  <Button big onClick={() => startSet()} className="pulse-ring" data-testid="progressions-start">
                    ▶ {t.start}
                  </Button>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button variant="ghost" onClick={() => setPhase("lesson")} data-testid="progressions-lesson-open">
                      📖 {t.progressions.lessonOpen}
                    </Button>
                    {!done && (
                      <Button variant="secondary" onClick={() => startSet(nextLevel)} data-testid="progressions-skip">
                        🚀 {t.progressions.skipTest(nextLevel + 1)}
                      </Button>
                    )}
                  </div>
                  {!done && <p className="text-xs text-ink-3">{t.progressions.skipHint(SKIP_TEST_PASS, SKIP_TEST_ROUNDS)}</p>}
                </>
              )}

              {active && q && (
                <>
                  <div className="h-9">{phase !== "feedback" && <ComboBadge combo={combo} />}</div>
                  {phase === "feedback" && verdict && (
                    <div className={cx("pop text-3xl font-black", verdict.correct === need ? "text-good" : "text-bad")}>
                      {verdict.levelUp !== null
                        ? `🔓 ${t.progressions.levelUp(verdict.levelUp + 1)}`
                        : verdict.unlocked
                          ? `🔓 ${t.progressions.unlocked(verdict.unlocked)}`
                          : verdict.correct === need
                            ? t.progressions.correct
                            : t.progressions.partial(verdict.correct, need)}
                    </div>
                  )}
                  <Slots
                    q={q}
                    picks={picks}
                    reveal={phase === "feedback"}
                    playingAt={playingAt}
                    colors={settings.noteColors}
                    moods={settings.chordMoods}
                    onTap={hearSlot}
                  />
                  {phase === "feedback" ? (
                    <button className="space-y-1" onClick={next} data-testid="progressions-feedback">
                      <div className="text-sm text-ink-2">
                        {q.minor ? t.progressions.inMinorKey(nameOf(q.key)) : t.progressions.inKey(nameOf(q.key))}
                      </div>
                      {verdict?.levelUp !== null && verdict?.levelUp !== undefined && (
                        <div className="text-sm font-bold text-accent">{t.progressions.levelDesc[verdict.levelUp]}</div>
                      )}
                      <div className="text-xs text-ink-3">{t.next} ›</div>
                    </button>
                  ) : (
                    <>
                      <p className="text-ink-2">{phase === "playing" ? t.progressions.playing : t.progressions.listenFrom(progLabel(q.chords[0]), need)}</p>
                      {phase === "question" && <p className="text-xs text-ink-3">{t.progressions.tapSlot}</p>}
                      <div className="flex flex-wrap justify-center gap-2">
                        <Button variant="secondary" disabled={phase !== "question"} onClick={() => void playQuestion(q)}>
                          ↻ {t.progressions.replay}
                        </Button>
                        <Button variant="secondary" disabled={phase !== "question"} onClick={() => setHinted(true)} data-testid="progressions-hint">
                          💡 {t.progressions.hint}
                        </Button>
                        {need > 1 && (
                          <Button
                            variant="secondary"
                            disabled={phase !== "question" || picks.length === 0}
                            onClick={() => setPicks((p) => p.slice(0, -1))}
                            data-testid="progressions-undo"
                          >
                            ⌫ {t.progressions.undo}
                          </Button>
                        )}
                      </div>
                      {hinted && phase === "question" && (
                        <Card className="w-full space-y-2">
                          <div className="text-sm font-bold">{t.progressions.hintTitleFrom(progLabel(q.chords[0]))}</div>
                          <div className="flex flex-wrap justify-center gap-2" data-testid="progressions-hint-panel">
                            {q.choices.map((c) => (
                              <Button key={c} variant="secondary" data-hint-numeral={c} onClick={() => void playSeq(q.tonic, [q.chords[0], c])}>
                                ▶ {progLabel(q.chords[0])} → {progLabel(c)}
                              </Button>
                            ))}
                          </div>
                          <div className="text-xs text-ink-3">{test ? t.progressions.hintNoteTest : t.progressions.hintNote}</div>
                        </Card>
                      )}
                    </>
                  )}
                </>
              )}

              {phase === "summary" && (
                <div className="w-full space-y-4">
                  {testResult ? (
                    <>
                      <div className="text-6xl">{testResult.passed ? "🚀" : "💪"}</div>
                      <h2 className="text-2xl font-black" data-testid="progressions-test-result">
                        {testResult.passed
                          ? t.progressions.testPass(testResult.level + 1)
                          : t.progressions.testFail(testResult.hits, SKIP_TEST_PASS)}
                      </h2>
                      {testResult.passed && <p className="text-ink-2">{t.progressions.levelDesc[testResult.level]}</p>}
                    </>
                  ) : (
                    <>
                      <div className="text-6xl">{hits >= ROUNDS * 0.8 ? "🏆" : "🎶"}</div>
                      <h2 className="text-2xl font-black">{t.progressions.summaryLine(hits, ROUNDS)}</h2>
                    </>
                  )}
                  <Button big className="w-full" onClick={() => setPhase("intro")} data-testid="progressions-summary-ok">
                    {t.done}
                  </Button>
                </div>
              )}
            </div>

            {active && q && (
              <div className={cx("grid gap-2 pb-[max(1rem,env(safe-area-inset-bottom))]", grid.length === 2 ? "grid-cols-2" : "grid-cols-3")}>
                {grid.map((c) => {
                  const on = unlockedSet.includes(c);
                  const col = DEGREE_COLORS[PROG_CHORDS[c].deg];
                  const label = progLabel(c);
                  return (
                    <button
                      key={c}
                      data-numeral={c}
                      disabled={!on || phase !== "question"}
                      onClick={() => choose(c)}
                      className={cx(
                        "flex flex-col items-center justify-center rounded-3xl px-1 py-2 font-bold transition active:scale-95",
                        grid.length <= 3 ? "min-h-24" : "min-h-20",
                        !on && "opacity-30",
                        phase !== "question" && on && "opacity-60",
                      )}
                      style={
                        on
                          ? { background: `linear-gradient(135deg, color-mix(in srgb, ${col} 65%, #fff), ${col})`, color: inkOn(col) }
                          : { background: "var(--surface-2)", color: "var(--ink-3)" }
                      }
                    >
                      <span className={cx("font-serif leading-none", label.length > 3 ? "text-2xl" : "text-3xl")}>{on ? label : "🔒"}</span>
                      <span className="text-xs font-medium leading-tight opacity-80">{on ? t.progressions.feel[c] : ""}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Intro lesson in C major: I = home, V = tension, IV = open, then free comparison. */
function Lesson({ colors, onBegin }: { colors: NoteColors; onBegin: () => void }) {
  const steps = t.progressions.lesson.steps;
  const [i, setI] = useState(0);
  const [lit, setLit] = useState<number | null>(null);
  const playId = useRef(0);
  const step = steps[i];
  const last = i === steps.length - 1;

  const play = async (seq: ProgChord[]) => {
    const id = ++playId.current;
    await playSeq(LESSON_TONIC, seq);
    for (let j = 0; j < seq.length; j++) {
      if (id !== playId.current) return;
      setLit(j);
      await wait(STEP * 1000);
    }
    if (id === playId.current) setLit(null);
  };
  useEffect(
    () => () => {
      playId.current++;
    },
    [],
  );

  const seq = step.play as ProgChord[];
  const chip = (c: ProgChord, j: number) => {
    const col = colorOf(colors, rootOf(0, c));
    return (
      <span
        key={j}
        className={cx("flex h-16 w-16 flex-col items-center justify-center rounded-2xl font-serif text-2xl font-black transition", lit === j && "scale-110")}
        style={{ background: col, color: inkOn(col), boxShadow: lit === j ? `0 0 24px 4px ${col}` : undefined }}
      >
        {progLabel(c)}
        <span className="font-sans text-[10px] font-bold">{chordName(0, c)}</span>
      </span>
    );
  };

  return (
    <div className="flex flex-1 flex-col gap-4" data-testid="progressions-lesson">
      <Card className="space-y-4 text-center">
        <div className="flex justify-center gap-1.5">
          {steps.map((_, j) => (
            <span key={j} className={cx("h-1.5 w-6 rounded-full", j <= i ? "bg-accent" : "bg-surface-2")} />
          ))}
        </div>
        <h2 className="text-2xl font-black" data-testid="lesson-title">
          {step.title}
        </h2>
        <p className="leading-relaxed text-ink-2">{step.body}</p>
        {seq.length > 0 && (
          <>
            <div className="flex items-center justify-center gap-2">
              {seq.map((c, j) => (
                <span key={j} className="flex items-center gap-2">
                  {j > 0 && <span className="text-ink-3">→</span>}
                  {chip(c, j)}
                </span>
              ))}
            </div>
            <Button big className="w-full" onClick={() => void play(seq)} data-testid="lesson-play">
              ▶ {seq.map(progLabel).join(" → ")}
            </Button>
          </>
        )}
        {last && (
          <div className="grid grid-cols-2 gap-2">
            <Button big variant="secondary" onClick={() => void play(["I", "IV"])} data-testid="lesson-compare-iv">
              ▶ {t.progressions.lesson.compareIV}
            </Button>
            <Button big variant="secondary" onClick={() => void play(["I", "V"])} data-testid="lesson-compare-v">
              ▶ {t.progressions.lesson.compareV}
            </Button>
          </div>
        )}
        {i === 0 && <div className="flex justify-center gap-2">{(["I", "IV", "V"] as ProgChord[]).map((c, j) => chip(c, j + 10))}</div>}
      </Card>
      <div className="mt-auto grid grid-cols-2 gap-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button variant="secondary" disabled={i === 0} onClick={() => setI(i - 1)}>
          ‹ {t.progressions.lesson.back}
        </Button>
        {last ? (
          <Button onClick={onBegin} data-testid="lesson-begin">
            {t.progressions.lesson.begin} ▶
          </Button>
        ) : (
          <Button onClick={() => setI(i + 1)} data-testid="lesson-next">
            {t.progressions.lesson.next} ›
          </Button>
        )}
      </div>
    </div>
  );
}

/** The home chord, then the player's picks. After answering, each slot shows the real chord in its root's color. */
function Slots({
  q,
  picks,
  reveal,
  playingAt,
  colors,
  moods,
  onTap,
}: {
  q: Q;
  picks: ProgChord[];
  reveal: boolean;
  playingAt: number | null;
  colors: NoteColors;
  moods: ChordMoods;
  onTap: (i: number) => void;
}) {
  return (
    <div
      className={cx("grid w-full gap-2", q.chords.length === 2 ? "mx-auto max-w-56 grid-cols-2" : q.chords.length === 3 ? "grid-cols-3" : "grid-cols-4")}
      data-testid="progressions-slots"
    >
      {q.chords.map((real, i) => {
        const pick = i === 0 ? q.chords[0] : picks[i - 1];
        const shown = i === 0 || reveal;
        const wrong = reveal && i > 0 && pick !== real;
        const col = colorOf(colors, rootOf(q.key, real));
        const minorish = PROG_CHORDS[real].iv[1] === 3;
        return (
          <button
            key={i}
            data-slot={i + 1}
            onClick={() => onTap(i)}
            className={cx(
              "flex min-h-24 flex-col items-center justify-center gap-0.5 rounded-2xl border px-1 py-2 transition active:scale-95",
              playingAt === i ? "scale-105 border-white" : "border-line",
              wrong && "ring-4 ring-bad",
            )}
            style={
              shown
                ? {
                    background: `linear-gradient(160deg, color-mix(in srgb, ${col} 45%, transparent), ${col})`,
                    color: inkOn(col),
                    boxShadow: playingAt === i ? `0 0 24px 4px ${col}` : undefined,
                  }
                : { background: "var(--surface-2)", boxShadow: playingAt === i ? "0 0 18px 2px var(--ink-3)" : undefined }
            }
          >
            <span className={cx("font-serif font-black leading-none", (shown ? progLabel(real) : (pick && progLabel(pick)) ?? "?").length > 3 ? "text-lg" : "text-2xl")}>
              {shown ? progLabel(real) : pick ? progLabel(pick) : "?"}
            </span>
            {shown ? (
              <>
                <span className="text-xs font-bold">
                  {(minorish ? moods.minor : moods.major)?.emoji} {chordName(q.key, real)}
                </span>
                {wrong && pick && (
                  <span className="rounded-full bg-black/35 px-2 text-[11px] font-bold text-white">{t.progressions.yourPick(progLabel(pick))}</span>
                )}
              </>
            ) : (
              <span className="text-xs text-ink-3">{i + 1}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
