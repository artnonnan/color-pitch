"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { addPractice, defaultState, type AppState, type Progress, type Settings } from "./state";
import { loadState, saveState, saveTheme, storageAvailable } from "./storage";
import { setInstrument } from "./audio";

interface Store {
  state: AppState;
  ready: boolean;
  storageOk: boolean;
  setSettings: (fn: (s: Settings) => Settings) => void;
  setProgress: (fn: (p: Progress) => Progress) => void;
  replaceState: (s: AppState) => void;
  /** Latest state, safe to call from timers/callbacks that may hold stale renders. */
  getState: () => AppState;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(defaultState);
  const [ready, setReady] = useState(false);
  const [storageOk, setStorageOk] = useState(true);
  const stateRef = useRef(state);

  useEffect(() => {
    const ok = storageAvailable();
    setStorageOk(ok);
    const loaded = loadState();
    stateRef.current = loaded;
    setState(loaded);
    setReady(true);
    if (ok) saveState(loaded); // persists startDate on first launch
  }, []);

  const commit = useCallback((next: AppState) => {
    stateRef.current = next;
    setState(next);
    saveState(next);
  }, []);

  const setSettings = useCallback(
    (fn: (s: Settings) => Settings) => commit({ ...stateRef.current, settings: fn(stateRef.current.settings) }),
    [commit],
  );
  const setProgress = useCallback(
    (fn: (p: Progress) => Progress) => commit({ ...stateRef.current, progress: fn(stateRef.current.progress) }),
    [commit],
  );
  const replaceState = useCallback((s: AppState) => commit(s), [commit]);
  const getState = useCallback(() => stateRef.current, []);

  // Side effects of settings: theme on <html>, instrument in the audio engine.
  useEffect(() => {
    if (!ready) return;
    document.documentElement.dataset.theme = state.settings.theme;
    saveTheme(state.settings.theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute("content", state.settings.theme === "dark" ? "#0b0b12" : "#f7f5f0");
  }, [ready, state.settings.theme]);
  useEffect(() => {
    if (ready) setInstrument(state.settings.instrument);
  }, [ready, state.settings.instrument]);

  // Read-only hook for automated verification (inspect, never mutate).
  useEffect(() => {
    (window as unknown as { __colorPitch?: () => AppState }).__colorPitch = () => stateRef.current;
  }, []);

  const value = useMemo(
    () => ({ state, ready, storageOk, setSettings, setProgress, replaceState, getState }),
    [state, ready, storageOk, setSettings, setProgress, replaceState, getState],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside StoreProvider");
  return s;
}

/** Adds practice time while an exercise screen is open, visible and recently used. */
export function usePracticeTimer(active = true) {
  const { setProgress } = useStore();
  useEffect(() => {
    if (!active) return;
    let lastInput = Date.now();
    const bump = () => (lastInput = Date.now());
    window.addEventListener("pointerdown", bump);
    window.addEventListener("keydown", bump);
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastInput > 45000) return;
      setProgress((p) => addPractice(p, 5));
    }, 5000);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("pointerdown", bump);
      window.removeEventListener("keydown", bump);
    };
  }, [active, setProgress]);
}
