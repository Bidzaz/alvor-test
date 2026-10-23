/* Alvor · Today's frame (the weather line, the week ahead with its jobs) and Garden (the places, how warm they stay).
   What to do today (the decision, Walk the garden, the morning after) is in js/today.js.
   Plain script (no build step): loaded by index.html in a fixed order and sharing one global scope. */
"use strict";
/* ---------- Render ---------- */
/* "Updated 14:02", naming MET Norway when the forecast came from it (its data asks to be credited where it's shown). */
function updLine(w){
  const at = new Date(w.at), hm = `${pad(at.getHours())}:${pad(at.getMinutes())}`;
  /* An older forecast says its day too, so a saved one never looks fresh. */
  const time = ymd(at) === today() ? hm : `${at.toLocaleDateString(LOCALE, {day:"numeric", month:"short"})} ${hm}`;
  return w.source === "met" ? tr("Updated {time} · MET Norway", {time}) : tr("Updated {time}", {time});
}
let LAST_GROUPS = [];
function render(){
  $("#placeName").textContent = state.settings.place || tr("Garden");
  const w = state.weather, W = wx();
  const cur = w && w.current;
  if(cur && W && W.next.length){
    const t = W.next[0];
    $("#nowWx").innerHTML = `${wIcon(cur.weather_code, cur.is_day !== 0)}<div><b>${deg(cur.temperature_2m)}</b><small><span class="hi">${tr("H {t}", {t:deg(t.max)})}</span>  <span class="lo">${tr("L {t}", {t:deg(t.min)})}</span></small></div>`;
    $("#nowLine").textContent = updLine(w);
  }else{
    $("#nowWx").innerHTML = "";
    $("#nowLine").textContent = w ? tr("Tap the weather to refresh") : tr("Loading forecast…");
  }
  const groups = state.plants.length ? buildAlerts() : [];
  plantFlags = flagsFrom(groups);
  LAST_GROUPS = groups;
  renderHero(W, groups);
  renderLocations(W);
  renderToday(groups);
  renderForecast(W);
  renderPlants();
  fillMeButtons();
  if(currentTab === "journal") renderJournalPage();
  refreshPsTop();
}

/* ---------- The week ahead: the weather, and the jobs on their days ---------- */
let fcOpen = null;
const dayRisks = d => GA.dayRisks(state.plants, d, state.settings, {W:wx(), today:today()});   // the same rules as the alerts (acclimatisation too)
/* What each day of the week holds: frost to protect from (rooms and storage aren't frost), heat, gusts, rain that
   waters the garden for you, your own tasks, feeding on the weekend. */
