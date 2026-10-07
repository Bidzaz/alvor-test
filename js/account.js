/* Alvor · Account and sync: Supabase, the garden sync, photo sync, sign in, forgotten password, friend links.
   Plain script (no build step): loaded by index.html in a fixed order and sharing one global scope. */
"use strict";
/* ---------- Account and sync ---------- */
/* Alvor's accounts and data live in Supabase. The publishable key is meant to sit in the app:
   what each person may read or change is enforced by the database itself. */
const SUPABASE_URL = "https://ihufhwnwzmzuhfxiwbal.supabase.co";
const SUPABASE_KEY = "sb_publishable_v82YQhQIPQ31xuOArsKzGg_6LZ7e1US";
const sb = window.supabase && location.protocol === "https:"
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {auth:{persistSession:true, autoRefreshToken:true, detectSessionInUrl:false}})
  : null;
const online = !!sb;
const IDENTIFY_READY = true, PUSH_READY = true;
const MOVING_MSG = "isn't available right now.";
const OLD_TOKEN_KEY = "garden-token", USER_KEY = "garden-user";
const hadOldAccount = (() => { try{ return !!localStorage.getItem(OLD_TOKEN_KEY); }catch(e){ return false; } })();
let token = "";   // current session's access token ("" when signed out)
let me = (() => { try{ return JSON.parse(localStorage.getItem(USER_KEY) || "null"); }catch(e){ return null; } })();
if(me && !me.id) me = null;   // left over from the old accounts
let syncTimer = null, syncing = null;
const hhmm = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const setSync = m => { $("#syncStatus").textContent = m; };
const setNotify = m => { $("#notifyStatus").textContent = m; };
/* Calls one of Alvor's server functions on Supabase as the signed-in person. Returns {r, j}. */
async function callFn(name, body){
  let t = token;
  try{ const {data} = await sb.auth.getSession(); if(data && data.session) t = data.session.access_token; }catch(e){}
  const r = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {method:"POST",
    headers:{"Content-Type":"application/json", "apikey":SUPABASE_KEY, "Authorization":"Bearer " + t}, body:JSON.stringify(body || {})});
  return {r, j:await r.json().catch(() => ({}))};
}
const OFFLINE_MSG = "Couldn't reach Alvor. Changes stay on this phone and are saved next time.";
const isAuthErr = e => e && (e.status === 401 || e.code === "PGRST301" || /jwt|refresh token/i.test(e.message || ""));
const must = r => { if(r.error) throw r.error; return r.data; };

async function loadMe(session){
  token = session.access_token;
  const id = session.user.id;
  try{
    const [prof, acct] = await Promise.all([
      sb.from("profiles").select("username,display_name,avatar_path").eq("id", id).maybeSingle().then(must),
      sb.from("accounts").select("is_owner,default_visibility,findable,migrated_at,disabled").eq("id", id).maybeSingle().then(must)
    ]);
    me = {id, email:session.user.email, user:prof ? prof.username : session.user.email, name:prof ? prof.display_name : "",
      avatar:(prof && prof.avatar_path) || null, findable:!!(acct && acct.findable),
      owner:!!(acct && acct.is_owner), activitySeen:me && me.id === id ? me.activitySeen || null : null, defaultVisibility:(acct && acct.default_visibility) || "vault", migrated:!!(acct && acct.migrated_at), disabled:!!(acct && acct.disabled)};
  }catch(e){
    // Offline: keep what we knew about this account.
    if(!me || me.id !== id) me = {id, email:session.user.email, user:session.user.email, name:"", owner:false, defaultVisibility:"vault"};
  }
  try{ localStorage.setItem(USER_KEY, JSON.stringify(me)); }catch(e){}
}
async function initAuth(){
  if(!sb) return;
  try{
    const {data} = await sb.auth.getSession();
    if(data && data.session) await loadMe(data.session);
  }catch(e){}
  sb.auth.onAuthStateChange((ev, s) => {
    token = s ? s.access_token : "";
    if(ev === "SIGNED_OUT" && me){ me = null; try{ localStorage.removeItem(USER_KEY); }catch(e){} }
  });
}

