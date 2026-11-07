"use client";
import { colorOf, inkOn, type NoteColors } from "@/lib/colors";
import { NOTE_NAMES, WHITE_PCS, type PC } from "@/lib/music";
import { cx } from "./ui";

export interface KeyFlash {
  pc: PC;
  kind: "correct" | "wrong" | "reveal";
  k: number; // change to replay the animation
}

const BLACK_AFTER: Record<number, number> = { 1: 0, 3: 1, 6: 3, 8: 4, 10: 5 }; // black pc → white index on its left

/**
 * One-octave colored keyboard. Every pitch class is one big key; locked keys are
 * greyed out and can't be tapped. `hideColors` = hard mode.
 */
export function Keyboard({
  colors,
  enabled,
  onPress,
  hideColors,
  flashes = [],
  disabled,
  showLocked = true,
  height = 210,
}: {
  colors: NoteColors;
  enabled: PC[];
  onPress: (pc: PC) => void;
  hideColors?: boolean;
  flashes?: KeyFlash[];
  disabled?: boolean;
  showLocked?: boolean;
  height?: number;
}) {
  const flashOf = (pc: PC) => flashes.find((f) => f.pc === pc);
  const isOn = (pc: PC) => enabled.includes(pc);
  const anyBlack = enabled.some((pc) => !WHITE_PCS.includes(pc)) || showLocked;

  const keyStyle = (pc: PC, black: boolean) => {
    const f = flashOf(pc);
    const reveal = f && (f.kind === "correct" || f.kind === "reveal");
    const on = isOn(pc);
    const col = colorOf(colors, pc);
    if (!on) {
      // Locked: solid, muted (no transparency, so overlapping keys stay readable).
      return black
        ? { background: "#1c1a24", color: "#55506a", border: "1px solid #2d2a3a" }
        : { background: "var(--surface-2)", color: "var(--ink-3)" };
    }
    if (hideColors && !reveal) {
      return black
        ? { background: "linear-gradient(#3a3746, #24222d)", color: "#d8d4e4" }
        : { background: "linear-gradient(#fbfaf7, #e4e1da)", color: "#4a4655" };
    }
    return black
      ? {
          background: `linear-gradient(${col}, color-mix(in srgb, ${col} 55%, #000))`,
          color: inkOn(col),
          boxShadow: reveal ? `0 0 28px 6px ${col}` : undefined,
        }
      : {
          background: `linear-gradient(color-mix(in srgb, ${col} 35%, #fff), ${col})`,
          color: inkOn(col),
          boxShadow: reveal ? `0 0 32px 8px ${col}` : undefined,
        };
  };

  const press = (pc: PC) => (e: React.PointerEvent) => {
    e.preventDefault();
    if (!disabled && isOn(pc)) onPress(pc);
  };

  return (
    <div className="relative w-full select-none" style={{ height }} role="group" aria-label="keyboard">
      <div className="absolute inset-0 flex gap-[3px]">
        {WHITE_PCS.map((pc) => {
          const f = flashOf(pc);
          return (
            <button
              key={`${pc}-${f?.k ?? 0}`}
              data-pc={pc}
              aria-label={NOTE_NAMES[pc]}
              aria-disabled={!isOn(pc) || disabled}
              onPointerDown={press(pc)}
              className={cx(
                "relative flex flex-1 flex-col items-center justify-end rounded-b-2xl rounded-t-md pb-3 text-lg font-bold transition-[background,box-shadow] duration-300",
                f && "keyflash z-[1]",
                f?.kind === "wrong" && "shake ring-4 ring-bad",
              )}
              style={keyStyle(pc, false)}
            >
              {NOTE_NAMES[pc]}
            </button>
          );
        })}
      </div>
      {anyBlack &&
        Object.entries(BLACK_AFTER).map(([pcStr, idx]) => {
          const pc = Number(pcStr);
          if (!showLocked && !isOn(pc)) return null;
          const f = flashOf(pc);
          return (
            <button
              key={`${pc}-${f?.k ?? 0}`}
              data-pc={pc}
              aria-label={NOTE_NAMES[pc]}
              aria-disabled={!isOn(pc) || disabled}
              onPointerDown={press(pc)}
              className={cx(
                "absolute top-0 z-[2] flex flex-col items-center justify-end rounded-b-xl pb-2 text-xs font-bold transition-[background,box-shadow] duration-300",
                f && "keyflash",
                f?.kind === "wrong" && "shake ring-4 ring-bad",
                // A locked black key lets taps fall through to the white key underneath.
                !isOn(pc) && "pointer-events-none",
              )}
              style={{
                left: `calc(${((idx + 1) / 7) * 100}% - 4.9%)`,
                width: "9.8%",
                height: "58%",
                ...keyStyle(pc, true),
              }}
            >
              {NOTE_NAMES[pc]}
            </button>
          );
        })}
    </div>
  );
}
