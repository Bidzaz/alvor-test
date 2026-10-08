/* Alvor · Notifications.
   Plain script (no build step): loaded by index.html in a fixed order and sharing one global scope. */
"use strict";
/* ---------- Notifications ---------- */
function keyBytes(b64){
  const s = (b64 + "=".repeat((4 - b64.length % 4) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}
const canPush = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && online;
async function refreshNotifyStatus(){
  if(!canPush()){ setNotify(tr("Notifications work once the app is opened from your site in Chrome.")); return; }
  try{
    const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription();
    setNotify(sub && Notification.permission === "granted" ? tr("Notifications are on for this phone.") : tr("Notifications are off for this phone."));
  }catch(e){ setNotify(""); }
}
$("#notifyBtn").addEventListener("click", () => enableNotifications());
async function enableNotifications(quiet){
  if(!token){ if(!quiet) showAuth(); return false; }
  if(!canPush()){ setNotify(tr("This browser can't receive notifications. Open the app from your site in Chrome.")); return false; }
  const perm = await Notification.requestPermission();
  if(perm !== "granted"){ setNotify(tr("Notifications are blocked. Allow them for this site in Chrome's settings, then try again.")); return false; }
  try{
    if(!quiet) setNotify(tr("Turning on…"));
    const reg = await navigator.serviceWorker.ready;
    const {r:kr, j:kj} = await callFn("notify", {action:"key"});
    if(kr.status === 401){ sessionExpired(); return false; }
    if(!kr.ok || !kj.publicKey) throw new Error("key");
    let sub = await reg.pushManager.getSubscription();
    if(sub) await sub.unsubscribe();
    sub = await reg.pushManager.subscribe({userVisibleOnly:true, applicationServerKey:keyBytes(kj.publicKey)});
    must(await sb.rpc("save_push_subscription", {p_sub:sub.toJSON()}));
    try{ localStorage.setItem(PUSH_KEY, kj.publicKey); }catch(e){}
    await push();
    setNotify(tr("Notifications are on for this phone.")); if(!quiet) toast(tr("Notifications on"));
    return true;
  }catch(e){ setNotify(tr("Couldn't turn on notifications. Try again in a moment.")); return false; }
}
/* If this phone had notifications on (also from the old Alvor), sign it up again whenever the server key is new. */
const PUSH_KEY = "garden-push-key";
async function ensurePush(){
  if(!token || !canPush() || Notification.permission !== "granted") return;
  try{
    const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription();
    const {j} = await callFn("notify", {action:"key"});
    if(!j.publicKey) return;
    if(!sub || localStorage.getItem(PUSH_KEY) !== j.publicKey) await enableNotifications(true);
  }catch(e){}
}
$("#testBtn").addEventListener("click", async () => {
  if(!token){ showAuth(); return; }
  setNotify(tr("Sending a test…"));
  try{
    await push();
    const {r, j} = await callFn("notify", {action:"test", mode:"morning"});
    if(r.status === 401){ sessionExpired(); return; }
    if(!r.ok) throw new Error(j.error || r.status);
    setNotify(j.sent ? tr("Test sent. It should arrive in a few seconds.") : tr("This phone isn't signed up for notifications yet. Tap Turn on notifications first."));
  }catch(e){ setNotify(tr("Couldn't send the test. Try again in a moment.")); }
});
function saveNotifySettings(){
  state.settings.morningHour = +$("#sMorning").value;
  state.settings.eveningHour = +$("#sEvening").value;
  state.settings.eveningCheck = $("#sEveningOn").checked;
  state.settings.socialPush = $("#sSocialOn").checked;
  save(); toast(tr("Saved"));
}
["#sMorning","#sEvening","#sEveningOn","#sSocialOn"].forEach(id => $(id).addEventListener("change", saveNotifySettings));
