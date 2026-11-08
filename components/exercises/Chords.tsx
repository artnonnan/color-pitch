"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useStore, usePracticeTimer } from "@/lib/store";
import { inkOn, type ChordMood } from "@/lib/colors";
import { CHORD_INTERVALS, CHORD_QUALITIES, CHORD_SYMBOL, pick, randInt, type ChordQuality } from "@/lib/music";
import { playChord, stopAll, newVoice } from "@/lib/audio";
import { markStepDone, recentChordAccuracy, recordChordAnswer, unlockedChords, UNLOCK_WINDOW } from "@/lib/state";
import { Button, Card, ProgressBar, ScreenHeader, cx } from "../ui";
import { fireworks } from "../fx/Burst";
import { t } from "@/i18n";

const ROUND_MS = 3 * 60 * 1000;
type Phase = "intro" | "question" | "mood" | "summary";

/** Full-screen mood card shown for ~1.7 s after each answer. */
export function MoodCard({ mood, title, verdict }: { mood: ChordMood; title: string; verdict?: string }) {
  return (
    <div
      className="moodin fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 p-8 text-center"
      style={{
        background: `radial-gradient(circle at 50% 35%, color-mix(in srgb, ${mood.color} 75%, #fff) 0%, ${mood.color} 40%, color-mix(in srgb, ${mood.color} 45%, #000) 100%)`,
        color: inkOn(mood.color),
      }}
    >
      <div className="pop text-[7rem] leading-none drop-shadow-xl">{mood.emoji}</div>
      <div className="text-3xl font-black">{title}</div>
      <div className="text-xl opacity-90">{mood.mood}</div>
      {verdict && <div className="mt-4 rounded-full bg-black/20 px-4 py-1 text-lg font-bold">{verdict}</div>}
    </div>
  );
}