function dayJobs(d, i, W){
  const s = state.settings, r = dayRisks(d), out = [];
  if(i === 0 && new Date().getHours() >= 10) r.frost = [];   // last night is over
  if(r.frost.length) out.push({k:"frost", icon:ICON.snow, n:r.frost.length, label:trn(r.frost.length, "{n} plant to protect", "{n} plants to protect")});
  if(r.heat.length) out.push({k:"heat", icon:ICON.heat, n:r.heat.length, label:trn(r.heat.length, "{n} plant in the heat", "{n} plants in the heat")});
  if(d.gust >= +s.wind && state.plants.some(p => ["outside","balcony"].includes(p.area))) out.push({k:"wind", icon:ICON.wind, label:tr("Gusts up to {n} km/h", {n:Math.round(d.gust)})});
  if(d.rain >= (+s.rain || 5) && (d.prob || 0) >= 60 && state.plants.some(p => p.rainCounts)) out.push({k:"rain", icon:ICON.drop, label:tr("Rain waters the garden for you")});
  const tasks = GA.taskList(s).filter(x => GA.taskState(x, today()).stage !== "done" && (x.d === d.date || (i === 0 && x.d && x.d < d.date)));
  if(tasks.length) out.push({k:"task", icon:ICON.calendar, label:tasks.length === 1 ? tasks[0].t : trn(tasks.length, "{n} task", "{n} tasks"), tasks});
  return out;
}
const PILL_WORD = {frost:n => `${n}`, heat:n => `${n}`, wind:() => tr("wind"), rain:() => tr("skip"), task:() => tr("task")};
function renderForecast(W){
  const el = $("#forecast");
  if(!W || !W.next.length){ el.innerHTML = `<p class="fc-empty">${tr("No forecast yet. Tap the weather at the top to try again.")}</p>`; $("#fcDetail").hidden = true; return; }
  const codes = state.weather.daily.weather_code || [];
  const idx0 = state.weather.daily.time.indexOf(W.next[0].date);
  const fmt = v => v >= 0.1 ? (v < 10 ? (Math.round(v * 10) / 10) : Math.round(v)) : "–";
  el.innerHTML = W.next.map((d, i) => {
    const jobs = dayJobs(d, i, W), frost = jobs.some(j => j.k === "frost"), heat = jobs.some(j => j.k === "heat");
    const lo = d.fmin != null ? d.fmin : d.min;
    /* The visible words are the button's name (day, high, low, rain, jobs); hidden words only add what layout and colour say. */
    return `<button class="fc-day ${frost ? "frost" : heat ? "heat" : ""} ${fcOpen === d.date ? "open" : ""}" data-fc="${d.date}" aria-controls="fcDetail">
      <span class="fc-dn">${i === 0 ? tr("Today") : parseDay(d.date).toLocaleDateString(LOCALE, {weekday:"short"})}</span>
      ${wIcon(codes[idx0 + i], true)}<span class="vh">${tr("High")}</span><b class="hi">${deg(d.max)}</b><span class="vh">${tr("Low")}</span><small class="lo">${deg(lo)}</small><span class="vh">${tr("Rain mm")}</span><small class="rn ${d.rain >= 0.1 ? "" : "dry"}">${fmt(d.rain)}</small>
      <span class="fc-jobs">${jobs.slice(0, 2).map(j => `<span class="fc-pill p-${j.k}">${j.icon}<span>${esc(PILL_WORD[j.k](j.n))}</span><span class="vh">: ${esc(j.label)}</span></span>`).join("")}</span></button>`;
  }).join("");
  el.insertAdjacentHTML("afterbegin", `<div class="fc-lab" aria-hidden="true"><span class="fc-dn">&nbsp;</span><span class="fc-sp"></span><b class="hi">${tr("High")}</b><small class="lo">${tr("Low")}</small><small class="rn">${tr("Rain mm")}</small></div>`);
  const det = $("#fcDetail");
  const i = fcOpen ? W.next.findIndex(x => x.date === fcOpen) : -1, d = i >= 0 ? W.next[i] : null;
  el.querySelectorAll("[data-fc]").forEach(b => b.setAttribute("aria-expanded", b.dataset.fc === fcOpen));
  if(!d){ det.hidden = true; return; }
  /* The day in full: what the forecast says, what Alvor plans for, and what it means for your plants. */
  const r = dayRisks(d), names = a => a.map(p => esc(p.name)).join(", ");
  const estGust = state.weather && state.weather.source === "met", lo = d.fmin != null ? d.fmin : d.min;
  const facts = [
    `<li><span>${tr("High")}</span><b class="hi">${deg(d.max)}</b></li>`,
    `<li><span>${tr("Low")}</span><b class="lo">${deg(lo)}</b>${d.adj ? `<small>${tr("Alvor plans {t}", {t:deg(d.min)})}</small>` : ""}</li>`,
    `<li><span>${tr("Rain")}</span><b>${d.rain >= 0.1 ? tr("{n} mm", {n:d.rain < 10 ? Math.round(d.rain * 10) / 10 : Math.round(d.rain)}) : tr("Dry")}</b>${d.prob ? `<small>${tr("{n}% chance", {n:Math.round(d.prob)})}</small>` : ""}</li>`,
    `<li><span>${tr("Gusts")}</span><b>${tr("{n} km/h", {n:Math.round(d.gust || 0)})}</b>${estGust ? `<small>${tr("estimated")}</small>` : ""}</li>`];
  const why = GA.nightWhy(d), jobs = dayJobs(d, i, W);
  det.innerHTML = `<div class="fcd-h"><b>${cap(longDay(d.date))}</b><small>${parseDay(d.date).toLocaleDateString(LOCALE, {day:"numeric", month:"long"})}</small></div>
    <ul class="fcd-facts">${facts.join("")}</ul>` + (why ? `<p class="fcd-why">${esc(cap(why))}.</p>` : "") +
    (r.frost.length ? `<p><span class="dot frost">${ICON.snow}</span>${tr("Down to {t} outside: too cold for {names} as they are.", {t:deg(d.min), names:names(r.frost)})} <button class="linkish" data-act="seePlants" data-ids="${r.frost.map(p => p.id).join(",")}">${tr("See plants")}</button></p>` : "") +
    (r.indoor.length ? `<p><span class="dot indoor">${ICON.house}</span>${tr("Indoors: {names} would be colder than they take where they stand.", {names:names(r.indoor)})}</p>` : "") +
    (r.heat.length ? `<p><span class="dot heat">${ICON.heat}</span>${tr("Up to {t}, too hot for {names}.", {t:deg(d.max), names:names(r.heat)})} <button class="linkish" data-act="seePlants" data-ids="${r.heat.map(p => p.id).join(",")}">${tr("See plants")}</button></p>` : "") +
    jobs.filter(j => ["wind","rain","task"].includes(j.k)).map(j => `<p><span class="dot ${j.k}">${j.icon}</span>${j.k === "task" ? esc(j.tasks.map(x => x.t).join(", ")) : esc(j.label)}</p>`).join("") +
    (!r.frost.length && !r.heat.length && !r.indoor.length && state.plants.length ? `<p class="fcd-calm">${ICON.leaf}${tr("No plant is at risk from the temperature that day.")}</p>` : "");
  det.hidden = false;
}
$("#forecast").addEventListener("click", e => {
  const b = e.target.closest("[data-fc]"); if(!b) return;
  fcOpen = fcOpen !== b.dataset.fc ? b.dataset.fc : null;
  renderForecast(wx());
});
$("#nowWx").addEventListener("click", () => fetchWeather(true));

