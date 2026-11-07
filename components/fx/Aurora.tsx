"use client";
// Slow-moving blurred light behind the whole app, tinted with the unlocked notes' colors.

export function Aurora({ colors }: { colors: string[] }) {
  const cs = colors.length ? colors : ["#6d4aff"];
  const pick = (i: number) => cs[i % cs.length];
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={`aurora aurora-${i}`}
          style={{ background: `radial-gradient(circle, ${pick(i * 2)} 0%, transparent 65%)` }}
        />
      ))}
    </div>
  );
}
