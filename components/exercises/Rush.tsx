"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useStore, usePracticeTimer } from "@/lib/store";
import { colorOf } from "@/lib/colors";
import { nameOf, type PC } from "@/lib/music";
import { playNote, stopAll } from "@/lib/audio";
import { appendCapped, pickNoteMidi, recordNoteAnswer, rushBest, unlockedNotes } from "@/lib/state";
import { Keyboard, type KeyFlash } from "../Keyboard";
import { Button, Card, ScreenHeader, cx } from "../ui";
import { burstFrom, fireworks } from "../fx/Burst";
import { Celebration, ComboBadge } from "../fx/Celebration";
import { t } from "@/i18n";

const ROUND_MS = 60_000;
type Phase = "intro" | "playing" | "done";

/** 60-second speed round. Answers count toward the normal note log and unlocks. */
export function Rush({ onBack }: { onBack: () => void }) {
  const { state, setProgress, getState } = useStore();
  const { settings, progress } = state;
  usePracticeTimer(true);

  const [phase, setPhase] = useState<Phase>("intro");
  const [q, setQ] = useState<{ midi: number; pc: PC } | null>(null);
  const [locked, setLocked] = useState(false);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [stats, setStats] = useState({ correct: 0, total: 0, maxCombo: 0 });
  const [timeLeft, setTimeLeft] = useState(ROUND_MS);
  const [flashes, setFlashes] = useState<KeyFlash[]>([]);
  const [floater, setFloater] = useState<{ text: string; k: number; color: string } | null>(null);
  const [unlockedQueue, setUnlockedQueue] = useState<PC[]>([]);
  const [newBest, setNewBest] = useState(false);
  const startAt = useRef(0);
  const askedAt = useRef(0);
  const last = useRef<PC | null>(null);
  const timers = useRef<number[]>([]);
  const k = useRef(0);
  const live = useRef({ score: 0, combo: 0, correct: 0, total: 0, maxCombo: 0 });
  const bestBefore = useRef(0);

  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      stopAll();
    },
    [],
  );

  const ask = useCallback(() => {
    if (Date.now() - startAt.current >= ROUND_MS) return;
    const next = pickNoteMidi(getState(), last.current);
    last.current = next.pc;
    (window as unknown as { __cpQuestion?: unknown }).__cpQuestion = { kind: "note", ...next };
    setQ(next);
    setFlashes([]);
    setLocked(false);
    void playNote(next.midi, 1.1);
    askedAt.current = performance.now();
  }, [getState]);

  const finish = useCallback(() => {
    timers.current.forEach(clearTimeout);
    setPhase("done");
    setLocked(true);
    const L = live.current;
    const isBest = L.score > bestBefore.current && L.score > 0;
    setNewBest(isBest);
    setProgress((p) => ({
      ...p,
      rush: appendCapped(p.rush, { t: Date.now(), score: L.score, correct: L.correct, total: L.total, maxCombo: L.maxCombo }),
    }));
    if (isBest) {
      const cs = unlockedNotes(getState().progress).map((pc) => colorOf(settings.noteColors, pc));
      later(() => fireworks(cs, 9), 200);
    }
  }, [getState, setProgress, settings.noteColors]);

  // countdown
  useEffect(() => {
    if (phase !== "playing") return;
    const id = window.setInterval(() => {
      const left = Math.max(0, ROUND_MS - (Date.now() - startAt.current));
      setTimeLeft(left);
      if (left === 0) finish();
    }, 100);
    return () => window.clearInterval(id);
  }, [phase, finish]);

  const start = () => {
    bestBefore.current = rushBest(getState().progress);
    live.current = { score: 0, combo: 0, correct: 0, total: 0, maxCombo: 0 };
    setScore(0);
    setCombo(0);
    setStats({ correct: 0, total: 0, maxCombo: 0 });
    setUnlockedQueue([]);
    setNewBest(false);
    startAt.current = Date.now();
    setTimeLeft(ROUND_MS);
    setPhase("playing");
    ask();
  };

  const answer = (pc: PC) => {
    if (phase !== "playing" || locked || !q) return;
    setLocked(true);
    const ms = Math.round(performance.now() - askedAt.current);
    const ok = pc === q.pc;
    let unlocked: PC | null = null;
    setProgress((p) => {
      const r = recordNoteAnswer(p, { t: Date.now(), target: q.pc, answer: pc, ms });
      unlocked = r.unlocked;
      return r.progress;
    });
    if (unlocked !== null) setUnlockedQueue((u) => [...u, unlocked as PC]);
    const L = live.current;
    L.total++;
    k.current++;
    const col = colorOf(settings.noteColors, q.pc);
    if (ok) {
      L.combo++;
      L.correct++;
      L.maxCombo = Math.max(L.maxCombo, L.combo);
      const mult = Math.min(5, 1 + Math.floor(L.combo / 5)); // x2 at 5, … capped at x5
      // faster answers earn a little more
      const pts = 10 * mult + Math.max(0, Math.round((2000 - ms) / 200));
      L.score += pts;
      setFloater({ text: `+${pts}`, k: k.current, color: col });
      setFlashes([{ pc, kind: "correct", k: k.current }]);
      burstFrom(document.querySelector(`button[data-pc="${pc}"]`), [col, "#ffffff"], Math.min(3, 0.8 + L.combo / 6));
      later(ask, 280);
    } else {
      L.combo = 0;
      setFlashes([
        { pc, kind: "wrong", k: k.current },
        { pc: q.pc, kind: "reveal", k: k.current },
      ]);
      void playNote(q.midi, 0.8);
      later(ask, 950);
    }
    setScore(L.score);
    setCombo(L.combo);
    setStats({ correct: L.correct, total: L.total, maxCombo: L.maxCombo });
  };

  const best = rushBest(progress);
  const frac = timeLeft / ROUND_MS;
  const celebrate = phase === "done" && unlockedQueue.length > 0 ? unlockedQueue[0] : null;

  return (
    <div className="flex min-h-[calc(100dvh-1rem)] flex-col">
      <ScreenHeader title={t.exercises.rush.title} onBack={onBack} sub={best ? t.rush.best(best) : t.rush.noBest} />
      {celebrate !== null && (
        <Celebration
          color={colorOf(settings.noteColors, celebrate)}
          label={nameOf(celebrate)}
          title={t.fx.newNote}
          sub={t.fx.newNoteSub(nameOf(celebrate))}
          onClose={() => setUnlockedQueue((u) => u.slice(1))}
        />
      )}

      <div className="relative z-[11] flex flex-1 flex-col gap-4">
        {phase === "intro" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
            <div className="text-6xl">⚡</div>
            <p className="text-ink-2">{t.rush.rules}</p>
            <Button big onClick={start} className="pulse-ring">
              ▶ {t.start}
            </Button>
          </div>
        )}

        {phase === "playing" && (
          <>
            <div className="h-3 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full origin-left rounded-full transition-transform duration-100 ease-linear"
                style={{
                  transform: `scaleX(${frac})`,
                  background: frac > 0.25 ? "linear-gradient(90deg, #22c55e, #facc15)" : "linear-gradient(90deg, #ef4444, #f97316)",
                }}
              />
            </div>
            <div className="relative flex flex-1 flex-col items-center justify-center gap-3 text-center">
              <div className="text-sm text-ink-3">{t.rush.score}</div>
              <div className="relative">
                <div className="text-7xl font-black tabular-nums" data-testid="rush-score">
                  {score}
                </div>
                {floater && (
                  <span
                    key={floater.k}
                    className="float-up absolute -right-12 top-0 text-2xl font-black"
                    style={{ color: floater.color }}
                  >
                    {floater.text}
                  </span>
                )}
              </div>
              <div className="h-9">
                <ComboBadge combo={combo} />
              </div>
              <Button variant="secondary" onClick={() => q && void playNote(q.midi, 1.1)}>
                ↻ {t.replay}
              </Button>
            </div>
          </>
        )}

        {phase === "done" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <div className="text-6xl">{newBest ? "🏆" : "⏱️"}</div>
            <h2 className="text-2xl font-black">{newBest ? t.fx.newBest : t.rush.timeUp}</h2>
            <Card className="w-full space-y-1">
              <div className="text-5xl font-black tabular-nums">{score}</div>
              <div className="text-ink-2">{t.rush.result(score, stats.correct, stats.total)}</div>
              <div className="text-sm text-ink-3">{t.rush.maxCombo(stats.maxCombo)}</div>
            </Card>
            <div className="grid w-full grid-cols-2 gap-3">
              <Button variant="secondary" onClick={onBack}>
                {t.done}
              </Button>
              <Button onClick={start}>{t.rush.again}</Button>
            </div>
          </div>
        )}

        {phase === "playing" && (
          <div className={cx("pb-[max(1rem,env(safe-area-inset-bottom))]")}>
            <Keyboard
              colors={settings.noteColors}
              enabled={unlockedNotes(progress)}
              onPress={answer}
              hideColors={settings.hardMode}
              flashes={flashes}
              disabled={locked}
            />
          </div>
        )}
      </div>
    </div>
  );
}
