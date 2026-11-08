"use client";
import { useEffect, useRef, useState } from "react";
import { useStore, usePracticeTimer } from "@/lib/store";
import { colorOf, inkOn } from "@/lib/colors";
import { NOTE_UNLOCK_ORDER, nameOf, pickWeighted, randInt, type PC } from "@/lib/music";
import { newVoice, playNote, stopAll, wait } from "@/lib/audio";
import {
  COLOR_PICK_MAX_LEVEL,
  colorPickOptions,
  quizWeights,
  recentColorPickAccuracy,
  recordColorPick,
  unlockedNotes,
  UNLOCK_WINDOW,
} from "@/lib/state";
import { Button, Card, ColorWash, ProgressBar, ScreenHeader, cx } from "../ui";
import { burstFrom, fireworks } from "../fx/Burst";
import { ComboBadge } from "../fx/Celebration";
import { t } from "@/i18n";

const ROUNDS = 10;
const GAP = 0.95; // seconds between options when they play in a row
type Phase = "intro" | "playing" | "question" | "feedback" | "summary";
interface Opt {
  pc: PC;
  midi: number;
}
interface Q {
  target: PC;
  options: Opt[];
}

/**
 * Color → sound, the reverse of the quiz, without singing: see only a color, hear 2–4
 * notes (in random octaves, so height gives nothing away) and pick the one that is that
 * color. The target comes from the unlocked notes; decoys are other notes, unlocked first.
 */
