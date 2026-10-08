/* Alvor · Shared basics: icons, who sees a plant, the saved state, care values for a species, sync bookkeeping.
   Plain script (no build step): loaded by index.html in a fixed order and sharing one global scope. */
"use strict";
const KEY = "garden-tracker-v1";
const GA = window.GardenAlerts;
const {PRESETS} = GA;
const SV = (inner, extra = "") => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" ${extra}>${inner}</svg>`;
const ICON = {
  house:SV('<path d="M3.5 11 12 4l8.5 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M10 20v-5h4v5"/>'),
  porch:SV('<path d="M2.5 9.5 12 5l9.5 4.5"/><path d="M4.5 9v11M19.5 9v11"/><path d="M3 20h18"/><path d="M9 20v-3.5h6V20"/>'),
  outside:SV('<path d="M12 21v-6"/><path d="M12 15c-4.5 0-6.5-3-5.5-6.2C7.3 6 9.5 4 12 4s4.7 2 5.5 4.8c1 3.2-1 6.2-5.5 6.2z"/><path d="M4 21h16"/>'),
  greenhouse:SV('<path d="M3 21V10l9-6 9 6v11z"/><path d="M12 4v17M3 14.5h18M7.5 7v14M16.5 7v14"/>'),
  balcony:SV('<path d="M3 13h18M3 13v8M21 13v8M3 21h18M7.5 13v8M12 13v8M16.5 13v8"/><path d="M12 13V9"/><path d="M12 10c-1.3-2.6-3.8-3-5-2.2.7 2 3 3 5 2.2zM12 10c1.3-2.6 3.8-3 5-2.2-.7 2-3 3-5 2.2z"/>'),
  window:SV('<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M12 3v18M5 12h14"/>'),
  low:SV('<path d="M19.5 14.5A7.5 7.5 0 1 1 9.5 4.5a6 6 0 0 0 10 10z"/>'),
  cabinet:SV('<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M5 9h14M5 15h14"/><path d="M8 6h8"/>'),
  sun:SV('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4"/>'),
  partial:SV('<circle cx="9" cy="9" r="3.2"/><path d="M9 2.5v1.3M2.5 9h1.3M4.4 4.4l.9.9M13.6 4.4l-.9.9"/><path d="M8.5 19h9a3.3 3.3 0 0 0 .4-6.6 4.5 4.5 0 0 0-8.4 1.3A2.7 2.7 0 0 0 8.5 19z"/>'),
  shade:SV('<path d="M12 21v-5"/><path d="M12 16c-5 0-7-3.2-6-6.5C6.8 6.3 9.2 4 12 4s5.2 2.3 6 5.5c1 3.3-1 6.5-6 6.5z"/><path d="M8 21h8" stroke-dasharray="1.5 2"/>'),
  pot:SV('<path d="M6 12h12l-1.6 9H7.6z"/><path d="M12 12V7"/><path d="M12 8.5C10.5 5.5 7.5 5 6 6c.8 2.4 3.8 3.5 6 2.5zM12 8.5c1.5-3 4.5-3.5 6-2.5-.8 2.4-3.8 3.5-6 2.5z"/>'),
  ground:SV('<path d="M2.5 20h19"/><path d="M12 20v-7"/><path d="M12 14.5C10 10.5 6 10 4.5 11.5c1 3 5 4.5 7.5 3zM12 13c2-4 6-4.5 7.5-3-1 3-5 4.5-7.5 3z"/>'),
  leaf:SV('<path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z"/><path d="M5 19l7-7"/>'),
  sprout:SV('<path d="M12 21v-8"/><path d="M12 13C12 8 8.5 6 4.5 6.5 4.5 10.5 7.5 13 12 13zM12 11c0-4 3-6.5 7.5-6.5 0 4-3 6.5-7.5 6.5z"/>'),
  calendar:SV('<rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M4 10h16M8.5 3v4M15.5 3v4"/><circle cx="12" cy="15" r="1.2" fill="currentColor"/>'),
  clock:SV('<path d="M3.5 12a8.5 8.5 0 1 0 2.5-6"/><path d="M3 4v4.2h4.2"/><path d="M12 7.5V12l3 2"/>'),
  gear:SV('<circle cx="12" cy="12" r="3"/><path d="M12 2.8l1.6 2.3 2.8-.5.5 2.8 2.3 1.6-1.2 2.5 1.2 2.5-2.3 1.6-.5 2.8-2.8-.5L12 21.2l-1.6-2.3-2.8.5-.5-2.8-2.3-1.6L6 12.5 4.8 10l2.3-1.6.5-2.8 2.8.5z"/>'),
  plus:SV('<path d="M12 5v14M5 12h14"/>'),
  camera:SV('<path d="M4 8.5h3.2L9 6h6l1.8 2.5H20V19H4z"/><circle cx="12" cy="13.3" r="3.4"/>'),
  drop:SV('<path d="M12 3.5s6 6.4 6 10.6a6 6 0 0 1-12 0C6 9.9 12 3.5 12 3.5z"/>'),
  snow:SV('<path d="M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6"/><path d="M9.5 3.8 12 6l2.5-2.2M9.5 20.2 12 18l2.5 2.2"/>'),
  heat:SV('<path d="M14 14.8V5a2 2 0 0 0-4 0v9.8a3.5 3.5 0 1 0 4 0z"/><path d="M12 8v8"/><path d="M18 5.5h2.5M18 9h2.5"/>'),
  wind:SV('<path d="M3 9h11a3 3 0 1 0-3-3"/><path d="M3 13h15a3 3 0 1 1-3 3"/><path d="M3 17h7"/>'),
  move:SV('<path d="M7 7h11l-3-3M17 17H6l3 3"/>'),
  list:SV('<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1" fill="currentColor"/><circle cx="4.5" cy="12" r="1" fill="currentColor"/><circle cx="4.5" cy="18" r="1" fill="currentColor"/>'),
  grid:SV('<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>'),
  back:SV('<path d="M15 5l-7 7 7 7"/>'),
  pin:SV('<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'),
  lock:SV('<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3"/><circle cx="12" cy="15.5" r="1.2" fill="currentColor"/>'),
  people:SV('<circle cx="9" cy="8.5" r="3.2"/><path d="M3 20c0-3.6 2.7-6 6-6s6 2.4 6 6"/><circle cx="17" cy="9.5" r="2.5"/><path d="M16 14.2c2.9.2 5 2.3 5 5.3"/>'),
  eyeOff:SV('<path d="M3 3l18 18"/><path d="M10.6 5.6A10.5 10.5 0 0 1 12 5.5c5.5 0 9 6.5 9 6.5a17 17 0 0 1-2.7 3.4M6.6 6.7C4.2 8.3 3 12 3 12s3.5 6.5 9 6.5a8.6 8.6 0 0 0 4.3-1.1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>'),
  check:SV('<path d="M4.5 12.5l5 5 10-11"/>')
};
/* Who sees a plant. "Everyone" comes later, when Alvor opens up. */
const VIS = {
  friends:{label:tr("Friends"), short:tr("Friends"), icon:ICON.people, hint:tr("Friends see its name, species, spot and photos. Never your notes or watering.")},
  vault:{label:tr("Only me (Vault)"), short:tr("Only me"), icon:ICON.lock, hint:tr("Only you see it. It stays in its spot with all its alerts.")},
  everyone:{label:tr("Everyone"), short:tr("Everyone"), icon:ICON.people, hint:tr("Anyone on Alvor can see it.")}
};
const visOf = p => VIS[p && p.visibility] ? p.visibility : "vault";
const AREAS = {
  house:{label:tr("House"), hint:tr("Inside the house"), zones:["house-window","house-low","house-cabinet"]},
  porch:{label:tr("Porch"), hint:tr("Covered, rain doesn't reach"), zones:["porch-partial","porch-shade"]},
  outside:{label:tr("Outside"), hint:tr("In the open garden"), zones:["out-sun","out-partial","out-shade"]},
  greenhouse:{label:tr("Greenhouse"), hint:tr("Sheltered, a few degrees warmer"), zones:["greenhouse"]},
  balcony:{label:tr("Balcony"), hint:tr("Outside on the balcony"), zones:["balc-sun","balc-partial","balc-shade"]}
};
const ALL_AREAS = ["house","balcony","porch","outside","greenhouse"];
const isApt = () => state.settings.home === "apartment";
const areaOrder = () => isApt() ? ["house","balcony"] : ["house","porch","outside","greenhouse"];
const areaLabel = a => a === "house" && isApt() ? tr("Inside") : AREAS[a].label;
const areaHint = a => a === "house" && isApt() ? tr("Inside the apartment") : AREAS[a].hint;
function defaultZone(pattern){ return isApt() ? (pattern === "indoor" ? "house-window" : "balc-sun") : DEFAULT_ZONE[pattern]; }
function defaultPlanting(pattern){ return isApt() ? "pot" : DEFAULT_PLANTING[pattern]; }
function patternOptions(){
  return isApt()
    ? `<option value="indoor">${tr("Inside all year")}</option><option value="outdoor">${tr("On the balcony all year")}</option><option value="mover">${tr("Balcony in summer, inside in winter")}</option>`
    : `<option value="indoor">${tr("Inside all year")}</option><option value="outdoor">${tr("Outside all year")}</option><option value="mover">${tr("Outside in summer, inside in winter")}</option><option value="greenhouse">${tr("Outside in summer, greenhouse in winter")}</option>`;
}
const ZONES = {
  "house-window": {area:"house", light:"window", icon:"window", label:tr("By a window"), short:tr("Window"), hint:tr("Inside, in good light")},
  "house-low":    {area:"house", light:"low", icon:"low", label:tr("Low light"), short:tr("Low light"), hint:tr("Inside, away from the windows")},
  "house-cabinet":{area:"house", light:"cabinet", icon:"cabinet", label:tr("Grow cabinet"), short:tr("Grow cabinet"), hint:tr("Under grow lights")},
  "porch-partial":{area:"porch", light:"partial", icon:"partial", label:tr("Porch, partial sun"), short:tr("Partial sun"), hint:tr("Some direct sun during the day")},
  "porch-shade":  {area:"porch", light:"shade", icon:"shade", label:tr("Porch, shade"), short:tr("Shade"), hint:tr("Little or no direct sun")},
  "out-sun":      {area:"outside", light:"sun", icon:"sun", label:tr("Outside, sun"), short:tr("Sun"), hint:tr("Sun most of the day")},
  "out-partial":  {area:"outside", light:"partial", icon:"partial", label:tr("Outside, partial sun"), short:tr("Partial sun"), hint:tr("Sun for part of the day")},
  "out-shade":    {area:"outside", light:"shade", icon:"shade", label:tr("Outside, shade"), short:tr("Shade"), hint:tr("Mostly in shade")},
  "greenhouse":   {area:"greenhouse", light:null, icon:"greenhouse", label:tr("Greenhouse"), short:tr("Greenhouse"), hint:tr("Sheltered, a few degrees warmer")},
  "balc-sun":     {area:"balcony", light:"sun", icon:"sun", label:tr("Balcony, sun"), short:tr("Sun"), hint:tr("Sun most of the day")},
  "balc-partial": {area:"balcony", light:"partial", icon:"partial", label:tr("Balcony, partial sun"), short:tr("Partial sun"), hint:tr("Sun for part of the day")},
  "balc-shade":   {area:"balcony", light:"shade", icon:"shade", label:tr("Balcony, shade"), short:tr("Shade"), hint:tr("Mostly in shade")}
};
const ZONE_ORDER = Object.keys(ZONES);
const DEFAULT_ZONE = {indoor:"house-window", outdoor:"out-sun", mover:"out-sun", greenhouse:"out-sun"};
const DEFAULT_PLANTING = {indoor:"pot", outdoor:"ground", mover:"pot", greenhouse:"pot"};
const areaOf = z => (ZONES[z] || {}).area || z;
const zi = z => `<span class="zi a-${areaOf(z)}">${ICON[(ZONES[z] || {}).icon || z] || ""}</span>`;
const canGround = z => ZONES[z] && (ZONES[z].area === "outside" || ZONES[z].area === "greenhouse");
const zoneLabel = p => ZONES[p.zone].label + (canGround(p.zone) ? (p.planting === "ground" ? tr(", in the ground") : tr(", in a pot")) : "");
const OLD_ZONES = {window:"house-window", shade:"house-low", covered:"porch-partial", pots:"out-sun", potsShade:"out-shade", ground:"out-sun"};
function zoneFromOld(p){
  if(OLD_ZONES[p.zone]) return OLD_ZONES[p.zone];
  if(p.current === "inside") return "house-window";
  if(p.current === "greenhouse") return "greenhouse";
  return p.rainCounts === false ? "porch-partial" : "out-sun";
}
/* The alert engine reads current / planting / rainCounts / sun, so keep them in step with the spot. */
function applyZone(p, z, planting){
  const Z = ZONES[z];
  p.zone = z; p.area = Z.area; p.light = Z.light;
  p.current = Z.area === "house" ? "inside" : Z.area === "greenhouse" ? "greenhouse" : "outside";
  p.planting = canGround(z) ? (planting || p.planting || "pot") : "pot";
  p.rainCounts = Z.area === "outside" || (Z.area === "balcony" && !!state.settings.balconyRain);
  p.sun = Z.light === "sun" ? "full" : Z.light === "partial" ? "partial" : "none";
}
function normalizePlants(){
  state.plants.forEach(p => {
    if(ZONES[p.zone]) applyZone(p, p.zone, p.planting);
    else applyZone(p, zoneFromOld(p), p.zone === "ground" ? "ground" : p.planting);
  });
}

