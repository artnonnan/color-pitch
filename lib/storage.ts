// localStorage persistence. Every access is wrapped: private mode, blocked
// storage or quota errors must never break the app.
// Each profile has its own copy, plus the time it was last changed (for cloud sync).
import { defaultState, normalizeState, type AppState } from "./state";
import type { ProfileId } from "./cloud";

/** Before profiles existed, everything lived here. It becomes อาท's local copy once. */
const LEGACY_KEY = "color-pitch:v1";
const keyOf = (id: ProfileId) => `color-pitch:v1:${id}`;
const tsKeyOf = (id: ProfileId) => `color-pitch:v1:${id}:ts`;
const LAST_PROFILE = "color-pitch:profile";

export function storageAvailable(): boolean {
  try {
    const k = "__cp_test__";
    window.localStorage.setItem(k, "1");
    window.localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

export interface LocalCopy {
  state: AppState;
  /** When this copy last changed (epoch ms). 0 = never saved on this device. */
  ts: number;
}

export function loadState(id: ProfileId): LocalCopy {
  try {
    let raw = window.localStorage.getItem(keyOf(id));
    let ts = Number(window.localStorage.getItem(tsKeyOf(id)) ?? 0) || 0;
    if (!raw && id === "art") {
      // Progress made before profiles existed belongs to the device owner.
      raw = window.localStorage.getItem(LEGACY_KEY);
      if (raw) ts = 1; // older than any cloud save, so the cloud wins if it has one
    }
    if (!raw) return { state: defaultState(), ts: 0 };
    return { state: normalizeState(JSON.parse(raw)), ts };
  } catch {
    return { state: defaultState(), ts: 0 };
  }
}

export function saveState(id: ProfileId, state: AppState, ts: number): boolean {
  try {
    window.localStorage.setItem(keyOf(id), JSON.stringify(state));
    window.localStorage.setItem(tsKeyOf(id), String(ts));
    return true;
  } catch {
    return false;
  }
}

export function lastProfile(): ProfileId | null {
  try {
    const v = window.localStorage.getItem(LAST_PROFILE);
    return v === "art" || v === "guest" ? v : null;
  } catch {
    return null;
  }
}
export function rememberProfile(id: ProfileId) {
  try {
    window.localStorage.setItem(LAST_PROFILE, id);
  } catch {
    /* ignore */
  }
}

/** Small separate key read before hydration so the theme doesn't flash. */
export const THEME_KEY = "color-pitch:theme";
export function saveTheme(theme: string) {
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* ignore */
  }
}

export function exportJson(state: AppState): string {
  return JSON.stringify({ app: "color-pitch", exportedAt: new Date().toISOString(), ...state }, null, 2);
}

export function parseImport(text: string): AppState | null {
  try {
    const raw = JSON.parse(text);
    if (!raw || typeof raw !== "object" || !("progress" in raw || "settings" in raw)) return null;
    return normalizeState(raw);
  } catch {
    return null;
  }
}
