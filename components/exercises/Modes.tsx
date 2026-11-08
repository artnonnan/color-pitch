"use client";
import { useEffect, useRef, useState } from "react";
import { useStore, usePracticeTimer } from "@/lib/store";
import { MODES, MODE_INTERVALS, MODE_LABEL, pick, type Mode } from "@/lib/music";
import { newVoice, playSequence, stopAll } from "@/lib/audio";
import { modesUnlocked } from "@/lib/state";
import { Button, Card, ScreenHeader, cx } from "../ui";
import { t } from "@/i18n";

const ROUNDS = 7;
// Brightest (index 0) → darkest (index 6).
const SHADES = ["#fff3c4", "#ffd98a", "#f5a65b", "#c46a6a", "#6b4c8a", "#33305f", "#12111f"];
const shadeInk = (i: number) => (i <= 2 ? "#1d1a12" : "#f5f2ff");

export function Modes({ onBack }: { onBack: () => void }) {
  const { state, setProgress } = useStore();
  const unlocked = modesUnlocked(state.progress);
  usePracticeTimer(unlocked);

  const [mode, setMode] = useState<Mode | null>(null);
  const [pos, setPos] = useState(3);
  const [result, setResult] = useState<{ off: number } | null>(null);
  const [n, setN] = useState(0);
  const [score, setScore] = useState(0);
  const last = useRef<Mode | null>(null);

  useEffect(() => () => stopAll(), []);

  const play = (m: Mode) => playSequence(MODE_INTERVALS[m].map((i) => 60 + i), 0.36, 0.45);

  const ask = () => {
    newVoice();
    let m = pick(MODES);
    if (m === last.current) m = pick(MODES);
    last.current = m;
    setMode(m);
    setPos(3);
    setResult(null);
    void play(m);
  };

  const confirm = () => {
    if (!mode) return;
    const truth = MODES.indexOf(mode);
    const off = Math.abs(truth - pos);
    setResult({ off });
    setN((x) => x + 1);
    if (off === 0) setScore((s) => s + 1);
    setProgress((p) => ({ ...p, modeAnswers: [...p.modeAnswers, { t: Date.now(), target: mode, answer: MODES[pos] }] }));
  };

  if (!unlocked) {
    return (
      <div>
        <ScreenHeader title={t.exercises.modes.title} onBack={onBack} />
        <Card className="space-y-2 text-center">
          <div className="text-5xl">🔒</div>
          <h2 className="text-xl font-bold">{t.modes.locked}</h2>
          <p className="text-ink-2">{t.modes.lockedBody}</p>
        </Card>
      </div>
    );
  }

  const shownPos = result && mode ? MODES.indexOf(mode) : pos;
  const bg = SHADES[shownPos];
  const done = n >= ROUNDS && result;

  return (
    <div
      className="-mx-4 -mt-2 flex min-h-dvh flex-col px-4 pt-2 transition-[background] duration-700"
      style={{ background: `linear-gradient(180deg, ${bg} 0%, color-mix(in srgb, ${bg} 70%, var(--bg)) 100%)`, color: shadeInk(shownPos) }}
    >
      <ScreenHeader title={t.exercises.modes.title} onBack={onBack} sub={`${Math.min(n + (result ? 0 : 1), ROUNDS)}/${ROUNDS}`} />
      <div className="flex flex-1 flex-col justify-center gap-6 text-center">
        {!mode ? (
          <>
            <p className="text-lg">{t.modes.listen}</p>
            <Button big onClick={ask} className="mx-auto pulse-ring">
              ▶ {t.start}
            </Button>
          </>
        ) : (
          <>
            <p className="text-lg font-medium">{t.modes.listen}</p>
            <Button variant="secondary" className="mx-auto" onClick={() => void play(mode)}>
              ↻ {t.replay}
            </Button>

            {/* brightness scale */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold opacity-80">
                <span>☀️ {t.modes.brightest}</span>
                <span>{t.modes.darkest} 🌑</span>
              </div>
              <div
                className="relative h-16 rounded-2xl border border-black/10"
                style={{ background: `linear-gradient(90deg, ${SHADES.join(", ")})` }}
              >
                {MODES.map((m, i) => (
                  <button
                    key={m}
                    data-mode={m}
                    disabled={!!result}
                    onClick={() => setPos(i)}
                    aria-label={MODE_LABEL[m]}
                    className="absolute top-0 h-full"
                    style={{ left: `${(i / 7) * 100}%`, width: `${100 / 7}%` }}
                  />
                ))}
                <div
                  className="pointer-events-none absolute top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white shadow-xl transition-[left] duration-300"
                  style={{ left: `${((shownPos + 0.5) / 7) * 100}%`, background: SHADES[shownPos] }}
                />
                {result && result.off > 0 && (
                  <div
                    className="pointer-events-none absolute top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-white/80"
                    style={{ left: `${((pos + 0.5) / 7) * 100}%` }}
                  />
                )}
              </div>
              <input
                type="range"
                min={0}
                max={6}
                step={1}
                value={pos}
                disabled={!!result}
                onChange={(e) => setPos(Number(e.target.value))}
                className="h-10 w-full"
                aria-label="brightness"
              />
              <div className="grid grid-cols-7 text-[10px] font-medium opacity-70">
                {MODES.map((m) => (
                  <span key={m} className="truncate">
                    {result ? MODE_LABEL[m] : "·"}
                  </span>
                ))}
              </div>
            </div>

            {!result ? (
              <Button big onClick={confirm} className="mx-auto">
                {t.modes.confirm}
              </Button>
            ) : (
              <div className="pop space-y-2">
                <div className={cx("text-2xl font-black")}>{result.off === 0 ? t.modes.correct : t.modes.off(result.off)}</div>
                <div className="text-lg">{t.modes.itWas(MODE_LABEL[mode])}</div>
                {done ? (
                  <>
                    <div className="text-lg">{t.quiz.summaryLine(score, n)}</div>
                    <Button big onClick={onBack}>
                      {t.done}
                    </Button>
                  </>
                ) : (
                  <Button big onClick={ask}>
                    {t.next} ›
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