const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const uid = () => (crypto.randomUUID ? crypto.randomUUID()
  : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)));
/* Plants made before the move to Supabase had short ids; the database needs UUIDs.
   The same old id always becomes the same UUID, so every phone upgrades a plant to the same id. */
function idFromOld(s){
  let h = "";
  for(let k = 0; k < 4; k++){
    let x = (0x811c9dc5 ^ Math.imul(k + 1, 0x9e3779b9)) >>> 0;
    for(const c of String(s) + "#" + k){ x ^= c.charCodeAt(0); x = Math.imul(x, 0x01000193) >>> 0; }
    h += x.toString(16).padStart(8, "0");
  }
  return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;
}
function upgradeIds(){
  const map = {};
  state.plants.forEach(p => { if(!UUID_RE.test(String(p.id))){ const n = idFromOld(p.id); map[p.id] = n; p.id = n; } });
  if(!Object.keys(map).length) return null;
  state.log.forEach(l => { if(map[l.plantId]) l.plantId = map[l.plantId]; });
  saveLocal();
  return map;
}
async function upgradePhotoIds(map){
  try{
    for(const ph of await idb.all()){
      let changed = false;
      if(map && map[ph.plantId]){ ph.plantId = map[ph.plantId]; changed = true; }
      if(!UUID_RE.test(String(ph.id))){ await idb.del(ph.id); ph.id = idFromOld(ph.id); changed = true; }
      if(changed) await idb.put(ph);
    }
  }catch(e){}
}
const pad = n => String(n).padStart(2,"0");
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const today = () => ymd(new Date());
const parseDay = s => new Date(s + "T12:00:00");
const daysBetween = (a,b) => Math.round((parseDay(b) - parseDay(a)) / 86400000);
const dayName = s => s === today() ? tr("Today") : parseDay(s).toLocaleDateString(LOCALE,{weekday:"short"});
const longDay = s => s === today() ? tr("today") : parseDay(s).toLocaleDateString(LOCALE,{weekday:"long"});
const deg = n => `${Math.round(n)}°`;
/* ---------- Care values for a species ---------- */
/* hardiness.js gives the cold limit for every genus in the species list and many species.
   PRESETS (alerts.js) add watering and notes for the plants Alvor started with. */