/* ---------- Alert cards ---------- */
const COLD = GA.COLD_KEYS;
function alertLook(g){
  const n = g.items.length;
  if(COLD.includes(g.key) || g.key === "frostOk"){
    const worst = g.items.reduce((a, i) => i.t < a.t ? i : a, g.items[0]);
    const when = (worst.why || "").split(/,| · /)[0];
    const lead = {bringIn:trn(n, "Bring {n} plant inside:", "Bring {n} plants inside:"), toGh:trn(n, "Move {n} plant to the greenhouse:", "Move {n} plants to the greenhouse:"), ghProtect:g.text,
      potProtect:trn(n, "Shelter this pot:", "Shelter these {n} pots:"), groundProtect:trn(n, "Protect {n} plant in the ground:", "Protect {n} plants in the ground:"),
      warmerSpot:trn(n, "Find a warmer spot for {n} plant:", "Find a warmer spot for {n} plants:"),
      crownProtect:trn(n, "Protect the crown of {n} plant:", "Protect the crown of {n} plants:"), mulchRoots:trn(n, "Mulch the roots of {n} plant:", "Mulch the roots of {n} plants:"),
      springGrowth:trn(n, "Cover the new growth of {n} plant:", "Cover the new growth of {n} plants:"), frostOk:g.text}[g.key];
    if(g.key === "frostOk") return {type:"frost", icon:"snow", label:tr("Frost plan"), title:tr("Nothing to protect"), chip:"", lead, tip:""};
    const frosty = worst.t <= 0;   /* "frost" only when it really freezes; plants can be hurt well above 0 °C */
    return {type:"frost", icon:"snow", label:g.level === "danger" ? (frosty ? tr("Frost alert") : tr("Low temperature alert")) : tr("Low temperature watch"),
      title:g.level === "danger" ? (frosty ? tr("Frost is coming") : tr("Too cold for these plants")) : tr("A cold night ahead"), chip:when, lead,
      tip:["potProtect","groundProtect","crownProtect","mulchRoots","springGrowth","warmerSpot"].includes(g.key) ? g.text : ""};
  }
  if(g.key === "heater") return {type:"frost", icon:"snow", label:tr("Frost plan"), title:tr("Check the greenhouse heater"), chip:"", lead:g.text, tip:""};
  if(g.key === "heat" || g.key === "vent") return {type:"heat", icon:"heat", label:tr("Heat alert"), title:g.key === "vent" ? tr("Open the greenhouse") : tr("A hot spell"), lead:g.text};
  if(g.key === "wind") return {type:"wind", icon:"wind", label:tr("Wind alert"), title:tr("Strong gusts"), lead:g.text};
  if(g.key === "water") return {type:"water", icon:"drop", label:tr("Watering"), title:trn(n, "{n} plant likely needs water", "{n} plants likely need water"), lead:""};
  if(g.key === "rainWill") return {type:"water", icon:"drop", label:tr("Watering"), title:tr("Skip these, rain is coming"), lead:g.text};
  if(g.key === "waterUnknown") return {type:"water", icon:"drop", label:tr("Watering"), title:tr("Not sure about these"), lead:g.text};
  if(g.key === "settleSun") return {type:"info", icon:"sun", label:tr("Heads-up"), title:g.title, lead:g.text};
  if(g.key === "feed") return {type:"care", icon:"feed", label:tr("Feeding and repotting"), title:trn(n, "{n} plant is ready for feeding", "{n} plants are ready for feeding"), lead:g.text};
  if(g.key === "repot") return {type:"care", icon:"repot", label:tr("Feeding and repotting"), title:tr("Time to repot"), lead:g.text};
  if(g.key === "goOut") return {type:"info", icon:"move", label:tr("Good news"), title:tr("Safe to move outside"), lead:g.text};
  return {type:"info", icon:"move", label:tr("Heads-up"), title:g.title, lead:g.text};
}
/* Which warning a group answers, kept with what you did about it (Weather Wise). */
const alertWx = g => COLD.includes(g.key) ? "frost" : g.key === "heat" || g.key === "vent" ? "heat" : g.key === "wind" ? "wind" : "";
/* Frost plans you carry out where the plant stands: they get "Mark as protected" (a journal entry), next to See plants. */
const PROTECT_KEYS = ["potProtect", "groundProtect", "crownProtect", "mulchRoots", "springGrowth", "ghProtect"];
/* Feedback on a suggestion, under each plant: what the gardener actually found. */
const FB = {water:tr("Watered"), wet:tr("Already wet"), fine:tr("Looks fine"), later:tr("Later"), settled:tr("It's used to it"),
  fed:tr("Fed"), skip:tr("Skip this time"), repotted:tr("Repotted…"), notYear:tr("Not this year"), unprotect:tr("Taken off")};
