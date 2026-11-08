"use client";
import { useEffect, useRef, useState } from "react";
import { useStore, usePracticeTimer } from "@/lib/store";
import { colorOf, mix } from "@/lib/colors";
import {
  INTERVAL_SEMITONES,
  INTERVALS,
  nameOf,
  pcOf,
  pick,
  randInt,
  type Interval,
  type IntervalDir,
} from "@/lib/music";
import { newVoice, playChord, playSequence, stopAll } from "@/lib/audio";
import { recentIntervalAccuracy, recordIntervalAnswer, unlockedIntervals, unlockedNotes, UNLOCK_WINDOW } from "@/lib/state";
import { Button, Card, ColorWash, NoteDot, ProgressBar, ScreenHeader, cx } from "../ui";
import { burstFrom, fireworks } from "../fx/Burst";
import { ComboBadge } from "../fx/Celebration";
import { Lesson, type LessonStep } from "../Lesson";
import { refFor, refMidis, type RefTune } from "@/lib/references";
import { t } from "@/i18n";

const ROUNDS = 10;
const DIRS: IntervalDir[] = ["up", "down", "together", "mix"];
/** Answer buttons in size order, so the grid reads like a ruler. */
const BY_SIZE = [...INTERVALS].sort((a, b) => INTERVAL_SEMITONES[a] - INTERVAL_SEMITONES[b]);
type Phase = "intro" | "lesson" | "question" | "feedback" | "summary";
interface Q {
  iv: Interval;
  dir: Exclude<IntervalDir, "mix">;
  low: number;
  high: number;
}

function play(q: Q) {
  if (q.dir === "together") return playChord([q.low, q.high], 1.6);
  return playSequence(q.dir === "up" ? [q.low, q.high] : [q.high, q.low], 0.75, 0.9);
}
const playTune = (tune: RefTune) => playSequence(refMidis(tune), 0.36, 0.42);
/** The same question asked with another interval, from the same first note (for the hint). */
function withInterval(q: Q, iv: Interval): Q {
  const s = INTERVAL_SEMITONES[iv];
  return q.dir === "down" ? { ...q, iv, low: q.high - s } : { ...q, iv, high: q.low + s };
}
const dirLabel = (d: "up" | "down" | "together") => t.intervals.dirs[d === "together" ? "up" : d];

/** Lesson steps for the intervals unlocked so far (grows as more unlock). */
function lessonSteps(set: Interval[]): LessonStep[] {
  const L = t.intervals.lesson;
  const steps: LessonStep[] = [
    {
      title: L.introTitle,
      body: L.introBody,
      actions: [
        { label: L.near, play: () => playSequence([60, 62], 0.75, 0.9) },
        { label: L.far, play: () => playSequence([60, 72], 0.75, 0.9) },
      ],
    },
  ];
  for (const iv of set) {
    const up = refFor(iv, "up");
    const down = refFor(iv, "down");
    const actions = [{ label: t.intervals.playInterval, play: () => playSequence([60, 60 + INTERVAL_SEMITONES[iv]], 0.75, 0.9) }];
    if (up) actions.push({ label: `${up.song}`, play: () => playTune(up) });
    if (down) actions.push({ label: `${down.song} (${t.intervals.dirs.down})`, play: () => playTune(down) });
    steps.push({ title: t.intervals.names[iv], body: L.ivBody(t.intervals.feel[iv], up?.song ?? null), actions });
  }
  steps.push({
    title: L.compareTitle,
    body: L.compareBody,
    actions: set.map((iv) => ({ label: t.intervals.names[iv], play: () => playSequence([60, 60 + INTERVAL_SEMITONES[iv]], 0.75, 0.9) })),
  });
  steps.push({ title: L.dirTitle, body: L.dirBody });
  return steps;
}

