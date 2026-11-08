"use client";
import { useEffect, useRef, useState } from "react";
import { useStore, usePracticeTimer } from "@/lib/store";
import { MODES, MODE_INTERVALS, MODE_LABEL, pick, type Mode } from "@/lib/music";
import { newVoice, playSequence, stopAll } from "@/lib/audio";
import {
  MODE_LAST_LEVEL,
  MODE_LEVELS,
  modeLevelOf,
  modesUnlocked,
  recentModeAccuracy,
  recordModeAnswer,
  UNLOCK_WINDOW,
} from "@/lib/state";
import { Button, Card, ProgressBar, ScreenHeader, cx } from "../ui";
import { Lesson, type LessonStep } from "../Lesson";
import { fireworks } from "../fx/Burst";
import { t } from "@/i18n";

const ROUNDS = 10;
// Brightest (index 0) → darkest (index 6).
const SHADES = ["#fff3c4", "#ffd98a", "#f5a65b", "#c46a6a", "#6b4c8a", "#33305f", "#12111f"];
const shadeInk = (i: number) => (i <= 2 ? "#1d1a12" : "#f5f2ff");
/** Note names for scales on C, spelled with flats the way modes are usually written. */
const SPELL = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

const playMode = (m: Mode) => playSequence(MODE_INTERVALS[m].map((i) => 60 + i), 0.36, 0.45);
/** The scale a mode is heard against: major for the bright ones, natural minor for the dark ones. */
const refOf = (m: Mode): Mode =>
  m === "ionian" ? "aeolian" : m === "aeolian" ? "ionian" : MODE_INTERVALS[m][2] === 4 ? "ionian" : "aeolian";
/** Indexes of the scale notes that differ from the reference scale. */
const diffIdx = (m: Mode) => {
  const a = MODE_INTERVALS[m];
  const b = MODE_INTERVALS[refOf(m)];
  return a.map((s, i) => (s !== b[i] ? i : -1)).filter((i) => i >= 0);
};

function lessonSteps(): LessonStep[] {
  const L = t.modes.lesson;
  return [
    {
      title: L.whatTitle,
      body: L.whatBody,
      actions: [
        { label: "Ionian", play: () => playMode("ionian") },
        { label: "Aeolian", play: () => playMode("aeolian") },
      ],
    },
    {
      title: L.thirdTitle,
      body: L.thirdBody,
      actions: [
        { label: L.third.major, play: () => playSequence([60, 62, 64], 0.45, 0.6) },
        { label: L.third.minor, play: () => playSequence([60, 62, 63], 0.45, 0.6) },
      ],
    },
    {
      title: L.brightTitle,
      body: L.brightBody,
      actions: (["lydian", "ionian", "mixolydian"] as Mode[]).map((m) => ({ label: MODE_LABEL[m], play: () => playMode(m) })),
    },
    {
      title: L.darkTitle,
      body: L.darkBody,
      actions: (["dorian", "aeolian", "phrygian", "locrian"] as Mode[]).map((m) => ({ label: MODE_LABEL[m], play: () => playMode(m) })),
    },
    {
      title: L.trickTitle,
      body: L.trickBody,
      actions: [
        { label: "C D E F G", play: () => playSequence([60, 62, 64, 65, 67], 0.36, 0.45) },
        { label: "C D E F# G", play: () => playSequence([60, 62, 64, 66, 67], 0.36, 0.45) },
      ],
    },
  ];
}

/**
 * Mode brightness: a short lesson, then levels from "bright or dark" to all seven
 * modes on the brightness slider.
 */