/* A plant is stored in two parts: what friends may see (by its visibility) and everything else, owner only. */
const sharedRow = p => ({id:p.id, owner_id:me.id, name:String(p.name || "").trim().slice(0, 80) || "Plant",
  species:p.species ? String(p.species).slice(0, 120) : null, area:p.area ? String(p.area).slice(0, 40) : null,
  visibility:["friends","everyone","vault"].includes(p.visibility) ? p.visibility : "vault"});

/* Puts a merged garden on this phone (see syncGarden). */
function applyMerged(m){
  const base = defaults();
  state.plants = m.plants.map(p => ({...p})); state.log = m.log;
  state.settings = {...base.settings, ...m.settings};
  state.account = me && me.id;
  normalizePlants(); normalizeLocation(); useActiveLocation();
  rebaseSync();
  saveLocal(); applyLook(); render(); if(currentTab === "settings") fillSettings();
}
function sessionExpired(){
  token = "";
  showAuth("Please sign in again.");
}
async function serverGarden(){
  return must(await sb.from("garden_private").select("settings,log").eq("owner_id", me.id).maybeSingle());
}
async function serverPlants(){
  const [priv, rows] = await Promise.all([
    sb.from("plant_private").select("plant_id,data").eq("owner_id", me.id).then(must),
    sb.from("plants").select("id,visibility").eq("owner_id", me.id).then(must)
  ]);
  const vis = Object.fromEntries(rows.map(r => [r.id, r.visibility]));
  return priv.filter(r => vis[r.plant_id])
    .map(r => ({...r.data, id:r.plant_id, visibility:vis[r.plant_id]}))
    .sort((a, b) => (a._i ?? 0) - (b._i ?? 0))
    .map(({_i, ...p}) => p);
}
/* Sends what the merge says the account is missing. Plants are only deleted when this or another
   phone marked them as deleted, never because a phone simply doesn't have them. */
async function uploadMerged(m){
  const order = new Map(m.plants.map((p, i) => [p.id, i]));
  if(m.upsert.length){
    must(await sb.from("plants").upsert(m.upsert.map(sharedRow)));
    must(await sb.from("plant_private").upsert(m.upsert.map(p => ({plant_id:p.id, owner_id:me.id, data:{...p, _i:order.get(p.id)}}))));
  }
  const gone = m.removeFromServer.filter(id => UUID_RE.test(String(id)));
  if(gone.length){
    const rows = must(await sb.from("photos").select("id").eq("owner_id", me.id).in("plant_id", gone));
    if(rows.length) must(await sb.storage.from("photos").remove(rows.flatMap(r => [phPath(r.id, "l"), phPath(r.id, "s")])));
    must(await sb.from("plants").delete().eq("owner_id", me.id).in("id", gone));
  }
  must(await sb.from("gardens").upsert({owner_id:me.id, home:state.settings.home === "apartment" ? "apartment" : "house",
    town:String(state.settings.place || "").slice(0, 60) || null}));
  // The backdrop friends see. A separate write, so a missing column (part 9 not run) can't stop the sync.
  try{ await sb.from("gardens").update({theme:publicLook()}).eq("owner_id", me.id); }catch(e){}
  // Saved last: its updatedAt is the account's revision, so other phones know something changed.
  const rev = Date.now();
  must(await sb.from("garden_private").upsert({owner_id:me.id,
    settings:{...m.settings, updatedAt:rev, _sAt:m.sAt, _gone:m.gone}, log:m.log.slice(0, GS.LOG_SERVER)}));
  return rev;
}
/* Merges this phone and the account plant by plant (rules in sync.js), then updates whichever side needs it.
   Cheap when nothing changed: one small read. */
