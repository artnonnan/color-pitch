// Cloud sync through Supabase's REST API (plain fetch, no SDK, to keep the PWA small).
// Two fixed profiles, "art" and "guest", each one row in public.cp_profiles.
// Writes go through the cp_save RPC, which keeps the newer copy (by client timestamp),
// so an old device coming back online can't overwrite newer progress.
//
// Without NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY the app
// stays local-only. Automated checks set localStorage "color-pitch:nocloud" so test
// runs never touch real profiles.

export type ProfileId = "art" | "guest";
export const PROFILES: ProfileId[] = ["art", "guest"];

const URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

export function cloudEnabled(): boolean {
  if (!URL || !KEY) return false;
  try {
    return window.localStorage.getItem("color-pitch:nocloud") !== "1";
  } catch {
    return true;
  }
}

const headers = () => ({ apikey: KEY, "Content-Type": "application/json" });

export interface CloudCopy {
  state: unknown;
  ts: number; // client_updated_at, epoch ms
}

/** The stored copy of a profile, or null if it has never been saved. Throws when offline. */
export async function fetchProfile(id: ProfileId): Promise<CloudCopy | null> {
  const res = await fetch(`${URL}/rest/v1/cp_profiles?id=eq.${id}&select=state,client_updated_at`, {
    headers: headers(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  const rows = (await res.json()) as { state: unknown; client_updated_at: number }[];
  return rows.length ? { state: rows[0].state, ts: Number(rows[0].client_updated_at) } : null;
}

/** Save a profile. Resolves true if stored, false if the cloud already had a newer copy. */
export async function pushProfile(id: ProfileId, state: unknown, ts: number, keepalive = false): Promise<boolean> {
  const body = JSON.stringify({ p_id: id, p_state: state, p_ts: ts });
  const res = await fetch(`${URL}/rest/v1/rpc/cp_save`, {
    method: "POST",
    headers: headers(),
    body,
    // Browsers cap keepalive bodies at 64 KB; bigger saves go as normal requests.
    keepalive: keepalive && body.length < 60000,
  });
  if (!res.ok) throw new Error(`save ${res.status}`);
  return (await res.json()) === true;
}
