// Color Pitch service worker: works offline after the first load.
// - App shell ("/") is network-first, falling back to the cached copy.
// - Next.js build assets (/_next/static, hashed) are cache-first.
// - Piano samples (tonejs.github.io) and Google Fonts are cache-first once fetched.
const VERSION = "cp-v1";
const SHELL = `${VERSION}-shell`;
const ASSETS = `${VERSION}-assets`;
const SAMPLES = "cp-samples-v1"; // kept across app versions — the samples never change

const PRECACHE = ["/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/icon.svg"];
const SALAMANDER = "https://tonejs.github.io/audio/salamander/";
const SAMPLE_FILES = ["C", "Ds", "Fs", "A"].flatMap((n) => [2, 3, 4, 5, 6].map((o) => `${SALAMANDER}${n}${o}.mp3`));

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const shell = await caches.open(SHELL);
      await shell.addAll(PRECACHE);
      // Best effort: fetch piano samples now so offline practice has the real piano.
      const samples = await caches.open(SAMPLES);
      await Promise.all(
        SAMPLE_FILES.map(async (url) => {
          if (await samples.match(url)) return;
          try {
            const res = await fetch(url, { mode: "cors" });
            if (res.ok) await samples.put(url, res);
          } catch {
            /* offline during install — they'll be cached on first use */
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL, ASSETS, SAMPLES]);
      for (const key of await caches.keys()) if (!keep.has(key)) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req, { ignoreVary: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === "opaque") cache.put(req, res.clone());
  return res;
}

async function networkFirst(req) {
  const cache = await caches.open(SHELL);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put("/", res.clone());
    return res;
  } catch {
    return (await cache.match("/")) || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (req.mode === "navigate") {
    event.respondWith(networkFirst(req));
    return;
  }
  if (url.href.startsWith(SALAMANDER)) {
    event.respondWith(cacheFirst(req, SAMPLES));
    return;
  }
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(cacheFirst(req, ASSETS));
    return;
  }
  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
      event.respondWith(cacheFirst(req, ASSETS));
      return;
    }
    // Everything else same-origin: try network, fall back to cache.
    event.respondWith(
      (async () => {
        const cache = await caches.open(ASSETS);
        try {
          const res = await fetch(req);
          if (res.ok) cache.put(req, res.clone());
          return res;
        } catch {
          return (await cache.match(req)) || Response.error();
        }
      })(),
    );
  }
});
