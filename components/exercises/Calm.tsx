"use client";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { colorOf, inkOn } from "@/lib/colors";
import { nameOf, pick, randInt, type PC } from "@/lib/music";
import { playNote, setVoiceOverride, stopAll } from "@/lib/audio";
import { addPractice, appendCapped, unlockedNotes } from "@/lib/state";
import { Button, ScreenHeader, cx } from "../ui";
import { t } from "@/i18n";

const MINUTES = [5, 10, 15];
const ALL: PC[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const EVERY_MS = 4500;
type Phase = "intro" | "playing" | "paused" | "done";

/**
 * Passive pairing: slow notes, one at a time, with the whole screen in that note's color.
 * Nothing to answer. Repeated pairing is how trained synesthesia-like links form. The time
 * listened is added to today's practice when the session ends.
 */
export function Calm({ onBack }: { onBack: () => void }) {
  const { state, setProgress } = useStore();
  const { settings, progress } = state;

  const [phase, setPhase] = useState<Phase>("intro");
  const [minutes, setMinutes] = useState(5);
  const [names, setNames] = useState(true);
  const [all, setAll] = useState(false);
  const [note, setNote] = useState<PC | null>(null);
  const [left, setLeft] = useState(0);
  const [listened, setListened] = useState(0);
  const elapsed = useRef(0); // ms played, excluding pauses
  const tickAt = useRef(0);
  const nextAt = useRef(0);
  const last = useRef<PC | null>(null);
  const wake = useRef<{ release: () => Promise<void> } | null>(null);
  const phaseRef = useRef<Phase>("intro");
  phaseRef.current = phase;

  const keepAwake = async () => {
    try {
      const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
      wake.current = (await nav.wakeLock?.request("screen")) ?? null;
    } catch {
      wake.current = null;
    }
  };
  const letSleep = () => {
    void wake.current?.release().catch(() => {});
    wake.current = null;
  };

  const finish = () => {
    const secs = Math.round(elapsed.current / 1000);
    setVoiceOverride(null);
    letSleep();
    setListened(secs);
    setPhase("done");
    if (secs > 0) {
      setProgress((p) => addPractice({ ...p, calmSessions: appendCapped(p.calmSessions, { t: Date.now(), secs }) }, secs));
    }
  };

  // The loop: count time, play the next note every few seconds.
  useEffect(() => {
    if (phase !== "playing") return;
    tickAt.current = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      elapsed.current += now - tickAt.current;
      tickAt.current = now;
      const remain = minutes * 60_000 - elapsed.current;
      setLeft(Math.max(0, remain));
      if (remain <= 0) {
        finish();
        return;
      }
      if (elapsed.current >= nextAt.current) {
        nextAt.current = elapsed.current + EVERY_MS;
        const pool = all ? ALL : unlockedNotes(progress);
        let pc = pick(pool);
        if (pc === last.current && pool.length > 1) pc = pick(pool.filter((x) => x !== pc));
        last.current = pc;
        setNote(pc);
        (window as unknown as { __cpQuestion?: unknown }).__cpQuestion = { kind: "calm", note: pc, elapsed: elapsed.current };
        void playNote(48 + pc + randInt(0, 1) * 12, 3.2);
      }
    }, 200);
    return () => window.clearInterval(id);
    // finish/progress read at tick time; the loop restarts only on phase/settings changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, minutes, all]);

  // Going to the background pauses.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden" && phaseRef.current === "playing") setPhase("paused");
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      setVoiceOverride(null);
      letSleep();
      stopAll();
    };
  }, []);

  const start = () => {
    elapsed.current = 0;
    nextAt.current = 0;
    setLeft(minutes * 60_000);
    setNote(null);
    setVoiceOverride("soft");
    void keepAwake();
    setPhase("playing");
  };

  const bg = note === null ? "var(--bg)" : colorOf(settings.noteColors, note);
  const ink = note === null ? "var(--ink)" : inkOn(colorOf(settings.noteColors, note));
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  const total = progress.calmSessions.reduce((a, x) => a + x.secs, 0);

  if (phase === "playing" || phase === "paused") {
    return (
      <div
        className="-mx-4 -mt-2 flex min-h-dvh flex-col items-center justify-between px-4 py-[max(1.5rem,env(safe-area-inset-top))] transition-[background-color,color] duration-[2000ms]"
        style={{ backgroundColor: bg, color: ink }}
        data-testid="calm-stage"
      >
        <div className="text-lg font-semibold tabular-nums opacity-80" data-testid="calm-left">
          {t.calm.left(m, s)}
        </div>
        <div className={cx("text-[7rem] font-black leading-none transition-opacity duration-1000", (!names || note === null) && "opacity-0")} data-testid="calm-note">
          {note !== null ? nameOf(note) : ""}
        </div>
        <div className="grid w-full max-w-sm grid-cols-2 gap-3 pb-[env(safe-area-inset-bottom)]">
          {phase === "playing" ? (
            <Button variant="secondary" onClick={() => setPhase("paused")} data-testid="calm-pause">
              ⏸ {t.calm.pause}
            </Button>
          ) : (
            <Button onClick={() => setPhase("playing")} data-testid="calm-resume">
              ▶ {t.calm.resume}
            </Button>
          )}
          <Button variant="secondary" onClick={finish} data-testid="calm-stop">
            ■ {t.calm.stop}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-1rem)] flex-col">
      <ScreenHeader title={t.exercises.calm.title} onBack={onBack} sub={total ? `${Math.round(total / 60)} ${t.stats.minutes}` : undefined} />
      {phase === "intro" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
          <div className="text-6xl">🌈</div>
          <p className="text-ink-2">{t.calm.rules}</p>
          <div className="grid w-full grid-cols-3 gap-2">
            {MINUTES.map((n) => (
              <button
                key={n}
                data-minutes={n}
                onClick={() => setMinutes(n)}
                className={cx("min-h-12 rounded-2xl border font-semibold", minutes === n ? "border-accent bg-accent/15 text-ink" : "border-line bg-surface-2 text-ink-3")}
              >
                {t.calm.minutes(n)}
              </button>
            ))}
          </div>
          <label className="flex w-full items-center justify-between rounded-2xl border border-line bg-surface p-4 text-left">
            <span className="font-semibold">{t.calm.showNames}</span>
            <input type="checkbox" className="h-6 w-6" checked={names} onChange={(e) => setNames(e.target.checked)} />
          </label>
          <label className="flex w-full items-center justify-between rounded-2xl border border-line bg-surface p-4 text-left">
            <span className="font-semibold">{t.calm.allNotes}</span>
            <input type="checkbox" className="h-6 w-6" checked={all} onChange={(e) => setAll(e.target.checked)} data-testid="calm-all" />
          </label>
          <Button big onClick={start} className="pulse-ring" data-testid="calm-start">
            ▶ {t.start}
          </Button>
        </div>
      )}
      {phase === "done" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <div className="text-6xl">🌈</div>
          <h2 className="text-2xl font-black">{t.calm.done}</h2>
          <p className="text-ink-2" data-testid="calm-done">
            {t.calm.doneBody(listened)}
          </p>
          <Button big className="w-full" onClick={onBack}>
            {t.done}
          </Button>
        </div>
      )}
    </div>
  );
}