const fbRow = (g, p) => g.feedback ? `<span class="fb" role="group" aria-label="${tr("What did you find?")}">${g.feedback.map(k => `<button class="fb-b" data-act="fb" data-kind="${k}" data-id="${p.id}">${FB[k]}</button>`).join("")}</span>` : "";
const GT_ICON = {frost:"snow", heat:"heat", wind:"wind", sun:"sun", water:"drop", rain:"drop", soon:"drop", feed:"feed", repot:"repot", move:"move", task:"calendar", unknown:"drop", indoor:"house", protect:"sun"};
/* Your own tasks open the tasks list; every other line opens its plants. */
const gtAttrs = l => l.kind === "task" ? `data-task="all"` : `data-act="seePlants" data-ids="${l.ids.join(",")}"`;
const RISK_TYPES = ["frost", "heat", "wind"];

/* Per-plant status icons, from the same rules as the alerts */
let plantFlags = {};
function flagsFrom(groups){
  const f = {};
  const put = (id, k) => { (f[id] ||= new Set()).add(k); };
  groups.forEach(g => g.items.forEach(i => {
    const k = COLD.includes(g.key) ? "frost" : g.key === "heat" || g.key === "vent" ? "heat" : g.key === "wind" ? "wind"
      : g.key === "water" ? "water" : g.key === "feed" ? "feed" : g.key === "plan" || g.key === "goOut" ? "move" : null;
    if(i.done) return;   // already protected: nothing to flag
    if(k) put(i.p.id, k);
    if(g.move) put(i.p.id, "move");
  }));
  return f;
}
const FLAG_INFO = {frost:["snow",tr("Too cold")], heat:["heat",tr("Too hot")], wind:["wind",tr("Strong wind")], water:["drop",tr("Needs water")], move:["move",tr("Time to move")], feed:["feed",tr("Ready for feeding")]};
const flagIcons = id => [...(plantFlags[id] || [])].sort().map(k => `<span class="flag f-${k}" role="img" title="${FLAG_INFO[k][1]}" aria-label="${FLAG_INFO[k][1]}">${ICON[FLAG_INFO[k][0]]}</span>`).join("");

/* The weather tints the backdrop band (clear, cloudy, rain, snow; frosty below zero; night). Nothing moves over it. */
const reduceMotion = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
function skyPhase(){
  const w = state.weather, cur = w && w.current;
  if(!cur) return "day";
  const d = w.daily, i = d.time.indexOf(today());
  const now = Date.now(), near = t => t && Math.abs(now - new Date(t).getTime()) < 30 * 60000;
  if(i >= 0 && d.sunrise && (near(d.sunrise[i]) || near(d.sunset[i]))) return "dusk";
  return cur.is_day === 0 ? "night" : "day";
}
const applySky = () => applyBackdrop();
setInterval(() => { if(!document.hidden && currentTab === "today") applyBackdrop(); }, 5 * 60000);