let syncAgain = false;
function syncGarden(){
  if(!token || !me) return Promise.resolve(false);
  if(syncing){ syncAgain = true; return syncing; }
  syncing = (async () => {
    try{
      for(let round = 0; round < 3; round++){
        const M = syncMeta(), n0 = M.n || 0;
        const gp = await serverGarden();
        const st = gp ? gp.settings || {} : null, rev = st ? +st.updatedAt || 0 : null;
        if(gp && !M.dirty && rev === M.seenAt) break;   // nothing new on either side
        const plants = gp ? await serverPlants() : [];
        if(syncMeta() !== M || (M.n || 0) !== n0) continue;   // saved something meanwhile: start again
        const legacy = rev || 0;   // rows saved before per-plant times existed
        plants.forEach(p => { if(p._m == null) p._m = legacy; });
        const S = gp ? {plants, gone:st._gone || {}, settings:st, sAt:st._sAt != null ? +st._sAt : legacy, log:gp.log || []} : null;
        const m = GS.merge({plants:state.plants, gone:M.gone, settings:state.settings, sAt:M.sAt, log:state.log}, S, Date.now());
        M.gone = m.gone; M.sAt = m.sAt; writeMeta();
        if(m.localChanged) applyMerged(m);
        const newRev = m.serverChanged ? await uploadMerged(m) : rev;
        M.seenAt = newRev;
        if((M.n || 0) === n0) M.dirty = false;
        writeMeta();
        break;
      }
      setSync(`Saved to your account at ${hhmm()}.`); queuePhotoSync(); return true;
    }catch(e){
      if(isAuthErr(e)){ sessionExpired(); return false; }
      setSync(OFFLINE_MSG); return false;
    }finally{
      syncing = null;
      if(syncAgain){ syncAgain = false; queueSync(); }
    }
  })();
  return syncing;
}
function push(){ return syncGarden(); }
function pull(){ return syncGarden(); }
function queueSync(){ if(!token) return; clearTimeout(syncTimer); syncTimer = setTimeout(push, 1500); }

/* ---------- Photo sync ----------
   Each photo is stored twice in the account: large (only you) and small (what friends see).
   This phone keeps the large one, so photos also work offline. */
const PH_DEL_KEY = "garden-photo-deletes";
const phPath = (id, size) => `${me.id}/${id}-${size}.jpg`;
const readDels = () => { try{ return JSON.parse(localStorage.getItem(PH_DEL_KEY) || "[]"); }catch(e){ return []; } };
const writeDels = a => { try{ localStorage.setItem(PH_DEL_KEY, JSON.stringify(a)); }catch(e){} };
function forgetPhoto(id){ writeDels([...new Set([...readDels(), id])]); queuePhotoSync(); }
let photoSyncing = null, photoTimer = null;
function queuePhotoSync(){ if(!token) return; clearTimeout(photoTimer); photoTimer = setTimeout(syncPhotos, 1500); }
async function syncPhotos(){
  if(!token || !me || !sb) return;
  if(photoSyncing) return photoSyncing;
  photoSyncing = (async () => {
    let changed = false;
    try{
      const store = sb.storage.from("photos");
      // 1. Photos deleted on this phone
      const dels = readDels();
      if(dels.length){
        must(await store.remove(dels.flatMap(id => [phPath(id, "l"), phPath(id, "s")])));
        must(await sb.from("photos").delete().in("id", dels));
        writeDels(readDels().filter(id => !dels.includes(id)));
      }
      const plantIds = new Set(state.plants.map(p => p.id));
      const rows = must(await sb.from("photos").select("id,plant_id,path_large,taken_at,hidden").eq("owner_id", me.id));
      const server = new Set(rows.map(r => r.id));
      const local = await idb.all(), localIds = new Set(local.map(p => p.id)), pendingDel = new Set(readDels());
      // 2. New photos on this phone go up, large and small
      const uploaded = new Set();
      for(const ph of local){
        if(ph.synced || !plantIds.has(ph.plantId) || !UUID_RE.test(String(ph.id))) continue;
        if(!server.has(ph.id)){
          setSync("Saving photos…");
          must(await store.upload(phPath(ph.id, "l"), await dataToBlob(ph.data), {upsert:true, contentType:"image/jpeg"}));
          must(await store.upload(phPath(ph.id, "s"), await smallJpeg(ph.data), {upsert:true, contentType:"image/jpeg"}));
          must(await sb.from("photos").upsert({id:ph.id, plant_id:ph.plantId, owner_id:me.id, hidden:!!ph.hidden,
            path_large:phPath(ph.id, "l"), path_small:phPath(ph.id, "s"), taken_at:new Date(ph.ts || Date.now()).toISOString()}));
          delete ph.hideDirty;
        }
        ph.synced = true; await idb.put(ph); uploaded.add(ph.id);
      }
      // 2b. "Hide this photo": changes on this phone go up, changes from another phone come down
      const byId = Object.fromEntries(rows.map(r => [r.id, r]));
      for(const ph of local){
        const r = byId[ph.id]; if(!r || uploaded.has(ph.id) && !ph.hideDirty) continue;
        if(ph.hideDirty){
          must(await sb.from("photos").update({hidden:!!ph.hidden}).eq("id", ph.id));
          delete ph.hideDirty; await idb.put(ph);
        }else if(!!r.hidden !== !!ph.hidden){ ph.hidden = !!r.hidden; await idb.put(ph); changed = true; }
      }
      // 3. Photos deleted on another phone
      for(const ph of local){
        if(ph.synced && !server.has(ph.id) && !uploaded.has(ph.id)){ await idb.del(ph.id); changed = true; }
      }
      // 4. Photos added on another phone come down
      for(const r of rows){
        if(localIds.has(r.id) || pendingDel.has(r.id) || !plantIds.has(r.plant_id)) continue;
        setSync("Getting photos…");
        const blob = must(await store.download(r.path_large));
        const at = new Date(r.taken_at || Date.now());
        await idb.put({id:r.id, plantId:r.plant_id, date:ymd(at), ts:at.getTime(), data:await blobToData(blob), synced:true, hidden:!!r.hidden});
        changed = true;
      }
      if(uploaded.size || changed) setSync(`Saved to your account at ${hhmm()}.`);
    }catch(e){
      if(isAuthErr(e)) sessionExpired(); else setSync("Some photos aren't saved to your account yet. Alvor tries again next time.");
    }finally{
      photoSyncing = null;
      if(changed) await loadPhotos();
    }
  })();
  return photoSyncing;
}