const PAT = {o:"outdoor", m:"mover", g:"greenhouse", i:"indoor"};
const patFor = min => min <= -5 ? "outdoor" : min >= 10 ? "indoor" : "mover";
const HARDY = (() => {
  const m = {};
  for(const [k, v] of Object.entries(window.HARDINESS || {})){
    const [min, pat, note] = Array.isArray(v) ? v : [v];
    m[k.toLowerCase()] = {s:k, min, pat:PAT[pat] || patFor(min), note:note || ""};
  }
  return m;
})();
/* "Musa basjoo 'Sakhalin'" → "musa basjoo"; "Abelia × grandiflora" → "abelia x grandiflora" */
function speciesKey(s){
  const w = String(s || "").toLowerCase().replace(/×/g, "x").replace(/['"‘’“”].*$/, "").trim().split(/\s+/).filter(Boolean);
  return (w[1] === "x" ? w.slice(0, 3) : w.slice(0, 2)).join(" ");
}
/* Exact species first, then its genus. how: "species" | "genus" (only the genus was given) | "related" (filled in from the genus) */
function findPreset(species, genus){
  const sp = speciesKey(species), g = String(genus || "").trim().toLowerCase().split(/\s+/)[0] || sp.split(" ")[0];
  if(!sp && !g) return null;
  const byGenus = g ? PRESETS.find(p => p.s.toLowerCase().split(/[ (]/)[0] === g) : null;
  const water = byGenus ? {ws:byGenus.ws, ww:byGenus.ww} : {};
  const exact = sp && PRESETS.find(p => p.s.toLowerCase() === sp);
  if(exact) return {...exact, how:"species"};
  const oneWord = !sp.includes(" ");
  if(!oneWord && HARDY[sp]) return {...HARDY[sp], ...water, how:"species"};
  if(HARDY[g]) return {...HARDY[g], ...water, how:oneWord ? "genus" : "related"};
  if(byGenus) return {...byGenus, how:"related"};
  return null;
}
const presetFor = s => findPreset(s, "");
/* Cold warnings start switched on, except for very hardy plants. */
const COLD_DEFAULT_OFF = -15;
const coldDefault = min => !(isFinite(parseFloat(min)) && parseFloat(min) <= COLD_DEFAULT_OFF);
const hasMin = p => p.minTemp !== null && p.minTemp !== undefined && p.minTemp !== "" && isFinite(+p.minTemp);
function coldTag(p){
  if(GA.coldOn(p)) return `<span class="tag">${tr("takes {t}", {t:deg(p.minTemp)})}</span>`;
  return `<span class="tag off" title="${tr("Low temperature warnings are off for this plant")}">${hasMin(p) ? tr("takes {t}", {t:deg(p.minTemp)}) + ", " : ""}${tr("no low temp alerts")}</span>`;
}

let state = load();
normalizePlants();
let currentTab = "today";
let plantFilter = "all";
let editingId = null;

function defaults(){
  return {
    settings:{home:"house", balconyRain:false, place:"Lekunberri", lat:43.0014, lon:-1.8908, margin:2, gh:3, heat:32, wind:55, rain:5, morningHour:8, eveningHour:19, eveningCheck:true, tz:"Europe/Madrid"},
    plants:[], log:[], weather:null, updatedAt:0
  };
}
function load(){
  try{
    const raw = localStorage.getItem(KEY);
    if(!raw) return defaults();
    const d = JSON.parse(raw), base = defaults();
    return {...base, ...d, settings:{...base.settings, ...(d.settings||{})}};
  }catch(e){ return defaults(); }
}
function saveLocal(){
  try{ localStorage.setItem(KEY, JSON.stringify(state)); }
  catch(e){ toast(tr("Couldn't save. Export a backup to be safe.")); }
}
/* Sync bookkeeping (the rules are in sync.js): what changed or was deleted on this phone since the last save.
   Kept apart from the garden, tied to the account it belongs to. */
const META_KEY = "garden-sync-meta";
let syncMetaCache = null;
function syncMeta(){
  const acct = state.account || null;
  if(!syncMetaCache){ try{ syncMetaCache = JSON.parse(localStorage.getItem(META_KEY) || "null"); }catch(e){} }
  if(!syncMetaCache || syncMetaCache.v !== 1 || syncMetaCache.account !== acct){
    syncMetaCache = GS.fresh(acct, state.plants, state.settings, state.updatedAt || 0);
    writeMeta(); saveLocal();
  }
  return syncMetaCache;
}
function writeMeta(){ try{ localStorage.setItem(META_KEY, JSON.stringify(syncMetaCache)); }catch(e){} }
/* After the app tidies its own data (on start, after a download): that isn't a change to send. */
function rebaseSync(){ GS.rebase(syncMeta(), state.plants, state.settings); writeMeta(); }
function save(){
  state.updatedAt = Date.now();
  GS.stamp(syncMeta(), state.plants, state.settings, Date.now()); writeMeta();
  saveLocal(); queueSync();
}
function toast(msg){
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 2200);
}
function addLog(plantId, type, detail){
  state.log.unshift({t:new Date().toISOString(), plantId, type, detail});
  if(state.log.length > 2000) state.log.length = 2000;
}