/* ---------- Home hero, photo backdrop, locations ---------- */
const SKY_WORD = {clear:tr("Clear"), partly:tr("Partly cloudy"), cloudy:tr("Cloudy"), fog:tr("Fog"), rain:tr("Rain"), snow:tr("Snow"), storm:tr("Thunderstorm")};
function renderHero(W, groups){
  $("#heroPlace").textContent = state.settings.place || tr("Your garden");
  $("#heroDate").textContent = cap(new Date().toLocaleDateString(LOCALE, {weekday:"long", day:"numeric", month:"long"}));
  const w = state.weather, cur = w && w.current;
  $("#fcSrc").textContent = W && W.next.length ? tr("Tap a day for details") : "";
  if(!(cur && W && W.next.length)){
    $("#heroNow").innerHTML = `<span class="hn-wait">${w ? tr("Tap to refresh the weather") : navigator.onLine === false ? tr("You're offline. The forecast loads when you're back online.") : tr("Loading forecast…")}</span>`;
    $("#heroUpd").textContent = ""; return;
  }
  const t = W.next[0];
  $("#heroNow").innerHTML = `<span class="hn-ic">${wIcon(cur.weather_code, cur.is_day !== 0)}</span><b class="hn-t">${deg(cur.temperature_2m)}</b><span class="hn-s"><span>${SKY_WORD[sky(cur.weather_code)] || ""}</span><small>${tr("H {t}", {t:deg(t.max)})} · ${tr("L {t}", {t:deg(t.fmin != null ? t.fmin : t.min)})}</small></span><span class="hn-r" aria-hidden="true">${ICON.clock}</span><span class="vh">${tr("Refresh the weather")}</span>`;
  const old = Date.now() - w.at > 3 * 3600000;
  $("#heroUpd").innerHTML = `${old ? ICON.warn : ""}<span>${esc(updLine(w))}${old ? " · " + esc(tr("tap the weather to refresh")) : ""}</span>`;
  $("#heroUpd").classList.toggle("stale", old);
}
$("#heroNow").addEventListener("click", () => fetchWeather(true));

function applyBackdrop(){
  const cur = state.weather && state.weather.current, b = document.body;
  const type = cur ? sky(cur.weather_code) : "partly";
  b.dataset.sky = type; b.dataset.phase = skyPhase();
  b.classList.toggle("frosty", !!(cur && cur.temperature_2m <= 0 && type !== "snow"));
}

/* Winter storage (a garage, cellar or shed) shows only once a plant goes there, or when it's been given a temperature. */
const STORE_LOC = {k:"store", label:tr("Winter storage"), sub:tr("Dark and frost-free"), areas:["store"], icon:"store"};
const withStore = list => state.plants.some(p => inArea(p, "store")) || isFinite(parseFloat(state.settings.storeLow)) ? [...list, STORE_LOC] : list;
/* Your own places (Phase G) as cards after Alvor's: the kind's picture, your name. */
const myLocs = () => myPlaces().map(L => ({k:"pl:" + L.id, loc:PLACE_KINDS[L.k].loc, label:L.n, sub:PLACE_KINDS[L.k].label, areas:[placeArea(L)], icon:PLACE_KINDS[L.k].icon, place:L}));
const locHas = (L, p) => L.place ? p.place === L.place.id && !!plPlace(p) : L.areas.includes(p.area) && !plPlace(p);
const LOCS = () => [...builtLocs(), ...myLocs()];
const builtLocs = () => withStore(isApt()
  ? [{k:"house", label:tr("House"), sub:tr("Indoors"), areas:["house"], icon:"house"},
     {k:"balcony", label:tr("Balcony"), sub:tr("Outdoors"), areas:["balcony"], icon:"balcony"}]
  : [{k:"house", label:tr("House"), sub:tr("Indoors"), areas:["house"], icon:"house"},
     {k:"garden", label:tr("Outside"), sub:tr("The garden and the porch"), areas:["outside","porch"], icon:"leaf"},
     {k:"greenhouse", label:tr("Greenhouse"), sub:tr("Sheltered"), areas:["greenhouse"], icon:"greenhouse"}]);
