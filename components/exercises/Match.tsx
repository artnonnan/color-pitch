"use client";
import { useEffect, useRef, useState } from "react";
import { useStore, usePracticeTimer } from "@/lib/store";
import { colorOf, inkOn } from "@/lib/colors";
import { NOTE_UNLOCK_ORDER, nameOf, type PC } from "@/lib/music";
import { newVoice, playNote, stopAll } from "@/lib/audio";
import { appendCapped, matchBest, unlockedNotes } from "@/lib/state";
import { Button, Card, ScreenHeader, cx } from "../ui";
import { burstFrom, fireworks } from "../fx/Burst";
import { t } from "@/i18n";

const SIZES = [3, 6] as const;
type Phase = "intro" | "playing" | "done";
interface CardT {
  id: number;
  pc: PC;
  midi: number;
}

function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

/**
 * Build a board: `pairs` different notes, unlocked ones first (then the rest in unlock
 * order). The two cards of a pair are the same note in different octaves, so the match is
 * by pitch class, not by height.
 */
function deal(pairs: number, unlocked: PC[]): CardT[] {
  const pool = [...shuffle(unlocked), ...NOTE_UNLOCK_ORDER.filter((pc) => !unlocked.includes(pc))];
  const pcs = pool.slice(0, pairs);
  let id = 1;
  const cards = pcs.flatMap((pc) => {
    const low = 48 + pc; // C3–B3
    const high = 60 + pc + (Math.random() < 0.5 ? 0 : 12); // one or two octaves up
    return [
      { id: id++, pc, midi: low },
      { id: id++, pc, midi: high },
    ];
  });
  return shuffle(cards);
}

