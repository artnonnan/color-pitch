"use client";
import { useEffect, useRef, useState } from "react";
import { useStore, usePracticeTimer } from "@/lib/store";
import { colorOf, DEGREE_COLORS, inkOn, type NoteColors } from "@/lib/colors";
import {
  CHORD_SYMBOL,
  MAJOR_STEPS,
  NUMERAL_DEGREE,
  NUMERAL_QUALITY,
  NUMERALS,
  diatonicTriad,
  nameOf,
  randInt,
  randomProgression,
  type Numeral,
  type PC,
} from "@/lib/music";
import { newVoice, playChord, playChords, stopAll, wait } from "@/lib/audio";
import {
  PROG_LAST_LEVEL,
  PROG_LEVELS,
  progSpec,
  recentProgressionAccuracy,
  recordProgression,
  unlockedNotes,
  unlockedNumerals,
  UNLOCK_WINDOW,
} from "@/lib/state";
import type { ChordMoods } from "@/lib/colors";
import { Button, Card, ColorWash, ProgressBar, ScreenHeader, cx } from "../ui";
import { burstFrom, fireworks } from "../fx/Burst";
import { ComboBadge } from "../fx/Celebration";
import { t } from "@/i18n";

const ROUNDS = 10;
const STEP = 1.1; // seconds between chords
const LESSON_TONIC = 48; // C3: the lesson always uses C major
type Phase = "intro" | "lesson" | "playing" | "question" | "feedback" | "summary";
interface Q {
  key: PC;
  tonic: number; // MIDI, C3–B3
  chords: Numeral[];
  choices: Numeral[];
  level: number;
}

/** Root pitch class of a numeral in a key. */
const rootOf = (key: PC, n: Numeral) => (key + MAJOR_STEPS[NUMERAL_DEGREE[n] - 1]) % 12;
/** Chord name in the key, e.g. vi in G → "Em". */
const chordName = (key: PC, n: Numeral) => nameOf(rootOf(key, n)) + CHORD_SYMBOL[NUMERAL_QUALITY[n]];
const playSeq = (tonic: number, seq: Numeral[]) => playChords(seq.map((n) => diatonicTriad(tonic, n)), STEP, STEP * 0.95);

/**
 * Hear chords that start on I and name the rest by function. A short lesson comes first,
 * then four levels: one chord (IV or V), one chord (I, IV or V), three chords, four chords.
 */
