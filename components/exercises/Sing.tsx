"use client";
import { useEffect, useRef, useState } from "react";
import { useStore, usePracticeTimer } from "@/lib/store";
import { colorOf, inkOn } from "@/lib/colors";
import { centsFromPc, freqToMidiFloat, nameOf, pcOf, pick, type PC } from "@/lib/music";
import { newVoice, playNote, stopAll, wait } from "@/lib/audio";
import { capturePitch, startMic, type MicError, type MicSession } from "@/lib/pitch";
import { appendCapped, unlockedNotes } from "@/lib/state";
import { Keyboard } from "../Keyboard";
import { MicErrorBox, toMicError } from "../MicErrorBox";
import { Button, Card, ColorWash, ScreenHeader, cx } from "../ui";
import { burst, fireworks } from "../fx/Burst";
import { t } from "@/i18n";

const ROUNDS = 8;
type Phase = "prompt" | "listening" | "result" | "summary";

/** See a color (no name), produce its pitch. Trains color → pitch, the reverse direction. */
export function Sing({ onBack }: { onBack: () => void }) {
  const { state, setProgress, getState } = useStore();
  const { settings } = state;
  usePracticeTimer(true);

  const pickTarget = (prev: PC | null) => {
    const set = unlockedNotes(getState().progress);
    let pc = pick(set);
    if (pc === prev && set.length > 1) pc = pick(set.filter((x) => x !== prev));
    return pc;
  };
  const [target, setTarget] = useState<PC>(() => pickTarget(null));
  const [phase, setPhase] = useState<Phase>("prompt");
  const [round, setRound] = useState(1);
  const [hits, setHits] = useState(0);
  const [level, setLevel] = useState(0);
  const [result, setResult] = useState<{ cents: number | null; answer: PC; midi: number } | null>(null);
  const [micErr, setMicErr] = useState<MicError | null>(null);
  const [noPitch, setNoPitch] = useState(false);
  const [wash, setWash] = useState(0);
  const mic = useRef<MicSession | null>(null);
  const orb = useRef<HTMLDivElement>(null);

  useEffect(
    () => () => {
      mic.current?.stop();
      stopAll();
    },
    [],
  );

  const color = colorOf(settings.noteColors, target);
  const revealed = phase === "result" || phase === "summary";

  const record = (cents: number | null, answer: PC, nearMidi: number) => {
    const ok = cents !== null ? Math.abs(cents) <= 50 : answer === target;
    if (ok) setHits((h) => h + 1);
    setProgress((p) => ({ ...p, sing: appendCapped(p.sing, { t: Date.now(), target, cents, answer }) }));
    const real = Math.round((nearMidi - target) / 12) * 12 + target;
    setResult({ cents, answer, midi: real });
    setPhase("result");
    setWash((w) => w + 1);
    if (ok && orb.current) {
      const r = orb.current.getBoundingClientRect();
      burst([color, "#ffffff"], r.left + r.width / 2, r.top + r.height / 2, cents !== null && Math.abs(cents) <= 25 ? 2.6 : 1.6);
    }
    void wait(400).then(() => playNote(real, 1.8));
  };

  const sing = async () => {
    setMicErr(null);
    setNoPitch(false);
    try {
      const m = await startMic();
      mic.current = m;
      setPhase("listening");
      const freq = await capturePitch(m, 2600, 15, (f) => setLevel(f.level));
      m.stop();
      mic.current = null;
      setLevel(0);
      if (!freq) {
        setNoPitch(true);
        setPhase("prompt");
        return;
      }
      const mf = freqToMidiFloat(freq);
      record(centsFromPc(freq, target), pcOf(Math.round(mf)), mf);
    } catch (e) {
      mic.current = null;
      setMicErr(toMicError(e));
      setPhase("prompt");
    }
  };

  const next = () => {
    if (round >= ROUNDS) {
      setPhase("summary");
      const cs = unlockedNotes(getState().progress).map((pc) => colorOf(settings.noteColors, pc));
      if (hits >= ROUNDS * 0.75) fireworks(cs, 6);
      return;
    }
    setRound((r) => r + 1);
    newVoice();
    setTarget((prev) => pickTarget(prev));
    setResult(null);
    setPhase("prompt");
  };

  const ok = result ? (result.cents !== null ? Math.abs(result.cents) <= 50 : result.answer === target) : false;
  const perfect = !!result && result.cents !== null && Math.abs(result.cents) <= 25;

  return (
    <div className="flex min-h-[calc(100dvh-1rem)] flex-col">
      <ScreenHeader title={t.exercises.sing.title} onBack={onBack} sub={t.sing.round(Math.min(round, ROUNDS), ROUNDS)} />
      {wash > 0 && <ColorWash color={color} k={wash} />}
      <div className="relative z-[11] flex flex-1 flex-col items-center justify-center gap-6 pb-8 text-center">
        {phase !== "summary" && (
          <div
            ref={orb}
            className={cx("flex h-44 w-44 items-center justify-center rounded-full text-6xl font-black", phase === "listening" && "pulse-ring", revealed && "pop")}
            style={{
              background: `radial-gradient(circle at 35% 30%, color-mix(in srgb, ${color} 55%, #fff), ${color} 60%)`,
              color: inkOn(color),
              boxShadow: `0 0 ${50 + level * 140}px ${color}`,
              transform: `scale(${1 + level * 0.12})`,
              transition: "transform 80ms linear, box-shadow 80ms linear",
            }}
            data-testid="sing-orb"
          >
            {revealed ? nameOf(target) : ""}
          </div>
        )}

        {phase === "prompt" && (
          <div className="w-full space-y-4">
            <div>
              <p className="text-xl font-semibold">{t.sing.prompt}</p>
              <p className="text-sm text-ink-3">{t.sing.hint}</p>
            </div>
            {noPitch && <p className="rounded-2xl bg-bad/10 px-4 py-2 text-sm text-bad">{t.first.noPitch}</p>}
            {!micErr && (
              <Button big className="w-full" onClick={sing}>
                🎤 {t.sing.sing}
              </Button>
            )}
            {micErr && (
              <>
                <MicErrorBox error={micErr} onRetry={sing} />
                <p className="text-sm text-ink-2">{t.sing.tapInstead}</p>
                <Keyboard
                  colors={settings.noteColors}
                  enabled={unlockedNotes(state.progress)}
                  hideColors
                  height={170}
                  onPress={(pc) => record(null, pc, 60 + pc)}
                />
              </>
            )}
          </div>
        )}

        {phase === "listening" && <p className="text-xl font-semibold">{t.sing.listening}</p>}

        {phase === "result" && result && (
          <Card className="pop w-full space-y-2">
            <div className={cx("text-3xl font-black", ok ? "text-good" : "text-bad")}>
              {perfect ? t.sing.perfect : ok ? t.sing.close : t.sing.off}
            </div>
            <div className="text-ink-2">{t.sing.itWas(nameOf(target))}</div>
            {result.cents !== null && <div className="text-sm text-ink-3">{t.sing.youSang(nameOf(result.answer), result.cents)}</div>}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button variant="secondary" onClick={() => void playNote(result.midi, 1.8)}>
                🔊 {t.replay}
              </Button>
              <Button onClick={next}>{t.next} ›</Button>
            </div>
          </Card>
        )}

        {phase === "summary" && (
          <div className="w-full space-y-4">
            <div className="text-6xl">{hits >= ROUNDS * 0.75 ? "🌈" : "🎤"}</div>
            <h2 className="text-2xl font-black">{t.sing.summary(hits, ROUNDS)}</h2>
            <Button big className="w-full" onClick={onBack}>
              {t.done}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
