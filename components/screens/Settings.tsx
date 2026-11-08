"use client";
import { useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { colorOf, defaultChordMoods, defaultNoteColors, inkOn } from "@/lib/colors";
import { CHORD_QUALITIES, isBlack, midiName, NOTE_NAMES, type ChordQuality } from "@/lib/music";
import { newVoice, playNote } from "@/lib/audio";
import { defaultProgress, type Instrument } from "@/lib/state";
import { exportJson, parseImport } from "@/lib/storage";
import { Button, Card, ScreenHeader, cx } from "../ui";
import { AudioCheck } from "../AudioUnlock";
import { t } from "@/i18n";

const OCTAVE_CHOICES = [36, 48, 60, 72, 84]; // C2..C6

export function SettingsScreen() {
  const { state, setSettings, setProgress, replaceState, profile, sync, switchProfile } = useStore();
  const s = state.settings;
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const flash = (m: string) => {
    setMsg(m);
    window.setTimeout(() => setMsg(null), 2500);
  };

  const setNoteColor = (pc: number, color: string | null) =>
    setSettings((x) => ({ ...x, noteColors: { ...x.noteColors, [pc]: color } }));
  const setMood = (q: ChordQuality, patch: Partial<(typeof s.chordMoods)[ChordQuality]>) =>
    setSettings((x) => ({ ...x, chordMoods: { ...x.chordMoods, [q]: { ...x.chordMoods[q], ...patch } } }));

  const doExport = () => {
    const blob = new Blob([exportJson(state)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `color-pitch-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const doImport = async (file: File) => {
    const parsed = parseImport(await file.text());
    if (!parsed) return flash(t.settings.importFail);
    replaceState(parsed);
    flash(t.settings.importOk);
  };
  const doReset = () => {
    if (!window.confirm(t.settings.resetConfirm)) return;
    setProgress(() => defaultProgress());
    flash(t.settings.resetDone);
  };

  return (
    <div className="space-y-4 pb-28">
      <ScreenHeader title={t.settings.title} />
      {msg && (
        <div className="pop fixed inset-x-4 top-4 z-50 mx-auto max-w-md rounded-2xl bg-accent px-4 py-3 text-center font-semibold text-white dark:text-black">
          {msg}
        </div>
      )}

      {/* Note colors */}
      <Card className="space-y-3">
        <h2 className="font-bold">{t.settings.noteColors}</h2>
        <p className="rounded-2xl bg-accent/10 px-3 py-2 text-sm text-ink-2">💡 {t.settings.colorTip}</p>
        <div className="grid grid-cols-4 gap-2">
          {NOTE_NAMES.map((name, pc) => {
            const col = colorOf(s.noteColors, pc);
            const auto = isBlack(pc) && !s.noteColors[pc];
            return (
              <div key={name} className="flex flex-col items-center gap-1">
                <label
                  className="relative flex h-14 w-full items-center justify-center rounded-2xl text-lg font-bold"
                  style={{ background: col, color: inkOn(col) }}
                >
                  {name}
                  <input
                    type="color"
                    value={col}
                    onChange={(e) => setNoteColor(pc, e.target.value)}
                    className="absolute inset-0 cursor-pointer opacity-0"
                    aria-label={`${name} color`}
                  />
                </label>
                {isBlack(pc) && (
                  <button
                    className={cx("min-h-8 text-[11px]", auto ? "text-accent" : "text-ink-3 underline")}
                    onClick={() => setNoteColor(pc, null)}
                    disabled={auto}
                  >
                    {t.settings.autoBlend}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <Button variant="ghost" className="w-full" onClick={() => setSettings((x) => ({ ...x, noteColors: defaultNoteColors() }))}>
          ↺ {t.settings.resetColors}
        </Button>
      </Card>

      {/* Chord moods */}
      <Card className="space-y-3">
        <h2 className="font-bold">{t.settings.chordMoods}</h2>
        {CHORD_QUALITIES.map((q) => {
          const m = s.chordMoods[q];
          return (
            <div key={q} className="flex items-center gap-2">
              <label className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ background: m.color }}>
                <input
                  type="color"
                  value={m.color}
                  onChange={(e) => setMood(q, { color: e.target.value })}
                  className="absolute inset-0 cursor-pointer opacity-0"
                  aria-label={`${q} color`}
                />
              </label>
              <input
                value={m.emoji}
                onChange={(e) => setMood(q, { emoji: e.target.value.slice(0, 4) })}
                className="h-12 w-12 shrink-0 rounded-2xl border border-line bg-surface-2 text-center text-xl"
                aria-label={`${q} emoji`}
              />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-ink-3">{t.chords.names[q]}</div>
                <input
                  value={m.mood}
                  onChange={(e) => setMood(q, { mood: e.target.value })}
                  className="h-9 w-full rounded-xl border border-line bg-surface-2 px-2 text-sm"
                  aria-label={`${q} mood`}
                />
              </div>
            </div>
          );
        })}
        <Button variant="ghost" className="w-full" onClick={() => setSettings((x) => ({ ...x, chordMoods: defaultChordMoods() }))}>
          ↺ {t.settings.resetColors}
        </Button>
      </Card>

      {/* Instrument */}
      <Card className="space-y-3">
        <h2 className="font-bold">{t.settings.instrument}</h2>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["piano", "🎹", t.settings.piano, t.settings.pianoSub],
              ["sine", "〰️", t.settings.sine, t.settings.sineSub],
              ["mix", "🎨", t.settings.mix, t.settings.mixSub],
            ] as [Instrument, string, string, string][]
          ).map(([id, icon, label, sub]) => (
            <button
              key={id}
              onClick={() => setSettings((x) => ({ ...x, instrument: id }))}
              data-instrument={id}
              className={cx(
                id === "mix" && "col-span-2",
                "flex min-h-20 flex-col items-start justify-center rounded-2xl border px-3 text-left",
                s.instrument === id ? "border-accent bg-accent/15" : "border-line bg-surface-2",
              )}
            >
              <span className="font-bold">
                {icon} {label}
              </span>
              <span className="text-xs text-ink-3">{sub}</span>
            </button>
          ))}
        </div>
        <Button variant="secondary" className="w-full" onClick={() => {
          newVoice();
          void playNote(60);
        }}>
          🔊 {t.settings.testSound}
        </Button>
      </Card>

      {/* Octave range */}
      <Card className="space-y-3">
        <h2 className="font-bold">{t.settings.octaveRange}</h2>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              ["lowMidi", t.settings.from],
              ["highMidi", t.settings.to],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="space-y-1 text-sm">
              <span className="text-ink-3">{label}</span>
              <select
                value={s[key]}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setSettings((x) => {
                    const next = { ...x, [key]: v };
                    if (next.lowMidi >= next.highMidi) {
                      if (key === "lowMidi") next.highMidi = v + 12;
                      else next.lowMidi = v - 12;
                    }
                    return next;
                  });
                }}
                className="h-12 w-full rounded-2xl border border-line bg-surface-2 px-3 text-base"
              >
                {OCTAVE_CHOICES.map((m) => (
                  <option key={m} value={m}>
                    {midiName(m)}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </Card>

      {/* Theme */}
      <Card className="space-y-3">
        <h2 className="font-bold">{t.settings.theme}</h2>
        <div className="grid grid-cols-2 gap-2">
          {(["dark", "light"] as const).map((th) => (
            <button
              key={th}
              onClick={() => setSettings((x) => ({ ...x, theme: th }))}
              className={cx(
                "min-h-12 rounded-2xl border font-semibold",
                s.theme === th ? "border-accent bg-accent/15" : "border-line bg-surface-2",
              )}
            >
              {th === "dark" ? `🌙 ${t.settings.dark}` : `☀️ ${t.settings.light}`}
            </button>
          ))}
        </div>
      </Card>

      {/* Profile */}
      <Card className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm text-ink-3">{t.profile.current}</div>
          <div className="font-bold">
            {profile ? t.profile.names[profile] : ""} <span className="text-xs font-normal text-ink-3">· {t.profile.sync[sync]}</span>
          </div>
        </div>
        <Button variant="secondary" onClick={switchProfile} data-testid="switch-profile">
          ⇄ {t.profile.switch}
        </Button>
      </Card>

      {/* Data */}
      <Card className="space-y-3">
        <h2 className="font-bold">{t.settings.data}</h2>
        <p className="text-sm text-ink-3">{t.settings.dataNote}</p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={doExport}>
            ⬇ {t.settings.export}
          </Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            ⬆ {t.settings.import}
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void doImport(f);
            e.target.value = "";
          }}
        />
        <Button variant="danger" className="w-full" onClick={doReset}>
          {t.settings.reset}
        </Button>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-bold">🔈 {t.audioDiag.title}</h2>
        <AudioCheck />
      </Card>

      <Card className="space-y-2">
        <h2 className="font-bold">{t.settings.about}</h2>
        <p className="text-sm leading-relaxed text-ink-2">{t.settings.aboutBody}</p>
      </Card>
    </div>
  );
}