export function Progressions({ onBack }: { onBack: () => void }) {
  const { state, setProgress, getState } = useStore();
  const { settings, progress } = state;
  usePracticeTimer(true);

  const [phase, setPhase] = useState<Phase>(() => (progress.progLessonSeen ? "intro" : "lesson"));
  const [q, setQ] = useState<Q | null>(null);
  const [picks, setPicks] = useState<Numeral[]>([]);
  const [hinted, setHinted] = useState(false);
  const [round, setRound] = useState(0);
  const [hits, setHits] = useState(0);
  const [combo, setCombo] = useState(0);
  const [verdict, setVerdict] = useState<{ correct: number; unlocked: Numeral | null; levelUp: number | null } | null>(null);
  const [playingAt, setPlayingAt] = useState<number | null>(null); // slot lit while its chord plays
  const [wash, setWash] = useState<{ color: string; k: number } | null>(null);
  const k = useRef(0);
  const qid = useRef(0);
  const timer = useRef<number | null>(null);
  const roundRef = useRef(0);
  const hitsRef = useRef(0);

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
    const spec = progSpec(getState().progress);
    const key = randInt(0, 11);
    const x: Q = {
      key,
      tonic: 48 + key,
      chords: randomProgression(spec.choices, spec.len, spec.len > 2),
      choices: spec.choices,
      level: spec.level,
    };
    (window as unknown as { __cpQuestion?: unknown }).__cpQuestion = { kind: "progression", ...x };
    setQ(x);
    setPicks([]);
    setHinted(false);
    setVerdict(null);
    roundRef.current++;
    setRound(roundRef.current);
    void playQuestion(x);
  };

  const finishLesson = () => {
    setProgress((p) => (p.progLessonSeen ? p : { ...p, progLessonSeen: true }));
    stopAll();
    ask();
  };

  const grade = (x: Q, ans: Numeral[]) => {
    const now = Date.now();
    const ask_ = x.chords.length - 1;
    const answers = ans.map((a, i) => ({
      t: now,
      key: x.key,
      pos: i + 2,
      target: x.chords[i + 1],
      answer: a,
      level: x.level,
      ...(hinted ? { hinted: true } : {}),
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
    const all = correct === ask_;
    k.current++;
    setVerdict({ correct, unlocked: u, levelUp: lv });
    setPhase("feedback");
    // Wash in the last chord's root color: the function is relative, the root is absolute.
    setWash({ color: colorOf(settings.noteColors, rootOf(x.key, x.chords[ask_])), k: k.current });
    if (all) {
      hitsRef.current++;
      setHits(hitsRef.current);
      setCombo((c) => c + 1);
      burstFrom(
        document.querySelector('[data-testid="progressions-slots"]'),
        x.chords.map((n) => colorOf(settings.noteColors, rootOf(x.key, n))),
        1.2 + combo / 4,
      );
    } else {
      setCombo(0);
    }
    if (u) window.setTimeout(() => fireworks([DEGREE_COLORS[NUMERAL_DEGREE[u]], "#ffffff"], 6), 200);
    if (lv !== null) window.setTimeout(() => fireworks([DEGREE_COLORS[1], DEGREE_COLORS[4], DEGREE_COLORS[5], "#ffffff"], 7), 200);
    // Hear it again with the names showing, so the sound and the function connect.
    const id = qid.current;
    void wait(500).then(() => (id === qid.current ? playProgression(x, id) : undefined));
    timer.current = window.setTimeout(next, 900 + x.chords.length * STEP * 1000 + 1200);
  };

  const choose = (n: Numeral) => {
    if (phase !== "question" || !q) return;
    const need = q.chords.length - 1;
    if (picks.length >= need) return;
    const nextPicks = [...picks, n];
    setPicks(nextPicks);
    if (nextPicks.length === need) grade(q, nextPicks);
  };

  /** Tap a slot to hear just that chord again. */
  const hearSlot = (i: number) => {
    if (!q || (phase !== "question" && phase !== "feedback")) return;
    void playChord(diatonicTriad(q.tonic, q.chords[i]), STEP);
  };

  function next() {
    if (timer.current) window.clearTimeout(timer.current);
    if (roundRef.current >= ROUNDS) {
      qid.current++;
      setPlayingAt(null);
      setPhase("summary");
      if (hitsRef.current >= ROUNDS * 0.8) {
        fireworks(unlockedNotes(getState().progress).map((pc) => colorOf(settings.noteColors, pc)), 6);
      }
      return;
    }
    ask();
  }

  const spec = progSpec(progress);
  const acc = recentProgressionAccuracy(progress);
  const done = spec.level >= PROG_LAST_LEVEL && progress.numeralsUnlocked >= NUMERALS.length;
  const active = phase === "playing" || phase === "question" || phase === "feedback";
  const need = q ? q.chords.length - 1 : spec.len - 1;
  // Last level: the full grid with locks. Earlier levels: only the level's own choices.
  const grid: Numeral[] = q && q.level < PROG_LAST_LEVEL ? q.choices : [...NUMERALS];
  const unlockedSet = q && q.level < PROG_LAST_LEVEL ? q.choices : unlockedNumerals(progress);

  return (
    <div className="flex min-h-[calc(100dvh-1rem)] flex-col">
      <ScreenHeader
        title={t.exercises.progressions.title}
        onBack={onBack}
        sub={
          phase === "intro" || phase === "lesson"
            ? t.progressions.level(spec.level + 1, PROG_LEVELS.length)
            : t.progressions.round(Math.min(Math.max(round, 1), ROUNDS), ROUNDS)
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
                  {t.progressions.level(spec.level + 1, PROG_LEVELS.length)}
                </span>
                <span className="text-xs text-ink-3">{t.progressions.levelDesc[spec.level]}</span>
              </div>
              <div className="text-sm text-ink-2">
                {acc.n
                  ? t.progressions.accuracyRecent(acc.pct, acc.n)
                  : spec.level < PROG_LAST_LEVEL
                    ? t.progressions.levelNeed
                    : t.progressions.unlockNeed}
              </div>
              {!done && <ProgressBar value={acc.n >= UNLOCK_WINDOW ? acc.pct / 100 / 0.9 : acc.n / UNLOCK_WINDOW} />}
            </Card>

            <div className="flex min-h-44 flex-1 flex-col items-center justify-center gap-3 text-center">
              {phase === "intro" && (
                <>
                  <div className="text-6xl">🛤️</div>
                  <p className="text-ink-2">{t.exercises.progressions.desc}</p>
                  <Button big onClick={ask} className="pulse-ring" data-testid="progressions-start">
                    ▶ {t.start}
                  </Button>
                  <Button variant="ghost" onClick={() => setPhase("lesson")} data-testid="progressions-lesson-open">
                    📖 {t.progressions.lessonOpen}
                  </Button>
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
                      <div className="text-sm text-ink-2">{t.progressions.inKey(nameOf(q.key))}</div>
                      {verdict?.levelUp !== null && verdict?.levelUp !== undefined && (
                        <div className="text-sm font-bold text-accent">{t.progressions.levelDesc[verdict.levelUp]}</div>
                      )}
                      <div className="text-xs text-ink-3">{t.next} ›</div>
                    </button>
                  ) : (
                    <>
                      <p className="text-ink-2">{phase === "playing" ? t.progressions.playing : t.progressions.listenN(need)}</p>
                      {phase === "question" && <p className="text-xs text-ink-3">{t.progressions.tapSlot}</p>}
                      <div className="flex flex-wrap justify-center gap-2">
                        <Button variant="secondary" disabled={phase !== "question"} onClick={() => void playQuestion(q)}>
                          ↻ {t.progressions.replay}
                        </Button>
                        <Button
                          variant="secondary"
                          disabled={phase !== "question"}
                          onClick={() => setHinted(true)}
                          data-testid="progressions-hint"
                        >
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
                        <Card className="w-full space-y-2" >
                          <div className="text-sm font-bold">{t.progressions.hintTitle}</div>
                          <div className="flex flex-wrap justify-center gap-2" data-testid="progressions-hint-panel">
                            {q.choices.map((n) => (
                              <Button
                                key={n}
                                variant="secondary"
                                data-hint-numeral={n}
                                onClick={() => void playSeq(q.tonic, ["I", n])}
                              >
                                ▶ I → {n}
                              </Button>
                            ))}
                          </div>
                          <div className="text-xs text-ink-3">{t.progressions.hintNote}</div>
                        </Card>
                      )}
                    </>
                  )}
                </>
              )}

              {phase === "summary" && (
                <div className="w-full space-y-4">
                  <div className="text-6xl">{hits >= ROUNDS * 0.8 ? "🏆" : "🎶"}</div>
                  <h2 className="text-2xl font-black">{t.progressions.summaryLine(hits, ROUNDS)}</h2>
                  <Button big className="w-full" onClick={onBack}>
                    {t.done}
                  </Button>
                </div>
              )}
            </div>

            {active && q && (
              <div
                className={cx("grid gap-2 pb-[max(1rem,env(safe-area-inset-bottom))]", grid.length === 2 ? "grid-cols-2" : "grid-cols-3")}
              >
                {grid.map((n) => {
                  const on = unlockedSet.includes(n);
                  const col = DEGREE_COLORS[NUMERAL_DEGREE[n]];
                  return (
                    <button
                      key={n}
                      data-numeral={n}
                      disabled={!on || phase !== "question"}
                      onClick={() => choose(n)}
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
                      <span className="font-serif text-3xl leading-none">{on ? n : "🔒"}</span>
                      <span className="text-xs font-medium leading-tight opacity-80">{on ? t.progressions.feel[n] : ""}</span>
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

  const play = async (seq: Numeral[]) => {
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

  const seq = step.play as Numeral[];
  const chip = (n: Numeral, j: number) => {
    const col = colorOf(colors, rootOf(0, n));
    return (
      <span
        key={j}
        className={cx("flex h-16 w-16 flex-col items-center justify-center rounded-2xl font-serif text-2xl font-black transition", lit === j && "scale-110")}
        style={{ background: col, color: inkOn(col), boxShadow: lit === j ? `0 0 24px 4px ${col}` : undefined }}
      >
        {n}
        <span className="font-sans text-[10px] font-bold">{chordName(0, n)}</span>
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
              {seq.map((n, j) => (
                <span key={j} className="flex items-center gap-2">
                  {j > 0 && <span className="text-ink-3">→</span>}
                  {chip(n, j)}
                </span>
              ))}
            </div>
            <Button big className="w-full" onClick={() => void play(seq)} data-testid="lesson-play">
              ▶ {seq.join(" → ")}
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
        {i === 0 && (
          <div className="flex justify-center gap-2">
            {(["I", "IV", "V"] as Numeral[]).map((n, j) => chip(n, j + 10))}
          </div>
        )}
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

/** I, then the player's picks. After answering, each slot shows the real chord in its root's color. Tap to hear one chord. */
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
  picks: Numeral[];
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
        const pick = i === 0 ? "I" : picks[i - 1];
        const shown = i === 0 || reveal;
        const wrong = reveal && i > 0 && pick !== real;
        const col = colorOf(colors, rootOf(q.key, real));
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
            <span className="font-serif text-2xl font-black leading-none">{shown ? real : (pick ?? "?")}</span>
            {shown ? (
              <>
                <span className="text-xs font-bold">
                  {moods[NUMERAL_QUALITY[real]]?.emoji} {chordName(q.key, real)}
                </span>
                {wrong && (
                  <span className="rounded-full bg-black/35 px-2 text-[11px] font-bold text-white">{t.progressions.yourPick(pick)}</span>
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
