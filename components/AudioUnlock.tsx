"use client";
import { useEffect, useState } from "react";
import { audioDiagnostics, getAudioStatus, isAudioRunning, onAudioStatus, playNote, preloadAudio, unlockAudio, type AudioStatus } from "@/lib/audio";
import { cx } from "./ui";
import { t } from "@/i18n";

/**
 * Unlocks Web Audio on a tap (iOS needs a real gesture — touchend/click, not just
 * touchstart). The listeners stay on for the whole session: iOS suspends audio
 * when the screen locks or the user switches apps, and the next tap must wake it.
 * It is mounted from the very first screen (the profile picker), so the first tap counts.
 *
 * Tapping the pill opens sound diagnostics, so a player can screenshot what the
 * browser reports when there is no sound.
 */
export function AudioUnlock({ raised = true }: { raised?: boolean }) {
  const [status, setStatus] = useState<AudioStatus>(getAudioStatus());
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<ReturnType<typeof audioDiagnostics> | null>(null);

  useEffect(() => {
    void preloadAudio();
    const off = onAudioStatus(setStatus);
    const handler = () => {
      if (!isAudioRunning()) unlockAudio();
    };
    const events = ["touchend", "click", "keydown"] as const;
    events.forEach((e) => document.addEventListener(e, handler, true));
    return () => {
      off();
      events.forEach((e) => document.removeEventListener(e, handler, true));
    };
  }, []);

  // Refresh the panel while it is open (the tap that opened it may just have started audio).
  useEffect(() => {
    if (!open) return;
    setInfo(audioDiagnostics());
    const id = window.setInterval(() => setInfo(audioDiagnostics()), 700);
    return () => window.clearInterval(id);
  }, [open]);

  if (status === "ready" && !open) return null;
  const text = status === "locked" ? t.tapToEnableSound : status === "loading" ? t.loadingSound : t.soundOffHint;
  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-40 flex flex-col items-center gap-2 px-4"
      style={{ bottom: raised ? "calc(5.5rem + env(safe-area-inset-bottom))" : "calc(1rem + env(safe-area-inset-bottom))" }}
    >
      {open && info && (
        <div
          className="pointer-events-auto w-full max-w-md rounded-2xl border border-line bg-surface/95 p-3 text-left text-xs text-ink-2 shadow-lg backdrop-blur"
          data-testid="audio-diag"
        >
          <div className="mb-1 flex items-center justify-between">
            <span className="font-bold text-ink">{t.audioDiag.title}</span>
            <button className="px-2 text-ink-3" onClick={() => setOpen(false)}>
              ✕
            </button>
          </div>
          <DiagList info={info} />
          <p className="mt-2 text-[11px] text-ink-3">{t.audioDiag.hint}</p>
        </div>
      )}
      <button
        // Only the problem states take taps (to open diagnostics). While the piano loads,
        // taps fall through to whatever is underneath, such as keyboard keys.
        className={cx(
          "rounded-full border border-line bg-surface/95 px-4 py-2 text-sm text-ink-2 shadow-lg backdrop-blur",
          (status === "locked" || status === "error" || open) && "pointer-events-auto",
        )}
        onClick={() => setOpen((o) => !o)}
        data-testid="audio-pill"
      >
        {status === "ready" ? "✅ " : status === "loading" ? "⏳ " : "🔈 "}
        {status === "ready" ? t.audioDiag.ok : text}
        <span className="ml-2 text-xs text-ink-3">ⓘ</span>
      </button>
    </div>
  );
}

function DiagList({ info }: { info: ReturnType<typeof audioDiagnostics> }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-mono text-[11px]">
      {Object.entries(info).map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-ink-3">{k}</dt>
          <dd className="break-all">{String(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Settings card: live sound diagnostics and a test tone, available at any time. */
export function AudioCheck() {
  const [info, setInfo] = useState<ReturnType<typeof audioDiagnostics> | null>(null);
  useEffect(() => {
    setInfo(audioDiagnostics());
    const id = window.setInterval(() => setInfo(audioDiagnostics()), 700);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="space-y-2" data-testid="audio-check">
      <button
        className="min-h-12 w-full rounded-2xl border border-line bg-surface-2 font-semibold"
        onClick={() => void playNote(60, 1.2)}
        data-testid="audio-test"
      >
        🔊 {t.audioDiag.test}
      </button>
      {info && <DiagList info={info} />}
      <p className="text-[11px] text-ink-3">{t.audioDiag.hint}</p>
    </div>
  );
}