export function Chords({ onDone, onBack, sessionLabel }: { onDone: () => void; onBack: () => void; sessionLabel?: string }) {
  const { state, setProgress, getState } = useStore();
  const { settings, progress } = state;
  usePracticeTimer(true);
  const qualities = unlockedChords(progress);

  const [phase, setPhase] = useState<Phase>("intro");
  const [chord, setChord] = useState<{ q: ChordQuality; midis: number[] } | null>(null);
  const [shown, setShown] = useState<{ q: ChordQuality; ok: boolean; unlocked: ChordQuality | null } | null>(null);
  const [round, setRound] = useState({ n: 0, correct: 0 });
  const roundStart = useRef(0);
  const askedAt = useRef(0);
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
    stopAll();
  }, []);

  const ask = useCallback(() => {
    const qs = unlockedChords(getState().progress);
    const q = pick(qs);
    const root = randInt(48, 60); // C3–C4 roots keep chords in a warm middle register
    const midis = CHORD_INTERVALS[q].map((i) => root + i);
    newVoice();
    (window as unknown as { __cpQuestion?: unknown }).__cpQuestion = { kind: "chord", quality: q, midis };
    setChord({ q, midis });
    setShown(null);
    setPhase("question");
    void playChord(midis);
    askedAt.current = performance.now();
  }, [getState]);

  const start = () => {
    roundStart.current = Date.now();
    setRound({ n: 0, correct: 0 });
    ask();
  };

  const answer = (q: ChordQuality) => {
    if (phase !== "question" || !chord) return;
    const ok = q === chord.q;
    const ms = Math.round(performance.now() - askedAt.current);
    let unlocked: ChordQuality | null = null;
    setProgress((p) => {
      const r = recordChordAnswer(p, { t: Date.now(), target: chord.q, answer: q, ms });
      unlocked = r.unlocked;
      return r.progress;
    });
    setRound((r) => ({ n: r.n + 1, correct: r.correct + (ok ? 1 : 0) }));
    setShown({ q: chord.q, ok, unlocked });
    setPhase("mood");
    if (!ok) void playChord(chord.midis, 1.6); // hear it again while seeing its true mood
    // (assigned inside the setProgress callback, so TS can't see it isn't null)
    const u = unlocked as ChordQuality | null;
    if (u) {
      window.setTimeout(() => fireworks([settings.chordMoods[u].color, "#ffffff"], 6), 200);
    }
    timer.current = window.setTimeout(() => {
      if (Date.now() - roundStart.current >= ROUND_MS) {
        setPhase("summary");
        setProgress((p) => markStepDone(p, "chords"));
      } else ask();
    }, 1750);
  };

  const acc = recentChordAccuracy(progress);
  const allUnlocked = progress.chordsUnlocked >= CHORD_QUALITIES.length;
  const label = (q: ChordQuality) => `${t.chords.names[q]}${CHORD_SYMBOL[q] ? ` · ${CHORD_SYMBOL[q]}` : ""}`;

  return (
    <div className="flex min-h-[calc(100dvh-1rem)] flex-col">
      <ScreenHeader title={t.exercises.chords.title} sub={sessionLabel} onBack={onBack} />
      {phase === "mood" && shown && (
        <MoodCard
          mood={settings.chordMoods[shown.q]}
          title={label(shown.q)}
          verdict={
            shown.unlocked
              ? `🔓 ${t.chords.unlocked(t.chords.names[shown.unlocked])}`
              : shown.ok
                ? t.chords.correct
                : t.chords.wrongWas(t.chords.names[shown.q])
          }
        />
      )}

      <div className="flex flex-1 flex-col gap-4">
        <Card className="space-y-2">
          <div className="text-sm text-ink-2">
            {acc.n ? t.quiz.accuracyRecent(acc.pct, acc.n) : t.quiz.unlockNeed}
          </div>
          {!allUnlocked && (
            <ProgressBar value={acc.n >= UNLOCK_WINDOW ? acc.pct / 100 / 0.9 : acc.n / UNLOCK_WINDOW} />
          )}
        </Card>

        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          {phase === "intro" && (
            <>
              <p className="text-ink-2">{t.exercises.chords.desc}</p>
              <Button big onClick={start} className="pulse-ring">
                ▶ {t.start}
              </Button>
            </>
          )}
          {(phase === "question" || phase === "mood") && (
            <>
              <div className="text-5xl">🎹</div>
              <p className="text-lg text-ink-2">{t.chords.listen}</p>
              <Button variant="secondary" onClick={() => chord && void playChord(chord.midis)}>
                ↻ {t.replay}
              </Button>
            </>
          )}
          {phase === "summary" && (
            <div className="w-full space-y-3">
              <div className="text-5xl">🌈</div>
              <h2 className="text-2xl font-bold">{t.quiz.summary}</h2>
              <p className="text-lg">{t.quiz.summaryLine(round.correct, round.n)}</p>
              <Button big className="w-full" onClick={onDone}>
                {t.next} ›
              </Button>
            </div>
          )}
        </div>

        {phase !== "summary" && phase !== "intro" && (
          <div className="grid grid-cols-2 gap-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {CHORD_QUALITIES.map((q) => {
              const on = qualities.includes(q);
              const m = settings.chordMoods[q];
              return (
                <button
                  key={q}
                  data-quality={q}
                  disabled={!on || phase !== "question"}
                  onClick={() => answer(q)}
                  className={cx(
                    "flex min-h-20 flex-col items-center justify-center rounded-3xl px-2 py-3 font-bold transition active:scale-95",
                    !on && "opacity-30",
                  )}
                  style={
                    on
                      ? { background: `linear-gradient(135deg, color-mix(in srgb, ${m.color} 70%, #fff), ${m.color})`, color: inkOn(m.color) }
                      : { background: "var(--surface-2)", color: "var(--ink-3)" }
                  }
                >
                  <span className="text-2xl">{on ? m.emoji : "🔒"}</span>
                  <span className="text-base">{t.chords.names[q]}</span>
                  {CHORD_SYMBOL[q] && <span className="text-xs opacity-75">{CHORD_SYMBOL[q]}</span>}
                </button>
              );
            })}
          </div>
        )}
        {phase !== "intro" && phase !== "summary" && round.n >= 5 && (
          <Button
            variant="ghost"
            onClick={() => {
              if (timer.current) window.clearTimeout(timer.current);
              setPhase("summary");
              setProgress((p) => markStepDone(p, "chords"));
            }}
          >
            {t.finish}
          </Button>
        )}
      </div>
    </div>
  );
}
