"use client";
import { useEffect, useRef, useState } from "react";
import { useStore, usePracticeTimer } from "@/lib/store";
import { colorOf } from "@/lib/colors";
import { NOTE_NAMES, nameOf, randInt, type PC } from "@/lib/music";
import { stopAll, type Voice } from "@/lib/audio";
import { noiseBurst, playIn, randomVoice } from "@/lib/drills";
import { appendCapped, daysBetween, dayKey, unlockedNotes } from "@/lib/state";
import { Keyboard } from "../Keyboard";
import { Button, Card, NoteDot, ScreenHeader, cx } from "../ui";
import { fireworks } from "../fx/Burst";
import { t } from "@/i18n";

const ITEMS = 24;
type Phase = "intro" | "wash" | "question" | "done";
interface Item {
  target: PC;
  midi: number;
  voice: Voice;
}

/** Every unlocked note an equal number of times (as near as 24 allows), shuffled. */
function buildItems(notes: PC[]): Item[] {
  const targets: PC[] = [];
  while (targets.length < ITEMS) targets.push(...notes);
  const list = targets.slice(0, ITEMS).sort(() => Math.random() - 0.5);
  return list.map((pc) => ({ target: pc, midi: 48 + pc + randInt(0, 2) * 12, voice: randomVoice() }));
}

/**
 * A pitch test with no feedback during it (the method of the 2025 Surrey study): a burst of
 * random notes before each item washes out the last one, voices and octaves vary, and the
 * result shows which notes are really known.
 */