/** Hear two notes, name the distance. The two colors blend in the feedback. */
export function Intervals({ onBack }: { onBack: () => void }) {
  const { state, setProgress, setSettings, getState } = useStore();
  const { settings, progress } = state;
  usePracticeTimer(true);

  const [phase, setPhase] = useState<Phase>(() => (progress.intervalLessonSeen ? "intro" : "lesson"));
  const [hinted, setHinted] = useState(false);
  const [q, setQ] = useState<Q | null>(null);
  const [round, setRound] = useState(0);
  const [hits, setHits] = useState(0);
  const [combo, setCombo] = useState(0);
  const [verdict, setVerdict] = useState<{ ok: boolean; answer: Interval; unlocked: Interval | null } | null>(null);
  const [wash, setWash] = useState<{ color: string; k: number } | null>(null);
  const k = useRef(0);
  const timer = useRef<number | null>(null);
  const roundRef = useRef(0);
  const hitsRef = useRef(0);
  const askedAt = useRef(0);
  const last = useRef<Interval | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
      stopAll();
    },
    [],
  );

  const ask = () => {
    newVoice();
    const s = getState();
    const set = unlockedIntervals(s.progress);
    let iv = pick(set);
    if (iv === last.current && set.length > 1) iv = pick(set.filter((x) => x !== iv));
    last.current = iv;
    const semis = INTERVAL_SEMITONES[iv];
    const want = s.settings.intervalDir;
    const dir = want === "mix" ? pick(["up", "down", "together"] as const) : want;
    const lo = s.settings.lowMidi;
    const low = randInt(lo, Math.max(lo, s.settings.highMidi - semis));
    const x: Q = { iv, dir, low, high: low + semis };
    (window as unknown as { __cpQuestion?: unknown }).__cpQuestion = { kind: "interval", ...x, semis };
    setQ(x);
    setHinted(false);
    setVerdict(null);
    roundRef.current++;
    setRound(roundRef.current);
    setPhase("question");
    void play(x);
    askedAt.current = performance.now();
  };

  const answer = (a: Interval) => {
    if (phase !== "question" || !q) return;
    const ok = a === q.iv;
    const ms = Math.round(performance.now() - askedAt.current);
    let unlocked: Interval | null = null;
    setProgress((p) => {
      const r = recordIntervalAnswer(p, {
        t: Date.now(),
        target: q.iv,
        answer: a,
        dir: q.dir,
        low: pcOf(q.low),
        ms,
        ...(hinted ? { hinted: true } : {}),
      });
      unlocked = r.unlocked;
      return r.progress;
    });
    const u = unlocked as Interval | null;
    const cLow = colorOf(settings.noteColors, q.low);
    const cHigh = colorOf(settings.noteColors, q.high);
    k.current++;
    setVerdict({ ok, answer: a, unlocked: u });
    setPhase("feedback");
    setWash({ color: mix(cLow, cHigh), k: k.current });
    if (ok) {
      hitsRef.current++;
      setHits(hitsRef.current);
      setCombo((c) => c + 1);
      burstFrom(document.querySelector(`button[data-interval="${a}"]`), [cLow, cHigh], 1.1 + combo / 4);
      if (!u) timer.current = window.setTimeout(next, 1500);
    } else {
      setCombo(0);
      void play(q);
      // Longer, so there is time to tap the reference tune.
      if (!u) timer.current = window.setTimeout(next, 4200);
    }
    if (u) window.setTimeout(() => fireworks([cLow, cHigh, "#ffffff"], 6), 200);
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

  const unlockedSet = unlockedIntervals(progress);
  const acc = recentIntervalAccuracy(progress);
  const allUnlocked = progress.intervalsUnlocked >= INTERVALS.length;
  const name = (iv: Interval) => t.intervals.names[iv];
  const finishLesson = () => {
    setProgress((p) => (p.intervalLessonSeen ? p : { ...p, intervalLessonSeen: true }));
    stopAll();
    setPhase("intro");
  };
  const first = q ? (q.dir === "down" ? q.high : q.low) : 0;
  const second = q ? (q.dir === "down" ? q.low : q.high) : 0;

  return (
    <div className="flex min-h-[calc(100dvh-1rem)] flex-col">
      <ScreenHeader
        title={t.exercises.intervals.title}
        onBack={onBack}
        sub={phase === "intro" || phase === "lesson" ? undefined : t.intervals.round(Math.min(Math.max(round, 1), ROUNDS), ROUNDS)}
      />
      {wash && <ColorWash color={wash.color} k={wash.k} />}
      {phase === "lesson" ? (
        <div className="relative z-[11] flex flex-1 flex-col">
          <Lesson steps={lessonSteps(unlockedSet)} onBegin={finishLesson} />
        </div>
      ) : (
      <div className="relative z-[11] flex flex-1 flex-col gap-4">
        <Card className="space-y-2">
          <div className="text-sm text-ink-2">{acc.n ? t.quiz.accuracyRecent(acc.pct, acc.n) : t.intervals.unlockNeed}</div>
          {!allUnlocked && <ProgressBar value={acc.n >= UNLOCK_WINDOW ? acc.pct / 100 / 0.9 : acc.n / UNLOCK_WINDOW} />}
        </Card>

        <div className="flex min-h-40 flex-1 flex-col items-center justify-center gap-3 text-center">
          {phase === "intro" && (
            <>
              <div className="text-6xl">📏</div>
              <p className="text-ink-2">{t.exercises.intervals.desc}</p>
              <div className="w-full space-y-2">
                <div className="text-sm font-semibold text-ink-2">{t.intervals.dir}</div>
                <div className="grid grid-cols-4 gap-2">
                  {DIRS.map((d) => (
                    <button
                      key={d}
                      data-dir={d}
                      onClick={() => setSettings((x) => ({ ...x, intervalDir: d }))}
                      className={cx(
                        "min-h-12 rounded-2xl border text-sm font-semibold",
                        settings.intervalDir === d ? "border-accent bg-accent/15 text-ink" : "border-line bg-surface-2 text-ink-3",
                      )}
                    >
                      {t.intervals.dirs[d]}
                    </button>
                  ))}
                </div>
              </div>
              <Button big onClick={ask} className="pulse-ring" data-testid="intervals-start">
                ▶ {t.start}
              </Button>
              <Button variant="ghost" onClick={() => setPhase("lesson")} data-testid="intervals-lesson-open">
                📖 {t.intervals.lessonOpen}
              </Button>
            </>
          )}
          {phase === "question" && q && (
            <>
              <div className="h-9">
                <ComboBadge combo={combo} />
              </div>
              <p className="text-lg text-ink-2">{t.intervals.listen}</p>
              <p className="text-xs text-ink-3">{t.intervals.dirs[q.dir]}</p>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => void play(q)}>
                  ↻ {t.replay}
                </Button>
                <Button variant="secondary" onClick={() => setHinted(true)} data-testid="intervals-hint">
                  💡 {t.intervals.hint}
                </Button>
              </div>
              {hinted && (
                <Card className="w-full space-y-2">
                  <div className="text-sm font-bold">{t.intervals.hintTitle}</div>
                  <div className="grid grid-cols-3 gap-2" data-testid="intervals-hint-panel">
                    {unlockedSet.map((iv) => (
                      <Button key={iv} variant="secondary" data-hint-interval={iv} onClick={() => void play(withInterval(q, iv))}>
                        ▶ {iv}
                      </Button>
                    ))}
                  </div>
                  <div className="text-xs text-ink-3">{t.intervals.hintNote}</div>
                </Card>
              )}
            </>
          )}
          {phase === "feedback" && q && verdict && (
            <button className="space-y-2" onClick={next} data-testid="intervals-feedback">
              <div className={cx("pop text-3xl font-black", verdict.ok ? "text-good" : "text-bad")}>
                {verdict.unlocked
                  ? `🔓 ${t.intervals.unlocked(name(verdict.unlocked))}`
                  : verdict.ok
                    ? t.intervals.correct
                    : t.intervals.wrong(name(q.iv))}
              </div>
              <div className="flex items-center justify-center gap-2">
                <NoteDot color={colorOf(settings.noteColors, first)} label={nameOf(first)} size={34} />
                <span className="text-xl text-ink-3">{q.dir === "together" ? "+" : "→"}</span>
                <NoteDot color={colorOf(settings.noteColors, second)} label={nameOf(second)} size={34} />
              </div>
              <div className="text-sm text-ink-3">
                {t.intervals.notes(nameOf(first), nameOf(second), INTERVAL_SEMITONES[q.iv], q.dir === "together")}
              </div>
              <div className="text-xs text-ink-3">{t.next} ›</div>
            </button>
          )}
          {phase === "feedback" && q && verdict && (
            <RefCard
              iv={verdict.unlocked ?? q.iv}
              dir={verdict.unlocked ? "up" : q.dir}
              isNew={!!verdict.unlocked}
              onPlay={() => {
                if (timer.current) window.clearTimeout(timer.current);
              }}
            />
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
          <div className="grid grid-cols-3 gap-2 pb-[max(1rem,env(safe-area-inset-bottom))]" data-testid="intervals-grid">
            {BY_SIZE.map((iv) => {
              const on = unlockedSet.includes(iv);
              const isTarget = phase === "feedback" && q?.iv === iv;
              const isWrong = phase === "feedback" && verdict && !verdict.ok && verdict.answer === iv;
              return (
                <button
                  key={iv}
                  data-interval={iv}
                  disabled={!on || phase !== "question"}
                  onClick={() => answer(iv)}
                  className={cx(
                    "flex min-h-16 flex-col items-center justify-center rounded-2xl border px-1 py-2 transition active:scale-95",
                    on ? "border-line bg-surface text-ink" : "border-transparent bg-surface-2 text-ink-3 opacity-40",
                    isTarget && "keyflash border-good ring-4 ring-good",
                    isWrong && "shake ring-4 ring-bad",
                  )}
                >
                  <span className="text-sm font-bold leading-tight">{on ? name(iv) : "🔒"}</span>
                  <span className="text-[11px] text-ink-3">
                    {iv} · {INTERVAL_SEMITONES[iv]}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      )}
    </div>
  );
}

/** "จำด้วยเพลง…" for the right answer, or a card introducing a newly unlocked interval. */
function RefCard({ iv, dir, isNew, onPlay }: { iv: Interval; dir: "up" | "down" | "together"; isNew: boolean; onPlay: () => void }) {
  const tune = refFor(iv, dir);
  const name = t.intervals.names[iv];
  return (
    <Card className={cx("w-full space-y-2 text-center", isNew && "ring-2 ring-accent")} >
      {isNew && <div className="font-bold" data-testid="intervals-new-card">{t.intervals.newCard(name)}</div>}
      <div className="text-sm text-ink-2">{t.intervals.feel[iv]}</div>
      <div className="text-xs text-ink-3" data-testid="intervals-remember">
        {tune ? t.intervals.remember(tune.song, dirLabel(dir)) : t.intervals.noSong}
      </div>
      <div className="flex justify-center gap-2">
        {isNew && (
          <Button
            variant="secondary"
            onClick={() => {
              onPlay();
              void playSequence([60, 60 + INTERVAL_SEMITONES[iv]], 0.75, 0.9);
            }}
          >
            ▶ {t.intervals.playInterval}
          </Button>
        )}
        {tune && (
          <Button
            variant="secondary"
            data-testid="intervals-play-song"
            onClick={() => {
              onPlay();
              void playTune(tune);
            }}
          >
            🎵 {t.intervals.playSong}
          </Button>
        )}
      </div>
    </Card>
  );
}
