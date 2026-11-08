"use client";
import { useEffect, useRef, useState } from "react";
import { useStore, usePracticeTimer } from "@/lib/store";
import { colorOf, DEGREE_COLORS, inkOn } from "@/lib/colors";
import { cadence, DEGREE_UNLOCK_ORDER, MAJOR_STEPS, nameOf, pick, randInt, resolution, type Degree, type PC } from "@/lib/music";
import { newVoice, playChords, playNote, playSequence, stopAll, wait } from "@/lib/audio";
import { recentDegreeAccuracy, recordDegreeAnswer, unlockedDegrees, unlockedNotes, UNLOCK_WINDOW } from "@/lib/state";
import { Button, Card, ColorWash, NoteDot, ProgressBar, ScreenHeader, cx } from "../ui";
import { burstFrom, fireworks } from "../fx/Burst";
import { ComboBadge } from "../fx/Celebration";
import { t } from "@/i18n";

const ROUNDS = 10;
const DEGREES: Degree[] = [1, 2, 3, 4, 5, 6, 7];
type Phase = "intro" | "playing" | "question" | "feedback" | "summary";
interface Q {
  key: PC;
  tonic: number; // MIDI of the tonic the cadence uses (C3–B3)
  degree: Degree;
  midi: number; // the test note, one octave above the tonic
}