/* Login screen */
let authMode = "login";   // login, signup, reset (ask for the email) or code (enter the code and a new password)
let resetEmail = "";
function setAuthMode(m){
  authMode = m;
  const reset = m === "reset" || m === "code", newPass = m === "signup" || m === "code";
  document.querySelectorAll("[data-auth]").forEach(b => b.setAttribute("aria-pressed", b.dataset.auth === m));
  $("#authSeg").hidden = reset;
  $("#authLead").style.marginBottom = reset ? "16px" : "";
  $("#inviteField").hidden = m !== "signup";
  $("#userField").hidden = m !== "signup";
  $("#codeField").hidden = m !== "code";
  $("#passField").hidden = m === "reset";
  $("#aEmail").closest(".field").hidden = m === "code";
  $("#passHint").hidden = !newPass;
  $("#passLabel").textContent = m === "code" ? "New password" : "Password";
  $("#aPass").setAttribute("autocomplete", newPass ? "new-password" : "current-password");
  $("#authGo").textContent = {signup:"Create account", reset:"Send me a code", code:"Save new password"}[m] || "Sign in";
  $("#authLead").textContent = {
    signup:"Create your own garden. You need an invite code or a friend's link.",
    reset:"Enter the email of your account. We'll send you a code to set a new password.",
    code:`If ${resetEmail} has an Alvor account, a code is on its way. It works for an hour. Check the spam folder too.`
  }[m] || "Sign in to see your garden.";
  $("#authLegal").innerHTML = m === "signup"
    ? `By creating an account you agree to how Alvor looks after your data, described in the <a href="privacy.html" target="_blank" rel="noopener">privacy policy</a>.`
    : `<a href="privacy.html" target="_blank" rel="noopener">Privacy policy</a>`;
  $("#forgotBtn").hidden = m !== "login";
  $("#resendBtn").hidden = m !== "code";
  $("#backBtn").hidden = !reset;
  $("#authMsg").textContent = "";
}
function showAuth(msg){
  setAuthMode(authMode);
  $("#auth").hidden = false;
  if(msg) $("#authMsg").textContent = msg;
}
document.querySelectorAll("[data-auth]").forEach(b => b.addEventListener("click", () => setAuthMode(b.dataset.auth)));
$("#authGo").addEventListener("click", async () => {
  if(authMode === "reset") return sendResetCode();
  if(authMode === "code") return saveResetPassword();
  const email = $("#aEmail").value.trim().toLowerCase(), password = $("#aPass").value;
  const msg = $("#authMsg");
  if(!email || !password){ msg.textContent = "Fill in your email and password."; return; }
  if(!sb){ msg.textContent = "Couldn't reach Alvor. Check your connection."; return; }
  const btn = $("#authGo"); btn.disabled = true; msg.textContent = "One moment…";
  try{
    if(authMode === "signup"){
      const username = $("#aUser").value.trim().toLowerCase().replace(/^@/, "");
      const r = await fetch(`${SUPABASE_URL}/functions/v1/signup`, {method:"POST",
        headers:{"Content-Type":"application/json", "apikey":SUPABASE_KEY},
        body:JSON.stringify({email, password, username, invite:$("#aInvite").value.trim()})});
      const j = await r.json().catch(() => ({}));
      if(!r.ok){ msg.textContent = j.error || "Something went wrong. Try again."; return; }
    }
    const {data, error} = await sb.auth.signInWithPassword({email, password});
    if(error){ msg.textContent = /invalid/i.test(error.message) ? "Wrong email or password." : "Couldn't sign in. Try again."; return; }
    await signedIn(data.session);
  }catch(e){ msg.textContent = "Couldn't reach Alvor. Check your connection."; }
  finally{ btn.disabled = false; }
});
$("#aPass").addEventListener("keydown", e => { if(e.key === "Enter") $("#authGo").click(); });
$("#aEmail").addEventListener("keydown", e => { if(e.key === "Enter" && authMode === "reset") $("#authGo").click(); });

