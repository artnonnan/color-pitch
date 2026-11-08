"use client";
import { useEffect, useRef, useState } from "react";
import { useStore, usePracticeTimer } from "@/lib/store";
import { colorOf, mix } from "@/lib/colors";
import { CHORD_INTERVALS, CHORD_SYMBOL, nameOf, pcOf, pick, randInt, type ChordQuality, type PC } from "@/lib/music";
import { newVoice, playChord, playSequence, stopAll } from "@/lib/audio";
import { mixChordCorrect, unlockedChords, unlockedNotes, appendCapped } from "@/lib/state";
import { Keyboard, type KeyFlash } from "../Keyboard";
import { Button, Card, ColorWash, NoteDot, ScreenHeader, cx } from "../ui";
import { burstFrom, fireworks } from "../fx/Burst";
import { ComboBadge } from "../fx/Celebration";
import { t } from "@/i18n";

const ROUNDS = 10;
const ALL_PCS: PC[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
type Phase = "intro" | "question" | "feedback" | "summary";
interface Q {
  root: PC;
  quality: ChordQuality;
  midis: number[];
  pcs: PC[];
}

/** Blend a list of colors evenly. */
function blend(colors: string[]): string {
  if (!colors.length) return "#444444";
  let c = colors[0];
  for (let i = 1; i < colors.length; i++) c = mix(c, colors[i], 1 / (i + 1));
  return c;
}

/**
 * Hear a chord and tap every note in it. The tapped notes' colors blend into "your mix",
 * shown next to the chord's real mix. Roots come from the unlocked notes and qualities from
 * the unlocked chords; every key can be tapped, because chord tones go beyond the unlocked set.
 */
export function MixChord({ onBack }: { onBack: () => void }) {
  const { state, setProgress, getState } = useStore();
  const { settings } = state;
  usePracticeTimer(true);

  const [phase, setPhase] = useState<Phase>("intro");
  const [q, setQ] = useState<Q | null>(null);
  const [picked, setPicked] = useState<PC[]>([]);
  const [round, setRound] = useState(0);
  const [hits, setHits] = useState(0);
  const [combo, setCombo] = useState(0);
  const [flashes, setFlashes] = useState<KeyFlash[]>([]);
  const [wash, setWash] = useState<{ color: string; k: number } | null>(null);
  const roundRef = useRef(0);
  const hitsRef = useRef(0);
  const k = useRef(0);
  const last = useRef<string>("");

  useEffect(() => () => stopAll(), []);

  const play = (x: Q) => playChord(x.midis, 1.8);
  const arpeggio = (x: Q) => playSequence(x.midis, 0.45, 0.6);

  const ask = () => {
    newVoice();
    const p = getState().progress;
    let root: PC, quality: ChordQuality;
    do {
      root = pick(unlockedNotes(p));
      quality = pick(unlockedChords(p).filter((c) => CHORD_INTERVALS[c].length === 3).length ? unlockedChords(p).filter((c) => CHORD_INTERVALS[c].length === 3) : unlockedChords(p));
    } while (`${root}${quality}` === last.current && unlockedNotes(p).length > 1);
    last.current = `${root}${quality}`;
    const base = 48 + root + (root > 7 ? -12 : 0) + randInt(0, 1) * 12; // C3–G4 roots, so the chord sits mid-range
    const midis = CHORD_INTERVALS[quality].map((s) => base + s);
    const x: Q = { root, quality, midis, pcs: midis.map(pcOf) };
    (window as unknown as { __cpQuestion?: unknown }).__cpQuestion = { kind: "mixchord", ...x };
    setQ(x);
    setPicked([]);
    setFlashes([]);
    roundRef.current++;
    setRound(roundRef.current);
    setPhase("question");
    void play(x);
  };

  const toggle = (pc: PC) => {
    if (phase !== "question") return;
    setPicked((cur) => (cur.includes(pc) ? cur.filter((x) => x !== pc) : [...cur, pc]));
  };

  const check = () => {
    if (!q || phase !== "question" || !picked.length) return;
    const a = { t: Date.now(), root: q.root, quality: q.quality, target: q.pcs, answer: [...picked] };
    const ok = mixChordCorrect(a);
    setProgress((p) => ({ ...p, mixChords: appendCapped(p.mixChords, a) }));
    k.current++;
    setFlashes([
      ...q.pcs.map((pc) => ({ pc, kind: (picked.includes(pc) ? "correct" : "reveal") as KeyFlash["kind"], k: k.current })),
      ...picked.filter((pc) => !q.pcs.includes(pc)).map((pc) => ({ pc, kind: "wrong" as const, k: k.current })),
    ]);
    const real = blend(q.pcs.map((pc) => colorOf(settings.noteColors, pc)));
    setWash({ color: real, k: k.current });
    setPhase("feedback");
    if (ok) {
      hitsRef.current++;
      setHits(hitsRef.current);
      setCombo((c) => c + 1);
      burstFrom(document.querySelector('[data-testid="mix-swatches"]'), [...q.pcs.map((pc) => colorOf(settings.noteColors, pc)), "#ffffff"], 1.4);
    } else {
      setCombo(0);
    }
    void arpeggio(q).then(() => window.setTimeout(() => void play(q), 1500));
  };

  const next = () => {
    if (roundRef.current >= ROUNDS) {
      setPhase("summary");
      if (hitsRef.current >= ROUNDS * 0.8) fireworks(unlockedNotes(getState().progress).map((pc) => colorOf(settings.noteColors, pc)), 7);
      return;
    }
    ask();
  };

  const yourMix = blend(picked.map((pc) => colorOf(settings.noteColors, pc)));
  const realMix = q ? blend(q.pcs.map((pc) => colorOf(settings.noteColors, pc))) : "#444444";
  const hit = q ? picked.filter((pc) => q.pcs.includes(pc)).length : 0;
  const ok = q ? mixChordCorrect({ t: 0, root: q.root, quality: q.quality, target: q.pcs, answer: picked }) : false;
  const chordLabel = q ? `${nameOf(q.root)}${CHORD_SYMBOL[q.quality]}` : "";

  return (
    <div className="flex min-h-[calc(100dvh-1rem)] flex-col">
      <ScreenHeader
        title={t.exercises.mixchord.title}
        onBack={onBack}
        sub={phase === "intro" ? undefined : t.mixchord.round(Math.min(Math.max(round, 1), ROUNDS), ROUNDS)}
      />
      {wash && <ColorWash color={wash.color} k={wash.k} />}
      <div className="relative z-[11] flex flex-1 flex-col gap-3">
        {phase === "intro" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
            <div className="flex gap-1">
              {unlockedNotes(state.progress).slice(0, 3).map((pc) => (
                <span key={pc} className="h-10 w-10 rounded-full" style={{ background: colorOf(settings.noteColors, pc), boxShadow: `0 0 14px ${colorOf(settings.noteColors, pc)}` }} />
              ))}
            </div>
            <p className="text-ink-2">{t.exercises.mixchord.desc}</p>
            <p className="text-sm text-ink-3">{t.mixchord.tip}</p>
            <Button big onClick={ask} className="pulse-ring" data-testid="mix-start">
              ▶ {t.start}
            </Button>
          </div>
        )}

        {(phase === "question" || phase === "feedback") && q && (
          <>
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="h-9">{phase === "question" && <ComboBadge combo={combo} />}</div>
              {phase === "feedback" ? (
                <div className={cx("pop text-3xl font-black", ok ? "text-good" : "text-bad")}>
                  {ok ? t.mixchord.correct : t.mixchord.partial(hit, q.pcs.length, picked.length - hit)}
                </div>
              ) : (
                <p className="text-ink-2">{t.mixchord.listen}</p>
              )}
              <div className="grid w-full grid-cols-2 gap-2" data-testid="mix-swatches">
                <Swatch label={t.mixchord.yourMix} color={yourMix} notes={picked} colors={settings.noteColors} />
                <Swatch
                  label={t.mixchord.realMix}
                  color={phase === "feedback" ? realMix : "var(--surface-2)"}
                  notes={phase === "feedback" ? q.pcs : []}
                  colors={settings.noteColors}
                  hidden={phase !== "feedback"}
                />
              </div>
              {phase === "feedback" && <div className="text-sm text-ink-2" data-testid="mix-chord-name">{t.mixchord.itWas(chordLabel)}</div>}
              <div className="text-xs text-ink-3" data-testid="mix-picked">
                {t.mixchord.picked(picked.length, q.pcs.length)}
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="secondary" onClick={() => void play(q)}>
                  ↻ {t.mixchord.chord}
                </Button>
                <Button variant="secondary" onClick={() => void arpeggio(q)} data-testid="mix-arpeggio">
                  ♪ {t.mixchord.arpeggio}
                </Button>
              </div>
            </div>
            <div className="mt-auto space-y-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {phase === "question" ? (
                <Button big className="w-full" disabled={!picked.length} onClick={check} data-testid="mix-check">
                  ✓ {t.mixchord.check}
                </Button>
              ) : (
                <Button big className="w-full" onClick={next} data-testid="mix-next">
                  {t.next} ›
                </Button>
              )}
              <Keyboard
                colors={settings.noteColors}
                enabled={ALL_PCS}
                onPress={toggle}
                hideColors={settings.hardMode}
                flashes={phase === "feedback" ? flashes : picked.map((pc) => ({ pc, kind: "reveal" as const, k: 0 }))}
                disabled={phase !== "question"}
                showLocked={false}
                height={180}
              />
            </div>
          </>
        )}

        {phase === "summary" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <div className="text-6xl">{hits >= ROUNDS * 0.8 ? "🏆" : "🎨"}</div>
            <h2 className="text-2xl font-black">{t.mixchord.summaryLine(hits, ROUNDS)}</h2>
            <Button big className="w-full" onClick={onBack}>
              {t.done}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Swatch({
  label,
  color,
  notes,
  colors,
  hidden,
}: {
  label: string;
  color: string;
  notes: PC[];
  colors: Parameters<typeof colorOf>[0];
  hidden?: boolean;
}) {
  return (
    <Card className="flex flex-col items-center gap-2 p-3">
      <div className="text-xs text-ink-3">{label}</div>
      <div
        className="flex h-16 w-full items-center justify-center rounded-2xl text-2xl"
        style={{ background: color, boxShadow: hidden ? undefined : `0 0 20px 2px ${color}` }}
      >
        {hidden ? "?" : ""}
      </div>
      <div className="flex min-h-7 flex-wrap justify-center gap-1">
        {notes.map((pc) => (
          <NoteDot key={pc} color={colorOf(colors, pc)} label={nameOf(pc)} size={26} />
        ))}
      </div>
    </Card>
  );
}
