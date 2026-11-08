"use client";
import { useEffect, useRef, useState } from "react";
import { useStore, usePracticeTimer } from "@/lib/store";
import { colorOf, DEGREE_COLORS, inkOn } from "@/lib/colors";
import {
  CHORD_SYMBOL,
  MAJOR_STEPS,
  NUMERAL_DEGREE,
  NUMERAL_QUALITY,
  NUMERALS,
  PROGRESSION_LEN,
  diatonicTriad,
  nameOf,
  randInt,
  randomProgression,
  type Numeral,
  type PC,
} from "@/lib/music";
import { newVoice, playChords, stopAll, wait } from "@/lib/audio";
import {
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

const ROUNDS = 8;
const STEP = 1.1; // seconds between chords
const ASK = PROGRESSION_LEN - 1; // chords the player names (the first is always I)
type Phase = "intro" | "playing" | "question" | "feedback" | "summary";
interface Q {
  key: PC;
  tonic: number; // MIDI, C3–B3
  chords: Numeral[];
}

/** Root pitch class of a numeral in a key. */
const rootOf = (key: PC, n: Numeral) => (key + MAJOR_STEPS[NUMERAL_DEGREE[n] - 1]) % 12;
/** Chord name in the key, e.g. vi in G → "Em". */
const chordName = (key: PC, n: Numeral) => nameOf(rootOf(key, n)) + CHORD_SYMBOL[NUMERAL_QUALITY[n]];

/** Hear a four-chord progression that starts on I, and name chords 2–4 by function. */
export function Progressions({ onBack }: { onBack: () => void }) {
  const { state, setProgress, getState } = useStore();
  const { settings, progress } = state;
  usePracticeTimer(true);

  const [phase, setPhase] = useState<Phase>("intro");
  const [q, setQ] = useState<Q | null>(null);
  const [picks, setPicks] = useState<Numeral[]>([]);
  const [round, setRound] = useState(0);
  const [hits, setHits] = useState(0);
  const [combo, setCombo] = useState(0);
  const [verdict, setVerdict] = useState<{ correct: number; unlocked: Numeral | null } | null>(null);
  const [playingAt, setPlayingAt] = useState<number | null>(null); // chord index lit while playing
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
    await playChords(x.chords.map((n) => diatonicTriad(x.tonic, n)), STEP, STEP * 0.95);
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
    const key = randInt(0, 11);
    const x: Q = { key, tonic: 48 + key, chords: randomProgression(unlockedNumerals(getState().progress)) };
    (window as unknown as { __cpQuestion?: unknown }).__cpQuestion = { kind: "progression", ...x };
    setQ(x);
    setPicks([]);
    setVerdict(null);
    roundRef.current++;
    setRound(roundRef.current);
    void playQuestion(x);
  };

  const grade = (x: Q, ans: Numeral[]) => {
    const now = Date.now();
    const answers = ans.map((a, i) => ({ t: now, key: x.key, pos: i + 2, target: x.chords[i + 1], answer: a }));
    const correct = answers.filter((a) => a.answer === a.target).length;
    let unlocked: Numeral | null = null;
    setProgress((p) => {
      const r = recordProgression(p, answers);
      unlocked = r.unlocked;
      return r.progress;
    });
    const u = unlocked as Numeral | null;
    const all = correct === ASK;
    k.current++;
    setVerdict({ correct, unlocked: u });
    setPhase("feedback");
    // Wash in the last chord's root color: the function is relative, the root is absolute.
    setWash({ color: colorOf(settings.noteColors, rootOf(x.key, x.chords[ASK])), k: k.current });
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
    // Hear it again with the names showing, so the sound and the function connect.
    const id = qid.current;
    void wait(500).then(() => (id === qid.current ? playProgression(x, id) : undefined));
    timer.current = window.setTimeout(next, 900 + PROGRESSION_LEN * STEP * 1000 + 1200);
  };

  const choose = (n: Numeral) => {
    if (phase !== "question" || !q || picks.length >= ASK) return;
    const nextPicks = [...picks, n];
    setPicks(nextPicks);
    if (nextPicks.length === ASK) grade(q, nextPicks);
  };

  function next() {
    if (timer.current) window.clearTimeout(timer.current);
    if (roundRef.current >= ROUNDS) {
      qid.current++;
      setPlayingAt(null);
      setPhase("summary");
      if (hitsRef.current >= ROUNDS * 0.75) {
        fireworks(unlockedNotes(getState().progress).map((pc) => colorOf(settings.noteColors, pc)), 6);
      }
      return;
    }
    ask();
  }

  const unlockedSet = unlockedNumerals(progress);
  const acc = recentProgressionAccuracy(progress);
  const allUnlocked = progress.numeralsUnlocked >= NUMERALS.length;
  const active = phase === "playing" || phase === "question" || phase === "feedback";

  return (
    <div className="flex min-h-[calc(100dvh-1rem)] flex-col">
      <ScreenHeader
        title={t.exercises.progressions.title}
        onBack={onBack}
        sub={phase === "intro" ? undefined : t.progressions.round(Math.min(Math.max(round, 1), ROUNDS), ROUNDS)}
      />
      {wash && <ColorWash color={wash.color} k={wash.k} />}
      <div className="relative z-[11] flex flex-1 flex-col gap-4">
        <Card className="space-y-2">
          <div className="text-sm text-ink-2">
            {acc.n ? t.progressions.accuracyRecent(acc.pct, acc.n) : t.progressions.unlockNeed}
          </div>
          {!allUnlocked && <ProgressBar value={acc.n >= UNLOCK_WINDOW ? acc.pct / 100 / 0.9 : acc.n / UNLOCK_WINDOW} />}
        </Card>

        <div className="flex min-h-44 flex-1 flex-col items-center justify-center gap-3 text-center">
          {phase === "intro" && (
            <>
              <div className="text-6xl">🛤️</div>
              <p className="text-ink-2">{t.exercises.progressions.desc}</p>
              <Button big onClick={ask} className="pulse-ring" data-testid="progressions-start">
                ▶ {t.start}
              </Button>
            </>
          )}

          {active && q && (
            <>
              <div className="h-9">{phase !== "feedback" && <ComboBadge combo={combo} />}</div>
              {phase === "feedback" && verdict && (
                <div className={cx("pop text-3xl font-black", verdict.correct === ASK ? "text-good" : "text-bad")}>
                  {verdict.unlocked
                    ? `🔓 ${t.progressions.unlocked(verdict.unlocked)}`
                    : verdict.correct === ASK
                      ? t.progressions.correct
                      : t.progressions.partial(verdict.correct, ASK)}
                </div>
              )}
              <Slots q={q} picks={picks} reveal={phase === "feedback"} playingAt={playingAt} colors={settings.noteColors} moods={settings.chordMoods} />
              {phase === "feedback" ? (
                <button className="space-y-1" onClick={next} data-testid="progressions-feedback">
                  <div className="text-sm text-ink-2">{t.progressions.inKey(nameOf(q.key))}</div>
                  <div className="text-xs text-ink-3">{t.next} ›</div>
                </button>
              ) : (
                <>
                  <p className="text-ink-2">{phase === "playing" ? t.progressions.playing : t.progressions.listen}</p>
                  <div className="flex gap-2">
                    <Button variant="secondary" disabled={phase !== "question"} onClick={() => void playQuestion(q)}>
                      ↻ {t.progressions.replay}
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={phase !== "question" || picks.length === 0}
                      onClick={() => setPicks((p) => p.slice(0, -1))}
                      data-testid="progressions-undo"
                    >
                      ⌫ {t.progressions.undo}
                    </Button>
                  </div>
                </>
              )}
            </>
          )}

          {phase === "summary" && (
            <div className="w-full space-y-4">
              <div className="text-6xl">{hits >= ROUNDS * 0.75 ? "🏆" : "🎶"}</div>
              <h2 className="text-2xl font-black">{t.progressions.summaryLine(hits, ROUNDS)}</h2>
              <Button big className="w-full" onClick={onBack}>
                {t.done}
              </Button>
            </div>
          )}
        </div>

        {active && (
          <div className="grid grid-cols-3 gap-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {NUMERALS.map((n) => {
              const on = unlockedSet.includes(n);
              const col = DEGREE_COLORS[NUMERAL_DEGREE[n]];
              return (
                <button
                  key={n}
                  data-numeral={n}
                  disabled={!on || phase !== "question"}
                  onClick={() => choose(n)}
                  className={cx(
                    "flex min-h-20 flex-col items-center justify-center rounded-3xl px-1 py-2 font-bold transition active:scale-95",
                    !on && "opacity-30",
                    phase !== "question" && on && "opacity-60",
                  )}
                  style={
                    on
                      ? { background: `linear-gradient(135deg, color-mix(in srgb, ${col} 65%, #fff), ${col})`, color: inkOn(col) }
                      : { background: "var(--surface-2)", color: "var(--ink-3)" }
                  }
                >
                  <span className="font-serif text-2xl leading-none">{on ? n : "🔒"}</span>
                  <span className="text-[11px] font-medium leading-tight opacity-80">{on ? t.progressions.feel[n] : ""}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/** Four slots: I, then the player's picks. After answering, each shows the real chord in its root's color. */
function Slots({
  q,
  picks,
  reveal,
  playingAt,
  colors,
  moods,
}: {
  q: Q;
  picks: Numeral[];
  reveal: boolean;
  playingAt: number | null;
  colors: Parameters<typeof colorOf>[0];
  moods: Record<string, { emoji: string }>;
}) {
  return (
    <div className="grid w-full grid-cols-4 gap-2" data-testid="progressions-slots">
      {q.chords.map((real, i) => {
        const pick = i === 0 ? "I" : picks[i - 1];
        const shown = i === 0 || reveal;
        const wrong = reveal && i > 0 && pick !== real;
        const col = colorOf(colors, rootOf(q.key, real));
        return (
          <div
            key={i}
            data-slot={i + 1}
            className={cx(
              "flex min-h-24 flex-col items-center justify-center gap-0.5 rounded-2xl border px-1 py-2 transition",
              playingAt === i ? "scale-105 border-white" : "border-line",
              wrong && "ring-4 ring-bad",
            )}
            style={
              shown
                ? { background: `linear-gradient(160deg, color-mix(in srgb, ${col} 45%, transparent), ${col})`, color: inkOn(col), boxShadow: playingAt === i ? `0 0 24px 4px ${col}` : undefined }
                : { background: "var(--surface-2)", boxShadow: playingAt === i ? "0 0 18px 2px var(--ink-3)" : undefined }
            }
          >
            <span className="font-serif text-2xl font-black leading-none">{shown ? real : pick ?? "?"}</span>
            {shown ? (
              <>
                <span className="text-xs font-bold">
                  {moods[NUMERAL_QUALITY[real]]?.emoji} {chordName(q.key, real)}
                </span>
                {wrong && <span className="rounded-full bg-black/35 px-2 text-[11px] font-bold text-white">{t.progressions.yourPick(pick)}</span>}
              </>
            ) : (
              <span className="text-xs text-ink-3">{i + 1}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