function renderLocations(W){
  const el = $("#locList"); if(!el) return;
  const n = state.plants.length;
  if($("#allCount")) $("#allCount").textContent = n ? String(n) : "";
  const used = LOCS().filter(L => state.plants.some(p => locHas(L, p))).length;
  $("#locSub").textContent = n ? trn(n, "{n} plant", "{n} plants") + " · " + trn(used, "{n} place", "{n} places") : tr("Where your plants live");
  const archived = (state.archive || []).length, vault = online ? state.plants.filter(p => visOf(p) === "vault").length : 0;
  if($("#allSub")) $("#allSub").textContent = n ? [trn(n, "{n} plant", "{n} plants"), vault ? trn(vault, "{n} only for you", "{n} only for you") : "", archived ? trn(archived, "{n} in the Archive", "{n} in the Archive") : ""].filter(Boolean).join(" · ") : tr("Search, filter, list, grid or tiles");
  const r0 = {frost:state.plants.filter(p => (plantFlags[p.id] || new Set()).has("frost"))};   // same plants as the alerts
  el.innerHTML = LOCS().map(L => {
    const list = state.plants.filter(p => locHas(L, p));
    const risk = r0.frost.filter(p => locHas(L, p)).length;
    const thirsty = list.filter(p => (plantFlags[p.id] || new Set()).has("water")).length;
    const spots = [];
    if(!L.place) L.areas.forEach(a => {
      if(a === "porch"){ const c = list.filter(p => p.area === "porch").length; spots.push({f:"porch", icon:"porch", label:tr("Porch"), c}); return; }
      AREAS[a].zones.forEach(z => { if(z === "greenhouse" || z === "store") return; spots.push({f:z, icon:ZONES[z].icon, label:ZONES[z].short, c:list.filter(p => p.zone === z).length}); });
    });
    if(L.k === "greenhouse"){ const g = list.filter(p => p.pattern === "greenhouse").length; if(g) spots.push({f:"greenhouse", icon:"snow", label:tr("Wintering guests"), c:g}); }
    const temp = tempChip(L.k);
    const status = (risk ? `<span class="lchip frost">${ICON.snow}${tr("{n} at risk from the cold", {n:risk})}</span>` : thirsty ? `<span class="lchip water">${ICON.drop}${trn(thirsty, "{n} needs water", "{n} need water")}</span>` : "")
      + (temp ? `<button class="lchip temp" data-loctemp="${L.k}" aria-label="${tr("{place} temperature", {place:L.label})}: ${esc(temp)}">${ICON.thermo}${esc(temp)}</button>` : "");
    const mine = locPicSrc(L.k), canPic = online && !!me && !!token, cls = L.loc || L.k, to = L.place ? L.k : L.k === "garden" ? "garden" : L.areas[0];
    /* A place with no plants yet is offered, not claimed: a slim card with a way to start it. */
    if(!list.length) return `<div class="loc loc-${cls} ${L.place ? "loc-mine" : ""} empty slim">
      <button class="loc-main" data-loc="${esc(to)}"><span class="loc-ic" aria-hidden="true">${ICON[L.icon]}</span>
        <span class="loc-t"><b>${esc(L.label)}</b><small>${L.place ? esc(L.sub) + " · " : ""}${tr("No plants here yet")}</small></span><span class="chev" aria-hidden="true">›</span></button>
      ${temp ? `<div class="loc-status"><button class="lchip temp" data-loctemp="${L.k}" aria-label="${tr("{place} temperature", {place:L.label})}: ${esc(temp)}">${ICON.thermo}${esc(temp)}</button></div>` : ""}</div>`;
    return `<div class="loc loc-${cls} ${L.place ? "loc-mine" : ""} ${mine ? "has-img" : ""}" style="${mine ? "" : locStyle(look().style, cls)}">
      ${mine ? `<img class="loc-img" src="${mine}" alt="">` : `<span class="loc-art">${ICON[L.icon]}</span>`}
      ${canPic ? locPicBtn(L) : ""}
      <button class="loc-main" data-loc="${esc(to)}">
        <span class="loc-ic" aria-hidden="true">${ICON[L.icon]}</span>
        <span class="loc-t"><b>${esc(L.label)}</b><small>${esc(L.sub)} · ${list.length ? trn(list.length, "{n} plant", "{n} plants") : tr("no plants yet")}</small></span>
        <span class="chev" aria-hidden="true">›</span>
      </button>
      ${status ? `<div class="loc-status">${status}</div>` : ""}
      ${spots.length > 1 || L.k === "greenhouse" ? `<div class="loc-spots">${spots.filter(x => x.c || L.k !== "greenhouse").map(x => `<button class="spot" data-loc="${x.f}">${ICON[x.icon] || ""}<span>${esc(x.label)}</span><b>${x.c}</b></button>`).join("")}</div>` : ""}
    </div>`;
  }).join("") + (myPlaces().length < MAX_PLACES ? `<button type="button" class="loc-add" data-place-new="1"><span class="loc-ic" aria-hidden="true">${ICON.plus}</span>
      <span class="loc-t"><b>${tr("Add your own place")}</b><small>${isApt() ? tr("A cool room, a second balcony, a storage room…") : tr("A polytunnel, the garage, a cool bedroom, the vegetable patch…")}</small></span></button>` : "");
}
const LOC_TITLE = {all:tr("All plants"), garden:tr("Outside"), house:tr("House"), greenhouse:tr("Greenhouse"), balcony:tr("Balcony"), porch:tr("Porch"), outside:tr("Outside, not the porch"), store:tr("Winter storage"), vault:tr("Only me"), archive:tr("Archive")};
const plantsTitle = () => idsFilter ? tr("Selected plants") : plKey(plantFilter) ? plKey(plantFilter).n : LOC_TITLE[plantFilter] || (ZONES[plantFilter] ? ZONES[plantFilter].label : tr("Plants"));
$("#view-locations").addEventListener("click", e => {
  const pic = e.target.closest("[data-locpic]"); if(pic){ openLocPic(pic.dataset.locpic); return; }
  const th = e.target.closest("[data-loctemp]"); if(th){ openLocTemp(th.dataset.loctemp); return; }
  if(e.target.closest("[data-place-new]")){ openPlace(null); return; }
  const b = e.target.closest("[data-loc]"); if(!b) return;
  idsFilter = null; plantFilter = b.dataset.loc;
  showTab("plants"); renderPlants();
});