export function ApTest({ onBack }: { onBack: () => void }) {
  const { state, setProgress } = useStore();
  const { settings, progress } = state;
  usePracticeTimer(true);

  const [phase, setPhase] = useState<Phase>("intro");
  const [items, setItems] = useState<Item[]>([]);
  const [i, setI] = useState(0);
  const answers = useRef<{ target: PC; answer: PC; midi: number; ms: number }[]>([]);
  const askedAt = useRef(0);
  const live = useRef(0);

  useEffect(
    () => () => {
      live.current++;
      stopAll();
    },
    [],
  );

  const present = async (list: Item[], idx: number) => {
    const id = ++live.current;
    setPhase("wash");
    await noiseBurst();
    if (id !== live.current) return;
    await new Promise((r) => setTimeout(r, 500));
    if (id !== live.current) return;
    const it = list[idx];
    (window as unknown as { __cpQuestion?: unknown }).__cpQuestion = { kind: "aptest", i: idx, target: it.target, midi: it.midi, voice: it.voice };
    await playIn(it.midi, it.voice);
    askedAt.current = performance.now();
    setPhase("question");
  };

  const start = () => {
    const list = buildItems(unlockedNotes(progress));
    answers.current = [];
    setItems(list);
    setI(0);
    void present(list, 0);
  };

  const answer = (pc: PC) => {
    if (phase !== "question") return;
    const it = items[i];
    answers.current.push({ target: it.target, answer: pc, midi: it.midi, ms: Math.round(performance.now() - askedAt.current) });
    if (i + 1 >= items.length) {
      const items_ = [...answers.current];
      setProgress((p) => ({ ...p, apTests: appendCapped(p.apTests, { t: Date.now(), items: items_ }) }));
      setPhase("done");
      const solid = solidNotes(items_);
      if (solid.length) window.setTimeout(() => fireworks(solid.map((pc) => colorOf(settings.noteColors, pc)), 8), 300);
      return;
    }
    setI(i + 1);
    void present(items, i + 1);
  };

  const last = progress.apTests.at(-1);
  const sinceLast = last ? daysBetween(dayKey(new Date(last.t)), dayKey()) : null;

  return (
    <div className="flex min-h-[calc(100dvh-1rem)] flex-col">
      <ScreenHeader
        title={t.exercises.aptest.title}
        onBack={onBack}
        sub={phase === "wash" || phase === "question" ? t.aptest.q(i + 1, ITEMS) : sinceLast === null ? t.aptest.never : t.aptest.lastTest(sinceLast)}
      />

      {phase === "intro" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
          <div className="text-6xl">🎓</div>
          <p className="text-ink-2">{t.aptest.rules}</p>
          <p className="text-sm text-ink-3">{t.aptest.weekly}</p>
          <Button big onClick={start} className="pulse-ring" data-testid="aptest-start">
            ▶ {t.start}
          </Button>
          <History tests={progress.apTests} />
        </div>
      )}

      {(phase === "wash" || phase === "question") && items[i] && (
        <>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(i / ITEMS) * 100}%` }} />
          </div>
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <div className={cx("text-5xl", phase === "wash" && "animate-pulse")}>{phase === "wash" ? "🌫️" : "👂"}</div>
            <p className="text-lg text-ink-2" data-testid="aptest-prompt">
              {phase === "wash" ? t.aptest.wash : t.aptest.listen}
            </p>
            <Button variant="secondary" disabled={phase !== "question"} onClick={() => void playIn(items[i].midi, items[i].voice)}>
              ↻ {t.aptest.replay}
            </Button>
          </div>
          <div className="pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Keyboard
              colors={settings.noteColors}
              enabled={unlockedNotes(progress)}
              onPress={answer}
              hideColors={settings.hardMode}
              disabled={phase !== "question"}
            />
          </div>
        </>
      )}

      {phase === "done" && <Result items={answers.current} colors={settings.noteColors} notes={unlockedNotes(progress)} onAgain={start} onBack={onBack} tests={progress.apTests} />}
    </div>
  );
}

/** Notes answered right every time they came up, at least twice. */
function solidNotes(items: { target: PC; answer: PC }[]): PC[] {
  const by = new Map<PC, { n: number; ok: number }>();
  for (const it of items) {
    const e = by.get(it.target) ?? { n: 0, ok: 0 };
    e.n++;
    if (it.answer === it.target) e.ok++;
    by.set(it.target, e);
  }
  return [...by.entries()].filter(([, e]) => e.n >= 2 && e.ok === e.n).map(([pc]) => pc);
}

function Result({
  items,
  colors,
  notes,
  onAgain,
  onBack,
  tests,
}: {
  items: { target: PC; answer: PC }[];
  colors: Parameters<typeof colorOf>[0];
  notes: PC[];
  onAgain: () => void;
  onBack: () => void;
  tests: { t: number; items: { target: PC; answer: PC }[] }[];
}) {
  const ok = items.filter((x) => x.answer === x.target).length;
  const pct = Math.round((ok / items.length) * 100);
  const solid = solidNotes(items);
  const conf = new Map<string, number>();
  for (const x of items) if (x.answer !== x.target) conf.set(`${x.target}>${x.answer}`, (conf.get(`${x.target}>${x.answer}`) ?? 0) + 1);
  const topConf = [...conf.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  return (
    <div className="flex flex-1 flex-col gap-4 pb-8">
      <Card className="space-y-1 text-center">
        <div className="text-sm text-ink-3">{t.aptest.score}</div>
        <div className="text-6xl font-black tabular-nums" data-testid="aptest-score">
          {pct}%
        </div>
        <div className="text-ink-2">{t.quiz.summaryLine(ok, items.length)}</div>
      </Card>

      {solid.length > 0 && (
        <div data-testid="aptest-cert">
        <Card className="space-y-3 text-center ring-2 ring-accent">
          <div className="text-xs uppercase tracking-widest text-ink-3">{t.aptest.certificate}</div>
          <div className="text-2xl font-black">{t.aptest.certTitle(solid.length)}</div>
          <div className="flex flex-wrap justify-center gap-2">
            {solid.map((pc) => (
              <NoteDot key={pc} color={colorOf(colors, pc)} label={nameOf(pc)} size={40} />
            ))}
          </div>
          <div className="text-xs text-ink-3">
            {new Date().toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })} · {t.aptest.solidHint}
          </div>
        </Card>
        </div>
      )}

      <Card className="space-y-2">
        <div className="font-bold">{t.aptest.perNote}</div>
        <ul className="space-y-1.5" data-testid="aptest-per-note">
          {notes.map((pc) => {
            const mine = items.filter((x) => x.target === pc);
            const good = mine.filter((x) => x.answer === pc).length;
            const p = mine.length ? good / mine.length : 0;
            const col = colorOf(colors, pc);
            return (
              <li key={pc} className="flex items-center gap-2 text-sm">
                <span className="w-8 font-bold">{NOTE_NAMES[pc]}</span>
                <div className="h-4 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full" style={{ width: `${p * 100}%`, background: col }} />
                </div>
                <span className="w-12 text-right tabular-nums text-ink-3">
                  {good}/{mine.length}
                </span>
              </li>
            );
          })}
        </ul>
        {topConf.length > 0 && (
          <div className="pt-1 text-xs text-ink-3">
            {t.aptest.confusions}:{" "}
            {topConf.map(([k, n]) => {
              const [a, b] = k.split(">").map(Number);
              return `${NOTE_NAMES[a]}→${NOTE_NAMES[b]} (${n})`;
            }).join(" · ")}
          </div>
        )}
      </Card>
      <History tests={tests} />
      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={onBack}>
          {t.done}
        </Button>
        <Button onClick={onAgain} data-testid="aptest-again">
          {t.aptest.again}
        </Button>
      </div>
    </div>
  );
}

/** The last tests' scores as bars. */
function History({ tests }: { tests: { t: number; items: { target: PC; answer: PC }[] }[] }) {
  if (!tests.length) return null;
  const last = tests.slice(-8);
  return (
    <div className="w-full" data-testid="aptest-history">
    <Card className="w-full space-y-2 text-left">
      <div className="font-bold">{t.aptest.history}</div>
      <div className="flex h-24 items-end gap-2">
        {last.map((x) => {
          const pct = Math.round((x.items.filter((i) => i.answer === i.target).length / x.items.length) * 100);
          return (
            <div key={x.t} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[10px] tabular-nums text-ink-3">{pct}%</span>
              <div className="w-full rounded-t-md bg-accent" style={{ height: `${Math.max(4, pct * 0.7)}px` }} />
              <span className="text-[10px] text-ink-3">{new Date(x.t).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}</span>
            </div>
          );
        })}
      </div>
    </Card>
    </div>
  );
}

