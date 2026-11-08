"use client";
import { useCallback, useEffect, useState } from "react";
import { StoreProvider, useStore } from "@/lib/store";
import { dayKey } from "@/lib/state";
import { AudioUnlock } from "./AudioUnlock";
import { Home, SESSION_STEPS } from "./screens/Home";
import { Stats } from "./screens/Stats";
import { SettingsScreen } from "./screens/Settings";
import { FirstNote } from "./exercises/FirstNote";
import { Quiz } from "./exercises/Quiz";
import { Chords } from "./exercises/Chords";
import { Modes } from "./exercises/Modes";
import { Tuner } from "./exercises/Tuner";
import { Rush } from "./exercises/Rush";
import { Sing } from "./exercises/Sing";
import { Roots } from "./exercises/Roots";
import { Degrees } from "./exercises/Degrees";
import { Intervals } from "./exercises/Intervals";
import { Progressions } from "./exercises/Progressions";
import { Melody } from "./exercises/Melody";
import { Rain } from "./exercises/Rain";
import { MixChord } from "./exercises/MixChord";
import { Match } from "./exercises/Match";
import { ColorPick } from "./exercises/ColorPick";
import { BurstLayer, clearBursts, fireworks } from "./fx/Burst";
import { Aurora } from "./fx/Aurora";
import { colorOf } from "@/lib/colors";
import { unlockedNotes } from "@/lib/state";
import { Button, Card, cx } from "./ui";
import { cloudEnabled, PROFILES, type ProfileId } from "@/lib/cloud";
import { t } from "@/i18n";

export type Screen =
  | "home" | "first" | "quiz" | "chords" | "modes" | "tuner" | "stats" | "settings" | "session"
  | "rush" | "sing" | "roots" | "degrees" | "intervals" | "progressions" | "melody" | "rain" | "mixchord" | "match" | "colorpick";
const SCREENS: Screen[] = ["home", "first", "quiz", "chords", "modes", "tuner", "stats", "settings", "session", "rush", "sing", "roots", "degrees", "intervals", "progressions", "melody", "rain", "mixchord", "match", "colorpick"];
// Screens that play notes: the daily first note should come before any of them.
const GATED: Screen[] = ["quiz", "chords", "modes", "rush", "sing", "roots", "degrees", "intervals", "progressions", "melody", "rain", "mixchord", "match", "colorpick"];
const NAV: { s: Screen; icon: string; label: string }[] = [
  { s: "home", icon: "🏠", label: t.nav.home },
  { s: "tuner", icon: "📻", label: t.nav.tuner },
  { s: "stats", icon: "📊", label: t.nav.stats },
  { s: "settings", icon: "⚙️", label: t.nav.settings },
];

function readHash(): Screen {
  if (typeof window === "undefined") return "home";
  const h = window.location.hash.replace("#", "") as Screen;
  return SCREENS.includes(h) ? h : "home";
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}

