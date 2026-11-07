"use client";
import { useEffect, useRef, useState } from "react";
import { useStore, usePracticeTimer } from "@/lib/store";
import { colorOf } from "@/lib/colors";
import { CHORD_INTERVALS, CHORD_SYMBOL, midisOfPc, nameOf, pick, type ChordQuality, type PC } from "@/lib/music";
import { playChord, playNote, stopAll, wait } from "@/lib/audio";
import { appendCapped, unlockedChords, unlockedNotes } from "@/lib/state";
import { Keyboard, type KeyFlash } from "../Keyboard";
import { Button, ColorWash, ScreenHeader, cx } from "../ui";
import { burstFrom, fireworks } from "../fx/Burst";
import { ComboBadge } from "../fx/Celebration";
import { t } from "@/i18n";

const ROUNDS = 10;
type Phase = "intro" | "question" | "feedback" | "summary";

/** Hear a chord, tap its root: absolute pitch inside harmony. */
export function Roots({ onBack }: { onBack: () => void }) {
  const { state, setProgress, getState } = useStore();
  const { settings } = state;
  usePracticeTimer(true);

  const [phase, setPhase] = useState<Phase>("intro");
  const [q, setQ] = useState<{ root: PC; quality: ChordQuality; midis: number[] } | null>(null);
  const [round, setRound] = useState(0);
  const [hits, setHits] = useState(0);
  const [combo, setCombo] = useState(0);
  const [flashes, setFlashes] = useState<KeyFlash[]>([]);
  const [verdict, setVerdict] = useState<{ ok: boolean } | null>(null);
  const [wash, setWash] = useState<{ color: string; k: number } | null>(null);
  const k = useRef(0);
  const timer = useRef<number | null>(null);
  const roundRef = useRef(0); // refs: next() runs from timers holding old renders
  const hitsRef = useRef(0);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
      stopAll();
    },
    [],
  );

  const ask = () => {
    const s = getState();
    const root = pick(unlockedNotes(s.progress));
    const quality = pick(unlockedChords(s.progress));
    const options = midisOfPc(root, 48, 60); // roots C3–B3: chords stay in a clear register
    const base = options.length ? pick(options) : 48 + root;
    const midis = CHORD_INTERVALS[quality].map((i) => base + i);
    (window as unknown as { __cpQuestion?: unknown }).__cpQuestion = { kind: "root", pc: root, quality, midis };
    setQ({ root, quality, midis });
    setFlashes([]);
    setVerdict(null);
    roundRef.current++;
    setRound(roundRef.current);
    setPhase("question");
    void playChord(midis);
  };

  const answer = (pc: PC) => {
    if (phase !== "question" || !q) return;
    const ok = pc === q.root;
    k.current++;
    const col = colorOf(settings.noteColors, q.root);
    setProgress((p) => ({ ...p, roots: appendCapped(p.roots, { t: Date.now(), target: q.root, answer: pc, quality: q.quality }) }));
    setVerdict({ ok });
    setPhase("feedback");
    setWash({ color: col, k: k.current });
    if (ok) {
      hitsRef.current++;
      setHits(hitsRef.current);
      setCombo((c) => c + 1);
      setFlashes([{ pc, kind: "correct", k: k.current }]);
      burstFrom(document.querySelector(`button[data-pc="${pc}"]`), [col, "#ffffff"], 1.2 + combo / 4);
      timer.current = window.setTimeout(next, 1300);
    } else {
      setCombo(0);
      setFlashes([
        { pc, kind: "wrong", k: k.current },
        { pc: q.root, kind: "reveal", k: k.current },
      ]);
      void wait(150)
        .then(() => playNote(q.midis[0], 0.9))
        .then(() => wait(1000))
        .then(() => playChord(q.midis, 1.4));
      timer.current = window.setTimeout(next, 3300);
    }
  };

  function next() {
    if (timer.current) window.clearTimeout(timer.current);
    if (roundRef.current >= ROUNDS) {
      setPhase("summary");
      if (hitsRef.current >= ROUNDS * 0.8) {
        fireworks(unlockedNotes(getState().progress).map((pc) => colorOf(settings.noteColors, pc)), 6);
      }
      return;
    }
    ask();
  }

  const sym = q ? CHORD_SYMBOL[q.quality] : "";

  return (
    <div className="flex min-h-[calc(100dvh-1rem)] flex-col">
      <ScreenHeader
        title={t.exercises.roots.title}
        onBack={onBack}
        sub={phase === "intro" ? undefined : t.roots.round(Math.min(Math.max(round, 1), ROUNDS), ROUNDS)}
      />
      {wash && <ColorWash color={wash.color} k={wash.k} />}
      <div className="relative z-[11] flex flex-1 flex-col gap-4">
        <div className="flex min-h-48 flex-1 flex-col items-center justify-center gap-3 text-center">
          {phase === "intro" && (
            <>
              <div className="text-6xl">🎹</div>
              <p className="text-ink-2">{t.exercises.roots.desc}</p>
              <Button big onClick={ask} className="pulse-ring">
                ▶ {t.start}
              </Button>
            </>
          )}
          {phase === "question" && (
            <>
              <div className="h-9">
                <ComboBadge combo={combo} />
              </div>
              <p className="text-lg text-ink-2">{t.roots.listen}</p>
              <Button variant="secondary" onClick={() => q && void playChord(q.midis)}>
                ↻ {t.replay}
              </Button>
            </>
          )}
          {phase === "feedback" && q && verdict && (
            <button className="space-y-2" onClick={next}>
              <div className={cx("pop text-3xl font-black", verdict.ok ? "text-good" : "text-bad")}>
                {verdict.ok ? t.roots.correct(nameOf(q.root), sym) : t.roots.wrong(nameOf(q.root), sym)}
              </div>
              <div className="text-sm text-ink-3">{t.chords.names[q.quality]}</div>
              {!verdict.ok && <div className="text-sm text-ink-3">{t.roots.playingRoot}</div>}
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
        {(phase === "question" || phase === "feedback") && (
          <div className="pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Keyboard
              colors={settings.noteColors}
              enabled={unlockedNotes(state.progress)}
              onPress={answer}
              hideColors={settings.hardMode}
              flashes={flashes}
              disabled={phase !== "question"}
            />
          </div>
        )}
      </div>
    </div>
  );
}
