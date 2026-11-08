"use client";
import { useEffect, useRef, useState } from "react";
import { useStore, usePracticeTimer } from "@/lib/store";
import { colorOf } from "@/lib/colors";
import type { PC } from "@/lib/music";
import { newVoice, playNote, stopAll } from "@/lib/audio";
import { appendCapped, pickNoteMidi, rainBest, unlockedNotes } from "@/lib/state";
import { Keyboard, type KeyFlash } from "../Keyboard";
import { Button, Card, ScreenHeader, cx } from "../ui";
import { burst, fireworks } from "../fx/Burst";
import { ComboBadge } from "../fx/Celebration";
import { t } from "@/i18n";

const LIVES = 3;
const GRAY = "#8a8696";
interface Drop {
  id: number;
  pc: PC;
  midi: number;
  born: number; // game-clock ms
  dur: number; // ms to reach the ground
  x: number; // 0–1 across the field
}
type Phase = "intro" | "playing" | "paused" | "over";

/**
 * Speed ramps over the first two minutes: drops fall faster, come more often, and more
 * of them can be in the air at once.
 */
function pace(elapsedMs: number) {
  const f = Math.min(1, elapsedMs / 120_000);
  return {
    dur: 5600 - 3200 * f,
    gap: 3200 - 1900 * f,
    maxActive: elapsedMs < 30_000 ? 1 : elapsedMs < 75_000 ? 2 : 3,
  };
}

