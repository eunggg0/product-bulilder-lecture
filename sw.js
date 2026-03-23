const CACHE = "todaypick-v5";
const STATIC = ["/", "/style.css", "/script.js", "/data.js", "/og-image.svg", "/manifest.json"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  // 외부 API는 캐시 안 함
  if (!url.hostname.includes("today-pick.vercel.app") && url.hostname !== location.hostname) return;

  // data.js, script.js는 항상 네트워크 우선 (업데이트 즉시 반영)
  const isCore = ["/data.js", "/script.js"].includes(url.pathname);
  if (isCore) {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok) {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        }
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // 나머지는 캐시 우선
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
      if (res.ok && STATIC.some(s => url.pathname === s)) {
        caches.open(CACHE).then(c => c.put(e.request, res.clone()));
      }
      return res;
    }))
  );
});
