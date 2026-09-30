/* Service worker: shows garden notifications and opens the app when one is tapped. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

self.addEventListener("push", e => {
  let d = {title:"Alvor", body:""};
  try{ if(e.data) d = e.data.json(); }catch(err){ if(e.data) d.body = e.data.text(); }
  e.waitUntil(self.registration.showNotification(d.title, {
    body:d.body, tag:d.tag || "alvor", renotify:true,
    icon:"icon-192.png", badge:"badge-96.png", data:{url:d.url || self.registration.scope}
  }));
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || self.registration.scope;
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({type:"window", includeUncontrolled:true});
    for(const c of all){ if("focus" in c){ await c.focus(); return; } }
    await self.clients.openWindow(url);
  })());
});

/* Network first, so updates show up right away; falls back to the last copy when offline. */
const CACHE = "garden-v1";
self.addEventListener("fetch", e => {
  const req = e.request;
  if(req.method !== "GET" || new URL(req.url).origin !== location.origin || new URL(req.url).pathname.startsWith("/api/")) return;
  e.respondWith((async () => {
    try{
      const res = await fetch(req);
      if(res.ok){ const c = await caches.open(CACHE); c.put(req, res.clone()); }
      return res;
    }catch(err){
      const hit = await caches.match(req);
      if(hit) return hit;
      throw err;
    }
  })());
});
