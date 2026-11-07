"use client";
import { useEffect, useState } from "react";
import { getAudioStatus, isAudioUnlocked, onAudioStatus, preloadAudio, unlockAudio, type AudioStatus } from "@/lib/audio";
import { t } from "@/i18n";

/**
 * Unlocks Web Audio on the first tap anywhere (iOS needs a real gesture —
 * touchend/click, not just touchstart) and shows a small status pill.
 */
export function AudioUnlock() {
  const [status, setStatus] = useState<AudioStatus>(getAudioStatus());

  useEffect(() => {
    void preloadAudio();
    const off = onAudioStatus(setStatus);
    const handler = () => {
      unlockAudio();
      if (isAudioUnlocked()) remove();
    };
    const events = ["touchend", "click", "keydown"] as const;
    const remove = () => events.forEach((e) => document.removeEventListener(e, handler, true));
    events.forEach((e) => document.addEventListener(e, handler, true));
    return () => {
      off();
      remove();
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
