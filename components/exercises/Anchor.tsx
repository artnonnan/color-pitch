"use client";
import { useEffect, useRef, useState } from "react";
import { useStore, usePracticeTimer } from "@/lib/store";
import { colorOf, inkOn } from "@/lib/colors";
import { NOTE_NAMES, nameOf, pick, randInt, type PC } from "@/lib/music";
import { playNote, stopAll, type Voice } from "@/lib/audio";
import { playIn, randomVoice } from "@/lib/drills";
import {
  ANCHOR_MIN_DISTANCE,
  anchorDistance,
  recentAnchorAccuracy,
  recordAnchor,
  unlockedNotes,
  UNLOCK_WINDOW,
} from "@/lib/state";
import { Button, Card, ColorWash, ProgressBar, ScreenHeader, cx } from "../ui";
import { burstFrom, fireworks } from "../fx/Burst";
import { ComboBadge } from "../fx/Celebration";
import { t } from "@/i18n";

const ROUNDS = 15;
const ALL: PC[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
type Phase = "intro" | "question" | "feedback" | "summary";
const circ = (a: PC, b: PC) => Math.min((a - b + 12) % 12, (b - a + 12) % 12);

/**
 * Anchor note: learn one note so well you know it on sight. Each question plays a note in a
 * random octave and voice; half the time it is the anchor. Answer yes or no. Decoys come
 * closer as accuracy grows (3 semitones away → 2 → neighbors).
 */
export function Anchor({ onBack }: { onBack: () => void }) {
  const { state, setProgress } = useStore();
  const { settings, progress } = state;
  usePracticeTimer(true);

  const [phase, setPhase] = useState<Phase>("intro");
  const [choosing, setChoosing] = useState(progress.anchorPc === null);
  const [q, setQ] = useState<{ played: PC; midi: number; voice: Voice } | null>(null);
  const [round, setRound] = useState(0);
  const [hits, setHits] = useState(0);
  const [combo, setCombo] = useState(0);
  const [verdict, setVerdict] = useState<{ ok: boolean; said: boolean; grewTo: number | null } | null>(null);
  const [wash, setWash] = useState<{ color: string; k: number } | null>(null);
  const roundRef = useRef(0);
  const hitsRef = useRef(0);
  const k = useRef(0);

  useEffect(() => () => stopAll(), []);

  const anchor: PC = progress.anchorPc ?? unlockedNotes(progress)[0];
  const aCol = colorOf(settings.noteColors, anchor);

  const choose = (pc: PC) => {
    setProgress((p) => (p.anchorPc === pc ? p : { ...p, anchorPc: pc, anchorLevel: 0, anchorSince: Date.now() }));
    void playNote(60 + pc, 1.2);
    setChoosing(false);
  };

  const ask = () => {
    const dist = anchorDistance(progress);
    const isAnchor = Math.random() < 0.5;
    const decoys = ALL.filter((pc) => pc !== anchor && circ(pc, anchor) >= dist);
    const played = isAnchor ? anchor : pick(decoys);
    const x = { played, midi: 36 + played + randInt(0, 3) * 12, voice: randomVoice() };
    (window as unknown as { __cpQuestion?: unknown }).__cpQuestion = { kind: "anchor", anchor, ...x };
    setQ(x);
    setVerdict(null);
    roundRef.current++;
    setRound(roundRef.current);
    setPhase("question");
    void playIn(x.midi, x.voice);
  };

  const start = () => {
    roundRef.current = 0;
    hitsRef.current = 0;
    setHits(0);
    setCombo(0);
    ask();
  };

  const say = (yes: boolean) => {
    if (phase !== "question" || !q) return;
    const ok = yes === (q.played === anchor);
    let grewTo: number | null = null;
    setProgress((p) => {
      const r = recordAnchor(p, { t: Date.now(), anchor, played: q.played, said: yes });
      grewTo = r.grewTo;
      return r.progress;
    });
    const g = grewTo as number | null;
    k.current++;
    setVerdict({ ok, said: yes, grewTo: g });
    setPhase("feedback");
    const col = colorOf(settings.noteColors, q.played);
    setWash({ color: col, k: k.current });
    if (ok) {
      hitsRef.current++;
      setHits(hitsRef.current);
      setCombo((c) => c + 1);
      burstFrom(document.querySelector(`[data-answer="${yes ? "yes" : "no"}"]`), [col, "#ffffff"], 1.1 + combo / 5);
    } else setCombo(0);
    if (g !== null) window.setTimeout(() => fireworks([aCol, "#ffffff"], 7), 200);
  };

  const next = () => {
    if (roundRef.current >= ROUNDS) {
      setPhase("summary");
      if (hitsRef.current >= ROUNDS * 0.8) fireworks([aCol, "#ffffff", aCol], 7);
      return;
    }
    ask();
  };

  const acc = recentAnchorAccuracy(progress);
  const level = Math.min(progress.anchorLevel, ANCHOR_MIN_DISTANCE.length - 1);
  const maxed = progress.anchorLevel >= ANCHOR_MIN_DISTANCE.length - 1;

  return (
    <div className="flex min-h-[calc(100dvh-1rem)] flex-col">
      <ScreenHeader
        title={t.exercises.anchor.title}
        onBack={onBack}
        sub={phase === "intro" ? t.anchor.level[level] : t.anchor.round(Math.min(Math.max(round, 1), ROUNDS), ROUNDS)}
      />
      {wash && <ColorWash color={wash.color} k={wash.k} />}
      <div className="relative z-[11] flex flex-1 flex-col gap-4">
        <Card className="space-y-2">
          <div className="text-sm text-ink-2">{acc.n ? t.quiz.accuracyRecent(acc.pct, acc.n) : t.anchor.unlockNeed}</div>
          {!maxed && <ProgressBar value={acc.n >= UNLOCK_WINDOW ? acc.pct / 100 / 0.9 : acc.n / UNLOCK_WINDOW} />}
        </Card>

        {phase === "intro" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
            {choosing ? (
              <>
                <h2 className="text-xl font-bold">{t.anchor.choose}</h2>
                <p className="text-sm text-ink-2">{t.anchor.rules}</p>
                <div className="grid grid-cols-6 gap-2" data-testid="anchor-choices">
                  {ALL.map((pc) => {
                    const col = colorOf(settings.noteColors, pc);
                    return (
                      <button
                        key={pc}
                        data-anchor={pc}
                        onClick={() => choose(pc)}
                        className={cx("flex h-12 w-12 items-center justify-center rounded-full text-sm font-black", pc === anchor && "ring-4 ring-white")}
                        style={{ background: col, color: inkOn(col) }}
                      >
                        {NOTE_NAMES[pc]}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <button
                  className="flex h-32 w-32 items-center justify-center rounded-full text-5xl font-black"
                  style={{ background: aCol, color: inkOn(aCol), boxShadow: `0 0 40px 8px ${aCol}88` }}
                  onClick={() => void playNote(60 + anchor, 1.2)}
                  data-testid="anchor-current"
                >
                  {nameOf(anchor)}
                </button>
                <div className="font-bold">{t.anchor.yourAnchor(nameOf(anchor))}</div>
                <p className="text-sm text-ink-2">{t.anchor.rules}</p>
                <Button big onClick={start} className="pulse-ring" data-testid="anchor-start">
                  ▶ {t.start}
                </Button>
                <Button variant="ghost" onClick={() => setChoosing(true)} data-testid="anchor-change">
                  {t.anchor.change}
                </Button>
              </>
            )}
          </div>
        )}

        {(phase === "question" || phase === "feedback") && q && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <div className="h-9">{phase === "question" && <ComboBadge combo={combo} />}</div>
            <div
              className="flex h-28 w-28 items-center justify-center rounded-full text-4xl font-black transition"
              style={
                phase === "feedback"
                  ? { background: colorOf(settings.noteColors, q.played), color: inkOn(colorOf(settings.noteColors, q.played)) }
                  : { background: "var(--surface-2)" }
              }
              data-testid="anchor-note"
            >
              {phase === "feedback" ? nameOf(q.played) : "♪"}
            </div>
            {phase === "feedback" && verdict ? (
              <>
                <div className={cx("pop text-3xl font-black", verdict.ok ? "text-good" : "text-bad")}>
                  {verdict.grewTo !== null ? `🔓 ${t.anchor.grew}` : verdict.ok ? t.anchor.correct : t.anchor.wrong}
                </div>
                <div className="text-sm text-ink-2">{t.anchor.itWas(nameOf(q.played))}</div>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button variant="secondary" onClick={() => void playIn(q.midi, q.voice)}>
                    ↻ {nameOf(q.played)}
                  </Button>
                  <Button variant="secondary" onClick={() => void playNote(60 + anchor, 1.2)}>
                    ♪ {t.anchor.hear(nameOf(anchor))}
                  </Button>
                </div>
                <Button big className="w-full" onClick={next} data-testid="anchor-next">
                  {t.next} ›
                </Button>
              </>
            ) : (
              <>
                <p className="text-xl font-bold">{t.anchor.question(nameOf(anchor))}</p>
                <Button variant="ghost" onClick={() => void playIn(q.midi, q.voice)}>
                  ↻ {t.replay}
                </Button>
                <div className="grid w-full grid-cols-2 gap-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
                  <button
                    data-answer="yes"
                    onClick={() => say(true)}
                    className="flex min-h-28 flex-col items-center justify-center rounded-3xl text-2xl font-black active:scale-95"
                    style={{ background: aCol, color: inkOn(aCol) }}
                  >
                    ✓ {t.anchor.yes}
                    <span className="text-sm font-semibold">{nameOf(anchor)}</span>
                  </button>
                  <button
                    data-answer="no"
                    onClick={() => say(false)}
                    className="flex min-h-28 flex-col items-center justify-center rounded-3xl border border-line bg-surface text-2xl font-black active:scale-95"
                  >
                    ✗ {t.anchor.no}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {phase === "summary" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <div className="text-6xl">{hits >= ROUNDS * 0.8 ? "🏆" : "⚓"}</div>
            <h2 className="text-2xl font-black">{t.anchor.summaryLine(hits, ROUNDS)}</h2>
            <Button big className="w-full" onClick={onBack}>
              {t.done}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