/** Color Rain: colored drops fall with their note; tap the key before they land. */
export function Rain({ onBack }: { onBack: () => void }) {
  const { state, setProgress, getState } = useStore();
  const { settings, progress } = state;
  usePracticeTimer(true);

  const [phase, setPhase] = useState<Phase>("intro");
  const [gray, setGray] = useState(settings.hardMode);
  const [, setTick] = useState(0);
  const [flashes, setFlashes] = useState<KeyFlash[]>([]);
  const [floater, setFloater] = useState<{ text: string; k: number; color: string; x: number; y: number } | null>(null);
  const [newBest, setNewBest] = useState(false);
  const field = useRef<HTMLDivElement | null>(null);
  const drops = useRef<Drop[]>([]);
  const clock = useRef({ start: 0, pausedAt: 0, pausedTotal: 0 });
  const nextSpawn = useRef(0);
  const nextId = useRef(1);
  const lastPc = useRef<PC | null>(null);
  const live = useRef({ score: 0, combo: 0, maxCombo: 0, caught: 0, missed: 0, wrong: 0, lives: LIVES });
  const k = useRef(0);
  const bestBefore = useRef(0);
  const phaseRef = useRef<Phase>("intro");
  phaseRef.current = phase;

  /** Game time: real time minus pauses. */
  const gameNow = () => performance.now() - clock.current.start - clock.current.pausedTotal;

  useEffect(() => () => stopAll(), []);

  const expose = () => {
    const now = gameNow();
    (window as unknown as { __cpQuestion?: unknown }).__cpQuestion = {
      kind: "rain",
      drops: drops.current.map((d) => ({ id: d.id, pc: d.pc, y: Math.min(1, (now - d.born) / d.dur) })),
      lives: live.current.lives,
      score: live.current.score,
    };
  };

  const spawn = (now: number) => {
    const next = pickNoteMidi(getState(), lastPc.current);
    lastPc.current = next.pc;
    newVoice();
    const p = pace(now);
    drops.current.push({ id: nextId.current++, pc: next.pc, midi: next.midi, born: now, dur: p.dur, x: 0.2 + Math.random() * 0.6 });
    void playNote(next.midi, 1.0);
  };

  const finish = () => {
    const L = live.current;
    const secs = Math.round(gameNow() / 1000);
    const isBest = L.score > bestBefore.current && L.score > 0;
    setNewBest(isBest);
    setPhase("over");
    drops.current = [];
    expose();
    setProgress((p) => ({
      ...p,
      rain: appendCapped(p.rain, { t: Date.now(), score: L.score, caught: L.caught, missed: L.missed, wrong: L.wrong, maxCombo: L.maxCombo, gray, secs }),
    }));
    if (isBest) {
      const cs = unlockedNotes(getState().progress).map((pc) => colorOf(settings.noteColors, pc));
      window.setTimeout(() => fireworks(cs, 9), 200);
    }
  };

  // The game loop: move drops, land the ones that reach the ground, spawn new ones.
  useEffect(() => {
    if (phase !== "playing") return;
    let raf = 0;
    const step = () => {
      const now = gameNow();
      const landed = drops.current.filter((d) => now - d.born >= d.dur);
      if (landed.length) {
        drops.current = drops.current.filter((d) => now - d.born < d.dur);
        const L = live.current;
        L.lives -= landed.length;
        L.missed += landed.length;
        L.combo = 0;
        k.current++;
        setFlashes(landed.map((d) => ({ pc: d.pc, kind: "reveal" as const, k: k.current })));
        if (L.lives <= 0) {
          L.lives = 0;
          finish();
          return;
        }
      }
      const p = pace(now);
      if (now >= nextSpawn.current && drops.current.length < p.maxActive) {
        spawn(now);
        nextSpawn.current = now + p.gap;
      }
      expose();
      setTick((x) => x + 1);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // gameNow/spawn/finish read refs only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Pause when the app goes to the background.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden" && phaseRef.current === "playing") pause();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = () => {
    bestBefore.current = rainBest(getState().progress);
    live.current = { score: 0, combo: 0, maxCombo: 0, caught: 0, missed: 0, wrong: 0, lives: LIVES };
    drops.current = [];
    clock.current = { start: performance.now(), pausedAt: 0, pausedTotal: 0 };
    nextSpawn.current = 400;
    setFlashes([]);
    setNewBest(false);
    setPhase("playing");
  };
  function pause() {
    clock.current.pausedAt = performance.now();
    setPhase("paused");
  }
  const resume = () => {
    clock.current.pausedTotal += performance.now() - clock.current.pausedAt;
    setPhase("playing");
  };

  const press = (pc: PC) => {
    if (phase !== "playing") return;
    const now = gameNow();
    const L = live.current;
    k.current++;
    // The lowest drop of that note is the one caught.
    const hit = drops.current
      .filter((d) => d.pc === pc)
      .sort((a, b) => (now - b.born) / b.dur - (now - a.born) / a.dur)[0];
    if (!hit) {
      L.combo = 0;
      L.wrong++;
      setFlashes([{ pc, kind: "wrong", k: k.current }]);
      return;
    }
    const y = Math.min(1, (now - hit.born) / hit.dur);
    drops.current = drops.current.filter((d) => d.id !== hit.id);
    L.caught++;
    L.combo++;
    L.maxCombo = Math.max(L.maxCombo, L.combo);
    const mult = Math.min(5, 1 + Math.floor(L.combo / 5));
    const pts = 10 * mult + Math.round((1 - y) * 10); // earlier catch, more points
    L.score += pts;
    const col = colorOf(settings.noteColors, pc);
    setFlashes([{ pc, kind: "correct", k: k.current }]);
    const r = field.current?.getBoundingClientRect();
    if (r) {
      const px = r.left + hit.x * r.width;
      const py = r.top + y * (r.height - 56) + 28;
      burst([col, "#ffffff"], px, py, Math.min(3, 1 + L.combo / 6));
      setFloater({ text: `+${pts}`, k: k.current, color: col, x: hit.x, y });
    }
    expose();
  };

  const replayLowest = () => {
    const now = gameNow();
    const low = [...drops.current].sort((a, b) => (now - b.born) / b.dur - (now - a.born) / a.dur)[0];
    if (low) void playNote(low.midi, 1.0);
  };

  const best = rainBest(progress);
  const L = live.current;
  const now = phase === "playing" || phase === "paused" ? (phase === "paused" ? clock.current.pausedAt - clock.current.start - clock.current.pausedTotal : gameNow()) : 0;

  return (
    <div className="flex min-h-[calc(100dvh-1rem)] flex-col">
      <ScreenHeader
        title={t.exercises.rain.title}
        onBack={onBack}
        sub={best ? t.rain.best(best) : t.rain.noBest}
        right={
          phase === "playing" ? (
            <Button variant="secondary" onClick={pause} data-testid="rain-pause">
              ⏸
            </Button>
          ) : undefined
        }
      />

      {phase === "intro" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
          <div className="text-6xl">🌧️</div>
          <p className="text-ink-2">{t.rain.rules}</p>
          <label className="flex w-full items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4 text-left">
            <span>
              <span className="block font-semibold">{t.rain.gray}</span>
              <span className="block text-xs text-ink-3">{t.rain.grayHint}</span>
            </span>
            <input type="checkbox" className="h-6 w-6" checked={gray} onChange={(e) => setGray(e.target.checked)} data-testid="rain-gray" />
          </label>
          <Button big onClick={start} className="pulse-ring" data-testid="rain-start">
            ▶ {t.start}
          </Button>
        </div>
      )}

      {(phase === "playing" || phase === "paused") && (
        <>
          <div className="flex items-center justify-between px-1">
            <span className="text-xl" data-testid="rain-lives" aria-label={t.rain.lives}>
              {"❤️".repeat(L.lives)}
              <span className="opacity-30">{"🤍".repeat(LIVES - L.lives)}</span>
            </span>
            <ComboBadge combo={L.combo} />
            <span className="text-3xl font-black tabular-nums" data-testid="rain-score">
              {L.score}
            </span>
          </div>
          <div
            ref={field}
            className="relative mt-2 min-h-56 flex-1 overflow-hidden rounded-3xl border border-line bg-gradient-to-b from-surface/40 to-surface"
            data-testid="rain-field"
          >
            {drops.current.map((d) => {
              const y = Math.min(1, Math.max(0, (now - d.born) / d.dur));
              const col = gray ? GRAY : colorOf(settings.noteColors, d.pc);
              return (
                <div
                  key={d.id}
                  data-drop={d.id}
                  className="absolute h-14 w-14 -translate-x-1/2 rounded-full rounded-tl-none"
                  style={{
                    left: `${d.x * 100}%`,
                    top: `calc(${y} * (100% - 3.5rem))`,
                    transform: "translateX(-50%) rotate(45deg)",
                    background: `radial-gradient(circle at 35% 35%, color-mix(in srgb, ${col} 40%, #fff), ${col})`,
                    boxShadow: `0 0 18px 4px ${col}88`,
                  }}
                />
              );
            })}
            {floater && (
              <span
                key={floater.k}
                className="float-up pointer-events-none absolute -translate-x-1/2 text-2xl font-black"
                style={{ left: `${floater.x * 100}%`, top: `calc(${floater.y} * (100% - 3.5rem))`, color: floater.color }}
              >
                {floater.text}
              </span>
            )}
            <div className="absolute inset-x-0 bottom-0 h-1 bg-bad/60" />
            {phase === "paused" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-bg/70 backdrop-blur">
                <div className="text-xl font-bold">{t.rain.paused}</div>
                <Button big onClick={resume} data-testid="rain-resume">
                  ▶ {t.rain.resume}
                </Button>
              </div>
            )}
          </div>
          <div className="my-2 flex justify-center">
            <Button variant="ghost" onClick={replayLowest} disabled={phase !== "playing"}>
              ↻ {t.rain.replay}
            </Button>
          </div>
          <div className="pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Keyboard
              colors={settings.noteColors}
              enabled={unlockedNotes(progress)}
              onPress={press}
              hideColors={gray}
              flashes={flashes}
              disabled={phase !== "playing"}
              height={180}
            />
          </div>
        </>
      )}

      {phase === "over" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <div className="text-6xl">{newBest ? "🏆" : "🌧️"}</div>
          <h2 className="text-2xl font-black">{newBest ? t.fx.newBest : t.rain.gameOver}</h2>
          <Card className="w-full space-y-1">
            <div className="text-5xl font-black tabular-nums" data-testid="rain-final">
              {L.score}
            </div>
            <div className="text-ink-2">{t.rain.result(L.caught, Math.round((progress.rain.at(-1)?.secs ?? 0)))}</div>
            <div className="text-sm text-ink-3">{t.rain.maxCombo(L.maxCombo)}</div>
          </Card>
          <div className={cx("grid w-full grid-cols-2 gap-3")}>
            <Button variant="secondary" onClick={onBack}>
              {t.done}
            </Button>
            <Button onClick={start} data-testid="rain-again">
              {t.rain.again}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