export function Modes({ onBack }: { onBack: () => void }) {
  const { state, setProgress, getState } = useStore();
  const { progress } = state;
  const unlocked = modesUnlocked(progress);
  usePracticeTimer(unlocked);

  const [lesson, setLesson] = useState(() => !progress.modeLessonSeen);
  const [mode, setMode] = useState<Mode | null>(null);
  const [level, setLevel] = useState(0); // level of the current question
  const [pos, setPos] = useState(3);
  const [picked, setPicked] = useState<Mode | null>(null);
  const [hinted, setHinted] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; off: number; levelUp: number | null } | null>(null);
  const [n, setN] = useState(0);
  const [score, setScore] = useState(0);
  const last = useRef<Mode | null>(null);

  useEffect(() => () => stopAll(), []);

  const ask = () => {
    newVoice();
    const lv = modeLevelOf(getState().progress);
    const set = MODE_LEVELS[lv].modes;
    let m = pick(set);
    if (m === last.current && set.length > 1) m = pick(set.filter((x) => x !== m));
    last.current = m;
    (window as unknown as { __cpQuestion?: unknown }).__cpQuestion = { kind: "mode", mode: m, level: lv, choices: set };
    setLevel(lv);
    setMode(m);
    setPos(3);
    setPicked(null);
    setHinted(false);
    setResult(null);
    void playMode(m);
  };

  const confirm = (answer: Mode) => {
    if (!mode || result) return;
    const ok = answer === mode;
    const off = Math.abs(MODES.indexOf(mode) - MODES.indexOf(answer));
    let levelUp: number | null = null;
    setProgress((p) => {
      const r = recordModeAnswer(p, { t: Date.now(), target: mode, answer, level, ...(hinted ? { hinted: true } : {}) });
      levelUp = r.levelUp;
      return r.progress;
    });
    const lu = levelUp as number | null;
    setPicked(answer);
    setResult({ ok, off, levelUp: lu });
    setN((x) => x + 1);
    if (ok) setScore((s) => s + 1);
    if (lu !== null) window.setTimeout(() => fireworks(SHADES.slice(0, 5), 7), 200);
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

  const lvNow = modeLevelOf(progress);
  if (lesson) {
    return (
      <div className="flex min-h-[calc(100dvh-1rem)] flex-col">
        <ScreenHeader title={t.exercises.modes.title} onBack={onBack} sub={t.modes.level(lvNow + 1, MODE_LEVELS.length)} />
        <Lesson
          steps={lessonSteps()}
          onBegin={() => {
            setProgress((p) => (p.modeLessonSeen ? p : { ...p, modeLessonSeen: true }));
            stopAll();
            setLesson(false);
          }}
        />
      </div>
    );
  }

  const slider = level >= MODE_LAST_LEVEL;
  const shownPos = result && mode ? MODES.indexOf(mode) : slider ? pos : 3;
  const bg = SHADES[shownPos];
  const done = n >= ROUNDS && result;
  const acc = recentModeAccuracy(progress);
  const choices = MODE_LEVELS[level].modes;

  return (
    <div
      className="-mx-4 -mt-2 flex min-h-dvh flex-col px-4 pt-2 transition-[background] duration-700"
      style={{ background: `linear-gradient(180deg, ${bg} 0%, color-mix(in srgb, ${bg} 70%, var(--bg)) 100%)`, color: shadeInk(shownPos) }}
    >
      <ScreenHeader
        title={t.exercises.modes.title}
        onBack={onBack}
        sub={mode ? `${Math.min(n + (result ? 0 : 1), ROUNDS)}/${ROUNDS}` : t.modes.level(lvNow + 1, MODE_LEVELS.length)}
      />
      <Card className="space-y-2 text-ink">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-bold" data-testid="modes-level">
            {t.modes.level(lvNow + 1, MODE_LEVELS.length)}
          </span>
          <span className="text-right text-xs text-ink-3">{t.modes.levelDesc[lvNow]}</span>
        </div>
        {lvNow < MODE_LAST_LEVEL && (
          <>
            <div className="text-sm text-ink-2">{acc.n ? t.modes.accuracyRecent(acc.pct, acc.n) : t.modes.levelNeed}</div>
            <ProgressBar value={acc.n >= UNLOCK_WINDOW ? acc.pct / 100 / 0.9 : acc.n / UNLOCK_WINDOW} />
          </>
        )}
      </Card>
      <div className="flex flex-1 flex-col justify-center gap-5 py-4 text-center">
        {!mode ? (
          <>
            <p className="text-lg">{t.modes.listen}</p>
            <Button big onClick={ask} className="mx-auto pulse-ring" data-testid="modes-start">
              ▶ {t.start}
            </Button>
            <Button variant="ghost" className="mx-auto" onClick={() => setLesson(true)} data-testid="modes-lesson-open">
              📖 {t.modes.lessonOpen}
            </Button>
          </>
        ) : (
          <>
            <p className="text-lg font-medium">{slider ? t.modes.listen : t.modes.pick}</p>
            <div className="flex justify-center gap-2">
              <Button variant="secondary" onClick={() => void playMode(mode)}>
                ↻ {t.replay}
              </Button>
              {!result && (
                <Button variant="secondary" onClick={() => setHinted(true)} data-testid="modes-hint">
                  💡 {t.modes.hint}
                </Button>
              )}
            </div>
            {hinted && !result && (
              <Card className="space-y-2 text-ink">
                <div className="text-sm font-bold">{t.modes.hintTitle}</div>
                <div className="flex flex-wrap justify-center gap-2" data-testid="modes-hint-panel">
                  {choices.map((m) => (
                    <Button key={m} variant="secondary" data-hint-mode={m} onClick={() => void playMode(m)}>
                      ▶ {MODE_LABEL[m]}
                    </Button>
                  ))}
                </div>
                <div className="text-xs text-ink-3">{t.modes.hintNote}</div>
              </Card>
            )}

            {slider ? (
              <BrightnessSlider pos={pos} setPos={setPos} shownPos={shownPos} result={!!result} />
            ) : (
              <div className={cx("grid gap-2", choices.length === 2 ? "grid-cols-2" : "grid-cols-3")} data-testid="modes-choices">
                {choices.map((m) => {
                  const i = MODES.indexOf(m);
                  const isTarget = !!result && m === mode;
                  const isWrong = !!result && m === picked && m !== mode;
                  return (
                    <button
                      key={m}
                      data-mode-choice={m}
                      disabled={!!result}
                      onClick={() => confirm(m)}
                      className={cx(
                        "flex min-h-24 flex-col items-center justify-center gap-1 rounded-3xl border border-black/10 px-2 py-2 font-bold shadow transition active:scale-95",
                        isTarget && "ring-4 ring-good",
                        isWrong && "shake ring-4 ring-bad",
                      )}
                      style={{ background: SHADES[i], color: shadeInk(i) }}
                    >
                      <span className="text-lg">{MODE_LABEL[m]}</span>
                      <span className="text-[11px] font-medium leading-tight opacity-80">{t.modes.feel[m]}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {!result ? (
              slider && (
                <Button big onClick={() => confirm(MODES[pos])} className="mx-auto" data-testid="modes-confirm">
                  {t.modes.confirm}
                </Button>
              )
            ) : (
              <div className="pop space-y-3">
                <div className="text-2xl font-black">
                  {result.levelUp !== null
                    ? `🔓 ${t.modes.levelUp(result.levelUp + 1)}`
                    : slider
                      ? result.ok
                        ? t.modes.correct
                        : t.modes.off(result.off)
                      : result.ok
                        ? t.quiz.correct
                        : t.quiz.wrong}
                </div>
                <ScaleReveal mode={mode} />
                {done ? (
                  <>
                    <div className="text-lg">{t.quiz.summaryLine(score, n)}</div>
                    <Button big onClick={onBack}>
                      {t.done}
                    </Button>
                  </>
                ) : (
                  <Button big onClick={ask} data-testid="modes-next">
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

/** The scale's notes with the ones that differ from major/minor highlighted, plus a compare button. */
function ScaleReveal({ mode }: { mode: Mode }) {
  const ref = refOf(mode);
  const diff = diffIdx(mode);
  return (
    <Card className="space-y-2 text-ink" >
      <div className="font-bold">
        {t.modes.itWas(MODE_LABEL[mode])} · <span className="font-normal text-ink-2">{t.modes.feel[mode]}</span>
      </div>
      <div className="flex justify-center gap-1" data-testid="modes-scale">
        {MODE_INTERVALS[mode].map((s, i) => (
          <span
            key={i}
            data-diff={diff.includes(i) ? "1" : undefined}
            className={cx(
              "flex h-9 min-w-9 items-center justify-center rounded-xl px-1 text-sm font-bold",
              diff.includes(i) ? "bg-accent text-white ring-2 ring-accent" : "bg-surface-2 text-ink-2",
            )}
          >
            {SPELL[s % 12]}
          </span>
        ))}
      </div>
      <div className="text-xs text-ink-3">{t.modes.diffNote(MODE_LABEL[ref])}</div>
      <div className="flex justify-center gap-2">
        <Button variant="secondary" onClick={() => void playMode(mode)}>
          ▶ {MODE_LABEL[mode]}
        </Button>
        <Button variant="secondary" onClick={() => void playMode(ref)} data-testid="modes-compare">
          ▶ {t.modes.compareRef(MODE_LABEL[ref])}
        </Button>
      </div>
    </Card>
  );
}

/** The full bright → dark slider (last level). */
function BrightnessSlider({
  pos,
  setPos,
  shownPos,
  result,
}: {
  pos: number;
  setPos: (n: number) => void;
  shownPos: number;
  result: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs font-semibold opacity-80">
        <span>☀️ {t.modes.brightest}</span>
        <span>{t.modes.darkest} 🌑</span>
      </div>
      <div className="relative h-16 rounded-2xl border border-black/10" style={{ background: `linear-gradient(90deg, ${SHADES.join(", ")})` }}>
        {MODES.map((m, i) => (
          <button
            key={m}
            data-mode={m}
            disabled={result}
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
        {result && pos !== shownPos && (
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
        disabled={result}
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
  );
}
