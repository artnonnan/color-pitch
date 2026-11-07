"use client";
import type { MicError } from "@/lib/pitch";
import { t } from "@/i18n";

/** Explains why the mic failed and how to fix it on the user's device. */
export function MicErrorBox({ error, onRetry }: { error: MicError; onRetry?: () => void }) {
  const info = t.mic.errors[error.code] ?? t.mic.errors.failed;
  return (
    <div role="alert" className="w-full space-y-2 rounded-2xl border border-bad/40 bg-bad/10 px-4 py-3 text-left text-sm">
      <div className="font-bold text-bad">🎤 {info.title}</div>
      <ul className="list-disc space-y-1 pl-5 text-ink-2">
        {info.fix.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
      {onRetry && (
        <button onClick={onRetry} className="min-h-11 font-semibold text-accent underline">
          {t.mic.retry}
        </button>
      )}
      <details className="text-xs text-ink-3">
        <summary className="cursor-pointer py-1">{t.mic.detail}</summary>
        <code className="break-all">
          {error.code} · {error.detail}
        </code>
      </details>
    </div>
  );
}

/** Normalise anything thrown by startMic() into a MicError. */
export function toMicError(e: unknown): MicError {
  if (e && typeof e === "object" && "code" in e) return e as MicError;
  return { code: "failed", detail: String((e as Error)?.message ?? e) };
}
