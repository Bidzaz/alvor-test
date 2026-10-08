/* Alvor · Location, home type, settings, welcome setup, sharing, profile and privacy settings.
   Plain script (no build step): loaded by index.html in a fixed order and sharing one global scope. */
"use strict";
/* ---------- Location: current or saved ---------- */
const PIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>';
const GPS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2" fill="currentColor"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>';
function normalizeLocation(){
  const st = state.settings;
  if(!st.saved) st.saved = {name:st.place || tr("Garden"), lat:st.lat, lon:st.lon};
  if(!st.locMode) st.locMode = "saved";
}
/* The forecast, alerts and server all read settings.place/lat/lon: keep them pointing at the active location. */
function useActiveLocation(){
  const st = state.settings;
  const a = st.locMode === "current" && st.current ? st.current : st.saved;
  const changed = st.lat !== a.lat || st.lon !== a.lon || st.place !== a.name;
  st.place = a.name; st.lat = a.lat; st.lon = a.lon;
  return changed;
}
function applyLocationChange(){ useActiveLocation(); save(); fillLocation(); render(); fetchWeather(true); }
const round2 = n => Math.round(n * 100) / 100;
function distKm(a, b){
  const r = x => x * Math.PI / 180, dLat = r(b.lat - a.lat), dLon = r(b.lon - a.lon);
  const h = Math.sin(dLat/2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLon/2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
async function placeName(lat, lon){
  try{
    const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=${LANG}`);
    const j = await r.json();
    return j.city || j.locality || j.principalSubdivision || "";
  }catch(e){ return ""; }
}
function getPosition(){
  return new Promise((res, rej) => {
    if(!navigator.geolocation) return rej(new Error(tr("This browser can't share its location.")));
    navigator.geolocation.getCurrentPosition(p => res({lat:round2(p.coords.latitude), lon:round2(p.coords.longitude)}),
      e => rej(new Error(e.code === 1 ? tr("Location access is blocked. Allow it for this site in Chrome's settings.") : tr("Couldn't get your location right now."))),
      {enableHighAccuracy:false, timeout:12000, maximumAge:10 * 60 * 1000});
  });
}
let locBusy = false;
async function refreshCurrent(force){
  const st = state.settings;
  if(st.locMode !== "current" || locBusy) return;
  if(!force && st.current && Date.now() - (st.current.at || 0) < 30 * 60 * 1000) return;
  locBusy = true;
  if(force) $("#locNowLine").innerHTML = `${GPS}<span>${tr("Finding you…")}</span>`;
  try{
    const pos = await getPosition();
    const moved = !st.current || distKm(st.current, pos) > 1;
    const name = moved ? (await placeName(pos.lat, pos.lon)) || `${pos.lat}, ${pos.lon}` : st.current.name;
    st.current = {name, lat:pos.lat, lon:pos.lon, at:Date.now()};
    if(useActiveLocation() || moved){ save(); render(); fetchWeather(true); } else saveLocal();
  }catch(e){ if(force) toast(e.message); }
  locBusy = false; fillLocation();
}
function fillLocation(){
  const st = state.settings;
  document.querySelectorAll("[data-loc]").forEach(b => b.setAttribute("aria-pressed", b.dataset.loc === st.locMode));
  $("#locCurrent").hidden = st.locMode !== "current";
  $("#locSaved").hidden = st.locMode !== "saved";
  const c = st.current;
  if(!locBusy) $("#locNowLine").innerHTML = c
    ? `${GPS}<span><b>${esc(c.name)}</b><small>${c.lat}, ${c.lon}. ${tr("Checked")} ${new Date(c.at).toLocaleString(LOCALE, {day:"numeric", month:"short", hour:"2-digit", minute:"2-digit"})}</small></span>`
    : `${GPS}<span>${tr("Not found yet. Tap Update now.")}</span>`;
  $("#locSavedLine").innerHTML = `${PIN}<span><b>${esc(st.saved.name)}</b><small>${st.saved.lat}, ${st.saved.lon}</small></span>`;
  $("#sPlace").value = st.saved.name; $("#sLat").value = st.saved.lat; $("#sLon").value = st.saved.lon;
}
document.querySelectorAll("[data-loc]").forEach(b => b.addEventListener("click", () => {
  const st = state.settings;
  if(st.locMode === b.dataset.loc) return;
  st.locMode = b.dataset.loc;
  applyLocationChange();
  if(st.locMode === "current") refreshCurrent(true);
}));
$("#locRefresh").addEventListener("click", () => refreshCurrent(true));
function setSaved(name, lat, lon){
  state.settings.saved = {name:name || tr("Garden"), lat:round2(+lat), lon:round2(+lon)};
  $("#locResults").innerHTML = ""; $("#locSearch").value = "";
  applyLocationChange(); toast(tr("Saved {name}", {name:state.settings.saved.name}));
}
let locTimer = null, locResults = [];
$("#locSearch").addEventListener("input", e => {
  clearTimeout(locTimer);
  const q = e.target.value.trim();
  if(q.length < 2){ $("#locResults").innerHTML = ""; return; }
  locTimer = setTimeout(async () => {
    try{
      const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=${LANG}&format=json`);
      const j = await r.json();
      locResults = j.results || [];
      $("#locResults").innerHTML = locResults.length
        ? locResults.map((p, i) => `<button data-lr="${i}"><b>${esc(p.name)}</b><small>${esc([p.admin1, p.country].filter(Boolean).join(", "))}</small></button>`).join("")
        : `<p class="status" style="margin:0">${tr("No places found. Try another spelling, or enter coordinates below.")}</p>`;
    }catch(err){ $("#locResults").innerHTML = `<p class="status" style="margin:0">${tr("Search isn't working right now. Enter coordinates below.")}</p>`; }
  }, 350);
});
$("#locResults").addEventListener("click", e => {
  const b = e.target.closest("[data-lr]"); if(!b) return;
  const p = locResults[+b.dataset.lr]; setSaved(p.name, p.latitude, p.longitude);
});
$("#locHere").addEventListener("click", async () => {
  try{ toast(tr("Finding you…")); const pos = await getPosition(); setSaved((await placeName(pos.lat, pos.lon)) || tr("My place"), pos.lat, pos.lon); }
  catch(e){ toast(e.message); }
});
$("#locManualSave").addEventListener("click", () => {
  const lat = parseFloat($("#sLat").value), lon = parseFloat($("#sLon").value);
  if(isNaN(lat) || isNaN(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180){ toast(tr("Check the latitude and longitude")); return; }
  setSaved($("#sPlace").value.trim(), lat, lon);
});

/* ---------- Home type ---------- */
function fillHome(){
  const apt = isApt();
  document.querySelectorAll("[data-home]").forEach(b => b.setAttribute("aria-pressed", b.dataset.home === (apt ? "apartment" : "house")));
  $("#homeLine").textContent = apt ? tr("Spots: inside (window, low light, grow cabinet) and the balcony (sun, partial sun, shade).")
    : tr("Spots: the house, the porch, outside in the garden and the greenhouse.");
  $("#balcRainRow").hidden = !apt;
  $("#balcRain").checked = !!state.settings.balconyRain;
}
document.querySelectorAll("[data-home]").forEach(b => b.addEventListener("click", () => {
  if(state.settings.home === b.dataset.home) return;
  state.settings.home = b.dataset.home;
  normalizePlants(); sceneMode = "overview";
  save(); fillHome(); render();
  const allowed = areaOrder(), off = state.plants.filter(p => !allowed.includes(p.area)).length;
  toast(off ? trn(off, "{n} plant is in a spot that doesn't exist here. Move it from the Plants tab.", "{n} plants are in spots that don't exist here. Move them from the Plants tab.") : tr("Home type saved"));
}));
$("#balcRain").addEventListener("change", e => { state.settings.balconyRain = e.target.checked; normalizePlants(); save(); render(); toast(tr("Saved")); });

/* ---------- Settings ---------- */
function fillSettings(){
  fillHome();
  const s = state.settings;
  fillLocation();
  const hours = (a, b) => Array.from({length:b - a + 1}, (_, i) => a + i).map(h => `<option value="${h}">${pad(h)}:00</option>`).join("");
  $("#sMorning").innerHTML = hours(5, 11); $("#sEvening").innerHTML = hours(16, 22);
  $("#sMorning").value = s.morningHour; $("#sEvening").value = s.eveningHour; $("#sEveningOn").checked = s.eveningCheck !== false;
  $("#sSocialOn").checked = s.socialPush !== false; $("#sSocialRow").hidden = !online;
  fillAccount();
  fillProfileCard(); fillPrivacy(); fillLook(); fillLang();
  refreshNotifyStatus();
  if(me && me.owner && token) loadAdmin();
  renderColdPick();
  $("#sMargin").value = s.margin; $("#sGh").value = s.gh; $("#sHeat").value = s.heat; $("#sWind").value = s.wind; $("#sRain").value = s.rain;
}
/* Low temperature warnings per plant, in Alert rules. Changes save at once. */
function renderColdPick(open){
  const el = $("#coldPick");
  const list = state.plants.filter(p => p.pattern !== "indoor").sort((a, b) => a.name.localeCompare(b.name));
  if(!list.length){ el.innerHTML = ""; return; }
  const on = list.filter(p => GA.coldOn(p)).length;
  el.innerHTML = `<details class="cold-box" ${open ? "open" : ""}><summary><b>${tr("Low temperature warnings per plant")}</b><span class="status" id="coldCount">${tr("On for {n} of {total}", {n:on, total:list.length})}</span></summary>
    <p class="status">${tr("Untick plants you've already protected for the winter, or that take far more cold than your garden gets. Heat, wind and watering reminders still come for every plant.")}</p>
    <div class="pick-tools"><button class="linkish" data-cold-all="1">${tr("Tick all")}</button><button class="linkish" data-cold-all="0">${tr("Untick all")}</button></div>
    <div class="pick-list">${list.map(p => `<label class="pick-row"><input type="checkbox" data-cold="${p.id}" ${GA.coldOn(p) ? "checked" : ""}>
      <span class="pt">${thumbHtml(p)}</span><span><b>${esc(p.name)}</b><small>${hasMin(p) ? tr("takes {t}", {t:deg(p.minTemp)}) : tr("no cold limit set")} · ${esc(areaLabel(p.area))}</small></span></label>`).join("")}</div></details>`;
}
$("#coldPick").addEventListener("change", e => {
  const c = e.target.closest("[data-cold]"); if(!c) return;
  const p = state.plants.find(x => x.id === c.dataset.cold); if(!p) return;
  if(c.checked && !hasMin(p)){ c.checked = false; toast(tr("Set the lowest temperature {name} takes first", {name:p.name})); return; }
  p.coldAlert = c.checked;
  save(); render();
  const list = state.plants.filter(x => x.pattern !== "indoor");
  $("#coldCount").textContent = tr("On for {n} of {total}", {n:list.filter(x => GA.coldOn(x)).length, total:list.length});
});
$("#coldPick").addEventListener("click", e => {
  const b = e.target.closest("[data-cold-all]"); if(!b) return;
  e.preventDefault();
  const on = b.dataset.coldAll === "1"; let skipped = 0;
  state.plants.filter(p => p.pattern !== "indoor").forEach(p => { if(on && !hasMin(p)){ skipped++; return; } p.coldAlert = on; });
  save(); render(); renderColdPick(true);
  if(skipped) toast(trn(skipped, "{n} plant has no cold limit yet", "{n} plants have no cold limit yet"));
});
$("#saveSettings").addEventListener("click", () => {
  const n = (sel, fb) => { const v = parseFloat($(sel).value); return isNaN(v) ? fb : v; };
  const s = state.settings;
  state.settings = {...s,
    margin:n("#sMargin", s.margin), gh:n("#sGh", s.gh), heat:n("#sHeat", s.heat), wind:n("#sWind", s.wind), rain:n("#sRain", s.rain)};
  save(); toast(tr("Settings saved")); fetchWeather(true);
});
$("#exportBtn").addEventListener("click", async () => {
  let allPhotos = [];
  try{ allPhotos = await idb.all(); }catch(e){}
  const blob = new Blob([JSON.stringify({...state, weather:null, photos:allPhotos})], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = `alvor-backup-${today()}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
});
$("#importBtn").addEventListener("click", () => $("#importFile").click());
$("#importFile").addEventListener("change", async e => {
  const f = e.target.files[0]; if(!f) return;
  try{
    const d = JSON.parse(await f.text());
    if(!Array.isArray(d.plants)) throw new Error("bad");
    if(!confirm(tr("Replace what's here with {n} plants from the backup?", {n:d.plants.length}))) return;
    const base = defaults();
    const imported = Array.isArray(d.photos) ? d.photos : null;
    delete d.photos;
    state = {...base, ...d, settings:{...base.settings, ...(d.settings||{})}, weather:null, account:me ? me.id : d.account};
    const idMap = upgradeIds();
    save();
    if(imported){
      try{ await idb.clear(); for(const ph of imported){ delete ph.synced; await idb.put(ph); } }catch(e){ toast(tr("Plants imported, but the photos couldn't be saved")); }
      await upgradePhotoIds(idMap);
      await loadPhotos();
    } fillSettings(); fetchWeather(true); toast(tr("Backup imported"));
  }catch(err){ toast(tr("That file isn't a garden backup")); }
  e.target.value = "";
});
$("#resetBtn").addEventListener("click", () => {
  if(!confirm(token ? tr("Delete all plants and history, on this phone and in your account? Export a backup first if you might want them back.") : tr("Delete all plants and history on this device? Export a backup first if you might want them back."))) return;
  const s = state.settings, acct = state.account; state = defaults(); state.settings = s; if(acct) state.account = acct; save();
  idb.clear().catch(() => {}); photos = {};
  render(); toast(tr("Everything deleted"));
});

/* ---------- Language ----------
   Saved with the settings (same on every phone); "auto" follows each phone. Changing it reloads the app in it.
   settings.langUsed and the account's user_metadata.lang tell the server which language this person reads:
   notifications and the password-reset email follow it. */
function fillLang(){
  const c = state.settings.lang || "auto";
  $("#langSeg").innerHTML = [["auto", tr("Automatic")], ...Object.entries(LANGS)].map(([k, l]) =>
    `<button role="radio" data-lang="${k}" aria-pressed="${k === c}" ${k !== "auto" ? `lang="${k}"` : ""}>${esc(l)}</button>`).join("");
  $("#langHint").textContent = (c === "auto" ? tr("Follows the phone: {lang}.", {lang:LANGS[phoneLang()]}) + " " : "")
    + tr("Notifications and emails from Alvor use it too.");
}
$("#langSeg").addEventListener("click", e => {
  const b = e.target.closest("[data-lang]"); if(!b) return;
  const v = b.dataset.lang; if(v === (state.settings.lang || "auto")) return;
  state.settings.lang = v; state.settings.langUsed = resolveLang(v); save();
  try{ localStorage.setItem(LANG_KEY, v); }catch(e){}
  if(resolveLang(v) !== LANG){ document.body.style.opacity = ".4"; setTimeout(() => location.reload(), 250); }
  else{ fillLang(); toast(tr("Saved")); }
});
/* After a sync: the language was changed on another phone. */
function followAccountLang(){
  const c = state.settings.lang; if(!c || /[?&]lang=/.test(location.search)) return;
  let local = null; try{ local = localStorage.getItem(LANG_KEY); }catch(e){}
  if(c !== local){ try{ localStorage.setItem(LANG_KEY, c); }catch(e){} }
  if(resolveLang(c) !== LANG) location.reload();
}
/* Tells the account which language this phone shows (for notifications and emails). */
function syncLang(){
  if(state.settings.langUsed !== LANG){ state.settings.langUsed = LANG; save(); }
  if(sb && me && token && me.metaLang !== LANG){
    try{ sb.auth.updateUser({data:{lang:LANG}}).then(r => { if(r && !r.error){ me.metaLang = LANG; storeMe(); } }).catch(() => {}); }catch(e){}
  }
}

/* ---------- Welcome setup for new accounts ---------- */
let ONB = null;
const onbEl = () => $("#onb");
function maybeOnboard(){
  if(!online || !token || state.settings.onboarded) return;
  if(state.plants.length){ state.settings.onboarded = true; save(); return; }
  ONB = {step:0, home:state.settings.home || "house", rain:!!state.settings.balconyRain, place:null, results:[], busy:false, msg:"", q:""};
  onbEl().hidden = false; renderOnb();
}
function onbFinish(openAdd){
  state.settings.onboarded = true; state.settings.sharingIntro = true; save();
  onbEl().hidden = true; ONB = null;
  render(); showTab("today");
  if(openAdd) openWizard();
}
function onbPlace(p){
  ONB.place = p; ONB.results = []; ONB.msg = ""; renderOnb();
}
function renderOnb(){
  const O = ONB, body = $("#onbBody");
  if(O.mode) return renderShare();
  $("#onbSteps").innerHTML = [0,1,2,3].map(i => `<span class="${i <= O.step ? "on" : ""}"></span>`).join("");
  $("#onbBack").hidden = O.step === 0 || O.step === 4;
  const who = me && me.user ? me.user.charAt(0).toUpperCase() + me.user.slice(1) : "";
  if(O.step === 0){
    const card = (h, img, t, sub) => `<button class="home-card hc-pic" data-ohome="${h}" aria-pressed="${O.home === h && O.picked ? "true" : "false"}"><img class="hc-photo" src="${img}" alt="" draggable="false"><b>${t}</b><small>${sub}</small></button>`;
    body.innerHTML = `<h1>${who ? tr("Welcome, {name}!", {name:esc(who)}) : tr("Welcome!")}</h1><p class="onb-lead">${tr("Where do your plants live?")}</p>
      <div class="home-cards">${card("house", "loc-home-house.jpg", tr("House with garden"), tr("Garden, porch and greenhouse"))}${card("apartment", "loc-home-apartment.jpg", tr("Apartment"), tr("Inside and a balcony"))}</div>
      ${O.home === "apartment" && O.picked ? `<div class="onb-q"><p><b>${tr("Does rain reach your balcony?")}</b><br><span class="status">${tr("If it does, rain counts as watering for balcony plants.")}</span></p>
        <div class="seg"><button data-orain="1">${tr("Yes")}</button><button data-orain="0">${tr("No, it's covered")}</button></div></div>` : ""}`;
  }
  else if(O.step === 1){
    let html = `<h1>${O.home === "apartment" ? tr("Where is your balcony?") : tr("Where is your garden?")}</h1><p class="onb-lead">${tr("The forecast and all the alerts use this place.")}</p>`;
    if(O.place){
      html += `<div class="loc-now onb-place">${ICON.pin}<span><b>${esc(O.place.name)}</b><small>${esc(O.place.region || `${O.place.lat}, ${O.place.lon}`)}</small></span></div>
        <button class="btn primary wide" data-oact="confirm">${tr("That's right")}</button>
        <button class="linkish" data-oact="again">${tr("Choose another place")}</button>`;
    }else{
      html += `<button class="btn primary wide gps" data-oact="gps" ${O.busy ? "disabled" : ""}>${GPS} ${O.busy ? tr("Finding you…") : tr("Use my current location")}</button>
        <div class="onb-or"><span>${tr("or")}</span></div>
        <div class="field"><label for="onbSearch">${tr("Search a town")}</label><input id="onbSearch" type="search" autocomplete="off" placeholder="${tr("e.g. Lekunberri")}" value="${esc(O.q)}"></div>
        <div class="loc-results">${O.results.map((p, i) => `<button data-ores="${i}"><b>${esc(p.name)}</b><small>${esc([p.admin1, p.country].filter(Boolean).join(", "))}</small></button>`).join("")}</div>`;
    }
    if(O.msg) html += `<p class="status onb-msg">${esc(O.msg)}</p>`;
    body.innerHTML = html;
    const inp = $("#onbSearch");
    if(inp){
      let t = null;
      inp.addEventListener("input", () => {
        O.q = inp.value; clearTimeout(t);
        if(O.q.trim().length < 2){ O.results = []; $("#onbBody .loc-results").innerHTML = ""; return; }
        t = setTimeout(async () => {
          try{
            const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(O.q.trim())}&count=5&language=${LANG}&format=json`);
            O.results = (await r.json()).results || [];
            $("#onbBody .loc-results").innerHTML = O.results.length
              ? O.results.map((p, i) => `<button data-ores="${i}"><b>${esc(p.name)}</b><small>${esc([p.admin1, p.country].filter(Boolean).join(", "))}</small></button>`).join("")
              : `<p class="status" style="margin:0">${tr("No places found. Try another spelling.")}</p>`;
          }catch(e){ $("#onbBody .loc-results").innerHTML = `<p class="status" style="margin:0">${tr("Search isn't working right now. Check your connection.")}</p>`; }
        }, 350);
      });
    }
  }
  else if(O.step === 2){
    body.innerHTML = defaultVisHtml(O, tr("Sharing with friends"), tr("When you have friends on Alvor, who should see the plants you add?"));
  }
  else if(O.step === 3){
    body.innerHTML = `<h1>${tr("Get alerts")}</h1>
      <div class="onb-alerts">
        <div class="onb-alert"><span class="zi a-house">${ICON.sun}</span><p><b>${tr("Every morning at 08:00")}</b><br>${tr("A short summary of what your plants need today.")}</p></div>
        <div class="onb-alert"><span class="zi a-greenhouse">${ICON.snow}</span><p><b>${tr("In the evening at 19:00")}</b><br>${tr("A warning, only when a plant could get too cold that night.")}</p></div>
      </div>
      ${canPush() ? `<button class="btn primary wide" data-oact="notify" ${O.busy ? "disabled" : ""}>${O.busy ? tr("Turning on…") : tr("Turn on notifications")}</button>` : `<p class="status">${tr("Notifications work when the app is opened from your site in Chrome. You can turn them on later in Settings.")}</p>`}
      <button class="linkish" data-oact="later">${canPush() ? tr("Later") : tr("Continue")}</button>
      ${O.msg ? `<p class="status onb-msg">${esc(O.msg)}</p>` : ""}
      <p class="status">${tr("You can change the times in Settings.")}</p>`;
  }
  else{
    body.innerHTML = `<div class="onb-done"><img src="${O.home === "apartment" ? "loc-home-apartment.jpg" : "loc-home-house.jpg"}" alt=""><h1>${tr("You're all set")}</h1>
      <p class="onb-lead">${tr("Start with one plant. Take a photo and the app suggests what it is.")}</p>
      <button class="btn primary wide" data-oact="first">${tr("Add my first plant")}</button>
      <button class="linkish" data-oact="done">${tr("Later")}</button></div>`;
  }
}
$("#onbBody").addEventListener("click", async e => {
  const O = ONB; if(!O) return;
  if(await shareClick(e, O)) return;
  const h = e.target.closest("[data-ohome]"), rn = e.target.closest("[data-orain]"), rs = e.target.closest("[data-ores]"), a = e.target.closest("[data-oact]");
  if(h){
    O.home = h.dataset.ohome; O.picked = true;
    state.settings.home = O.home; normalizePlants(); saveLocal();
    if(O.home === "house"){ O.step = 1; }
    renderOnb(); return;
  }
  if(rn){
    O.rain = rn.dataset.orain === "1";
    state.settings.balconyRain = O.rain; normalizePlants(); saveLocal();
    O.step = 1; renderOnb(); return;
  }
  if(rs){
    const p = O.results[+rs.dataset.ores];
    onbPlace({name:p.name, lat:round2(p.latitude), lon:round2(p.longitude), region:[p.admin1, p.country].filter(Boolean).join(", ")});
    return;
  }
  if(!a) return;
  const act = a.dataset.oact;
  if(act === "gps"){
    O.busy = true; O.msg = ""; renderOnb();
    try{
      const pos = await getPosition();
      const name = await placeName(pos.lat, pos.lon);
      O.busy = false; onbPlace({name:name || tr("My place"), lat:pos.lat, lon:pos.lon, region:name ? `${pos.lat}, ${pos.lon}` : ""});
    }catch(err){ O.busy = false; O.msg = err.message + " " + tr("Search your town instead."); renderOnb(); }
  }
  else if(act === "again"){ O.place = null; renderOnb(); }
  else if(act === "confirm"){
    const st = state.settings;
    st.saved = {name:O.place.name, lat:O.place.lat, lon:O.place.lon}; st.locMode = "saved";
    useActiveLocation(); save(); fetchWeather(true);
    O.step = 2; O.msg = ""; O.vis = null; renderOnb();
  }
  else if(act === "notify"){
    O.busy = true; O.msg = ""; renderOnb();
    const ok = await enableNotifications();
    O.busy = false;
    if(ok){ O.step = 4; } else O.msg = $("#notifyStatus").textContent;
    renderOnb();
  }
  else if(act === "later"){ O.step = 4; O.msg = ""; renderOnb(); }
  else if(act === "first") onbFinish(true);
  else if(act === "done") onbFinish(false);
});
$("#onbBack").addEventListener("click", () => {
  if(ONB && ONB.mode){ shareBack(); return; }
  if(!ONB || ONB.step === 0) return; ONB.step--; ONB.msg = ""; if(ONB.step === 0) ONB.picked = true; renderOnb(); });