/** Memory match: turn cards to hear them, find the two that are the same note. */
export function Match({ onBack }: { onBack: () => void }) {
  const { state, setProgress, getState } = useStore();
  const { settings, progress } = state;
  usePracticeTimer(true);

  const [phase, setPhase] = useState<Phase>("intro");
  const [pairs, setPairs] = useState<number>(6);
  const [showColors, setShowColors] = useState(false);
  const [cards, setCards] = useState<CardT[]>([]);
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<PC[]>([]);
  const [moves, setMoves] = useState(0);
  const [miss, setMiss] = useState<number[]>([]);
  const [result, setResult] = useState<{ moves: number; secs: number; best: boolean } | null>(null);
  const startedAt = useRef(0);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
      stopAll();
    },
    [],
  );

  const expose = (cs: CardT[], m: PC[]) => {
    (window as unknown as { __cpQuestion?: unknown }).__cpQuestion = {
      kind: "match",
      cards: cs.map((c) => ({ id: c.id, pc: c.pc, matched: m.includes(c.pc) })),
    };
  };

  const start = () => {
    newVoice();
    const cs = deal(pairs, unlockedNotes(getState().progress));
    setCards(cs);
    setOpen([]);
    setMatched([]);
    setMoves(0);
    setMiss([]);
    setResult(null);
    startedAt.current = performance.now();
    expose(cs, []);
    setPhase("playing");
  };

  const finish = (mv: number) => {
    const secs = Math.round((performance.now() - startedAt.current) / 1000);
    const before = matchBest(getState().progress, pairs);
    const best = before === 0 || mv < before;
    setProgress((p) => ({
      ...p,
      matchGames: appendCapped(p.matchGames, { t: Date.now(), pairs, moves: mv, ms: secs * 1000, colors: showColors }),
    }));
    setResult({ moves: mv, secs, best });
    window.setTimeout(() => {
      setPhase("done");
      fireworks(cards.map((c) => colorOf(settings.noteColors, c.pc)).filter((_, i) => i % 2 === 0), best ? 9 : 5);
    }, 700);
  };

  const flip = (c: CardT) => {
    if (phase !== "playing" || matched.includes(c.pc) || open.includes(c.id) || open.length >= 2) return;
    void playNote(c.midi, 1.0);
    if (open.length === 0) {
      setOpen([c.id]);
      return;
    }
    const first = cards.find((x) => x.id === open[0])!;
    const mv = moves + 1;
    setMoves(mv);
    setOpen([first.id, c.id]);
    if (first.pc === c.pc) {
      const m = [...matched, c.pc];
      setMatched(m);
      expose(cards, m);
      window.setTimeout(() => {
        burstFrom(document.querySelector(`[data-card="${c.id}"]`), [colorOf(settings.noteColors, c.pc), "#ffffff"], 1.3);
        burstFrom(document.querySelector(`[data-card="${first.id}"]`), [colorOf(settings.noteColors, c.pc), "#ffffff"], 1.3);
      }, 50);
      timer.current = window.setTimeout(() => setOpen([]), 450);
      if (m.length === pairs) finish(mv);
    } else {
      setMiss([first.id, c.id]);
      timer.current = window.setTimeout(() => {
        setOpen([]);
        setMiss([]);
      }, 1000);
    }
  };

  const best = matchBest(progress, pairs);

  return (
    <div className="flex min-h-[calc(100dvh-1rem)] flex-col">
      <ScreenHeader
        title={t.exercises.match.title}
        onBack={onBack}
        sub={phase === "playing" ? `${t.match.moves(moves)} · ${t.match.found(matched.length, pairs)}` : best ? t.match.best(best) : undefined}
      />

      {phase === "intro" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
          <div className="text-6xl">🃏</div>
          <p className="text-ink-2">{t.match.rules}</p>
          <div className="w-full space-y-2">
            <div className="text-sm font-semibold text-ink-2">{t.match.size}</div>
            <div className="grid grid-cols-2 gap-2">
              {SIZES.map((n) => (
                <button
                  key={n}
                  data-pairs={n}
                  onClick={() => setPairs(n)}
                  className={cx(
                    "min-h-12 rounded-2xl border font-semibold",
                    pairs === n ? "border-accent bg-accent/15 text-ink" : "border-line bg-surface-2 text-ink-3",
                  )}
                >
                  {t.match.pairs(n)}
                </button>
              ))}
            </div>
          </div>
          <label className="flex w-full items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4 text-left">
            <span>
              <span className="block font-semibold">{t.match.colors}</span>
              <span className="block text-xs text-ink-3">{t.match.colorsHint}</span>
            </span>
            <input type="checkbox" className="h-6 w-6" checked={showColors} onChange={(e) => setShowColors(e.target.checked)} data-testid="match-colors" />
          </label>
          <Button big onClick={start} className="pulse-ring" data-testid="match-start">
            ▶ {t.start}
          </Button>
        </div>
      )}

      {phase === "playing" && (
        <div className="grid flex-1 content-center grid-cols-3 gap-3 pb-[max(1rem,env(safe-area-inset-bottom))]" data-testid="match-board">
          {cards.map((c) => {
            const isMatched = matched.includes(c.pc);
            const isOpen = open.includes(c.id);
            const col = colorOf(settings.noteColors, c.pc);
            const face = isMatched || (isOpen && showColors);
            return (
              <button
                key={c.id}
                data-card={c.id}
                data-state={isMatched ? "matched" : isOpen ? "open" : "closed"}
                onClick={() => flip(c)}
                className={cx(
                  "flex aspect-[3/4] flex-col items-center justify-center rounded-2xl border-2 text-2xl font-black transition duration-300 active:scale-95",
                  isOpen && !isMatched && !miss.includes(c.id) && "scale-105 border-white",
                  miss.includes(c.id) && "border-bad",
                  !isOpen && !isMatched && "border-line",
                  isMatched && "border-transparent",
                  miss.includes(c.id) && "shake",
                )}
                style={
                  face
                    ? { background: col, color: inkOn(col), boxShadow: isMatched ? `0 0 18px 3px ${col}` : undefined }
                    : isOpen
                      ? {
                          background: "var(--surface)",
                          boxShadow: miss.includes(c.id) ? "0 0 18px 3px rgb(239 68 68 / 0.6)" : "0 0 18px 2px var(--ink-3)",
                        }
                      : { background: "linear-gradient(135deg, var(--surface-2), var(--surface))" }
                }
              >
                {isMatched ? nameOf(c.pc) : isOpen ? "🔊" : "♪"}
              </button>
            );
          })}
        </div>
      )}

      {phase === "done" && result && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <div className="text-6xl">{result.best ? "🏆" : "🃏"}</div>
          <h2 className="text-2xl font-black">{result.best ? t.fx.newBest : t.match.done}</h2>
          <Card className="w-full space-y-1">
            <div className="text-ink-2" data-testid="match-result">
              {t.match.result(result.moves, result.secs)}
            </div>
            <div className="text-sm text-ink-3">{t.match.perfect(pairs)}</div>
          </Card>
          <div className="grid w-full grid-cols-2 gap-3">
            <Button variant="secondary" onClick={onBack}>
              {t.done}
            </Button>
            <Button onClick={start} data-testid="match-again">
              {t.match.again}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
