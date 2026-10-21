/* Service worker: shows garden notifications and opens the app when one is tapped
   (at the right reaction or comment, when the notification is about one). */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

self.addEventListener("push", e => {
  let d = {title:"Alvor", body:""};
  try{ if(e.data) d = e.data.json(); }catch(err){ if(e.data) d.body = e.data.text(); }
  /* Buttons on the notification (d.actions: [{action, title, hash}]), e.g. "Mark all watered": tapping one opens
     Alvor at its hash, and the app does it there. */
  const acts = Array.isArray(d.actions) ? d.actions.slice(0, 2) : [];
  e.waitUntil(self.registration.showNotification(d.title, {
    body:d.body, tag:d.tag || "alvor", renotify:true,
    icon:"icon-192.png", badge:"badge-96.png",
    actions:acts.map(a => ({action:a.action, title:a.title})),
    data:{url:d.hash ? new URL("./#" + d.hash, self.registration.scope).href : (d.url || self.registration.scope), hash:d.hash || "",
      acts:Object.fromEntries(acts.map(a => [a.action, a.hash]))}
  }));
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  const data0 = e.notification.data || {}, hash = e.action && data0.acts && data0.acts[e.action] ? data0.acts[e.action] : data0.hash;
  const data = {...data0, hash, url:hash ? new URL("./#" + hash, self.registration.scope).href : (data0.url || self.registration.scope)}, url = data.url;
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({type:"window", includeUncontrolled:true});
    for(const c of all){
      if("focus" in c){
        await c.focus();
        if(data.hash) c.postMessage({open:data.hash});   // a reaction or comment: the app opens it
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});

/* Network first, so updates show up right away; falls back to the last copy when offline.
   Files asked for with ?v= keep only their newest copy. */
const CACHE = "garden-v1";
self.addEventListener("fetch", e => {
  const req = e.request;
  if(req.method !== "GET" || new URL(req.url).origin !== location.origin || new URL(req.url).pathname.startsWith("/api/")) return;
  e.respondWith((async () => {
    try{
      const res = await fetch(req);
      if(res.ok){
        const c = await caches.open(CACHE), u = new URL(req.url);
        await c.put(req, res.clone());
        if(u.searchParams.has("v"))   // a newer version of a file: forget the older copies
          for(const k of await c.keys()){ const o = new URL(k.url); if(o.pathname === u.pathname && o.search !== u.search) c.delete(k); }
      }
      return res;
    }catch(err){
      const hit = await caches.match(req);
      if(hit) return hit;
      throw err;
    }
  })());
});
