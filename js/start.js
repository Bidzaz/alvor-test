/* Alvor · Start: runs last, once every other file is loaded.
   Plain script (no build step): loaded by index.html in a fixed order and sharing one global scope. */
"use strict";
/* ---------- Start ---------- */
normalizeLocation(); useActiveLocation();
try{ const tz = Intl.DateTimeFormat().resolvedOptions().timeZone; if(tz && state.settings.tz !== tz){ state.settings.tz = tz; saveLocal(); } }catch(e){}
if("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
const startIds = upgradeIds();
rebaseSync();
applyLook();
render();
upgradePhotoIds(startIds).then(loadPhotos);
fetchWeather(false);
try{ navigator.storage && navigator.storage.persist && navigator.storage.persist(); }catch(e){}
try{ localStorage.removeItem("garden-sync-key"); }catch(e){}
initAuth().then(async () => {
  if(online && !token){
    if(linkToken()){ authMode = "signup"; showAuth("A friend invited you. Create your account to join their circle."); $("#aInvite").value = location.href; }
    else if(hadOldAccount) showAuth("Alvor has a new home. Create a new account with the invite you received, or sign in if you already did. The plants on this phone come with you.");
    else showAuth();
    return;
  }
  fillAccount();
  await pull();
  loadCircle();
  loadAdmin(true);
  await joinFromLink();
  loadFeed();
  openFromHash(location.hash);
  ensurePush();
  maybeOnboard();
  maybeShareIntro();
});
refreshCurrent(false);
document.addEventListener("visibilitychange", () => { if(!document.hidden){ fetchWeather(false); refreshCurrent(false); if(token){ pull(); loadCircle(); loadFeed(); } } });
