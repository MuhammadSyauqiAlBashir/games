// BashGames service worker: installable app shell + push notifications. /api and /ws are never cached.
const VERSION = "__VERSION__"
const CACHE = "bashgames-" + VERSION
// 3D files (three.js, model packs) are named by their own version, so they survive deploys: phones download them once.
const ASSETS = "bashgames-assets-v1"
const isAsset = (p) => p.startsWith("/vendor/") || p.startsWith("/cook/m/")

self.addEventListener("install", (e) => { self.skipWaiting() })
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== ASSETS).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()))
})
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/ws/")) return
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).catch(() => caches.match("/")))
    return
  }
  // Versioned files and fonts/flags: cache first.
  e.respondWith(caches.open(isAsset(url.pathname) ? ASSETS : CACHE).then(async (c) => {
    const hit = await c.match(e.request)
    if (hit) return hit
    const res = await fetch(e.request)
    if (res.ok) c.put(e.request, res.clone())
    return res
  }))
})
self.addEventListener("push", (e) => {
  let d = {}
  try { d = e.data ? e.data.json() : {} } catch (_) { d = { title: "BashGames", body: e.data && e.data.text() } }
  e.waitUntil(self.registration.showNotification(d.title || "BashGames", {
    body: d.body || "", tag: d.tag || undefined, renotify: !!d.tag, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png",
    data: { url: d.url || "/" },
  }))
})
self.addEventListener("notificationclick", (e) => {
  e.notification.close()
  const url = (e.notification.data && e.notification.data.url) || "/"
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
    for (const c of all) { if ("focus" in c) { c.postMessage({ type: "navigate", url }); return c.focus() } }
    return self.clients.openWindow(url)
  })())
})
