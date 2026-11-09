"use client";
import { useState, type ReactNode } from "react";
import { useStore } from "@/lib/store";
import { colorOf } from "@/lib/colors";
import { CHORD_QUALITIES, NOTE_UNLOCK_ORDER, nameOf, type PC } from "@/lib/music";
import { addDays, dayKey, parseDay, rushBest, streak, rainBest, matchBest, mixChordCorrect } from "@/lib/state";
import { Card, ScreenHeader, cx } from "../ui";
import { t } from "@/i18n";

const pctOf = (hit: number, n: number) => (n ? `${Math.round((hit / n) * 100)}%` : "–");
const fmtDay = (k: string) => parseDay(k).toLocaleDateString("th-TH", { day: "numeric", month: "short" });

function Section({ title, sub, children, table }: { title: string; sub?: string; children: ReactNode; table?: ReactNode }) {
  return (
    <Card className="space-y-3">
      <div>
        <h2 className="font-bold">{title}</h2>
        {sub && <p className="text-xs text-ink-3">{sub}</p>}
      </div>
      {children}
      {table && (
        <details className="text-sm">
          <summary className="min-h-10 cursor-pointer py-2 text-ink-3">{t.stats.table}</summary>
          <div className="max-h-72 overflow-auto">{table}</div>
        </details>
      )}
    </Card>
  );
}

function Empty() {
  return <p className="py-6 text-center text-sm text-ink-3">{t.stats.noData}</p>;
}

function Tile({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-3xl border border-line bg-surface p-3 text-center">
      <div className="text-2xl font-black tabular-nums">{value}</div>
      <div className="text-xs text-ink-3">{label}</div>
    </div>
  );
}

const th = "px-2 py-1 text-left font-semibold text-ink-2";
const td = "px-2 py-1 tabular-nums";

