// localStorage persistence. Every access is wrapped: private mode, blocked
// storage or quota errors must never break the app.
import { defaultState, normalizeState, type AppState } from "./state";

const KEY = "color-pitch:v1";

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

export function loadState(): AppState {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return defaultState();
    return normalizeState(JSON.parse(raw));
  } catch {
    return defaultState();
  }
}

export function saveState(state: AppState): boolean {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
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