/* Forgotten password: Supabase emails a one-time code (no link), so it works the same in the app and in a browser. */
$("#forgotBtn").addEventListener("click", () => { $("#aPass").value = ""; setAuthMode("reset"); $("#aEmail").focus(); });
$("#backBtn").addEventListener("click", () => { $("#aCode").value = ""; $("#aPass").value = ""; setAuthMode("login"); });
$("#resendBtn").addEventListener("click", () => sendResetCode(true));
async function sendResetCode(again){
  const msg = $("#authMsg"), email = again ? resetEmail : $("#aEmail").value.trim().toLowerCase();
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){ msg.textContent = "Enter the email of your account."; return; }
  if(!sb){ msg.textContent = "Couldn't reach Alvor. Check your connection."; return; }
  const btn = again ? $("#resendBtn") : $("#authGo"); btn.disabled = true; msg.textContent = "One moment…";
  try{
    const {error} = await sb.auth.resetPasswordForEmail(email);
    if(error){
      msg.textContent = error.status === 429 || /security purposes|rate limit/i.test(error.message)
        ? "A code was sent a moment ago. Wait a minute before asking for another one."
        : "Couldn't send the code. Try again in a while.";
      return;
    }
    resetEmail = email;
    if(again){ msg.textContent = "A new code is on its way. Only the newest code works."; return; }
    setAuthMode("code"); $("#aCode").focus();
  }catch(e){ msg.textContent = "Couldn't reach Alvor. Check your connection."; }
  finally{ btn.disabled = false; }
}
async function saveResetPassword(){
  const msg = $("#authMsg"), code = $("#aCode").value.replace(/\D/g, ""), password = $("#aPass").value;
  if(code.length < 6){ msg.textContent = "Enter the code from the email."; return; }
  if(password.length < 8){ msg.textContent = "The new password needs at least 8 characters."; return; }
  const btn = $("#authGo"); btn.disabled = true; msg.textContent = "One moment…";
  try{
    const v = await sb.auth.verifyOtp({email:resetEmail, token:code, type:"recovery"});
    if(v.error || !v.data.session){ msg.textContent = "That code doesn't work. Check it, or send a new one."; return; }
    const {error} = await sb.auth.updateUser({password});
    if(error){
      msg.textContent = /same/i.test(error.message) ? "That's the password you already have. You can just sign in with it."
        : /weak|short|least/i.test(error.message) ? "Choose a longer or less common password." : "Couldn't save the new password. Try again.";
      return;
    }
    try{ await sb.auth.signOut({scope:"others"}); }catch(e){}
    const {data} = await sb.auth.getSession();
    $("#aCode").value = ""; $("#aEmail").value = resetEmail; authMode = "login";
    await signedIn(data.session || v.data.session);
    toast("New password saved. Other phones will need to sign in again.");
  }catch(e){ msg.textContent = "Couldn't reach Alvor. Check your connection."; }
  finally{ btn.disabled = false; }
}

