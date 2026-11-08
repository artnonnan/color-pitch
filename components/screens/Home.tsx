"use client";
import { useStore } from "@/lib/store";
import { colorOf, DEGREE_COLORS } from "@/lib/colors";
import { CHORD_QUALITIES, NOTE_UNLOCK_ORDER, nameOf } from "@/lib/music";
import { currentWeek, dayKey, modesUnlocked, rushBest, streak, type SessionStep } from "@/lib/state";
import { Button, Card, NoteDot, cx } from "../ui";
import { t } from "@/i18n";
import type { Screen } from "../App";

export const SESSION_STEPS: SessionStep[] = ["first", "quiz", "chords"];

export function Home({ go, startSession }: { go: (s: Screen) => void; startSession: () => void }) {
  const { state, setSettings, profile, sync, switchProfile } = useStore();
  const { progress, settings } = state;
  const today = dayKey();
  const done = progress.sessionDone[today] ?? [];
  const allDone = SESSION_STEPS.every((s) => done.includes(s));
  const anyDone = SESSION_STEPS.some((s) => done.includes(s));
  const st = streak(progress, today);
  const week = currentWeek(progress, today);
  const noteCols = (() => {
    const cs = NOTE_UNLOCK_ORDER.slice(0, Math.max(progress.notesUnlocked, 3)).map((pc) => colorOf(settings.noteColors, pc));
    return cs.length > 1 ? cs : [...cs, "#a855f7"];
  })();
  const best = rushBest(progress);
  const trainedToday = done.length > 0 || (progress.practiceSeconds[today] ?? 0) >= 30;

  const stepInfo: Record<SessionStep, { title: string; time: string; screen: Screen }> = {
    first: { title: t.exercises.first.title, time: t.exercises.first.time, screen: "first" },
    quiz: { title: t.exercises.quiz.title, time: t.exercises.quiz.time, screen: "quiz" },
    chords: { title: t.exercises.chords.title, time: t.exercises.chords.time, screen: "chords" },
  };

  return (
    <div className="space-y-4 pb-28 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="bg-gradient-to-r from-[#ef4444] via-[#facc15] via-50% to-[#a855f7] bg-clip-text text-3xl font-black text-transparent">
            {t.appName}
          </h1>
          <p className="text-sm text-ink-3">{t.tagline}</p>
          <button
            onClick={switchProfile}
            data-testid="profile-chip"
            className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-xs"
          >
            <span className="font-bold">{profile ? t.profile.names[profile] : ""}</span>
            <span className="text-ink-3">·</span>
            <span
              className={cx(
                "h-2 w-2 rounded-full",
                sync === "synced" ? "bg-good" : sync === "offline" ? "bg-bad" : sync === "syncing" ? "animate-pulse bg-accent" : "bg-ink-3",
              )}
            />
            <span className="text-ink-3" data-testid="sync-status">{t.profile.sync[sync]}</span>
          </button>
        </div>
        <button
          aria-label={t.settings.theme}
          className="flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-surface text-xl"
          onClick={() => setSettings((s) => ({ ...s, theme: s.theme === "dark" ? "light" : "dark" }))}
        >
          {settings.theme === "dark" ? "☀️" : "🌙"}
        </button>
      </header>

      {/* streak */}
      <Card className="flex items-center gap-4">
        <div className={cx("text-4xl", st === 0 && "grayscale")}>🔥</div>
        <div className="min-w-0">
          <div className="text-xl font-bold" data-testid="streak">
            {st > 0 ? t.home.streak(st) : t.home.streakZero}
          </div>
          <div className="text-sm text-ink-3">{st > 0 && !trainedToday ? t.home.streakAtRisk : t.home.streakHint}</div>
        </div>
      </Card>

      {/* today's checklist */}
      <Card className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-bold">{t.home.todaySession}</h2>
          <span className="text-xs text-ink-3">{t.home.totalTime}</span>
        </div>
        <ol className="space-y-2">
          {SESSION_STEPS.map((s, i) => {
            const isDone = done.includes(s);
            return (
              <li key={s}>
                <button
                  onClick={() => go(stepInfo[s].screen)}
                  className="flex min-h-14 w-full items-center gap-3 rounded-2xl bg-surface-2 px-3 text-left active:scale-[0.98]"
                >
                  <span
                    className={cx(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                      isDone ? "bg-good text-white dark:text-black" : "border border-line text-ink-3",
                    )}
                  >
                    {isDone ? "✓" : i + 1}
                  </span>
                  <span className={cx("flex-1 font-medium", isDone && "text-ink-3 line-through")}>{stepInfo[s].title}</span>
                  <span className="text-xs text-ink-3">{stepInfo[s].time}</span>
                </button>
              </li>
            );
          })}
        </ol>
        {allDone ? (
          <div className="space-y-2">
            <div className="text-center font-semibold text-good">{t.home.sessionComplete}</div>
            <Button variant="secondary" className="w-full" onClick={() => go("quiz")}>
              {t.home.practiceAgain}
            </Button>
          </div>
        ) : (
          <Button big className="w-full" onClick={startSession} data-testid="start-session">
            ▶ {anyDone ? t.home.continueSession : t.home.startSession}
          </Button>
        )}
      </Card>

      {/* unlocked notes */}
      <Card className="space-y-3">
        <h2 className="font-bold">{t.home.unlockedNotes}</h2>
        <div className="flex flex-wrap gap-2" data-testid="unlocked-notes">
          {NOTE_UNLOCK_ORDER.map((pc, i) => (
            <NoteDot
              key={pc}
              color={colorOf(settings.noteColors, pc)}
              label={i < progress.notesUnlocked ? nameOf(pc) : "🔒"}
              dim={i >= progress.notesUnlocked}
              size={38}
            />
          ))}
        </div>
        <h2 className="pt-1 font-bold">{t.home.unlockedChords}</h2>
        <div className="flex flex-wrap gap-2">
          {CHORD_QUALITIES.map((q, i) => {
            const m = settings.chordMoods[q];
            const on = i < progress.chordsUnlocked;
            return (
              <span
                key={q}
                className="inline-flex min-h-9 items-center gap-1 rounded-full px-3 text-sm font-semibold"
                style={on ? { background: `${m.color}33`, color: "var(--ink)", border: `1px solid ${m.color}` } : { background: "var(--surface-2)", color: "var(--ink-3)" }}
              >
                {on ? m.emoji : "🔒"} {t.chords.names[q]}
              </span>
            );
          })}
        </div>
      </Card>

      {/* curriculum */}
      <Card className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-bold">{t.home.curriculum}</h2>
          <span className="text-xs text-accent">{t.home.youAreInWeek(Math.min(week, 4))}</span>
        </div>
        <ol className="space-y-2">
          {t.home.weeks.map((w, i) => (
            <li
              key={w.title}
              className={cx(
                "flex gap-3 rounded-2xl px-3 py-2",
                Math.min(week, 4) === i + 1 ? "bg-accent/15 ring-1 ring-accent" : "bg-surface-2",
              )}
            >
              <span className="w-20 shrink-0 font-semibold">{w.title}</span>
              <span className="text-sm text-ink-2">{w.body}</span>
            </li>
          ))}
        </ol>
        <p className="text-xs text-ink-3">{t.home.curriculumNote}</p>
      </Card>

      {/* more */}
      <div className="space-y-3">
        <h2 className="px-1 font-bold">{t.home.moreExercises}</h2>
        <button
          onClick={() => go("rush")}
          data-testid="card-rush"
          className="relative flex min-h-28 w-full items-center gap-4 overflow-hidden rounded-3xl p-4 text-left text-white active:scale-[0.98]"
          style={{ background: `linear-gradient(120deg, ${noteCols.join(", ")})` }}
        >
          <span className="text-5xl drop-shadow">⚡</span>
          <span className="min-w-0 flex-1">
            <span className="block text-xl font-black drop-shadow">{t.exercises.rush.title}</span>
            <span className="block text-sm opacity-95 drop-shadow">{t.exercises.rush.desc}</span>
            <span className="mt-1 inline-block rounded-full bg-black/25 px-2 py-0.5 text-xs font-bold">
              🏆 {best ? t.rush.best(best) : t.rush.noBest}
            </span>
          </span>
        </button>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => go("sing")}
            className="flex min-h-28 flex-col justify-between rounded-3xl border border-line bg-surface p-4 text-left active:scale-[0.98]"
          >
            <span className="flex gap-1">
              {noteCols.slice(0, 3).map((c) => (
                <span key={c} className="h-6 w-6 rounded-full" style={{ background: c, boxShadow: `0 0 12px ${c}` }} />
              ))}
              <span className="ml-1 text-xl">🎤</span>
            </span>
            <span>
              <span className="block font-bold">{t.exercises.sing.title}</span>
              <span className="block text-xs text-ink-3">{t.exercises.sing.desc}</span>
            </span>
          </button>
          <button
            onClick={() => go("roots")}
            className="flex min-h-28 flex-col justify-between rounded-3xl border border-line bg-surface p-4 text-left active:scale-[0.98]"
          >
            <span className="text-2xl">🎹</span>
            <span>
              <span className="block font-bold">{t.exercises.roots.title}</span>
              <span className="block text-xs text-ink-3">{t.exercises.roots.desc}</span>
            </span>
          </button>
          <button
            onClick={() => go("degrees")}
            data-testid="card-degrees"
            className="flex min-h-28 flex-col justify-between rounded-3xl border border-line bg-surface p-4 text-left active:scale-[0.98]"
          >
            <span className="flex items-end gap-1">
              {[1, 3, 5].map((d) => (
                <span
                  key={d}
                  className="flex h-6 w-6 items-center justify-center rounded-lg text-xs font-black text-white"
                  style={{ background: DEGREE_COLORS[d] }}
                >
                  {d}
                </span>
              ))}
              <span className="ml-1 text-xl">🏠</span>
            </span>
            <span>
              <span className="block font-bold">{t.exercises.degrees.title}</span>
              <span className="block text-xs text-ink-3">{t.exercises.degrees.desc}</span>
            </span>
          </button>
          <button
            onClick={() => go("intervals")}
            data-testid="card-intervals"
            className="flex min-h-28 flex-col justify-between rounded-3xl border border-line bg-surface p-4 text-left active:scale-[0.98]"
          >
            <span className="flex items-center gap-1">
              <span className="h-6 w-6 rounded-full" style={{ background: noteCols[0], boxShadow: `0 0 12px ${noteCols[0]}` }} />
              <span className="h-[2px] w-5 bg-ink-3" />
              <span className="h-6 w-6 rounded-full" style={{ background: noteCols[1], boxShadow: `0 0 12px ${noteCols[1]}` }} />
              <span className="ml-1 text-xl">📏</span>
            </span>
            <span>
              <span className="block font-bold">{t.exercises.intervals.title}</span>
              <span className="block text-xs text-ink-3">{t.exercises.intervals.desc}</span>
            </span>
          </button>
          <button
            onClick={() => go("progressions")}
            data-testid="card-progressions"
            className="flex min-h-28 flex-col justify-between rounded-3xl border border-line bg-surface p-4 text-left active:scale-[0.98]"
          >
            <span className="flex items-end gap-1">
              {[1, 4, 5].map((d) => (
                <span
                  key={d}
                  className="flex h-6 min-w-6 items-center justify-center rounded-lg px-1 font-serif text-xs font-black text-white"
                  style={{ background: DEGREE_COLORS[d] }}
                >
                  {d === 1 ? "I" : d === 4 ? "IV" : "V"}
                </span>
              ))}
              <span className="ml-1 text-xl">🛤️</span>
            </span>
            <span>
              <span className="block font-bold">{t.exercises.progressions.title}</span>
              <span className="block text-xs text-ink-3">{t.exercises.progressions.desc}</span>
            </span>
          </button>
          <button
            onClick={() => go("melody")}
            data-testid="card-melody"
            className="flex min-h-28 flex-col justify-between rounded-3xl border border-line bg-surface p-4 text-left active:scale-[0.98]"
          >
            <span className="flex items-end gap-1">
              {noteCols.slice(0, 3).map((c, i) => (
                <span key={c} className="w-3 rounded-full" style={{ height: [14, 22, 18][i], background: c, boxShadow: `0 0 10px ${c}` }} />
              ))}
              <span className="ml-1 text-xl">🎼</span>
            </span>
            <span>
              <span className="block font-bold">{t.exercises.melody.title}</span>
              <span className="block text-xs text-ink-3">{t.exercises.melody.desc}</span>
            </span>
          </button>
          <button
            onClick={() => go("modes")}
            className="flex min-h-28 flex-col justify-between rounded-3xl p-4 text-left active:scale-[0.98]"
            style={{ background: "linear-gradient(135deg, #fff3c4, #f5a65b 35%, #6b4c8a 70%, #12111f)", color: "#fff" }}
          >
            <span className="text-2xl">{modesUnlocked(progress) ? "🌗" : "🔒"}</span>
            <span>
              <span className="block font-bold drop-shadow">{t.exercises.modes.title}</span>
              <span className="block text-xs opacity-90 drop-shadow">
                {modesUnlocked(progress) ? t.exercises.modes.desc : t.home.modeLocked}
              </span>
            </span>
          </button>
          <button
            onClick={() => go("tuner")}
            className="flex min-h-28 flex-col justify-between rounded-3xl border border-line bg-surface p-4 text-left active:scale-[0.98]"
          >
            <span className="text-2xl">📻</span>
            <span>
              <span className="block font-bold">{t.exercises.tuner.title}</span>
              <span className="block text-xs text-ink-3">{t.exercises.tuner.desc}</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
