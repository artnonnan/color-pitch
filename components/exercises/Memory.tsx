"use client";
import { useEffect, useRef, useState } from "react";
import { useStore, usePracticeTimer } from "@/lib/store";
import { colorOf } from "@/lib/colors";
import { nameOf, pickWeighted, randInt, type PC } from "@/lib/music";
import { playNote, playSequence, setVoiceOverride, stopAll, wait } from "@/lib/audio";
import { MEM_DELAYS, memDelay, quizWeights, recentMemAccuracy, recordMemory, unlockedNotes, UNLOCK_WINDOW } from "@/lib/state";
import { Keyboard, type KeyFlash } from "../Keyboard";
import { Button, Card, ColorWash, ProgressBar, ScreenHeader, cx } from "../ui";
import { burstFrom, fireworks } from "../fx/Burst";
import { ComboBadge } from "../fx/Celebration";
import { t } from "@/i18n";

const ROUNDS = 10;
type Phase = "intro" | "listen" | "hold" | "question" | "feedback" | "summary";

/**
 * Pitch memory: hear one note (no color), keep it in mind while random notes play for
 * 5–30 s, then name it. Absolute pitch is long-term pitch memory; this trains holding it.
 */
export function Memory({ onBack }: { onBack: () => void }) {
  const { state, setProgress, getState } = useStore();
  const { settings, progress } = state;
  usePracticeTimer(true);

  const [phase, setPhase] = useState<Phase>("intro");
  const [q, setQ] = useState<{ pc: PC; midi: number; delay: number } | null>(null);
  const [left, setLeft] = useState(0);
  const [round, setRound] = useState(0);
  const [hits, setHits] = useState(0);
  const [combo, setCombo] = useState(0);
  const [verdict, setVerdict] = useState<{ ok: boolean; grewTo: number | null } | null>(null);
  const [flashes, setFlashes] = useState<KeyFlash[]>([]);
  const [wash, setWash] = useState<{ color: string; k: number } | null>(null);
  const live = useRef(0);
  const k = useRef(0);
  const roundRef = useRef(0);
  const hitsRef = useRef(0);
  const last = useRef<PC | null>(null);

  useEffect(
    () => () => {
      live.current++;
      setVoiceOverride(null);
      stopAll();
    },
    [],
  );

  const ask = async () => {
    const id = ++live.current;
    const p = getState().progress;
    const set = unlockedNotes(p);
    const pc = pickWeighted(set, quizWeights(p, set, last.current));
    last.current = pc;
    const delay = memDelay(p);
    const x = { pc, midi: 48 + pc + randInt(0, 1) * 12, delay };
    (window as unknown as { __cpQuestion?: unknown }).__cpQuestion = { kind: "memory", ...x };
    setQ(x);
    setVerdict(null);
    setFlashes([]);
    roundRef.current++;
    setRound(roundRef.current);
    setPhase("listen");
    await playNote(x.midi, 1.4);
    await wait(1600);
    if (id !== live.current) return;
    // Hold: random notes in a plain voice until the delay is up.
    setPhase("hold");
    const endAt = performance.now() + delay * 1000;
    setVoiceOverride("sine");
    while (performance.now() < endAt) {
      if (id !== live.current) return;
      setLeft(Math.ceil((endAt - performance.now()) / 1000));
      void playSequence([randInt(36, 90)], 0.1, 0.35);
      await wait(700);
    }
    setVoiceOverride(null);
    if (id !== live.current) return;
    setPhase("question");
  };

  const answer = (pc: PC) => {
    if (phase !== "question" || !q) return;
    const ok = pc === q.pc;
    let grewTo: number | null = null;
    setProgress((p) => {
      const r = recordMemory(p, { t: Date.now(), target: q.pc, answer: pc, delay: q.delay });
      grewTo = r.grewTo;
      return r.progress;
    });
    const g = grewTo as number | null;
    k.current++;
    const col = colorOf(settings.noteColors, q.pc);
    setVerdict({ ok, grewTo: g });
    setPhase("feedback");
    setWash({ color: col, k: k.current });
    setFlashes(ok ? [{ pc, kind: "correct", k: k.current }] : [{ pc, kind: "wrong", k: k.current }, { pc: q.pc, kind: "reveal", k: k.current }]);
    if (ok) {
      hitsRef.current++;
      setHits(hitsRef.current);
      setCombo((c) => c + 1);
      burstFrom(document.querySelector(`button[data-pc="${pc}"]`), [col, "#ffffff"], 1.2 + combo / 4);
    } else setCombo(0);
    if (g) window.setTimeout(() => fireworks([col, "#ffffff"], 7), 200);
    void wait(300).then(() => playNote(q.midi, 1.2));
  };

  const next = () => {
    if (roundRef.current >= ROUNDS) {
      live.current++;
      setPhase("summary");
      if (hitsRef.current >= ROUNDS * 0.8) fireworks(unlockedNotes(getState().progress).map((pc) => colorOf(settings.noteColors, pc)), 6);
      return;
    }
    void ask();
  };

  const acc = recentMemAccuracy(progress);
  const delayNow = memDelay(progress);
  const maxed = progress.memLevel >= MEM_DELAYS.length - 1;
  const active = phase === "listen" || phase === "hold" || phase === "question" || phase === "feedback";

  return (
    <div className="flex min-h-[calc(100dvh-1rem)] flex-col">
      <ScreenHeader
        title={t.exercises.memory.title}
        onBack={onBack}
        sub={phase === "intro" ? t.memory.delay(delayNow) : t.memory.round(Math.min(Math.max(round, 1), ROUNDS), ROUNDS)}
      />
      {wash && <ColorWash color={wash.color} k={wash.k} />}
      <div className="relative z-[11] flex flex-1 flex-col gap-4">
        <Card className="space-y-2">
          <div className="text-sm text-ink-2">{acc.n ? t.quiz.accuracyRecent(acc.pct, acc.n) : t.memory.unlockNeed}</div>
          {!maxed && <ProgressBar value={acc.n >= UNLOCK_WINDOW ? acc.pct / 100 / 0.9 : acc.n / UNLOCK_WINDOW} />}
        </Card>

        {phase === "intro" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
            <div className="text-6xl">🧠</div>
            <p className="text-ink-2">{t.memory.rules}</p>
            <Button big onClick={() => void ask()} className="pulse-ring" data-testid="memory-start">
              ▶ {t.start}
            </Button>
          </div>
        )}

        {active && q && (
          <>
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
              <div className="h-9">{phase !== "feedback" && <ComboBadge combo={combo} />}</div>
              {phase === "hold" ? (
                <div
                  className="flex h-32 w-32 items-center justify-center rounded-full border-8 border-accent/40 text-5xl font-black tabular-nums"
                  data-testid="memory-countdown"
                >
                  {left}
                </div>
              ) : (
                <div className="text-6xl">{phase === "listen" ? "👂" : phase === "question" ? "❓" : verdict?.ok ? "🧠" : "💭"}</div>
              )}
              {phase === "feedback" && verdict ? (
                <div className={cx("pop text-3xl font-black", verdict.ok ? "text-good" : "text-bad")}>
                  {verdict.grewTo ? `🔓 ${t.memory.grew(verdict.grewTo)}` : verdict.ok ? t.memory.correct : t.memory.wrong(nameOf(q.pc))}
                </div>
              ) : (
                <p className="text-lg text-ink-2" data-testid="memory-prompt">
                  {phase === "listen" ? t.memory.remember : phase === "hold" ? t.memory.holding : t.memory.answerNow}
                </p>
              )}
              {phase === "feedback" && (
                <Button big onClick={next} data-testid="memory-next">
                  {t.next} ›
                </Button>
              )}
            </div>
            <div className="pb-[max(1rem,env(safe-area-inset-bottom))]">
              <Keyboard
                colors={settings.noteColors}
                enabled={unlockedNotes(progress)}
                onPress={answer}
                hideColors={settings.hardMode}
                flashes={flashes}
                disabled={phase !== "question"}
              />
            </div>
          </>
        )}

        {phase === "summary" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <div className="text-6xl">{hits >= ROUNDS * 0.8 ? "🏆" : "🧠"}</div>
            <h2 className="text-2xl font-black">{t.memory.summaryLine(hits, ROUNDS)}</h2>
            <Button big className="w-full" onClick={onBack}>
              {t.done}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
