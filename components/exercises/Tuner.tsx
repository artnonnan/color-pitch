"use client";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { colorOf, inkOn } from "@/lib/colors";
import { freqToMidiFloat, midiName, nameOf, pcDiff, pcOf, type PC } from "@/lib/music";
import { capturePitch, startMic, type MicError, type MicSession } from "@/lib/pitch";
import { Keyboard } from "../Keyboard";
import { Button, Card, ColorWash, NoteDot, ScreenHeader, cx } from "../ui";
import { t } from "@/i18n";

const ALL: PC[] = Array.from({ length: 12 }, (_, i) => i);

export function Tuner({ onBack }: { onBack?: () => void }) {
  const { state, setProgress } = useStore();
  const { settings, progress } = state;
  const [guess, setGuess] = useState<PC | null>(null);
  const [listening, setListening] = useState(false);
  const [level, setLevel] = useState(0);
  const [result, setResult] = useState<{ midi: number; cents: number; guess: PC } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wash, setWash] = useState(0);
  const mic = useRef<MicSession | null>(null);

  useEffect(() => () => mic.current?.stop(), []);

  const detect = async () => {
    if (guess === null || listening) return;
    setError(null);
    setResult(null);
    try {
      const m = await startMic();
      mic.current = m;
      setListening(true);
      const freq = await capturePitch(m, 3000, 4, (f) => setLevel(f.level));
      m.stop();
      mic.current = null;
      setListening(false);
      setLevel(0);
      if (!freq) {
        setError(t.tuner.noPitch);
        return;
      }
      const mf = freqToMidiFloat(freq);
      const midi = Math.round(mf);
      const cents = Math.round((mf - midi) * 100);
      setResult({ midi, cents, guess });
      setWash((w) => w + 1);
      const g = guess;
      setProgress((p) => ({
        ...p,
        tuner: [...p.tuner, { t: Date.now(), guess: g, actual: pcOf(midi), cents, freq }].slice(-500),
      }));
    } catch (e) {
      mic.current = null;
      setListening(false);
      setError((e as MicError) === "unsupported" ? t.mic.unsupported : t.mic.denied);
    }
  };

  const log = progress.tuner;
  const hits = log.filter((x) => x.guess === x.actual).length;
  const actualColor = result ? colorOf(settings.noteColors, result.midi) : null;

  return (
    <div className="flex flex-col gap-4 pb-28">
      <ScreenHeader title={t.exercises.tuner.title} onBack={onBack} />
      {result && actualColor && <ColorWash color={actualColor} k={wash} />}
      <p className="text-ink-2">{t.tuner.intro}</p>

      <div className="relative z-[11] space-y-2">
        <div className="text-sm font-semibold">{t.tuner.pickGuess}</div>
        <Keyboard
          colors={settings.noteColors}
          enabled={ALL}
          onPress={(pc) => {
            setGuess(pc);
            setResult(null);
          }}
          flashes={guess !== null ? [{ pc: guess, kind: "reveal", k: guess }] : []}
          height={170}
          hideColors={settings.hardMode}
        />
      </div>

      <Button
        big
        disabled={guess === null || listening}
        onClick={detect}
        className={cx("relative z-[11]", listening && "pulse-ring")}
        style={listening ? { transform: `scale(${1 + level * 0.08})` } : undefined}
      >
        🎤 {listening ? t.tuner.listening : t.tuner.detectTap}
      </Button>
      {error && <p className="rounded-2xl bg-bad/10 px-4 py-2 text-sm text-bad">{error}</p>}

      {result && actualColor && (
        <Card className="pop relative z-[11] flex items-center gap-4">
          <div
            className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full text-4xl font-black"
            style={{ background: actualColor, color: inkOn(actualColor), boxShadow: `0 0 40px ${actualColor}` }}
          >
            {nameOf(result.midi)}
          </div>
          <div className="space-y-1">
            <div className="text-sm text-ink-3">
              {t.tuner.actual} {midiName(result.midi)} ({result.cents > 0 ? "+" : ""}
              {result.cents}¢)
            </div>
            <div className={cx("text-2xl font-black", result.guess === pcOf(result.midi) ? "text-good" : "text-bad")}>
              {result.guess === pcOf(result.midi) ? t.tuner.hit : t.tuner.miss(pcDiff(result.guess, pcOf(result.midi)))}
            </div>
            <div className="text-sm text-ink-2">
              {t.tuner.yourGuess} {nameOf(result.guess)}
            </div>
          </div>
        </Card>
      )}

      <Card className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-bold">{t.tuner.history}</h2>
          {log.length > 0 && (
            <span className="text-sm text-ink-3">{t.tuner.accuracy(Math.round((hits / log.length) * 100), log.length)}</span>
          )}
        </div>
        {log.length === 0 && <p className="text-sm text-ink-3">{t.tuner.empty}</p>}
        <ul className="space-y-2">
          {log
            .slice(-8)
            .reverse()
            .map((x) => (
              <li key={x.t} className="flex items-center gap-3 text-sm">
                <NoteDot size={28} color={colorOf(settings.noteColors, x.guess)} label={nameOf(x.guess)} />
                <span className="text-ink-3">→</span>
                <NoteDot size={28} color={colorOf(settings.noteColors, x.actual)} label={nameOf(x.actual)} />
                <span className={cx("ml-auto font-semibold", x.guess === x.actual ? "text-good" : "text-ink-3")}>
                  {x.guess === x.actual ? "✓" : `${pcDiff(x.guess, x.actual) > 0 ? "+" : ""}${pcDiff(x.guess, x.actual)}`}
                </span>
                <span className="w-20 text-right text-xs text-ink-3">
                  {new Date(x.t).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
                </span>
              </li>
            ))}
        </ul>
      </Card>
    </div>
  );
}