function Shell() {
  const { ready, state, storageOk, profile } = useStore();
  const [screen, setScreen] = useState<Screen>("home");
  const [gateSkipped, setGateSkipped] = useState(false);

  useEffect(() => {
    setScreen(readHash());
    const onHash = () => {
      clearBursts();
      setScreen(readHash());
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // Register the service worker (production only, so dev hot-reload isn't cached).
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  const go = useCallback((s: Screen) => {
    clearBursts();
    if (s === "home") {
      // Replace so the back button doesn't bounce between exercises.
      history.replaceState(null, "", window.location.pathname);
      setScreen("home");
    } else {
      window.location.hash = s;
    }
    window.scrollTo(0, 0);
  }, []);
  const home = useCallback(() => go("home"), [go]);

  if (!profile) {
    return (
      <>
        <ProfilePicker />
        <AudioUnlock raised={false} />
      </>
    );
  }
  if (!ready) {
    return <div className="flex min-h-dvh items-center justify-center text-ink-3">{t.appName}</div>;
  }

  // The daily first note should come before hearing any other note today.
  const today = dayKey();
  const firstDoneToday = !!state.progress.firstNote[today];
  const needsGate = GATED.includes(screen) && !firstDoneToday && !gateSkipped;
  const showNav = ["home", "tuner", "stats", "settings"].includes(screen);

  let body: React.ReactNode;
  if (needsGate) {
    body = (
      <FirstNoteGate
        onDo={() => go("first")}
        onSkip={() => setGateSkipped(true)}
      />
    );
  } else if (screen === "session") {
    body = <SessionRunner onExit={home} />;
  } else if (screen === "first") {
    body = <FirstNote onDone={home} onBack={home} />;
  } else if (screen === "quiz") {
    body = <Quiz onDone={home} onBack={home} />;
  } else if (screen === "chords") {
    body = <Chords onDone={home} onBack={home} />;
  } else if (screen === "modes") {
    body = <Modes onBack={home} />;
  } else if (screen === "rush") {
    body = <Rush onBack={home} />;
  } else if (screen === "sing") {
    body = <Sing onBack={home} />;
  } else if (screen === "roots") {
    body = <Roots onBack={home} />;
  } else if (screen === "degrees") {
    body = <Degrees onBack={home} />;
  } else if (screen === "intervals") {
    body = <Intervals onBack={home} />;
  } else if (screen === "progressions") {
    body = <Progressions onBack={home} />;
  } else if (screen === "melody") {
    body = <Melody onBack={home} />;
  } else if (screen === "rain") {
    body = <Rain onBack={home} />;
  } else if (screen === "mixchord") {
    body = <MixChord onBack={home} />;
  } else if (screen === "match") {
    body = <Match onBack={home} />;
  } else if (screen === "colorpick") {
    body = <ColorPick onBack={home} />;
  } else if (screen === "tuner") {
    body = <Tuner />;
  } else if (screen === "stats") {
    body = <Stats />;
  } else if (screen === "settings") {
    body = <SettingsScreen />;
  } else {
    body = <Home go={go} startSession={() => go("session")} />;
  }

  return (
    <>
    <Aurora colors={unlockedNotes(state.progress).map((pc) => colorOf(state.settings.noteColors, pc))} />
    <BurstLayer />
    <main className="relative z-[1] mx-auto min-h-dvh w-full max-w-md px-4 pt-2">
      {!storageOk && (
        <div className="mb-2 rounded-2xl bg-bad/15 px-4 py-2 text-sm text-bad">{t.settings.storageWarn}</div>
      )}
      {body}
      <AudioUnlock />
      {showNav && (
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur">
          <div className="mx-auto grid max-w-md grid-cols-4">
            {NAV.map((n) => (
              <button
                key={n.s}
                onClick={() => go(n.s)}
                className={cx(
                  "flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs",
                  screen === n.s ? "font-bold text-accent" : "text-ink-3",
                )}
              >
                <span className="text-xl">{n.icon}</span>
                {n.label}
              </button>
            ))}
          </div>
        </nav>
      )}
    </main>
    </>
  );
}

/** Shown every time the app opens: pick who is practicing. */
function ProfilePicker() {
  const { selectProfile, lastProfile } = useStore();
  const [cloud, setCloud] = useState(false);
  useEffect(() => setCloud(cloudEnabled()), []);
  const look: Record<ProfileId, { emoji: string; bg: string }> = {
    art: { emoji: "🎨", bg: "linear-gradient(135deg, #ef4444, #facc15 45%, #38bdf8 80%, #a855f7)" },
    guest: { emoji: "👋", bg: "linear-gradient(135deg, #334155, #64748b)" },
  };
  return (
    <main className="relative z-[1] mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-5 px-4 pb-10">
      <div className="text-center">
        <h1 className="bg-gradient-to-r from-[#ef4444] via-[#facc15] via-50% to-[#a855f7] bg-clip-text text-3xl font-black text-transparent">
          {t.appName}
        </h1>
        <h2 className="mt-4 text-xl font-bold">{t.profile.title}</h2>
        <p className="text-sm text-ink-3">{cloud ? t.profile.sub : t.profile.subLocal}</p>
      </div>
      {PROFILES.map((id, i) => (
        <button
          key={id}
          data-testid={`profile-${id}`}
          onClick={() => selectProfile(id)}
          className="relative flex min-h-28 items-center gap-4 rounded-3xl p-5 text-left text-white shadow-lg active:scale-[0.98]"
          style={{ background: look[id].bg }}
        >
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-black/25 text-3xl">
            {look[id].emoji}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-2xl font-black drop-shadow">
              {i + 1}. {t.profile.names[id]}
            </span>
            <span className="block text-sm opacity-95 drop-shadow">{t.profile.desc[id]}</span>
          </span>
          {lastProfile === id && (
            <span className="absolute right-3 top-3 rounded-full bg-black/30 px-2 py-0.5 text-xs font-bold">
              {t.profile.last}
            </span>
          )}
        </button>
      ))}
    </main>
  );
}

function FirstNoteGate({ onDo, onSkip }: { onDo: () => void; onSkip: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col justify-center gap-4 pb-16">
      <Card className="space-y-3 text-center">
        <div className="text-5xl">🎤</div>
        <h1 className="text-xl font-bold">{t.first.gateTitle}</h1>
        <p className="text-ink-2">{t.first.gateBody}</p>
        <Button big className="w-full" onClick={onDo}>
          {t.first.gateDo}
        </Button>
        <Button variant="ghost" className="w-full" onClick={onSkip}>
          {t.first.gateSkip}
        </Button>
      </Card>
    </div>
  );
}

/** Runs today's remaining steps (first note → quiz → chords) back-to-back. */
function SessionRunner({ onExit }: { onExit: () => void }) {
  const { state } = useStore();
  const today = dayKey();
  const [queue] = useState(() => {
    const done = state.progress.sessionDone[today] ?? [];
    const firstLogged = !!state.progress.firstNote[today];
    return SESSION_STEPS.filter((s) => !done.includes(s) && !(s === "first" && firstLogged));
  });
  const [i, setI] = useState(0);
  const next = () => {
    setI((x) => x + 1);
    window.scrollTo(0, 0);
  };

  if (i >= queue.length) {
    return <SessionDone onExit={onExit} />;
  }
  const label = t.session.stepOf(i + 1, queue.length);
  const step = queue[i];
  if (step === "first") return <FirstNote key="first" onDone={next} onBack={onExit} sessionLabel={label} />;
  if (step === "quiz") return <Quiz key="quiz" onDone={next} onBack={onExit} sessionLabel={label} />;
  return <Chords key="chords" onDone={next} onBack={onExit} sessionLabel={label} />;
}

/** End of the daily session: fireworks in every unlocked color. */
function SessionDone({ onExit }: { onExit: () => void }) {
  const { state } = useStore();
  useEffect(() => {
    const cs = unlockedNotes(state.progress).map((pc) => colorOf(state.settings.noteColors, pc));
    const id = window.setTimeout(() => fireworks(cs, 10), 250);
    return () => window.clearTimeout(id);
    // once, on arrival
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 text-center">
      <div className="glow-pulse text-8xl">🌈</div>
      <h1 className="text-3xl font-black">{t.session.allDone}</h1>
      <p className="text-ink-2">{t.session.allDoneBody}</p>
      <Button big onClick={onExit}>
        {t.session.backHome}
      </Button>
    </div>
  );
}