/* ---------- Sharing: default for new plants, and the one-time screen for existing gardens ---------- */
const shareWhatHtml = () => `<div class="share-what">
  <div><b>${ICON.people}${tr("Friends see")}</b>${tr("Name, species, spot, photos and how it's growing")}</div>
  <div><b>${ICON.lock}${tr("Never shared")}</b>${tr("Your notes, watering and exact location")}</div></div>`;
function visCard(k, sel){
  const t = k === "friends" ? [tr("Friends"), tr("They see the plants you add")] : [tr("Only me"), tr("New plants go to your Vault. Share them one by one.")];
  return `<button class="home-card vis-card" data-ovis="${k}" aria-pressed="${sel === k}"><span class="vis-big">${VIS[k].icon}</span><b>${t[0]}</b><small>${t[1]}</small></button>`;
}
function defaultVisHtml(O, title, lead){
  return `<h1>${title}</h1><p class="onb-lead">${lead}</p>
    <div class="home-cards">${visCard("friends", O.vis)}${visCard("vault", O.vis)}</div>
    ${O.mode ? `<div style="height:16px"></div>` : shareWhatHtml()}
    <button class="btn primary wide" data-oact="setVis" ${O.vis ? "" : "disabled"}>${tr("Continue")}</button>
    ${O.msg ? `<p class="status onb-msg">${esc(O.msg)}</p>` : ""}
    <p class="status">${tr("You can change it for any plant, any time, in its edit screen.")}</p>`;
}
const storeMe = () => { try{ localStorage.setItem(USER_KEY, JSON.stringify(me)); }catch(e){} };
async function setDefaultVis(v){
  if(!me || !VIS[v]) return false;
  me.defaultVisibility = v; storeMe();
  try{ must(await sb.from("accounts").update({default_visibility:v}).eq("id", me.id)); return true; }
  catch(e){ if(isAuthErr(e)) sessionExpired(); else toast(tr("Couldn't save that to your account. Try again in Settings.")); return false; }
}
/* Share exactly the plants in the set; the rest go to (or stay in) the Vault. */
function applyShareSet(sel){
  let n = 0;
  state.plants.forEach(p => {
    const v = sel.has(p.id) ? "friends" : "vault";
    if(visOf(p) !== v){ p.visibility = v; n++; }
  });
  if(n) save();
  return n;
}
function maybeShareIntro(){
  if(!online || !token || !me || ONB || !state.settings.onboarded || state.settings.sharingIntro) return;
  ONB = {mode:"intro", step:state.plants.length ? "share" : "default", vis:null, msg:"",
    sel:new Set(state.plants.filter(p => visOf(p) === "friends").map(p => p.id))};
  onbEl().hidden = false; renderOnb();
}
function openShareChooser(){
  if(!online || !me) return;
  ONB = {mode:"choose", step:"choose", msg:"", sel:new Set(state.plants.filter(p => visOf(p) === "friends").map(p => p.id))};
  onbEl().hidden = false; renderOnb();
}
function shareDone(msg){
  if(ONB && ONB.mode === "intro"){ state.settings.sharingIntro = true; save(); }
  onbEl().hidden = true; ONB = null;
  render(); if(currentTab === "settings") fillSettings();
  if(msg) toast(msg);
}
function renderShare(){
  const O = ONB, body = $("#onbBody");
  $("#onbSteps").innerHTML = "";
  $("#onbBack").hidden = O.mode === "intro" ? O.step === "share" || !state.plants.length : false;
  if(O.step === "share"){
    const n = state.plants.length, vault = state.plants.filter(p => visOf(p) === "vault").length;
    body.innerHTML = `<h1>${tr("Share your garden with friends")}</h1>
      <p class="onb-lead">${tr("Friends on Alvor can now see the plants you choose.")} ${vault === n ? tr("For now all your plants are in your Vault: only you see them.") : tr("{n} of your {total} plants are in your Vault: only you see them.", {n:vault, total:n})}</p>
      ${shareWhatHtml()}
      <button class="btn primary wide" data-oact="shareAll">${trn(n, "Share {n} plant", "Share all {n} plants")}</button>
      <button class="btn wide" data-oact="choose">${tr("Choose which")}</button>
      <button class="linkish" data-oact="notNow">${tr("Not now")}</button>`;
  }
  else if(O.step === "choose"){
    const list = [...state.plants].sort((a, b) => a.name.localeCompare(b.name)), k = O.sel.size;
    body.innerHTML = `<h1>${tr("Choose what friends see")}</h1>
      <p class="onb-lead">${tr("Ticked plants are visible to friends. The rest stay in your Vault, with all their alerts.")}</p>
      <div class="pick-tools"><button class="linkish" data-oact="pickAll">${tr("Tick all")}</button><button class="linkish" data-oact="pickNone">${tr("Untick all")}</button></div>
      <div class="pick-list">${list.map(p => `<label class="pick-row"><input type="checkbox" data-pick="${p.id}" ${O.sel.has(p.id) ? "checked" : ""}>
        <span class="pt">${thumbHtml(p)}</span><span><b>${esc(p.name)}</b><small>${esc(areaLabel(p.area))}</small></span></label>`).join("")}</div>
      <button class="btn primary wide" data-oact="saveChoice">${k ? trn(k, "Share {n} plant", "Share {n} plants") : tr("Keep them all in the Vault")}</button>`;
  }
  else{
    body.innerHTML = defaultVisHtml(O, tr("And the plants you add from now on?"), tr("Pick who sees new plants. You can still change each one."));
  }
}
function shareBack(){
  const O = ONB; if(!O) return;
  if(O.mode === "choose"){ onbEl().hidden = true; ONB = null; return; }
  if(O.step !== "share" && state.plants.length){ O.step = "share"; O.msg = ""; renderOnb(); }
}
/* Handles taps shared by the welcome setup and the sharing screens. Returns true when handled. */
async function shareClick(e, O){
  const pick = e.target.closest("[data-pick]"), ov = e.target.closest("[data-ovis]"), a = e.target.closest("[data-oact]");
  if(pick){ pick.checked ? O.sel.add(pick.dataset.pick) : O.sel.delete(pick.dataset.pick); const b = $("#onbBody [data-oact=saveChoice]"), k = O.sel.size;
    if(b) b.textContent = k ? trn(k, "Share {n} plant", "Share {n} plants") : tr("Keep them all in the Vault"); return true; }
  if(ov){ O.vis = ov.dataset.ovis; O.msg = ""; renderOnb(); return true; }
  if(!a) return false;
  const act = a.dataset.oact;
  if(act === "setVis"){
    if(!O.vis) return true;
    a.disabled = true;
    await setDefaultVis(O.vis);
    if(O.mode === "intro" && O.apply) applyShareSet(O.apply);
    if(O.mode === "intro") shareDone(O.vis === "friends" ? tr("New plants will be visible to friends") : tr("New plants will go to your Vault"));
    else { O.step = 3; O.msg = ""; renderOnb(); }
    return true;
  }
  if(!O.mode) return false;
  if(act === "shareAll"){ O.apply = new Set(state.plants.map(p => p.id)); O.step = "default"; O.vis = "friends"; renderOnb(); }
  else if(act === "choose"){ O.step = "choose"; renderOnb(); }
  else if(act === "notNow"){ O.apply = null; O.step = "default"; O.vis = null; renderOnb(); }
  else if(act === "pickAll"){ state.plants.forEach(p => O.sel.add(p.id)); renderOnb(); }
  else if(act === "pickNone"){ O.sel.clear(); renderOnb(); }
  else if(act === "saveChoice"){
    const k = O.sel.size;
    if(O.mode === "choose"){ const n = applyShareSet(O.sel); shareDone(n ? (k ? trn(k, "{n} plant visible to friends", "{n} plants visible to friends") : tr("All plants are in your Vault")) : tr("Nothing changed")); }
    else { O.apply = new Set(O.sel); O.step = "default"; O.vis = k ? "friends" : null; renderOnb(); }
  }
  return true;
}