/* ---------- How warm a place stays (Locations): the greenhouse's heater, how cold the spots in the house get ---------- */
/* settings.gh: the greenhouse without heat, °C warmer than outside on a cold night. settings.ghHeat: a heater keeps it
   above this (null: no heater). settings.rooms: {"house-window":9, …} the lowest each indoor spot reaches on a cold night
   (missing: warm enough for anything). The care engine (alerts.js) uses them for the frost plan; the garden and balcony
   simply follow the outside, with the porch, walls and shelter set per plant. */
const ROOM_ZONES = ["house-window","house-low","house-cabinet"];
const isNum = v => v !== null && v !== undefined && v !== "" && isFinite(+v);
const halfDeg = v => `${Math.round(+v * 2) / 2}°`;
function tempChip(k){
  const s = state.settings, L = plKey(k);
  if(L) return L.k === "greenhouse" ? (isNum(L.heat) ? tr("Heated · above {t}", {t:halfDeg(L.heat)}) : tr("Unheated · {t} warmer", {t:halfDeg(isNum(L.gh) ? +L.gh : GA.RULES.place.gh)}))
    : L.k === "store" ? (isNum(L.low) ? tr("Lowest {t}", {t:halfDeg(L.low)}) : tr("About {t} on cold nights", {t:halfDeg(GA.RULES.store.low)}))
    : L.k === "room" ? (isNum(L.low) ? tr("Coldest {t}", {t:halfDeg(L.low)}) : tr("Warm all year")) : "";
  if(k === "greenhouse") return isNum(s.ghHeat) ? tr("Heated · above {t}", {t:halfDeg(s.ghHeat)}) : tr("Unheated · {t} warmer", {t:halfDeg(+s.gh || 0)});
  if(k === "store") return isNum(s.storeLow) ? tr("Lowest {t}", {t:halfDeg(s.storeLow)}) : tr("About {t} on cold nights", {t:halfDeg(GA.RULES.store.low)});
  if(k === "house"){
    const set = ROOM_ZONES.filter(z => isNum((s.rooms || {})[z]));
    return set.length ? tr("Coldest spot {t}", {t:halfDeg(Math.min(...set.map(z => +s.rooms[z])))}) : tr("Warm all year");
  }
  return "";
}
const locTempDlg = $("#locTempDlg");
let ltFor = null, ltHeated = false;
function openLocTemp(k){
  if(plKey(k)) return openPlace(plKey(k).id);   // your own place: its sheet has its temperature
  ltFor = k;
  const s = state.settings, place = k === "greenhouse" ? tr("Greenhouse") : k === "store" ? tr("Winter storage") : areaLabel("house");
  $("#ltTitle").textContent = tr("{place} temperature", {place});
  if(k === "greenhouse"){
    ltHeated = isNum(s.ghHeat);
    $("#ltBody").innerHTML = `
      <p class="lt-intro">${tr("Alvor uses this to know which plants are safe in the greenhouse on a cold night, and which need fleece or the house.")}</p>
      <div class="seg" role="group" aria-label="${tr("Heating")}">
        <button type="button" data-heat="0" aria-pressed="${!ltHeated}">${tr("Unheated")}</button>
        <button type="button" data-heat="1" aria-pressed="${ltHeated}">${tr("Heated")}</button>
      </div>
      <div class="field" id="ltHeatF" ${ltHeated ? "" : "hidden"}><label for="ltHeat">${tr("The heater keeps it above (°C)")}</label>
        <input id="ltHeat" type="number" step="0.5" inputmode="decimal" value="${isNum(s.ghHeat) ? +s.ghHeat : ""}" placeholder="5">
        <span class="hint">${tr("The thermostat setting, or the lowest you've seen on a cold night with the heater on.")}</span></div>
      <div class="field"><label for="ltGh">${tr("Without heat: warmer than outside by (°C)")}</label>
        <input id="ltGh" type="number" step="0.5" min="0" max="15" inputmode="decimal" value="${isNum(s.gh) ? +s.gh : 3}">
        <span class="hint">${tr("On a cold, clear night. Most unheated greenhouses stay 2 to 4° warmer. With a heater, Alvor uses it to tell you when the plants depend on it.")}</span></div>
      <div class="a-act"><button class="btn primary" id="ltSave">${tr("Save")}</button></div>`;
  }else if(k === "store"){
    $("#ltBody").innerHTML = `
      <p class="lt-intro">${tr("A garage, cellar or shed where dormant plants spend the winter. Alvor warns you when it could get colder than they take.")}</p>
      <div class="field"><label for="ltStore">${tr("The lowest it gets on a cold winter night (°C)")}</label>
        <input id="ltStore" type="number" step="0.5" inputmode="decimal" value="${isNum(s.storeLow) ? +s.storeLow : ""}" placeholder="${GA.RULES.store.low}">
        <span class="hint">${tr("Empty: Alvor assumes about {t}. A min/max thermometer tells you for sure.", {t:GA.RULES.store.low + "°"})}</span></div>
      <div class="a-act"><button class="btn primary" id="ltSave">${tr("Save")}</button></div>`;
  }else{
    const r = s.rooms || {};
    $("#ltBody").innerHTML = `
      <p class="lt-intro">${tr("How cold each spot gets on a cold winter night. Leave it empty if it stays warm: Alvor then never warns about it.")}</p>
      ${ROOM_ZONES.map(z => `<div class="field lt-room"><label for="lt-${z}">${ICON[ZONES[z].icon] || ""}<span>${esc(ZONES[z].label)}</span></label>
        <input id="lt-${z}" data-zone="${z}" type="number" step="0.5" inputmode="decimal" value="${isNum(r[z]) ? +r[z] : ""}" placeholder="${tr("Warm")}" aria-label="${tr("Lowest °C")}"><span class="lt-u">°C</span></div>`).join("")}
      <p class="lt-note">${tr("Window sills can be several degrees colder than the room. A simple min/max thermometer tells you. Alvor counts it on nights at or below 5° outside.")}</p>
      <div class="a-act"><button class="btn primary" id="ltSave">${tr("Save")}</button></div>`;
  }
  locTempDlg.showModal();
}
$("#ltClose").addEventListener("click", () => locTempDlg.close());
$("#ltBody").addEventListener("click", e => {
  const h = e.target.closest("[data-heat]");
  if(h){
    ltHeated = h.dataset.heat === "1";
    $("#ltBody").querySelectorAll("[data-heat]").forEach(b => b.setAttribute("aria-pressed", b === h));
    $("#ltHeatF").hidden = !ltHeated;
    if(ltHeated && !$("#ltHeat").value) $("#ltHeat").focus();
    return;
  }
  if(!e.target.closest("#ltSave")) return;
  const val = el => { const x = parseFloat(String(el.value).replace(",", ".")); return isNaN(x) ? null : x; };
  const s = state.settings, clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  if(ltFor === "store"){
    const v = val($("#ltStore"));
    state.settings = {...s, storeLow:v == null ? null : clamp(v, -15, 20), storeAsked:true};
  }else if(ltFor === "greenhouse"){
    const gh = val($("#ltGh")), heat = ltHeated ? val($("#ltHeat")) : null;
    if(ltHeated && heat == null){ toast(tr("Say how warm the heater keeps it")); $("#ltHeat").focus(); return; }
    state.settings = {...s, gh:gh == null ? (isNum(s.gh) ? +s.gh : 3) : clamp(gh, 0, 15), ghHeat:heat == null ? null : clamp(heat, -5, 30), ghAsked:true};
  }else{
    const rooms = {};
    $("#ltBody").querySelectorAll("input[data-zone]").forEach(i => { const v = val(i); if(v != null) rooms[i.dataset.zone] = clamp(v, -10, 30); });
    state.settings = {...s, rooms};
  }
  save(); locTempDlg.close(); render(); toast(tr("Saved"));
});
