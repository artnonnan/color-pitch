// Reference tunes for intervals: the opening of a well-known melody that starts with
// (or clearly contains) the interval. All are public domain. The app plays the few
// notes itself, so the player doesn't need to know the song by name.
//
// To use other songs (for example Thai songs the player knows better), change only this
// table: `notes` are semitones from the first note, `at` is the index of the note where
// the interval lands (the interval is notes[at-1] → notes[at]).
import type { Interval } from "./music";

export interface RefTune {
  song: string;
  notes: number[];
  at: number;
}

export const INTERVAL_REFS: Record<Interval, { up?: RefTune; down?: RefTune }> = {
  m2: {
    up: { song: "Für Elise", notes: [0, -1, 0, -1, 0], at: 2 },
    down: { song: "Für Elise", notes: [0, -1, 0, -1, 0], at: 1 },
  },
  M2: {
    up: { song: "Frère Jacques", notes: [0, 2, 4, 0], at: 1 },
    down: { song: "Mary Had a Little Lamb", notes: [0, -2, -4, -2, 0, 0, 0], at: 1 },
  },
  m3: {
    up: { song: "Greensleeves", notes: [0, 3, 5, 7, 8, 7, 5], at: 1 },
    down: { song: "This Old Man", notes: [0, -3, 0], at: 1 },
  },
  M3: {
    up: { song: "When the Saints Go Marching In", notes: [0, 4, 5, 7], at: 1 },
    down: { song: "Beethoven: Symphony No. 5", notes: [0, 0, 0, -4], at: 3 },
  },
  P4: {
    up: { song: "Here Comes the Bride (Wagner)", notes: [0, 5, 5, 5], at: 1 },
    down: { song: "Mozart: Eine kleine Nachtmusik", notes: [0, -5, 0, -5, 0, 4, 7], at: 1 },
  },
  TT: {},
  P5: {
    up: { song: "Twinkle Twinkle Little Star", notes: [0, 0, 7, 7, 9, 9, 7], at: 2 },
  },
  m6: {
    up: { song: "The Entertainer (Joplin)", notes: [0, 1, 2, 10, 2, 10, 2, 10], at: 3 },
  },
  M6: {
    up: { song: "My Bonnie Lies Over the Ocean", notes: [0, 9, 7, 5, 7, 5, 2, 0], at: 1 },
  },
  m7: {},
  M7: {},
  P8: {},
};

/** The reference for an interval in a direction, if there is one ("together" uses "up"). */
export function refFor(iv: Interval, dir: "up" | "down" | "together"): RefTune | undefined {
  const r = INTERVAL_REFS[iv];
  return dir === "down" ? r.down : r.up;
}

/** MIDI notes of a reference tune. Downward tunes start higher so they stay in range. */
export function refMidis(tune: RefTune, base = 60): number[] {
  const start = base - Math.min(0, ...tune.notes);
  return tune.notes.map((s) => start + s);
}