/* ---------- Profile ---------- */
const avatarUrl = path => `${SUPABASE_URL}/storage/v1/object/public/avatars/${path.split("/").map(encodeURIComponent).join("/")}`;
const initialOf = () => esc(((me && (me.name || me.user)) || "?").trim().charAt(0).toUpperCase());
const avatarHtml = () => me && me.avatar ? `<img src="${avatarUrl(me.avatar)}" alt="">` : initialOf();
const USERNAME_RE = /^[a-z0-9._-]{3,24}$/;
function fillProfileCard(){
  const show = online && !!me;
  $("#profCard").hidden = !show;
  if(!show) return;
  $("#profAv").innerHTML = avatarHtml();
  $("#profName").textContent = me.name || me.user;
  $("#profUser").textContent = "@" + me.user;
}
function fillProfile(){
  if(!online || !me){ showTab("settings"); return; }
  $("#pAv").innerHTML = avatarHtml();
  $("#pAvDel").hidden = !me.avatar;
  $("#pName").value = me.name || "";
  $("#pUser").value = me.user || "";
}
$("#pSave").addEventListener("click", async () => {
  const name = $("#pName").value.trim().replace(/\s+/g, " "), user = $("#pUser").value.trim().toLowerCase().replace(/^@/, "");
  if(!name){ toast(tr("Add your name")); $("#pName").focus(); return; }
  if(name.length > 40){ toast(tr("Keep your name under 40 characters")); return; }
  if(!USERNAME_RE.test(user)){ toast(tr("Use 3 to 24 letters, numbers, dots or dashes for your @username")); $("#pUser").focus(); return; }
  const btn = $("#pSave"); btn.disabled = true;
  try{
    const {error} = await sb.from("profiles").update({display_name:name, username:user}).eq("id", me.id);
    if(error){
      if(error.code === "23505") toast(tr("That @username is already taken"));
      else if(error.code === "23514") toast(tr("That @username can't be used. Try letters and numbers only."));
      else if(isAuthErr(error)) sessionExpired();
      else toast(tr("Couldn't save. Check your connection."));
      return;
    }
    me.name = name; me.user = user; storeMe();
    $("#pUser").value = user; fillProfileCard(); fillAccount();
    toast(tr("Profile saved"));
  }catch(e){ toast(tr("Couldn't save. Check your connection.")); }
  finally{ btn.disabled = false; }
});
/* Profile photo: a 320 px square, cut from the middle of the picture. */
async function squareJpeg(file, size){
  const url = URL.createObjectURL(file);
  try{
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    const w = img.naturalWidth, h = img.naturalHeight, side = Math.min(w, h);
    const c = document.createElement("canvas"); c.width = c.height = size;
    c.getContext("2d").drawImage(img, (w - side) / 2, (h - side) / 2, side, side, 0, 0, size, size);
    return await new Promise(res => c.toBlob(res, "image/jpeg", 0.85));
  }finally{ URL.revokeObjectURL(url); }
}
$("#pAvBtn").addEventListener("click", () => $("#pAvFile").click());
$("#pAvFile").addEventListener("change", async e => {
  const f = e.target.files[0]; e.target.value = ""; if(!f || !me) return;
  const btn = $("#pAvBtn"); btn.disabled = true; btn.textContent = tr("Saving…");
  try{
    const blob = await squareJpeg(f, 320);
    const path = `${me.id}/avatar-${Date.now()}.jpg`, store = sb.storage.from("avatars");
    must(await store.upload(path, blob, {contentType:"image/jpeg", upsert:false}));
    must(await sb.from("profiles").update({avatar_path:path}).eq("id", me.id));
    const old = me.avatar; me.avatar = path; storeMe();
    if(old && old !== path) store.remove([old]).catch(() => {});
    fillProfile(); fillProfileCard(); toast(tr("Photo saved"));
  }catch(err){ if(isAuthErr(err)) sessionExpired(); else toast(tr("Couldn't save the photo. Try again.")); }
  finally{ btn.disabled = false; btn.textContent = tr("Change photo"); }
});
$("#pAvDel").addEventListener("click", async () => {
  if(!me || !me.avatar || !confirm(tr("Remove your profile photo?"))) return;
  try{
    must(await sb.from("profiles").update({avatar_path:null}).eq("id", me.id));
    sb.storage.from("avatars").remove([me.avatar]).catch(() => {});
    me.avatar = null; storeMe(); fillProfile(); fillProfileCard(); toast(tr("Photo removed"));
  }catch(e){ if(isAuthErr(e)) sessionExpired(); else toast(tr("Couldn't remove it. Check your connection.")); }
});

