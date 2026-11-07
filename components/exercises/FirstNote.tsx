"use client";
import { useEffect, useRef, useState } from "react";
import { useStore, usePracticeTimer } from "@/lib/store";
import { colorOf, inkOn } from "@/lib/colors";
import { centsFromPc, freqToMidiFloat, nameOf, pcDiff, pcOf, randInt, type PC } from "@/lib/music";
import { playNote, stopAll, wait } from "@/lib/audio";
import { capturePitch, startMic, type MicError, type MicSession } from "@/lib/pitch";
import { MicErrorBox, toMicError } from "../MicErrorBox";
import { dayKey, firstNoteTarget, markStepDone, type FirstNoteEntry } from "@/lib/state";
import { Button, Card, ColorWash, ScreenHeader, cx } from "../ui";
import { t } from "@/i18n";

type Phase = "intro" | "listening" | "slider" | "result";

const SLIDER_LO = 48; // C3
const SLIDER_HI = 72; // C5

export function FirstNote({ onDone, onBack, sessionLabel }: { onDone: () => void; onBack: () => void; sessionLabel?: string }) {
  const { state, setProgress } = useStore();
  const { settings, progress } = state;
  usePracticeTimer(true);
  const today = dayKey();
  const target = firstNoteTarget(progress, today);
  const existing = progress.firstNote[today];
  const color = colorOf(settings.noteColors, target);

  const [phase, setPhase] = useState<Phase>(existing && existing.method !== "skip" ? "result" : "intro");
  const [entry, setEntry] = useState<FirstNoteEntry | null>(existing && existing.method !== "skip" ? existing : null);
  const [level, setLevel] = useState(0);
  const [progressPct, setProgressPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [micErr, setMicErr] = useState<MicError | null>(null);
  const [slider, setSlider] = useState(() => randInt(SLIDER_LO, SLIDER_HI));
  const [realMidi, setRealMidi] = useState<number | null>(null);
  const [wash, setWash] = useState(0);
  const mic = useRef<MicSession | null>(null);
  const sliderTimer = useRef<number | null>(null);
  const alreadyDone = !!existing && existing.method !== "skip" && phase === "result" && !wash;

  useEffect(
    () => () => {
      mic.current?.stop();
      stopAll();
    },
    [],
  );

  const save = (e: FirstNoteEntry, nearMidi: number) => {
    setEntry(e);
    setProgress((p) => markStepDone({ ...p, firstNote: { ...p.firstNote, [today]: e } }, "first"));
    // The real note, in the octave closest to what the user produced.
    const real = Math.round((nearMidi - target) / 12) * 12 + target;
    setRealMidi(real);
    setPhase("result");
    setWash((w) => w + 1);
    void wait(500).then(() => playNote(real, 2));
  };

  const hum = async () => {
    setError(null);
    setMicErr(null);
    try {
      const m = await startMic(); // called straight from the tap
      mic.current = m;
      setPhase("listening");
      // Let the user settle in, then measure.
      const freq = await capturePitch(m, 3200, 20, (f, pr) => {
        setLevel(f.level);
        setProgressPct(pr);
      });
      m.stop();
      mic.current = null;
      if (!freq) {
        setError(t.first.noPitch);
        setPhase("intro");
        return;
      }
      const cents = centsFromPc(freq, target);
      save({ target, cents, method: "mic", freq }, freqToMidiFloat(freq));
    } catch (e) {
      mic.current = null;
      setMicErr(toMicError(e));
      setPhase("slider");
    }
  };

  const onSlide = (v: number) => {
    setSlider(v);
    if (sliderTimer.current) window.clearTimeout(sliderTimer.current);
    sliderTimer.current = window.setTimeout(() => void playNote(v, 0.9), 90);
  };
  const confirmSlider = () => {
    const pc: PC = pcOf(slider);
    save({ target, cents: pcDiff(pc, target) * 100, method: "slider" }, slider);
  };

  const skip = () => {
    setProgress((p) => markStepDone({ ...p, firstNote: { ...p.firstNote, [today]: { target, cents: null, method: "skip" } } }, "first"));
    onDone();
  };

  return (
    <div className="flex min-h-[calc(100dvh-1rem)] flex-col">
      <ScreenHeader title={t.exercises.first.title} sub={sessionLabel} onBack={onBack} />
      {wash > 0 && <ColorWash color={color} k={wash} />}
      <div className="relative z-[11] flex flex-1 flex-col items-center justify-center gap-6 pb-8 text-center">
        <div
          className={cx("flex h-36 w-36 items-center justify-center rounded-full text-6xl font-black", phase === "listening" && "pulse-ring")}
          style={{
            background: color,
            color: inkOn(color),
            boxShadow: `0 0 ${30 + level * 120}px ${color}`,
            transform: `scale(${1 + level * 0.15})`,
            transition: "transform 80ms linear, box-shadow 80ms linear",
          }}
        >
          {nameOf(target)}
        </div>

        {phase === "intro" && (
          <>
            <div className="space-y-1">
              <p className="text-xl font-semibold">{t.first.intro(nameOf(target))}</p>
              <p className="text-ink-2">{t.first.noReference}</p>
              <p className="text-xs text-ink-3">{t.first.rotateHint}</p>
            </div>
            {error && <p className="rounded-2xl bg-bad/10 px-4 py-2 text-sm text-bad">{error}</p>}
            <div className="flex w-full flex-col gap-3">
              <Button big onClick={hum}>
                🎤 {t.first.useMic}
              </Button>
              <Button variant="secondary" onClick={() => setPhase("slider")}>
                🎚️ {t.first.useSlider}
              </Button>
              <Button variant="ghost" onClick={skip}>
                {t.first.gateSkip}
              </Button>
            </div>
          </>
        )}

        {phase === "listening" && (
          <div className="w-full space-y-3">
            <p className="text-xl font-semibold">{t.first.listening}</p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
              <div className="h-full bg-accent" style={{ width: `${progressPct * 100}%` }} />
            </div>
          </div>
        )}

        {phase === "slider" && (
          <div className="w-full space-y-4">
            {micErr && <MicErrorBox error={micErr} onRetry={hum} />}
            <p className="text-ink-2">{t.first.sliderHelp}</p>
            <input
              type="range"
              min={SLIDER_LO}
              max={SLIDER_HI}
              step={1}
              value={slider}
              onChange={(e) => onSlide(Number(e.target.value))}
              className="h-14 w-full"
              aria-label="pitch slider"
            />
            <Button big className="w-full" onClick={confirmSlider}>
              {t.first.confirm}
            </Button>
          </div>
        )}

        {phase === "result" && entry && entry.cents !== null && (
          <Card className="pop w-full space-y-2">
            {alreadyDone && <p className="text-sm text-ink-3">{t.first.alreadyDone} · {t.first.alreadyDoneBody}</p>}
            <div className="text-sm text-ink-3">
              {entry.method === "mic" ? t.first.youSang : t.first.youPicked}{" "}
              <b className="text-ink">
                {entry.method === "mic" && entry.freq ? nameOf(Math.round(freqToMidiFloat(entry.freq))) : nameOf(target + Math.round(entry.cents / 100))}
              </b>
            </div>
            <div className={cx("text-3xl font-black", Math.abs(entry.cents) <= 50 ? "text-good" : "text-bad")}>
              {entry.method === "mic" ? t.first.centsOff(entry.cents) : t.first.semitonesOff(Math.round(entry.cents / 100))}
            </div>
            {entry.method === "mic" && Math.abs(entry.cents) >= 100 && (
              <div className="text-ink-2">{t.first.semitonesOff(Math.round(entry.cents / 100))}</div>
            )}
            <div className="flex flex-col gap-2 pt-2">
              <Button variant="secondary" onClick={() => void playNote(realMidi ?? 60 + target, 2)}>
                🔊 {t.first.playReal}
              </Button>
              <Button big onClick={onDone}>
                {t.next} ›
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