/** Functional ear training: a cadence sets the key, then name the degree of one note. */
export function Degrees({ onBack }: { onBack: () => void }) {
  const { state, setProgress, getState } = useStore();
  const { settings, progress } = state;
  usePracticeTimer(true);

  const [phase, setPhase] = useState<Phase>("intro");
  const [q, setQ] = useState<Q | null>(null);
  const [round, setRound] = useState(0);
  const [hits, setHits] = useState(0);
  const [combo, setCombo] = useState(0);
  const [verdict, setVerdict] = useState<{ ok: boolean; answer: Degree; unlocked: Degree | null } | null>(null);
  const [wash, setWash] = useState<{ color: string; k: number } | null>(null);
  const k = useRef(0);
  const qid = useRef(0); // bumps on every question and on unmount, so stale async steps stop
  const timer = useRef<number | null>(null);
  const roundRef = useRef(0);
  const hitsRef = useRef(0);
  const askedAt = useRef(0);
  const lastDegree = useRef<Degree | null>(null);

  useEffect(
    () => () => {
      qid.current++;
      if (timer.current) window.clearTimeout(timer.current);
      stopAll();
    },
    [],
  );

  const playQuestion = async (x: Q) => {
    const id = qid.current;
    setPhase("playing");
    await playChords(cadence(x.tonic));
    await wait(3000);
    if (id !== qid.current) return;
    await playNote(x.midi, 1.3);
    if (id !== qid.current) return;
    askedAt.current = performance.now();
    setPhase("question");
  };

  const ask = () => {
    qid.current++;
    newVoice();
    const set = unlockedDegrees(getState().progress);
    let degree = pick(set);
    if (degree === lastDegree.current && set.length > 1) degree = pick(set.filter((d) => d !== degree));
    lastDegree.current = degree;
    const key = randInt(0, 11);
    const tonic = 48 + key;
    const x: Q = { key, tonic, degree, midi: tonic + 12 + MAJOR_STEPS[degree - 1] };
    (window as unknown as { __cpQuestion?: unknown }).__cpQuestion = { kind: "degree", ...x };
    setQ(x);
    setVerdict(null);
    roundRef.current++;
    setRound(roundRef.current);
    void playQuestion(x);
  };

  const answer = (d: Degree) => {
    if (phase !== "question" || !q) return;
    const ok = d === q.degree;
    const ms = Math.round(performance.now() - askedAt.current);
    let unlocked: Degree | null = null;
    setProgress((p) => {
      const r = recordDegreeAnswer(p, { t: Date.now(), key: q.key, target: q.degree, answer: d, ms });
      unlocked = r.unlocked;
      return r.progress;
    });
    const u = unlocked as Degree | null;
    k.current++;
    setVerdict({ ok, answer: d, unlocked: u });
    setPhase("feedback");
    // Wash in the note's own color: the degree is relative, the note is still absolute.
    setWash({ color: colorOf(settings.noteColors, q.midi), k: k.current });
    if (ok) {
      hitsRef.current++;
      setHits(hitsRef.current);
      setCombo((c) => c + 1);
      burstFrom(document.querySelector(`button[data-degree="${d}"]`), [DEGREE_COLORS[d], "#ffffff"], 1.1 + combo / 4);
    } else {
      setCombo(0);
    }
    if (u) window.setTimeout(() => fireworks([DEGREE_COLORS[u], "#ffffff"], 6), 200);
    // Hearing the note walk home to 1 is how the degree's pull is learned.
    const walk = resolution(q.tonic + 12, q.degree);
    void wait(250).then(() => playSequence(walk, 0.42, 0.5));
    timer.current = window.setTimeout(next, 1600 + walk.length * 420);
  };

  function next() {
    if (timer.current) window.clearTimeout(timer.current);
    if (roundRef.current >= ROUNDS) {
      qid.current++;
      setPhase("summary");
      if (hitsRef.current >= ROUNDS * 0.8) {
        fireworks(unlockedNotes(getState().progress).map((pc) => colorOf(settings.noteColors, pc)), 6);
      }
      return;
    }
    ask();
  }

  const unlockedSet = unlockedDegrees(progress);
  const acc = recentDegreeAccuracy(progress);
  const allUnlocked = progress.degreesUnlocked >= DEGREE_UNLOCK_ORDER.length;
  const active = phase === "playing" || phase === "question" || phase === "feedback";

  return (
    <div className="flex min-h-[calc(100dvh-1rem)] flex-col">
      <ScreenHeader
        title={t.exercises.degrees.title}
        onBack={onBack}
        sub={phase === "intro" ? undefined : t.degrees.round(Math.min(Math.max(round, 1), ROUNDS), ROUNDS)}
      />
      {wash && <ColorWash color={wash.color} k={wash.k} />}
      <div className="relative z-[11] flex flex-1 flex-col gap-4">
        <Card className="space-y-2">
          <div className="text-sm text-ink-2">{acc.n ? t.quiz.accuracyRecent(acc.pct, acc.n) : t.quiz.unlockNeed}</div>
          {!allUnlocked && <ProgressBar value={acc.n >= UNLOCK_WINDOW ? acc.pct / 100 / 0.9 : acc.n / UNLOCK_WINDOW} />}
        </Card>

        <div className="flex min-h-44 flex-1 flex-col items-center justify-center gap-3 text-center">
          {phase === "intro" && (
            <>
              <div className="text-6xl">🏠</div>
              <p className="text-ink-2">{t.exercises.degrees.desc}</p>
              <Button big onClick={ask} className="pulse-ring" data-testid="degrees-start">
                ▶ {t.start}
              </Button>
            </>
          )}
          {(phase === "playing" || phase === "question") && q && (
            <>
              <div className="h-9">
                <ComboBadge combo={combo} />
              </div>
              <p className="text-lg text-ink-2">{phase === "playing" ? t.degrees.playing : t.degrees.listen}</p>
              <div className="flex gap-2">
                <Button variant="secondary" disabled={phase !== "question"} onClick={() => void playQuestion(q)}>
                  ↻ {t.degrees.replayKey}
                </Button>
                <Button variant="secondary" disabled={phase !== "question"} onClick={() => void playNote(q.midi, 1.3)}>
                  ♪ {t.degrees.replayNote}
                </Button>
              </div>
            </>
          )}
          {phase === "feedback" && q && verdict && (
            <button className="space-y-2" onClick={next} data-testid="degrees-feedback">
              <div className={cx("pop text-3xl font-black", verdict.ok ? "text-good" : "text-bad")}>
                {verdict.unlocked
                  ? `🔓 ${t.degrees.unlocked(verdict.unlocked)}`
                  : verdict.ok
                    ? t.degrees.correct
                    : t.degrees.wrong(q.degree)}
              </div>
              <div className="flex items-center justify-center gap-2 text-sm text-ink-2">
                <NoteDot color={colorOf(settings.noteColors, q.midi)} label={nameOf(q.midi)} size={30} />
                {t.degrees.inKey(nameOf(q.key), q.degree, nameOf(q.midi))}
              </div>
              <div className="text-sm text-ink-3">
                {t.degrees.names[q.degree]} · {t.degrees.feel[q.degree]}
              </div>
              <div className="text-xs text-ink-3">{t.degrees.resolving}</div>
              <div className="text-xs text-ink-3">{t.next} ›</div>
            </button>
          )}
          {phase === "summary" && (
            <div className="w-full space-y-4">
              <div className="text-6xl">{hits >= ROUNDS * 0.8 ? "🏆" : "🎶"}</div>
              <h2 className="text-2xl font-black">{t.quiz.summaryLine(hits, ROUNDS)}</h2>
              <Button big className="w-full" onClick={onBack}>
                {t.done}
              </Button>
            </div>
          )}
        </div>

        {active && (
          <div className="grid grid-cols-4 gap-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {DEGREES.map((d) => {
              const on = unlockedSet.includes(d);
              const col = DEGREE_COLORS[d];
              const isTarget = phase === "feedback" && q?.degree === d;
              const isWrong = phase === "feedback" && verdict && !verdict.ok && verdict.answer === d;
              return (
                <button
                  key={d}
                  data-degree={d}
                  disabled={!on || phase !== "question"}
                  onClick={() => answer(d)}
                  className={cx(
                    "flex min-h-20 flex-col items-center justify-center rounded-3xl px-1 py-2 font-bold transition active:scale-95",
                    !on && "opacity-30",
                    phase === "playing" && on && "opacity-60",
                    isTarget && "keyflash ring-4 ring-white",
                    isWrong && "shake ring-4 ring-bad",
                  )}
                  style={
                    on
                      ? {
                          background: `linear-gradient(135deg, color-mix(in srgb, ${col} 65%, #fff), ${col})`,
                          color: inkOn(col),
                          boxShadow: isTarget ? `0 0 28px 6px ${col}` : undefined,
                        }
                      : { background: "var(--surface-2)", color: "var(--ink-3)" }
                  }
                >
                  <span className="text-2xl leading-none">{on ? d : "🔒"}</span>
                  <span className="text-sm">{t.degrees.names[d]}</span>
                  <span className="text-[10px] font-medium leading-tight opacity-80">{on ? t.degrees.feel[d] : ""}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
