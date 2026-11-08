"use client";
import { useEffect, useRef, useState } from "react";
import { useStore, usePracticeTimer } from "@/lib/store";
import { colorOf } from "@/lib/colors";
import { MELODY_LENGTHS, nameOf, pcOf, randomMelody, type PC } from "@/lib/music";
import { newVoice, playSequence, stopAll, wait } from "@/lib/audio";
import { melodyLength, recentMelodyAccuracy, recordMelody, unlockedNotes, UNLOCK_WINDOW } from "@/lib/state";
import { Keyboard, type KeyFlash } from "../Keyboard";
import { Button, Card, ColorWash, NoteDot, ProgressBar, ScreenHeader, cx } from "../ui";
import { burstFrom, fireworks } from "../fx/Burst";
import { ComboBadge } from "../fx/Celebration";
import { t } from "@/i18n";

const ROUNDS = 10;
const STEP = 0.6; // seconds between melody notes
type Phase = "intro" | "playing" | "question" | "feedback" | "summary";

/**
 * Melodic dictation with absolute pitch: hear a short melody made only of the
 * unlocked notes, then tap the notes in order. Nothing plays while answering, so
 * every note is named from memory, not by comparing it with the previous one.
 */
export function Melody({ onBack }: { onBack: () => void }) {
  const { state, setProgress, getState } = useStore();
  const { settings, progress } = state;
  usePracticeTimer(true);

  const [phase, setPhase] = useState<Phase>("intro");
  const [melody, setMelody] = useState<number[]>([]);
  const [picks, setPicks] = useState<PC[]>([]);
  const [round, setRound] = useState(0);
  const [hits, setHits] = useState(0);
  const [combo, setCombo] = useState(0);
  const [verdict, setVerdict] = useState<{ correct: number; grewTo: number | null } | null>(null);
  const [flashes, setFlashes] = useState<KeyFlash[]>([]);
  const [wash, setWash] = useState<{ color: string; k: number } | null>(null);
  const k = useRef(0);
  const qid = useRef(0);
  const timer = useRef<number | null>(null);
  const roundRef = useRef(0);
  const hitsRef = useRef(0);
  const askedAt = useRef(0);

  useEffect(
    () => () => {
      qid.current++;
      if (timer.current) window.clearTimeout(timer.current);
      stopAll();
    },
    [],
  );

  const playMelody = async (m: number[]) => {
    const id = qid.current;
    setPhase("playing");
    await playSequence(m, STEP, STEP * 0.9);
    await wait(m.length * STEP * 1000 + 200);
    if (id !== qid.current) return;
    askedAt.current = performance.now();
    setPhase("question");
  };

  const ask = () => {
    qid.current++;
    newVoice();
    const p = getState().progress;
    const m = randomMelody(unlockedNotes(p), melodyLength(p));
    (window as unknown as { __cpQuestion?: unknown }).__cpQuestion = { kind: "melody", midis: m, pcs: m.map(pcOf) };
    setMelody(m);
    setPicks([]);
    setFlashes([]);
    setVerdict(null);
    roundRef.current++;
    setRound(roundRef.current);
    void playMelody(m);
  };

  const grade = (m: number[], ans: PC[]) => {
    const now = Date.now();
    const answers = ans.map((a, i) => ({ t: now, len: m.length, pos: i + 1, target: pcOf(m[i]), answer: a }));
    const correct = answers.filter((a) => a.answer === a.target).length;
    let grewTo: number | null = null;
    setProgress((p) => {
      const r = recordMelody(p, answers);
      grewTo = r.grewTo;
      return r.progress;
    });
    const g = grewTo as number | null;
    const all = correct === m.length;
    k.current++;
    setVerdict({ correct, grewTo: g });
    setPhase("feedback");
    setWash({ color: colorOf(settings.noteColors, m[m.length - 1]), k: k.current });
    if (all) {
      hitsRef.current++;
      setHits(hitsRef.current);
      setCombo((c) => c + 1);
      burstFrom(document.querySelector('[data-testid="melody-slots"]'), m.map((x) => colorOf(settings.noteColors, x)), 1.1 + combo / 4);
    } else {
      setCombo(0);
    }
    if (g) window.setTimeout(() => fireworks(m.map((x) => colorOf(settings.noteColors, x)), 6), 200);
    // Play the real melody again while both rows are on screen.
    const id = qid.current;
    void wait(400).then(() => (id === qid.current ? playSequence(m, STEP, STEP * 0.9) : undefined));
    timer.current = window.setTimeout(next, 1400 + m.length * STEP * 1000 + 1000);
  };

  const press = (pc: PC) => {
    if (phase !== "question" || picks.length >= melody.length) return;
    const nextPicks = [...picks, pc];
    setPicks(nextPicks);
    k.current++;
    setFlashes([{ pc, kind: "reveal", k: k.current }]);
    if (nextPicks.length === melody.length) grade(melody, nextPicks);
  };

  function next() {
    if (timer.current) window.clearTimeout(timer.current);
    if (roundRef.current >= ROUNDS) {
      qid.current++;
      setPhase("summary");
      if (hitsRef.current >= ROUNDS * 0.8) {
        fireworks(unlockedNotes(getState().progress).map((pc) => colorOf(settings.noteColors, pc)), 6);
      }
      return;
    }
    ask();
  }

  const acc = recentMelodyAccuracy(progress);
  const len = melodyLength(progress);
  const maxed = progress.melodyLevel >= MELODY_LENGTHS.length - 1;
  const active = phase === "playing" || phase === "question" || phase === "feedback";
  const n = melody.length || len;

  return (
    <div className="flex min-h-[calc(100dvh-1rem)] flex-col">
      <ScreenHeader
        title={t.exercises.melody.title}
        onBack={onBack}
        sub={phase === "intro" ? t.melody.length(len) : t.melody.round(Math.min(Math.max(round, 1), ROUNDS), ROUNDS)}
      />
      {wash && <ColorWash color={wash.color} k={wash.k} />}
      <div className="relative z-[11] flex flex-1 flex-col gap-4">
        <Card className="space-y-2">
          <div className="text-sm text-ink-2">{acc.n ? t.melody.accuracyRecent(acc.pct, acc.n) : t.melody.unlockNeed}</div>
          {!maxed && <ProgressBar value={acc.n >= UNLOCK_WINDOW ? acc.pct / 100 / 0.9 : acc.n / UNLOCK_WINDOW} />}
        </Card>

        <div className="flex min-h-44 flex-1 flex-col items-center justify-center gap-3 text-center">
          {phase === "intro" && (
            <>
              <div className="text-6xl">🎼</div>
              <p className="text-ink-2">{t.exercises.melody.desc}</p>
              <Button big onClick={ask} className="pulse-ring" data-testid="melody-start">
                ▶ {t.start}
              </Button>
            </>
          )}

          {active && (
            <>
              <div className="h-9">{phase !== "feedback" && <ComboBadge combo={combo} />}</div>
              {phase === "feedback" && verdict && (
                <div className={cx("pop text-3xl font-black", verdict.correct === n ? "text-good" : "text-bad")}>
                  {verdict.grewTo
                    ? `🔓 ${t.melody.grew(verdict.grewTo)}`
                    : verdict.correct === n
                      ? t.melody.correct
                      : t.melody.partial(verdict.correct, n)}
                </div>
              )}
              <div className="w-full space-y-2" data-testid="melody-slots">
                {phase === "feedback" && <div className="text-left text-xs text-ink-3">{t.melody.real}</div>}
                {phase === "feedback" && (
                  <div className="flex justify-center gap-2">
                    {melody.map((m, i) => (
                      <NoteDot key={i} color={colorOf(settings.noteColors, m)} label={nameOf(m)} size={40} />
                    ))}
                  </div>
                )}
                {phase === "feedback" && <div className="text-left text-xs text-ink-3">{t.melody.yours}</div>}
                <div className="flex justify-center gap-2">
                  {Array.from({ length: n }, (_, i) => {
                    const pc = picks[i];
                    const wrong = phase === "feedback" && pc !== undefined && pc !== pcOf(melody[i]);
                    return (
                      <span key={i} data-melody-slot={i + 1} className={cx("rounded-full", wrong && "shake ring-4 ring-bad")}>
                        {pc === undefined ? (
                          <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-line text-sm text-ink-3">
                            {i + 1}
                          </span>
                        ) : (
                          <NoteDot
                            color={settings.hardMode && phase !== "feedback" ? "#8a8696" : colorOf(settings.noteColors, pc)}
                            label={nameOf(pc)}
                            size={40}
                          />
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>
              {phase === "feedback" ? (
                <button className="space-y-1" onClick={next} data-testid="melody-feedback">
                  <div className="text-xs text-ink-3">{t.melody.playingReal}</div>
                  <div className="text-xs text-ink-3">{t.next} ›</div>
                </button>
              ) : (
                <>
                  <p className="text-ink-2">{phase === "playing" ? t.melody.playing : t.melody.listen(n)}</p>
                  <div className="flex gap-2">
                    <Button variant="secondary" disabled={phase !== "question"} onClick={() => void playMelody(melody)}>
                      ↻ {t.melody.replay}
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={phase !== "question" || picks.length === 0}
                      onClick={() => setPicks((p) => p.slice(0, -1))}
                      data-testid="melody-undo"
                    >
                      ⌫ {t.melody.undo}
                    </Button>
                  </div>
                </>
              )}
            </>
          )}

          {phase === "summary" && (
            <div className="w-full space-y-4">
              <div className="text-6xl">{hits >= ROUNDS * 0.8 ? "🏆" : "🎶"}</div>
              <h2 className="text-2xl font-black">{t.melody.summaryLine(hits, ROUNDS)}</h2>
              <Button big className="w-full" onClick={onBack}>
                {t.done}
              </Button>
            </div>
          )}
        </div>

        {active && (
          <div className="pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Keyboard
              colors={settings.noteColors}
              enabled={unlockedNotes(progress)}
              onPress={press}
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