async function signedIn(session){
  await loadMe(session);
  let gp = null;
  try{ gp = await serverGarden(); }catch(e){}
  const oldGarden = state.account && !UUID_RE.test(String(state.account));   // from the old Alvor accounts
  const mine = state.account === me.id;
  const otherAccount = state.account && !mine && !oldGarden;
  if(otherAccount){ try{ await idb.clear(); }catch(e){} photos = {}; writeDels([]); }
  if(gp){
    if(!mine){ state = defaults(); state.account = me.id; saveLocal(); }
    await syncGarden();   // merges: changes on this phone not yet sent are kept
  }else if(state.plants.length && (mine || oldGarden || !state.account)
      && confirm(`This phone has ${state.plants.length} ${state.plants.length === 1 ? "plant" : "plants"}. Move ${state.plants.length === 1 ? "it" : "them"} into this account?`)){
    state.account = me.id; state.updatedAt = Date.now(); saveLocal();
    await push();
    if(oldGarden || !me.migrated){ try{ await sb.from("accounts").update({migrated_at:new Date().toISOString()}).eq("id", me.id); }catch(e){} }
  }else{
    const keep = state.settings;
    state = defaults(); state.account = me.id;
    state.settings = {...state.settings, ...keep, onboarded:false};   // keep the location, run the welcome setup
    normalizeLocation(); useActiveLocation(); saveLocal(); render();
  }
  try{ localStorage.removeItem(OLD_TOKEN_KEY); }catch(e){}
  $("#auth").hidden = true; $("#aPass").value = ""; $("#aInvite").value = "";
  fillAccount();
  fetchWeather(true);
  if(state.settings.onboarded || state.plants.length) toast(`Welcome, ${me.name || me.user}`);
  loadCircle(true);
  loadAdmin(true);
  await joinFromLink();
  queuePhotoSync();
  ensurePush();
  maybeOnboard();
  maybeShareIntro();
}
async function signOut(){
  try{ await syncPhotos(); }catch(e){}
  try{
    if(canPush()){
      const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription();
      if(sub){ await sb.from("push_subscriptions").delete().eq("endpoint", sub.endpoint); await sub.unsubscribe(); }
      localStorage.removeItem(PUSH_KEY);
    }
  }catch(e){}
  try{ await sb.auth.signOut(); }catch(e){}
  token = ""; me = null;
  circle = null; circleAt = 0; myLink = null; visit = null; fSearch = {q:"", results:null}; admin = null; forgetTalk(); updateBadge(); fillAccount();
  if(currentTab === "friends" || currentTab === "friend") showTab("today");
  try{ localStorage.removeItem(USER_KEY); }catch(e){}
  const keep = state.settings; state = defaults(); state.settings = keep; saveLocal(); render();
  authMode = "login"; showAuth("You're signed out.");
}
$("#signOutBtn").addEventListener("click", () => { if(confirm("Sign out on this phone? Your garden stays saved in your account.")) signOut(); });

