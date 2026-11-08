"use client";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { t } from "@/i18n";

export function cx(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  big?: boolean;
};
export function Button({ variant = "primary", big, className, ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      className={cx(
        "inline-flex select-none items-center justify-center gap-2 rounded-2xl font-semibold transition active:scale-[0.97] disabled:opacity-40",
        big ? "min-h-14 px-6 text-lg" : "min-h-12 px-5 text-base",
        variant === "primary" && "bg-accent text-white shadow-lg shadow-accent/25 dark:text-[#0b0b12]",
        variant === "secondary" && "border border-line bg-surface-2 text-ink",
        variant === "ghost" && "text-ink-2 hover:bg-surface-2",
        variant === "danger" && "border border-bad/50 bg-bad/10 text-bad",
        className,
      )}
    />
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded-3xl border border-line bg-surface p-4", className)}>{children}</div>;
}

export function ScreenHeader({
  title,
  onBack,
  right,
  sub,
}: {
  title: string;
  onBack?: () => void;
  right?: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 -mx-4 mb-3 flex items-center gap-2 bg-bg/85 text-ink px-2 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur">
      {onBack ? (
        <button
          onClick={onBack}
          aria-label={t.back}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl text-ink-2 active:bg-surface-2"
        >
          ‹
        </button>
      ) : (
        <span className="w-2" />
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-bold leading-tight">{title}</h1>
        {sub && <div className="truncate text-xs text-ink-3">{sub}</div>}
      </div>
      {right}
    </header>
  );
}

export function ProgressBar({ value, color }: { value: number; color?: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color ?? "var(--accent)" }}
      />
    </div>
  );
}

export function NoteDot({ color, label, size = 36, dim }: { color: string; label?: string; size?: number; dim?: boolean }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full text-xs font-bold"
      style={{
        width: size,
        height: size,
        background: dim ? "var(--surface-2)" : color,
        color: dim ? "var(--ink-3)" : undefined,
        boxShadow: dim ? undefined : `0 0 18px ${color}55`,
      }}
    >
      {label}
    </span>
  );
}

/** Full-screen color wash; remount with a new `k` to replay. */
export function ColorWash({ color, k }: { color: string | null; k: number }) {
  if (!color) return null;
  return (
    <div
      key={k}
      aria-hidden
      className="wash pointer-events-none fixed inset-0 z-10"
      style={{ background: `radial-gradient(circle at 50% 60%, ${color}aa 0%, ${color}44 45%, transparent 80%)` }}
    />
  );
}