export function Stats() {
  const { state } = useStore();
  const { progress: p, settings } = state;
  const [sel, setSel] = useState<PC | null>(null);
  const today = dayKey();

  // ---- per-note accuracy ----
  const perNote = NOTE_UNLOCK_ORDER.map((pc) => {
    const xs = p.noteAnswers.filter((a) => a.target === pc);
    const ok = xs.filter((a) => a.answer === pc).length;
    return {
      pc,
      n: xs.length,
      pct: xs.length ? Math.round((ok / xs.length) * 100) : 0,
      ms: xs.length ? Math.round(xs.reduce((s, a) => s + a.ms, 0) / xs.length) : 0,
    };
  }).filter((r, i) => r.n > 0 || i < p.notesUnlocked);

  // ---- first-note trend ----
  const firsts = Object.entries(p.firstNote)
    .filter(([, e]) => e.cents !== null)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .slice(-30)
    .map(([d, e]) => ({ d, abs: Math.abs(Math.round(e.cents!)), e }));

  // ---- minutes per day (last 14 days) ----
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const mins = days.map((d) => ({ d, m: Math.round(((p.practiceSeconds[d] ?? 0) / 60) * 10) / 10 }));
  const totalMin = Math.round(Object.values(p.practiceSeconds).reduce((a, b) => a + b, 0) / 60);

  // ---- confusion matrix ----
  const seen = NOTE_UNLOCK_ORDER.filter((pc) => p.noteAnswers.some((a) => a.target === pc || a.answer === pc));
  const matrix = new Map<string, number>();
  for (const a of p.noteAnswers) matrix.set(`${a.target}-${a.answer}`, (matrix.get(`${a.target}-${a.answer}`) ?? 0) + 1);

  // ---- chords & tuner ----
  const chordRows = CHORD_QUALITIES.map((q) => {
    const xs = p.chordAnswers.filter((a) => a.target === q);
    return { q, n: xs.length, pct: xs.length ? Math.round((xs.filter((a) => a.answer === q).length / xs.length) * 100) : 0 };
  }).filter((r) => r.n > 0);
  const tunerHits = p.tuner.filter((x) => x.guess === x.actual).length;

  return (
    <div className="space-y-4 pb-28">
      <ScreenHeader title={t.stats.title} />
      <div className="grid grid-cols-3 gap-2">
        <Tile value={p.noteAnswers.length + p.chordAnswers.length} label={t.stats.totalAnswers} />
        <Tile value={totalMin} label={t.stats.totalMinutes} />
        <Tile value={streak(p, today)} label={t.stats.streak} />
      </div>

      {/* Accuracy per note — bar per note in its own color */}
      <Section
        title={t.stats.accuracyPerNote}
        sub={t.stats.accuracyPerNoteSub}
        table={
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>{t.stats.note}</th>
                <th className={th}>{t.stats.accuracy}</th>
                <th className={th}>{t.stats.count}</th>
                <th className={th}>{t.stats.avgMs}</th>
              </tr>
            </thead>
            <tbody>
              {perNote.map((r) => (
                <tr key={r.pc} className="border-t border-line">
                  <td className={td}>{nameOf(r.pc)}</td>
                  <td className={td}>{r.n ? `${r.pct}%` : "–"}</td>
                  <td className={td}>{r.n}</td>
                  <td className={td}>{r.n ? `${(r.ms / 1000).toFixed(1)} s` : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      >
        {p.noteAnswers.length === 0 ? (
          <Empty />
        ) : (
          <>
            <svg viewBox="0 0 320 170" className="w-full" role="img" aria-label={t.stats.accuracyPerNote}>
              {[0, 50, 100].map((v) => (
                <g key={v}>
                  <line x1={24} x2={316} y1={140 - v * 1.2} y2={140 - v * 1.2} stroke="var(--line)" strokeWidth={1} />
                  <text x={20} y={144 - v * 1.2} textAnchor="end" fontSize={9} fill="var(--ink-3)">
                    {v}
                  </text>
                </g>
              ))}
              {perNote.map((r, i) => {
                const slot = 292 / perNote.length;
                const w = Math.min(28, slot - 4);
                const x = 24 + i * slot + (slot - w) / 2;
                const h = Math.max(r.n ? 2 : 0, r.pct * 1.2);
                const c = colorOf(settings.noteColors, r.pc);
                return (
                  <g key={r.pc} onClick={() => setSel(sel === r.pc ? null : r.pc)} className="cursor-pointer">
                    <title>{`${nameOf(r.pc)}: ${r.pct}% · ${r.n} · ${(r.ms / 1000).toFixed(1)} s`}</title>
                    <rect x={24 + i * slot} y={0} width={slot} height={168} fill="transparent" />
                    <path
                      d={`M${x},140 V${140 - h + Math.min(4, h)} q0,-4 4,-4 H${x + w - 4} q4,0 4,4 V140 Z`}
                      fill={c}
                      opacity={sel === null || sel === r.pc ? 1 : 0.35}
                    />
                    {(sel === r.pc || perNote.length <= 7) && r.n > 0 && (
                      <text x={x + w / 2} y={136 - h} textAnchor="middle" fontSize={10} fontWeight={700} fill="var(--ink)">
                        {r.pct}
                      </text>
                    )}
                    <text x={x + w / 2} y={153} textAnchor="middle" fontSize={10} fontWeight={700} fill="var(--ink)">
                      {nameOf(r.pc)}
                    </text>
                    <text x={x + w / 2} y={165} textAnchor="middle" fontSize={8} fill="var(--ink-3)">
                      {r.n}
                    </text>
                  </g>
                );
              })}
            </svg>
            {sel !== null && (
              <p className="text-center text-sm text-ink-2">
                {(() => {
                  const r = perNote.find((x) => x.pc === sel);
                  return r ? `${nameOf(r.pc)} · ${r.pct}% · ${r.n} · ${t.stats.avgMs} ${(r.ms / 1000).toFixed(1)} s` : null;
                })()}
              </p>
            )}
          </>
        )}
      </Section>

      {/* First note error trend */}
      <Section
        title={t.stats.firstNoteTrend}
        sub={t.stats.firstNoteTrendSub}
        table={
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>{t.stats.date}</th>
                <th className={th}>{t.stats.note}</th>
                <th className={th}>{t.stats.cents}</th>
              </tr>
            </thead>
            <tbody>
              {[...firsts].reverse().map((f) => (
                <tr key={f.d} className="border-t border-line">
                  <td className={td}>{fmtDay(f.d)}</td>
                  <td className={td}>{nameOf(f.e.target)}</td>
                  <td className={td}>{Math.round(f.e.cents!)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      >
        {firsts.length === 0 ? (
          <Empty />
        ) : (
          (() => {
            const max = Math.max(100, ...firsts.map((f) => f.abs));
            const W = 320, H = 150, L = 30, R = 10, T = 12, B = 22;
            const xOf = (i: number) => (firsts.length === 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (firsts.length - 1));
            const yOf = (v: number) => T + (1 - v / max) * (H - T - B);
            const ticks = [0, Math.round(max / 2), max];
            return (
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={t.stats.firstNoteTrend}>
                {ticks.map((v) => (
                  <g key={v}>
                    <line x1={L} x2={W - R} y1={yOf(v)} y2={yOf(v)} stroke="var(--line)" />
                    <text x={L - 4} y={yOf(v) + 3} fontSize={9} textAnchor="end" fill="var(--ink-3)">
                      {v}
                    </text>
                  </g>
                ))}
                <polyline
                  points={firsts.map((f, i) => `${xOf(i)},${yOf(f.abs)}`).join(" ")}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  strokeLinejoin="round"
                />
                {firsts.map((f, i) => (
                  <g key={f.d}>
                    <title>{`${fmtDay(f.d)} · ${nameOf(f.e.target)} · ${Math.round(f.e.cents!)}¢`}</title>
                    <circle cx={xOf(i)} cy={yOf(f.abs)} r={14} fill="transparent" />
                    <circle cx={xOf(i)} cy={yOf(f.abs)} r={4.5} fill={colorOf(settings.noteColors, f.e.target)} stroke="var(--surface)" strokeWidth={2} />
                  </g>
                ))}
                <text x={L} y={H - 6} fontSize={9} fill="var(--ink-3)">
                  {fmtDay(firsts[0].d)}
                </text>
                {firsts.length > 1 && (
                  <text x={W - R} y={H - 6} fontSize={9} textAnchor="end" fill="var(--ink-3)">
                    {fmtDay(firsts[firsts.length - 1].d)}
                  </text>
                )}
              </svg>
            );
          })()
        )}
      </Section>

      {/* Minutes per day */}
      <Section
        title={t.stats.minutesPerDay}
        sub={t.stats.minutesPerDaySub}
        table={
          <table className="w-full">
            <tbody>
              {[...mins].reverse().map((m) => (
                <tr key={m.d} className="border-t border-line">
                  <td className={td}>{fmtDay(m.d)}</td>
                  <td className={td}>
                    {m.m} {t.stats.minutes}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      >
        {(() => {
          const max = Math.max(15, ...mins.map((m) => m.m));
          const W = 320, H = 130, L = 24, B = 20, T = 8;
          const slot = (W - L) / mins.length;
          const w = Math.min(16, slot - 4);
          return (
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={t.stats.minutesPerDay}>
              {[0, Math.round(max / 2), Math.round(max)].map((v) => {
                const y = T + (1 - v / max) * (H - T - B);
                return (
                  <g key={v}>
                    <line x1={L} x2={W} y1={y} y2={y} stroke="var(--line)" />
                    <text x={L - 4} y={y + 3} fontSize={9} textAnchor="end" fill="var(--ink-3)">
                      {v}
                    </text>
                  </g>
                );
              })}
              {mins.map((m, i) => {
                const h = (m.m / max) * (H - T - B);
                const x = L + i * slot + (slot - w) / 2;
                const base = H - B;
                return (
                  <g key={m.d}>
                    <title>{`${fmtDay(m.d)}: ${m.m} ${t.stats.minutes}`}</title>
                    {h > 0 && (
                      <path
                        d={`M${x},${base} V${base - h + Math.min(4, h)} q0,-${Math.min(4, h)} 4,-${Math.min(4, h)} H${x + w - 4} q4,0 4,${Math.min(4, h)} V${base} Z`}
                        fill={m.d === today ? "var(--accent)" : "color-mix(in srgb, var(--accent) 55%, transparent)"}
                      />
                    )}
                    {(i % 2 === 1 || i === mins.length - 1) && (
                      <text x={x + w / 2} y={H - 6} fontSize={8} textAnchor="middle" fill="var(--ink-3)">
                        {parseDay(m.d).getDate()}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          );
        })()}
      </Section>

      {/* Confusion matrix */}
      <Section title={t.stats.confusion} sub={t.stats.confusionSub}>
        {seen.length === 0 ? (
          <Empty />
        ) : (
          <div className="overflow-x-auto">
            <table className="mx-auto border-separate border-spacing-[2px] text-xs">
              <thead>
                <tr>
                  <th />
                  {seen.map((c) => (
                    <th key={c} className="h-7 w-7 font-bold" style={{ color: colorOf(settings.noteColors, c) }}>
                      {nameOf(c)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {seen.map((r) => {
                  const rowTotal = seen.reduce((s, c) => s + (matrix.get(`${r}-${c}`) ?? 0), 0);
                  return (
                    <tr key={r}>
                      <th className="pr-1 text-right font-bold" style={{ color: colorOf(settings.noteColors, r) }}>
                        {nameOf(r)}
                      </th>
                      {seen.map((c) => {
                        const v = matrix.get(`${r}-${c}`) ?? 0;
                        const share = rowTotal ? v / rowTotal : 0;
                        const diag = r === c;
                        return (
                          <td
                            key={c}
                            title={`${nameOf(r)} → ${nameOf(c)}: ${v}`}
                            className={cx("h-8 w-8 rounded-md text-center tabular-nums", diag && "ring-1 ring-line")}
                            style={{
                              background: v
                                ? diag
                                  ? `color-mix(in srgb, var(--good) ${20 + share * 60}%, transparent)`
                                  : `color-mix(in srgb, var(--bad) ${15 + share * 85}%, transparent)`
                                : "var(--surface-2)",
                              color: v ? "var(--ink)" : "var(--ink-3)",
                            }}
                          >
                            {v || ""}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* New exercises */}
      <Section title={t.stats.games}>
        <div className="grid grid-cols-3 gap-2">
          <Tile value={rushBest(p) || "–"} label={t.stats.rushBest} />
          <Tile value={pctOf(p.sing.filter((x) => (x.cents !== null ? Math.abs(x.cents) <= 50 : x.answer === x.target)).length, p.sing.length)} label={t.stats.singAcc} />
          <Tile value={pctOf(p.roots.filter((x) => x.answer === x.target).length, p.roots.length)} label={t.stats.rootAcc} />
          <Tile value={pctOf(p.degrees.filter((x) => x.answer === x.target).length, p.degrees.length)} label={t.stats.degreeAcc} />
          <Tile value={pctOf(p.intervals.filter((x) => x.answer === x.target).length, p.intervals.length)} label={t.stats.intervalAcc} />
          <Tile value={pctOf(p.progressions.filter((x) => x.answer === x.target).length, p.progressions.length)} label={t.stats.progressionAcc} />
          <Tile value={pctOf(p.melodies.filter((x) => x.answer === x.target).length, p.melodies.length)} label={t.stats.melodyAcc} />
          <Tile value={rainBest(p) || "–"} label={t.stats.rainBest} />
          <Tile value={pctOf(p.mixChords.filter(mixChordCorrect).length, p.mixChords.length)} label={t.stats.mixChordAcc} />
          <Tile value={matchBest(p, 6) || "–"} label={t.stats.matchBest} />
          <Tile value={pctOf(p.colorPicks.filter((x) => x.answer === x.target).length, p.colorPicks.length)} label={t.stats.colorPickAcc} />
          <Tile
            value={(() => {
              const x = p.apTests.at(-1);
              return x ? `${Math.round((x.items.filter((i) => i.answer === i.target).length / x.items.length) * 100)}%` : "–";
            })()}
            label={t.stats.apTestLast}
          />
          <Tile value={Math.round(p.calmSessions.reduce((a, x) => a + x.secs, 0) / 60) || "–"} label={t.stats.calmMinutes} />
          <Tile value={pctOf(p.memAnswers.filter((x) => x.answer === x.target).length, p.memAnswers.length)} label={t.stats.memAcc} />
          <Tile value={pctOf(p.anchorAnswers.filter((x) => x.said === (x.played === x.anchor)).length, p.anchorAnswers.length)} label={t.stats.anchorAcc} />
          <Tile value={pctOf(p.wideAnswers.filter((x) => x.answer === x.target).length, p.wideAnswers.length)} label={t.stats.wideAcc} />
        </div>
      </Section>

      {/* Chords + tuner */}
      <Section title={t.stats.chordAccuracy}>
        {chordRows.length === 0 ? (
          <Empty />
        ) : (
          <ul className="space-y-2">
            {chordRows.map((r) => {
              const m = settings.chordMoods[r.q];
              return (
                <li key={r.q} className="flex items-center gap-2 text-sm">
                  <span className="w-28 shrink-0">
                    {m.emoji} {t.chords.names[r.q]}
                  </span>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full" style={{ width: `${r.pct}%`, background: m.color }} />
                  </div>
                  <span className="w-16 text-right tabular-nums text-ink-2">
                    {r.pct}% · {r.n}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title={t.stats.tunerAccuracy}>
        {p.tuner.length === 0 ? (
          <Empty />
        ) : (
          <p className="text-lg font-bold">{t.tuner.accuracy(Math.round((tunerHits / p.tuner.length) * 100), p.tuner.length)}</p>
        )}
      </Section>
    </div>
  );
}