/* Friend links: opening one connects you at once; without an account it becomes your invite. */
const linkToken = () => { const m = (location.hash + " " + location.search).match(/join=([0-9a-f]{32})/); return m ? m[1] : null; };
async function joinFromLink(){
  const t = linkToken(); if(!t || !token) return;
  history.replaceState(null, "", location.pathname);
  try{
    const f = must(await sb.rpc("accept_friend_link", {p_token:t}));
    const p = f && f[0];
    toast(`You and ${p ? personName(p) : "your friend"} are friends`);
    await loadCircle(true);
    if(p && state.settings.onboarded && !ONB) openFriend(p.id);   // straight to their garden
  }catch(e){ toast(e && e.code === "P0001" && e.message ? e.message : "Couldn't use that link. Check your connection and open it again."); }
}
window.addEventListener("hashchange", () => { if(linkToken() && token) joinFromLink(); });

/* Account card */
function fillAccount(){
  if(!online){ $("#acctLine").textContent = "Accounts work once the app is opened from your site."; $("#accountCard").querySelectorAll("button").forEach(b => b.hidden = true); return; }
  $("#acctLine").textContent = me ? `Signed in as @${me.user}${me.email ? " (" + me.email + ")" : ""}${me.owner ? ", owner of Alvor" : ""}.` : "Not signed in.";
  $("#inviteBtn").hidden = !(me && me.owner);
  $("#friendsBtn").hidden = !(me && token);
  $("#heroAcct").hidden = !(me && token);
  let off = $("#acctOff");
  if(me && me.disabled){
    if(!off){ off = document.createElement("p"); off.id = "acctOff"; off.className = "acct-off"; $("#acctLine").after(off); }
    off.textContent = "Your account has been switched off by the owner of Alvor. Your garden still works for you, but nobody else can see it, find you or add you.";
  }else if(off) off.remove();
  $("#dataCard").hidden = !(me && token);
  $("#adminCard").hidden = !(me && me.owner && token);
}
$("#inviteBtn").addEventListener("click", async () => {
  const out = $("#inviteOut");
  try{
    const rows = must(await sb.rpc("create_invite"));
    const j = rows && rows[0]; if(!j) throw new Error();
    const until = new Date(j.expires_at).toLocaleDateString("en-GB", {day:"numeric", month:"long"});
    const site = location.origin + location.pathname;
    out.innerHTML = `<div>Send this code to your friend, together with the address of Alvor:</div><div class="code">${esc(j.code)}</div>
      <div class="status" style="margin:0">It works once, until ${until}. They tap Create account and enter it there.</div>
      <button class="btn small" id="copyInvite" style="margin-top:8px">Copy message</button>`;
    out.hidden = false;
    $("#copyInvite").addEventListener("click", async () => {
      const msg = `Join me on Alvor, the app I use for my plants. Get it here: ${site.replace(/[^/]*$/, "")}join.html , then tap "Create account" and use this invite code: ${j.code}`;
      try{ if(navigator.share) await navigator.share({text:msg}); else { await navigator.clipboard.writeText(msg); toast("Copied"); } }catch(e){}
    });
  }catch(e){ out.hidden = false; out.textContent = (e && e.message) || "Couldn't create an invite. Try again."; }
});
$("#pwBtn").addEventListener("click", () => { $("#pwBox").hidden = !$("#pwBox").hidden; });
$("#pwSave").addEventListener("click", async () => {
  const cur = $("#pwCur").value, next = $("#pwNew").value;
  if(next.length < 8){ toast("The new password needs at least 8 characters."); return; }
  try{
    const chk = await sb.auth.signInWithPassword({email:me.email, password:cur});
    if(chk.error){ toast("The current password is wrong."); return; }
    const {error} = await sb.auth.updateUser({password:next});
    if(error){ toast(/same/i.test(error.message) ? "That's the password you already have." : "Couldn't change the password"); return; }
    try{ await sb.auth.signOut({scope:"others"}); }catch(e){}
    $("#pwCur").value = ""; $("#pwNew").value = ""; $("#pwBox").hidden = true;
    toast("Password changed. Other phones will need to sign in again.");
  }catch(e){ toast("Couldn't reach Alvor"); }
});
