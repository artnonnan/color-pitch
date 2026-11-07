"use client";
import { useEffect } from "react";
import { inkOn } from "@/lib/colors";
import { burst, fireworks } from "./Burst";
import { t } from "@/i18n";

/**
 * Full-screen unlock ceremony: expanding rings, a giant orb in the new color,
 * fireworks. Tap anywhere to continue.
 */
export function Celebration({
  color,
  label,
  title,
  sub,
  onClose,
}: {
  color: string;
  label: string;
  title: string;
  sub?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const cx = window.innerWidth / 2, cy = window.innerHeight * 0.42;
    burst([color, "#ffffff"], cx, cy, 3);
    const id = window.setTimeout(() => fireworks([color, "#ffffff", color]), 350);
    return () => window.clearTimeout(id);
  }, [color]);

  return (
    <button
      onClick={onClose}
      className="fixed inset-0 z-[55] flex flex-col items-center justify-center gap-6 overflow-hidden p-8 text-center"
      // glow over a solid base, so nothing behind the ceremony shows through
      style={{ background: `radial-gradient(circle at 50% 42%, ${color}59 0%, transparent 62%), #07060c` }}
      aria-label={t.next}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="ring-out pointer-events-none absolute left-1/2 top-[42%] h-40 w-40 rounded-full border-4"
          style={{ borderColor: color, animationDelay: `${i * 0.35}s` }}
        />
      ))}
      <div className="glow-pulse relative mt-[-4rem] flex h-44 w-44 items-center justify-center rounded-full text-7xl font-black pop"
        style={{ background: color, color: inkOn(color), boxShadow: `0 0 80px 20px ${color}, 0 0 200px 60px ${color}66` }}
      >
        {label}
      </div>
      <div className="relative space-y-2 text-white">
        <div className="text-2xl font-black">✦ {title} ✦</div>
        {sub && <div className="text-lg opacity-90">{sub}</div>}
        <div className="pt-4 text-sm opacity-60">{t.fx.tapToContinue}</div>
      </div>
    </button>
  );
}

/**
 * Combo pill: grows and glows as the streak climbs. Fixed colors on purpose —
 * tinting it with the current note's color would give the answer away.
 */
export function ComboBadge({ combo }: { combo: number }) {
  const color = "#ff3d81";
  if (combo < 3) return null;
  const big = combo >= 10;
  return (
    <div
      key={combo}
      className="pop inline-flex items-center gap-1 rounded-full px-3 py-1 font-black text-white"
      style={{
        background: `linear-gradient(90deg, ${color}, #ff7a18)`,
        boxShadow: `0 0 ${big ? 30 : 14}px ${color}`,
        fontSize: big ? "1.15rem" : "0.95rem",
      }}
    >
      🔥 {t.fx.combo(combo)}
    </div>
  );
}
