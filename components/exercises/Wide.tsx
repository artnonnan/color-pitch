"use client";
import { useEffect, useRef, useState } from "react";
import { useStore, usePracticeTimer } from "@/lib/store";
import { colorOf } from "@/lib/colors";
import { midisOfPc, nameOf, octaveOf, pick, pickWeighted, type PC } from "@/lib/music";
import { stopAll, wait, type Voice } from "@/lib/audio";
import { playIn, randomVoice } from "@/lib/drills";
import { appendCapped, quizWeights, registerOf, unlockedNotes } from "@/lib/state";
import { Keyboard, type KeyFlash } from "../Keyboard";
import { Button, Card, ColorWash, ScreenHeader, cx } from "../ui";
import { burstFrom, fireworks } from "../fx/Burst";
import { ComboBadge } from "../fx/Celebration";
import { t } from "@/i18n";

const ROUNDS = 10;
const LO = 24; // C1
const HI = 96; // C7
type Phase = "intro" | "question" | "feedback" | "summary";

/**
 * The quiz across the whole range, C1–C7, with a different voice every question, so the
 * note is learned as a pitch class and not as "a piano note around middle C".
 */
export function Wide({ onBack }: { onBack: () => void }) {
  const { state, setProgress, getState } = useStore();
  const { settings, progress } = state;
  usePracticeTimer(true);

  const [phase, setPhase] = useState<Phase>("intro");
  const [q, setQ] = useState<{ pc: PC; midi: number; voice: Voice } | null>(null);
  const [round, setRound] = useState(0);
  const [hits, setHits] = useState(0);
  const [combo, setCombo] = useState(0);
  const [ok, setOk] = useState<boolean | null>(null);
  const [flashes, setFlashes] = useState<KeyFlash[]>([]);
  const [wash, setWash] = useState<{ color: string; k: number } | null>(null);
  const roundRef = useRef(0);
  const hitsRef = useRef(0);
  const k = useRef(0);
  const last = useRef<PC | null>(null);
  const lastOct = useRef(-1);

  useEffect(() => () => stopAll(), []);

  const ask = () => {
    const p = getState().progress;
    const set = unlockedNotes(p);
    const pc = pickWeighted(set, quizWeights(p, set, last.current));
    last.current = pc;
    const choices = midisOfPc(pc, LO, HI).filter((m) => octaveOf(m) !== lastOct.current);
    const midi = pick(choices.length ? choices : midisOfPc(pc, LO, HI));
    lastOct.current = octaveOf(midi);
    const x = { pc, midi, voice: randomVoice() };
    (window as unknown as { __cpQuestion?: unknown }).__cpQuestion = { kind: "wide", ...x };
    setQ(x);
    setOk(null);
    setFlashes([]);
    roundRef.current++;
    setRound(roundRef.current);
    setPhase("question");
    void playIn(x.midi, x.voice, 1.5);
  };

  const start = () => {
    roundRef.current = 0;
    hitsRef.current = 0;
    setHits(0);
    setCombo(0);
    ask();
  };

  const answer = (pc: PC) => {
    if (phase !== "question" || !q) return;
    const good = pc === q.pc;
    setProgress((p) => ({ ...p, wideAnswers: appendCapped(p.wideAnswers, { t: Date.now(), target: q.pc, answer: pc, midi: q.midi, voice: q.voice }) }));
    k.current++;
    const col = colorOf(settings.noteColors, q.pc);
    setOk(good);
    setPhase("feedback");
    setWash({ color: col, k: k.current });
    setFlashes(good ? [{ pc, kind: "correct", k: k.current }] : [{ pc, kind: "wrong", k: k.current }, { pc: q.pc, kind: "reveal", k: k.current }]);
    if (good) {
      hitsRef.current++;
      setHits(hitsRef.current);
      setCombo((c) => c + 1);
      burstFrom(document.querySelector(`button[data-pc="${pc}"]`), [col, "#ffffff"], 1.2 + combo / 4);
    } else {
      setCombo(0);
      void wait(250).then(() => playIn(q.midi, q.voice, 1.2));
    }
  };

  const next = () => {
    if (roundRef.current >= ROUNDS) {
      setPhase("summary");
      if (hitsRef.current >= ROUNDS * 0.8) fireworks(unlockedNotes(getState().progress).map((pc) => colorOf(settings.noteColors, pc)), 6);
      return;
    }
    ask();
  };

  // Accuracy by register, all time.
  const reg = (["low", "mid", "high"] as const).map((r) => {
    const mine = progress.wideAnswers.filter((a) => registerOf(a.midi) === r);
    return { r, n: mine.length, pct: mine.length ? Math.round((mine.filter((a) => a.answer === a.target).length / mine.length) * 100) : null };
  });

  return (
    <div className="flex min-h-[calc(100dvh-1rem)] flex-col">
      <ScreenHeader
        title={t.exercises.wide.title}
        onBack={onBack}
        sub={phase === "intro" ? undefined : t.wide.round(Math.min(Math.max(round, 1), ROUNDS), ROUNDS)}
      />
      {wash && <ColorWash color={wash.color} k={wash.k} />}
      <div className="relative z-[11] flex flex-1 flex-col gap-4">
        <Card className="grid grid-cols-3 gap-2 text-center" >
          {reg.map((x) => (
            <div key={x.r} data-register={x.r}>
              <div className="text-xl font-black tabular-nums">{x.pct === null ? "–" : `${x.pct}%`}</div>
              <div className="text-xs text-ink-3">{t.wide.registers[x.r]}</div>
            </div>
          ))}
        </Card>

        {phase === "intro" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
            <div className="text-6xl">🎚️</div>
            <p className="text-ink-2">{t.wide.rules}</p>
            <Button big onClick={start} className="pulse-ring" data-testid="wide-start">
              ▶ {t.start}
            </Button>
          </div>
        )}

        {(phase === "question" || phase === "feedback") && q && (
          <>
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
              <div className="h-9">{phase === "question" && <ComboBadge combo={combo} />}</div>
              {phase === "feedback" ? (
                <>
                  <div className={cx("pop text-3xl font-black", ok ? "text-good" : "text-bad")}>{ok ? t.wide.correct : t.wide.wrong(nameOf(q.pc))}</div>
                  <div className="text-sm text-ink-2" data-testid="wide-where">
                    {t.wide.where(octaveOf(q.midi), t.wide.voices[q.voice])}
                  </div>
                  <Button big onClick={next} data-testid="wide-next">
                    {t.next} ›
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-lg text-ink-2">{t.wide.listen}</p>
                  <Button variant="secondary" onClick={() => void playIn(q.midi, q.voice, 1.5)}>
                    ↻ {t.replay}
                  </Button>
                </>
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
            <div className="text-6xl">{hits >= ROUNDS * 0.8 ? "🏆" : "🎚️"}</div>
            <h2 className="text-2xl font-black">{t.wide.summaryLine(hits, ROUNDS)}</h2>
            <Button big className="w-full" onClick={onBack}>
              {t.done}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