/* ---------- Privacy settings ---------- */
function fillPrivacy(){
  const show = online && !!me;
  $("#privCard").hidden = !show;
  if(!show) return;
  const v = defaultVis();
  $("#defVisSeg").innerHTML = ["friends","vault"].map(k => `<button role="radio" data-defvis="${k}" aria-pressed="${k === v}">${VIS[k].icon}${VIS[k].short}</button>`).join("");
  $("#defVisHint").textContent = v === "friends" ? tr("Friends see new plants as soon as you add them.") : tr("New plants go to your Vault. Only you see them until you share them.");
  $("#chooseShareBtn").hidden = !state.plants.length;
  $("#findable").checked = !!me.findable;
}
$("#defVisSeg").addEventListener("click", async e => {
  const b = e.target.closest("[data-defvis]"); if(!b || b.dataset.defvis === defaultVis()) return;
  if(await setDefaultVis(b.dataset.defvis)) toast(tr("Saved"));
  fillPrivacy();
});
$("#chooseShareBtn").addEventListener("click", openShareChooser);
$("#findable").addEventListener("change", async e => {
  const v = e.target.checked;
  try{
    must(await sb.from("accounts").update({findable:v}).eq("id", me.id));
    me.findable = v; storeMe();
    toast(v ? tr("People can find you by name") : tr("Only people with your link can add you"));
  }catch(err){ e.target.checked = !v; if(isAuthErr(err)) sessionExpired(); else toast(tr("Couldn't save. Check your connection.")); }
});
