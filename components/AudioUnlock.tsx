"use client";
import { useEffect, useState } from "react";
import { getAudioStatus, isAudioRunning, onAudioStatus, preloadAudio, unlockAudio, type AudioStatus } from "@/lib/audio";
import { t } from "@/i18n";

/**
 * Unlocks Web Audio on a tap (iOS needs a real gesture — touchend/click, not just
 * touchstart). The listeners stay on for the whole session: iOS suspends audio
 * when the screen locks or the user switches apps, and the next tap must wake it.
 */
export function AudioUnlock() {
  const [status, setStatus] = useState<AudioStatus>(getAudioStatus());

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

  if (status === "ready") return null;
  const text = status === "locked" ? t.tapToEnableSound : status === "loading" ? t.loadingSound : t.soundOffHint;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-4">
      <div className="rounded-full border border-line bg-surface/95 px-4 py-2 text-sm text-ink-2 shadow-lg backdrop-blur">
        {status === "loading" ? "⏳ " : "🔈 "}
        {text}
      </div>
    </div>
  );
}
