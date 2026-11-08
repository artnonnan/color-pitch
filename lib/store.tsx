"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { addPractice, defaultState, normalizeState, type AppState, type Progress, type Settings } from "./state";
import { lastProfile, loadState, rememberProfile, saveState, saveTheme, storageAvailable } from "./storage";
import { cloudEnabled, fetchProfile, pushProfile, type ProfileId } from "./cloud";
import { setInstrument } from "./audio";

/** off = local only (no cloud config), syncing, synced, offline = the last attempt failed. */
export type SyncStatus = "off" | "syncing" | "synced" | "offline";

interface Store {
  state: AppState;
  /** True once a profile is chosen and its data is loaded. */
  ready: boolean;
  storageOk: boolean;
  profile: ProfileId | null;
  /** The profile chosen last time on this device (highlighted on the picker). */
  lastProfile: ProfileId | null;
  sync: SyncStatus;
  selectProfile: (id: ProfileId) => void;
  /** Save now, then go back to the profile picker. */
  switchProfile: () => void;
  setSettings: (fn: (s: Settings) => Settings) => void;
  setProgress: (fn: (p: Progress) => Progress) => void;
  replaceState: (s: AppState) => void;
  /** Latest state, safe to call from timers/callbacks that may hold stale renders. */
  getState: () => AppState;
}

const Ctx = createContext<Store | null>(null);
const PUSH_DELAY = 2500; // ms of quiet before a change is sent to the cloud

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(defaultState);
  const [ready, setReady] = useState(false);
  const [storageOk, setStorageOk] = useState(true);
  const [profile, setProfile] = useState<ProfileId | null>(null);
  const [last, setLast] = useState<ProfileId | null>(null);
  const [sync, setSyncState] = useState<SyncStatus>("off");
  const stateRef = useRef(state);
  const profileRef = useRef<ProfileId | null>(null);
  const syncRef = useRef<SyncStatus>("off");
  const tsRef = useRef(0); // when the current state last changed
  const pushedTs = useRef(0); // newest change the cloud is known to have
  const pushTimer = useRef<number | null>(null);

  const setSync = useCallback((s: SyncStatus) => {
    syncRef.current = s;
    setSyncState(s);
  }, []);

  useEffect(() => {
    setStorageOk(storageAvailable());
    setLast(lastProfile());
  }, []);

  /** Take a cloud copy that is newer than what this device has. */
  const adopt = useCallback((id: ProfileId, raw: unknown, ts: number) => {
    const s = normalizeState(raw);
    stateRef.current = s;
    tsRef.current = ts;
    pushedTs.current = ts;
    setState(s);
    saveState(id, s, ts);
  }, []);

  const push = useCallback(
    async (keepalive = false): Promise<void> => {
      if (pushTimer.current) {
        window.clearTimeout(pushTimer.current);
        pushTimer.current = null;
      }
      const id = profileRef.current;
      if (!id || !cloudEnabled()) return;
      const ts = tsRef.current;
      if (ts <= pushedTs.current) return;
      setSync("syncing");
      try {
        const stored = await pushProfile(id, stateRef.current, ts, keepalive);
        if (profileRef.current !== id) return;
        if (!stored) {
          // Another device saved something newer: take it.
          const remote = await fetchProfile(id);
          if (remote && profileRef.current === id) adopt(id, remote.state, remote.ts);
          setSync("synced");
          return;
        }
        pushedTs.current = Math.max(pushedTs.current, ts);
        setSync(tsRef.current > pushedTs.current ? "syncing" : "synced");
      } catch {
        if (profileRef.current === id) setSync("offline");
      }
    },
    [adopt, setSync],
  );

  /** Fetch the cloud copy; the newer of cloud and local wins. */
  const pull = useCallback(async (): Promise<void> => {
    const id = profileRef.current;
    if (!id) return;
    if (!cloudEnabled()) {
      setSync("off");
      return;
    }
    setSync("syncing");
    try {
      const remote = await fetchProfile(id);
      if (profileRef.current !== id) return;
      if (remote && remote.ts > tsRef.current) {
        adopt(id, remote.state, remote.ts);
        setSync("synced");
      } else {
        pushedTs.current = remote?.ts ?? 0;
        if (tsRef.current > pushedTs.current) await push();
        else setSync("synced");
      }
    } catch {
      if (profileRef.current === id) setSync("offline");
    }
  }, [adopt, push, setSync]);

  const selectProfile = useCallback(
    (id: ProfileId) => {
      const local = loadState(id);
      profileRef.current = id;
      rememberProfile(id);
      setLast(id);
      stateRef.current = local.state;
      tsRef.current = local.ts;
      pushedTs.current = 0;
      // First time on this device: keep startDate locally, but at ts 0 so any cloud copy
      // wins. Stamping it "now" would make a blank device overwrite real progress.
      if (local.ts === 0) saveState(id, local.state, 0);
      setState(local.state);
      setProfile(id);
      setReady(true);
      void pull();
    },
    [pull],
  );

  const switchProfile = useCallback(() => {
    void push(true);
    profileRef.current = null;
    setProfile(null);
    setReady(false);
    setSync("off");
  }, [push, setSync]);

  const commit = useCallback(
    (next: AppState) => {
      const id = profileRef.current;
      stateRef.current = next;
      setState(next);
      if (!id) return;
      tsRef.current = Date.now();
      saveState(id, next, tsRef.current);
      if (!cloudEnabled()) return;
      if (pushTimer.current) window.clearTimeout(pushTimer.current);
      pushTimer.current = window.setTimeout(() => void push(), PUSH_DELAY);
    },
    [push],
  );

  // Save when the app is hidden or closed; check for changes from other devices on return.
  useEffect(() => {
    const onVis = () => {
      if (!profileRef.current) return;
      if (document.visibilityState === "hidden") void push(true);
      else if (!pushTimer.current && tsRef.current <= pushedTs.current) void pull();
    };
    const onHide = () => void push(true);
    const onOnline = () => void push();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onHide);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("online", onOnline);
    };
  }, [push, pull]);

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

  // Read-only hooks for automated verification (inspect, never mutate).
  useEffect(() => {
    const w = window as unknown as { __colorPitch?: () => AppState; __cpSync?: () => unknown };
    w.__colorPitch = () => stateRef.current;
    w.__cpSync = () => ({
      profile: profileRef.current,
      sync: syncRef.current,
      cloud: cloudEnabled(),
      ts: tsRef.current,
      pushedTs: pushedTs.current,
    });
  }, []);

  const value = useMemo(
    () => ({
      state,
      ready,
      storageOk,
      profile,
      lastProfile: last,
      sync,
      selectProfile,
      switchProfile,
      setSettings,
      setProgress,
      replaceState,
      getState,
    }),
    [state, ready, storageOk, profile, last, sync, selectProfile, switchProfile, setSettings, setProgress, replaceState, getState],
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