export function ColorPick({ onBack }: { onBack: () => void }) {
  const { state, setProgress, getState } = useStore();
  const { settings, progress } = state;
  usePracticeTimer(true);

  const [phase, setPhase] = useState<Phase>("intro");
  const [q, setQ] = useState<Q | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [lit, setLit] = useState<number | null>(null);
  const [round, setRound] = useState(0);
  const [hits, setHits] = useState(0);
  const [combo, setCombo] = useState(0);
  const [verdict, setVerdict] = useState<{ ok: boolean; grewTo: number | null } | null>(null);
  const [wash, setWash] = useState<{ color: string; k: number } | null>(null);
  const qid = useRef(0);
  const k = useRef(0);
  const roundRef = useRef(0);
  const hitsRef = useRef(0);
  const askedAt = useRef(0);
  const last = useRef<PC | null>(null);

  useEffect(
    () => () => {
      qid.current++;
      stopAll();
    },
    [],
  );

  /** Play every option in order, lighting its card. */
  const playAll = async (x: Q) => {
    const id = ++qid.current;
    setPhase("playing");
    for (let i = 0; i < x.options.length; i++) {
      if (id !== qid.current) return;
      setLit(i);
      void playNote(x.options[i].midi, 0.8);
      await wait(GAP * 1000);
    }
    if (id !== qid.current) return;
    setLit(null);
    askedAt.current = performance.now();
    setPhase("question");
  };

  const ask = () => {
    newVoice();
    const p = getState().progress;
    const set = unlockedNotes(p);
    const target = pickWeighted(set, quizWeights(p, set, last.current));
    last.current = target;
    const n = colorPickOptions(p);
    const decoys = [...set.filter((pc) => pc !== target), ...NOTE_UNLOCK_ORDER.filter((pc) => !set.includes(pc))];
    // Unlocked decoys first (shuffled), then the next notes in unlock order.
    const firstPart = decoys.slice(0, Math.max(0, set.length - 1)).sort(() => Math.random() - 0.5);
    const pool = [...firstPart, ...decoys.slice(firstPart.length)];
    const pcs = [target, ...pool.slice(0, n - 1)].sort(() => Math.random() - 0.5);
    // C3–B5, each option in its own random octave.
    const options = pcs.map((pc) => ({ pc, midi: 48 + pc + randInt(0, 2) * 12 }));
    const x: Q = { target, options };
    (window as unknown as { __cpQuestion?: unknown }).__cpQuestion = { kind: "colorpick", target, options };
    setQ(x);
    setSel(null);
    setVerdict(null);
    roundRef.current++;
    setRound(roundRef.current);
    void playAll(x);
  };

  const tapOption = (i: number) => {
    if (!q || (phase !== "question" && phase !== "feedback")) return;
    void playNote(q.options[i].midi, 0.9);
    if (phase === "question") setSel(i);
  };

  const answer = () => {
    if (!q || phase !== "question" || sel === null) return;
    const chosen = q.options[sel].pc;
    const ok = chosen === q.target;
    const ms = Math.round(performance.now() - askedAt.current);
    let grewTo: number | null = null;
    setProgress((p) => {
      const r = recordColorPick(p, { t: Date.now(), target: q.target, answer: chosen, options: q.options.map((o) => o.pc), ms });
      grewTo = r.grewTo;
      return r.progress;
    });
    const g = grewTo as number | null;
    k.current++;
    setVerdict({ ok, grewTo: g });
    setPhase("feedback");
    const col = colorOf(settings.noteColors, q.target);
    setWash({ color: col, k: k.current });
    if (ok) {
      hitsRef.current++;
      setHits(hitsRef.current);
      setCombo((c) => c + 1);
      burstFrom(document.querySelector(`[data-option="${sel}"]`), [col, "#ffffff"], 1.3 + combo / 4);
    } else {
      setCombo(0);
    }
    if (g) window.setTimeout(() => fireworks([col, "#ffffff"], 7), 200);
    // Hear the right one again.
    const right = q.options.find((o) => o.pc === q.target)!;
    void wait(350).then(() => playNote(right.midi, 1.2));
  };

  const next = () => {
    if (roundRef.current >= ROUNDS) {
      qid.current++;
      setPhase("summary");
      if (hitsRef.current >= ROUNDS * 0.8) fireworks(unlockedNotes(getState().progress).map((pc) => colorOf(settings.noteColors, pc)), 6);
      return;
    }
    ask();
  };

  const acc = recentColorPickAccuracy(progress);
  const nOpts = colorPickOptions(progress);
  const maxed = progress.colorPickLevel >= COLOR_PICK_MAX_LEVEL;
  const targetCol = q ? colorOf(settings.noteColors, q.target) : "#444";
  const active = phase === "playing" || phase === "question" || phase === "feedback";

  return (
    <div className="flex min-h-[calc(100dvh-1rem)] flex-col">
      <ScreenHeader
        title={t.exercises.colorpick.title}
        onBack={onBack}
        sub={phase === "intro" ? t.colorpick.options(nOpts) : t.colorpick.round(Math.min(Math.max(round, 1), ROUNDS), ROUNDS)}
      />
      {wash && <ColorWash color={wash.color} k={wash.k} />}
      <div className="relative z-[11] flex flex-1 flex-col gap-4">
        <Card className="space-y-2">
          <div className="text-sm text-ink-2">{acc.n ? t.quiz.accuracyRecent(acc.pct, acc.n) : t.colorpick.unlockNeed}</div>
          {!maxed && <ProgressBar value={acc.n >= UNLOCK_WINDOW ? acc.pct / 100 / 0.9 : acc.n / UNLOCK_WINDOW} />}
        </Card>

        {phase === "intro" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
            <div
              className="flex h-28 w-28 items-center justify-center rounded-full text-4xl font-black text-white"
              style={{ background: colorOf(settings.noteColors, unlockedNotes(progress)[0]), boxShadow: `0 0 40px 8px ${colorOf(settings.noteColors, unlockedNotes(progress)[0])}88` }}
            >
              👂
            </div>
            <p className="text-ink-2">{t.colorpick.rules}</p>
            <Button big onClick={ask} className="pulse-ring" data-testid="colorpick-start">
              ▶ {t.start}
            </Button>
          </div>
        )}

        {active && q && (
          <>
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="h-9">{phase !== "feedback" && <ComboBadge combo={combo} />}</div>
              <div
                className="flex h-36 w-36 items-center justify-center rounded-full text-3xl font-black transition"
                style={{ background: targetCol, color: inkOn(targetCol), boxShadow: `0 0 50px 10px ${targetCol}88` }}
                data-testid="colorpick-swatch"
              >
                {phase === "feedback" ? nameOf(q.target) : ""}
              </div>
              {phase === "feedback" && verdict ? (
                <div className={cx("pop text-3xl font-black", verdict.ok ? "text-good" : "text-bad")}>
                  {verdict.grewTo ? `🔓 ${t.colorpick.grew(verdict.grewTo)}` : verdict.ok ? t.colorpick.correct : t.colorpick.wrong(nameOf(q.target))}
                </div>
              ) : (
                <p className="text-lg text-ink-2">{phase === "playing" ? t.colorpick.playing : t.colorpick.listen}</p>
              )}
            </div>

            <div className={cx("grid gap-3", q.options.length <= 2 ? "grid-cols-2" : q.options.length === 3 ? "grid-cols-3" : "grid-cols-2")} data-testid="colorpick-options">
              {q.options.map((o, i) => {
                const isRight = phase === "feedback" && o.pc === q.target;
                const isWrong = phase === "feedback" && sel === i && o.pc !== q.target;
                const col = colorOf(settings.noteColors, o.pc);
                return (
                  <button
                    key={i}
                    data-option={i}
                    onClick={() => tapOption(i)}
                    disabled={phase === "playing"}
                    className={cx(
                      "flex min-h-24 flex-col items-center justify-center gap-1 rounded-3xl border-2 p-2 font-bold transition active:scale-95",
                      lit === i && "scale-105",
                      // One border color at a time, so feedback colors are never overridden.
                      isRight
                        ? "border-good"
                        : isWrong
                          ? "shake border-bad"
                          : lit === i
                            ? "border-white"
                            : sel === i && phase === "question"
                              ? "border-accent ring-4 ring-accent/40"
                              : "border-line",
                    )}
                    style={
                      phase === "feedback"
                        ? { background: col, color: inkOn(col), boxShadow: isRight ? `0 0 24px 4px ${col}` : undefined }
                        : { background: "var(--surface)" }
                    }
                  >
                    <span className="text-2xl">{phase === "feedback" ? nameOf(o.pc) : lit === i ? "🔊" : "♪"}</span>
                    <span className="text-xs opacity-80">{t.colorpick.option(i + 1)}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-auto space-y-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {phase === "feedback" ? (
                <Button big className="w-full" onClick={next} data-testid="colorpick-next">
                  {t.next} ›
                </Button>
              ) : (
                <>
                  <Button big className="w-full" disabled={sel === null || phase !== "question"} onClick={answer} data-testid="colorpick-answer">
                    {sel === null ? t.colorpick.pickFirst : `✓ ${t.colorpick.answer}`}
                  </Button>
                  <Button variant="ghost" className="w-full" disabled={phase !== "question"} onClick={() => void playAll(q)}>
                    ↻ {t.colorpick.playAll}
                  </Button>
                </>
              )}
            </div>
          </>
        )}

        {phase === "summary" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <div className="text-6xl">{hits >= ROUNDS * 0.8 ? "🏆" : "🎨"}</div>
            <h2 className="text-2xl font-black">{t.colorpick.summaryLine(hits, ROUNDS)}</h2>
            <Button big className="w-full" onClick={onBack} data-testid="colorpick-done">
              {t.done}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
