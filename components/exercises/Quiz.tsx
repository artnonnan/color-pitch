"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useStore, usePracticeTimer } from "@/lib/store";
import { colorOf, inkOn } from "@/lib/colors";
import { midisOfPc, nameOf, pcOf, pickWeighted, randInt, NOTE_UNLOCK_ORDER, type PC } from "@/lib/music";
import { playNote, playSequence, stopAll, wait } from "@/lib/audio";
import { markStepDone, quizWeights, recentNoteAccuracy, recordNoteAnswer, unlockedNotes, UNLOCK_WINDOW } from "@/lib/state";
import { Keyboard, type KeyFlash } from "../Keyboard";
import { Button, Card, ColorWash, NoteDot, ProgressBar, ScreenHeader, cx } from "../ui";
import { t } from "@/i18n";

const ROUND_MS = 5 * 60 * 1000;

type Phase = "intro" | "question" | "feedback" | "summary";

export function Quiz({ onDone, onBack, sessionLabel }: { onDone: () => void; onBack: () => void; sessionLabel?: string }) {
  const { state, setProgress, setSettings, getState } = useStore();
  const { settings, progress } = state;
  const notes = unlockedNotes(progress);
  usePracticeTimer(true);

  const [phase, setPhase] = useState<Phase>("intro");
  const [target, setTarget] = useState<number | null>(null);
  const [flashes, setFlashes] = useState<KeyFlash[]>([]);
  const [wash, setWash] = useState<{ color: string; k: number } | null>(null);
  const [verdict, setVerdict] = useState<{ ok: boolean; answer: PC; target: PC } | null>(null);
  const [unlockedNow, setUnlockedNow] = useState<PC | null>(null);
  const [round, setRound] = useState<{ n: number; correct: number; ms: number }>({ n: 0, correct: 0, ms: 0 });
  const [timeLeft, setTimeLeft] = useState(ROUND_MS);
  const roundStart = useRef<number | null>(null);
  const askedAt = useRef(0);
  const lastPc = useRef<PC | null>(null);
  const advanceTimer = useRef<number | null>(null);
  const k = useRef(0);

  useEffect(() => () => {
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    stopAll();
  }, []);

  useEffect(() => {
    if (phase === "intro" || phase === "summary") return;
    const id = window.setInterval(() => {
      if (roundStart.current) setTimeLeft(Math.max(0, ROUND_MS - (Date.now() - roundStart.current)));
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  const ask = useCallback(() => {
    const { progress: p, settings: st } = getState();
    const set = unlockedNotes(p);
    const pc = pickWeighted(set, quizWeights(p, set, lastPc.current));
    const options = midisOfPc(pc, st.lowMidi, st.highMidi);
    const midi = options.length ? options[randInt(0, options.length - 1)] : 60 + pc;
    lastPc.current = pc;
    (window as unknown as { __cpQuestion?: unknown }).__cpQuestion = { kind: "note", midi, pc };
    setTarget(midi);
    setFlashes([]);
    setVerdict(null);
    setPhase("question");
    void playNote(midi).then(() => (askedAt.current = performance.now()));
    askedAt.current = performance.now();
  }, [getState]);

  const nextOrSummary = useCallback(() => {
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    if (roundStart.current && Date.now() - roundStart.current >= ROUND_MS) {
      setPhase("summary");
      setProgress((p) => markStepDone(p, "quiz"));
      return;
    }
    setUnlockedNow(null);
    ask();
  }, [ask, setProgress]);

  const start = () => {
    roundStart.current = Date.now();
    setTimeLeft(ROUND_MS);
    setRound({ n: 0, correct: 0, ms: 0 });
    ask();
  };

  const answer = (pc: PC) => {
    if (phase !== "question" || target === null) return;
    const ms = Math.round(performance.now() - askedAt.current);
    const targetPc = pcOf(target);
    const ok = pc === targetPc;
    const now = Date.now();
    let newly: PC | null = null;
    setProgress((p) => {
      const r = recordNoteAnswer(p, { t: now, target: targetPc, answer: pc, ms });
      newly = r.unlocked;
      return r.progress;
    });
    setUnlockedNow(newly);
    setRound((r) => ({ n: r.n + 1, correct: r.correct + (ok ? 1 : 0), ms: r.ms + ms }));
    setVerdict({ ok, answer: pc, target: targetPc });
    setPhase("feedback");
    k.current++;
    setWash({ color: colorOf(settings.noteColors, targetPc), k: k.current });
    if (ok) {
      setFlashes([{ pc, kind: "correct", k: k.current }]);
      advanceTimer.current = window.setTimeout(nextOrSummary, newly !== null ? 2600 : 1200);
    } else {
      setFlashes([
        { pc, kind: "wrong", k: k.current },
        { pc: targetPc, kind: "reveal", k: k.current },
      ]);
      // Real note, then the note they picked (same octave), so the difference is heard.
      const picked = target - targetPc + pc;
      void wait(150).then(() => playSequence([target, picked], 0.9, 0.85));
      advanceTimer.current = window.setTimeout(nextOrSummary, 3200);
    }
    if (newly !== null) {
      const nm = newly;
      void wait(ok ? 900 : 2200).then(() => playNote(60 + nm));
    }
  };

  const acc = recentNoteAccuracy(progress);
  const allDone = progress.notesUnlocked >= NOTE_UNLOCK_ORDER.length;
  const mm = Math.floor(timeLeft / 60000);
  const ss = String(Math.floor((timeLeft % 60000) / 1000)).padStart(2, "0");

  return (
    <div className="flex min-h-[calc(100dvh-1rem)] flex-col">
      <ScreenHeader
        title={t.exercises.quiz.title}
        sub={sessionLabel}
        onBack={onBack}
        right={
          phase !== "intro" && phase !== "summary" ? (
            <span className="rounded-full bg-surface-2 px-3 py-1 font-mono text-sm tabular-nums text-ink-2">
              {mm}:{ss}
            </span>
          ) : null
        }
      />
      {wash && <ColorWash color={wash.color} k={wash.k} />}

      <div className="relative z-[11] flex flex-1 flex-col gap-4">
        <Card className="space-y-2">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-ink-2">
              {acc.n ? t.quiz.accuracyRecent(acc.pct, acc.n) : t.quiz.unlockNeed}
            </span>
            <div className="flex gap-1">
              {notes.map((pc) => (
                <NoteDot key={pc} size={14} color={colorOf(settings.noteColors, pc)} />
              ))}
            </div>
          </div>
          {!allDone && (
            <>
              <ProgressBar value={acc.n >= UNLOCK_WINDOW ? acc.pct / 100 / 0.9 : acc.n / UNLOCK_WINDOW} />
              <div className="text-xs text-ink-3">
                {acc.n < UNLOCK_WINDOW ? t.quiz.unlockProgress(UNLOCK_WINDOW - acc.n) : t.quiz.unlockNeed}
              </div>
            </>
          )}
          {allDone && <div className="text-xs text-good">{t.quiz.allUnlocked}</div>}
        </Card>

        <div className="flex min-h-40 flex-1 flex-col items-center justify-center text-center">
          {phase === "intro" && (
            <div className="space-y-4">
              <p className="text-ink-2">{t.exercises.quiz.desc}</p>
              <Button big onClick={start} className="pulse-ring">
                ▶ {t.start}
              </Button>
            </div>
          )}
          {phase === "question" && (
            <div className="space-y-3">
              <div className="text-5xl">🎧</div>
              <p className="text-lg text-ink-2">{t.quiz.listen}</p>
              <Button variant="secondary" onClick={() => target !== null && void playNote(target)}>
                ↻ {t.replay}
              </Button>
            </div>
          )}
          {phase === "feedback" && verdict && (
            <button className="w-full space-y-2" onClick={nextOrSummary} aria-label={t.next}>
              <div
                key={k.current}
                className="pop mx-auto flex h-28 w-28 items-center justify-center rounded-full text-5xl font-black"
                style={{
                  background: colorOf(settings.noteColors, verdict.target),
                  color: inkOn(colorOf(settings.noteColors, verdict.target)),
                  boxShadow: `0 0 60px ${colorOf(settings.noteColors, verdict.target)}`,
                }}
              >
                {nameOf(verdict.target)}
              </div>
              <div className={cx("text-xl font-bold", verdict.ok ? "text-good" : "text-bad")}>
                {verdict.ok ? t.quiz.correct : t.quiz.wrong}
              </div>
              {!verdict.ok && (
                <div className="text-sm text-ink-2">
                  {t.quiz.wrongDetail(nameOf(verdict.answer), nameOf(verdict.target))}
                  <br />
                  <span className="text-ink-3">{t.quiz.playingBoth}</span>
                </div>
              )}
              {unlockedNow !== null && (
                <div
                  className="pop mx-auto mt-2 inline-flex items-center gap-2 rounded-full px-4 py-2 font-bold"
                  style={{ background: colorOf(settings.noteColors, unlockedNow), color: inkOn(colorOf(settings.noteColors, unlockedNow)) }}
                >
                  🔓 {t.quiz.unlocked(nameOf(unlockedNow))}
                </div>
              )}
              <div className="pt-1 text-xs text-ink-3">{t.next} ›</div>
            </button>
          )}
          {phase === "summary" && (
            <div className="w-full space-y-3">
              <div className="text-5xl">🎉</div>
              <h2 className="text-2xl font-bold">{t.quiz.summary}</h2>
              <p className="text-lg">{t.quiz.summaryLine(round.correct, round.n)}</p>
              {round.n > 0 && <p className="text-ink-2">{t.quiz.avgTime((round.ms / round.n / 1000).toFixed(1))}</p>}
              <Button big onClick={onDone} className="w-full">
                {t.next} ›
              </Button>
            </div>
          )}
        </div>

        {phase !== "summary" && (
          <div className="space-y-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Keyboard
              colors={settings.noteColors}
              enabled={notes}
              onPress={answer}
              hideColors={settings.hardMode}
              flashes={flashes}
              disabled={phase !== "question"}
            />
            <div className="flex items-center justify-between gap-2">
              <label className="flex min-h-12 items-center gap-3 text-sm text-ink-2">
                <input
                  type="checkbox"
                  className="h-6 w-6 accent-[var(--accent)]"
                  checked={settings.hardMode}
                  onChange={(e) => setSettings((s) => ({ ...s, hardMode: e.target.checked }))}
                />
                {t.quiz.hardMode}
              </label>
              {phase !== "intro" && round.n >= 5 && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
                    setPhase("summary");
                    setProgress((p) => markStepDone(p, "quiz"));
                  }}
                >
                  {t.finish}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
