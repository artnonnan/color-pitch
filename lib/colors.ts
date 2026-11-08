import { isBlack, pcOf, type PC, type ChordQuality } from "./music";

/** C red, D orange, E yellow, F green, G sky blue, A blue, B purple. */
export const DEFAULT_WHITE_COLORS: Record<number, string> = {
  0: "#ef4444",
  2: "#f97316",
  4: "#facc15",
  5: "#22c55e",
  7: "#38bdf8",
  9: "#3b5bf6",
  11: "#a855f7",
};

/** null = black key, auto-blended from its neighbours. */
export type NoteColors = Record<number, string | null>;

export function defaultNoteColors(): NoteColors {
  const c: NoteColors = {};
  for (let pc = 0; pc < 12; pc++) c[pc] = isBlack(pc) ? null : DEFAULT_WHITE_COLORS[pc];
  return c;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((x) => x + x).join("") : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex([r, g, b]: [number, number, number]) {
  return "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
}
export function mix(a: string, b: string, t = 0.5): string {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
}
/** Relative luminance, used to choose black or white text on a color. */
export function luminance(hex: string) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export const inkOn = (hex: string) => (luminance(hex) > 0.35 ? "#111111" : "#ffffff");
export function withAlpha(hex: string, alpha: number) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Resolve the display color of any pitch class (black keys blend their neighbours). */
export function colorOf(colors: NoteColors, pcOrMidi: PC): string {
  const pc = pcOf(pcOrMidi);
  const own = colors[pc];
  if (own) return own;
  if (!isBlack(pc)) return DEFAULT_WHITE_COLORS[pc];
  const lo = colors[pc - 1] || DEFAULT_WHITE_COLORS[pc - 1];
  const hi = colors[(pc + 1) % 12] || DEFAULT_WHITE_COLORS[(pc + 1) % 12];
  return mix(lo, hi, 0.5);
}

export interface ChordMood {
  color: string;
  emoji: string;
  mood: string;
}
export type ChordMoods = Record<ChordQuality, ChordMood>;

export function defaultChordMoods(): ChordMoods {
  return {
    major: { color: "#fbbf24", emoji: "☀️", mood: "แดดอุ่น สดใส" },
    minor: { color: "#3b82f6", emoji: "🌧️", mood: "ฝนตก เย็นเศร้า" },
    maj7: { color: "#f472b6", emoji: "🌅", mood: "ฝันละมุน พระอาทิตย์ตก" },
    sus4: { color: "#2dd4bf", emoji: "🌫️", mood: "ลอยค้าง รอคำตอบ" },
    dim: { color: "#7c3aed", emoji: "🌩️", mood: "ตึงเครียด น่าหวาดหวั่น" },
    aug: { color: "#a3e635", emoji: "🌀", mood: "แปลกประหลาด เหมือนฝัน" },
  };
}

/** One color per scale degree (1–7). Separate from note colors: a degree is a role in the key, not a pitch. */
export const DEGREE_COLORS: Record<number, string> = {
  1: "#f59e0b", // gold: home
  2: "#10b981", // emerald
  3: "#f472b6", // pink: warm
  4: "#06b6d4", // cyan: hanging
  5: "#6366f1", // indigo: open
  6: "#a78bfa", // lavender: tender
  7: "#f97316", // orange: pulls home
};
