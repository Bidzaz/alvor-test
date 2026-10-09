/* Alvor · Home: forecast with warnings, alert cards, the weather on the backdrop, Locations.
   Plain script (no build step): loaded by index.html in a fixed order and sharing one global scope. */
"use strict";
/* ---------- Render ---------- */
/* "Updated 14:02", naming MET Norway when the forecast came from it (its data asks to be credited where it's shown). */
function updLine(w){
  const at = new Date(w.at), time = `${pad(at.getHours())}:${pad(at.getMinutes())}`;
  return w.source === "met" ? tr("Updated {time} · MET Norway", {time}) : tr("Updated {time}", {time});
}
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
  renderForecast(W);
  renderHero(W, groups);
  renderLocations(W);
  renderAlerts(groups);
  renderPlants();
  renderLog();
}

/* ---------- Forecast with warnings on the days ---------- */
let fcOpen = null;
const dayRisks = d => GA.dayRisks(state.plants, d, state.settings);   // the same rules as the alerts
function renderForecast(W){
  const el = $("#forecast");
  if(!W || !W.next.length){ el.innerHTML = `<p class="fc-empty">${tr("No forecast yet. Tap the weather at the top to try again.")}</p>`; $("#fcDetail").hidden = true; return; }
  const codes = state.weather.daily.weather_code || [];
  const idx0 = state.weather.daily.time.indexOf(W.next[0].date);
  el.innerHTML = W.next.map((d, i) => {
    const r = dayRisks(d);
    const cls = r.frost.length ? "frost" : r.heat.length ? "heat" : "";
    const badge = r.frost.length ? `<span class="fc-badge frost">${ICON.snow}</span>` : r.heat.length ? `<span class="fc-badge heat">${ICON.heat}</span>` : "";
    return `<button class="fc-day ${cls} ${fcOpen === d.date ? "open" : ""}" data-fc="${d.date}" aria-label="${tr("{day}, {hi} to {lo}", {day:longDay(d.date), hi:deg(d.max), lo:deg(d.min)})}${cls ? tr(", warning") : ""}">
      ${badge}<span class="fc-dn">${i === 0 ? tr("Today") : parseDay(d.date).toLocaleDateString(LOCALE, {weekday:"short"})}</span>
      ${wIcon(codes[idx0 + i], true)}<b class="hi">${deg(d.max)}</b><small class="lo">${deg(d.min)}</small><small class="rn ${d.rain >= 0.1 ? "" : "dry"}">${d.rain >= 0.1 ? (d.rain < 10 ? (Math.round(d.rain * 10) / 10) : Math.round(d.rain)) : "–"}</small></button>`;
  }).join("");
  el.insertAdjacentHTML("afterbegin", `<div class="fc-lab" aria-hidden="true"><span class="fc-dn">&nbsp;</span><span class="fc-sp"></span><b class="hi">${tr("High")}</b><small class="lo">${tr("Low")}</small><small class="rn">${tr("Rain mm")}</small></div>`);
  const det = $("#fcDetail");
  const d = fcOpen && W.next.find(x => x.date === fcOpen);
  if(!d){ det.hidden = true; return; }
  const r = dayRisks(d), names = a => a.map(p => esc(p.name)).join(", ");
  det.innerHTML = `<b>${longDay(d.date).replace(/^./, c => c.toUpperCase())}</b>` +
    (r.frost.length ? `<p><span class="dot frost">${ICON.snow}</span>${tr("Down to {t}, too cold for {names}.", {t:deg(d.min), names:names(r.frost)})}</p>` : "") +
    (r.heat.length ? `<p><span class="dot heat">${ICON.heat}</span>${tr("Up to {t}, too hot for {names}.", {t:deg(d.max), names:names(r.heat)})}</p>` : "");
  det.hidden = false;
}
$("#forecast").addEventListener("click", e => {
  const b = e.target.closest("[data-fc]"); if(!b) return;
  const W = wx(), d = W && W.next.find(x => x.date === b.dataset.fc);
  const r = d && dayRisks(d);
  fcOpen = r && (r.frost.length || r.heat.length) && fcOpen !== b.dataset.fc ? b.dataset.fc : null;
  renderForecast(W);
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
      crownProtect:trn(n, "Protect the crown of {n} plant:", "Protect the crown of {n} plants:"), mulchRoots:trn(n, "Mulch the roots of {n} plant:", "Mulch the roots of {n} plants:"),
      springGrowth:trn(n, "Cover the new growth of {n} plant:", "Cover the new growth of {n} plants:"), frostOk:g.text}[g.key];
    if(g.key === "frostOk") return {type:"frost", icon:"snow", label:tr("Frost plan"), title:tr("Nothing to protect"), chip:"", lead, tip:""};
    const frosty = worst.t <= 0;   /* "frost" only when it really freezes; plants can be hurt well above 0 °C */
    return {type:"frost", icon:"snow", label:g.level === "danger" ? (frosty ? tr("Frost alert") : tr("Low temperature alert")) : tr("Low temperature watch"),
      title:g.level === "danger" ? (frosty ? tr("Frost is coming") : tr("Too cold for these plants")) : tr("A cold night ahead"), chip:when, lead,
      tip:["potProtect","groundProtect","crownProtect","mulchRoots","springGrowth"].includes(g.key) ? g.text : ""};
  }
  if(g.key === "heat" || g.key === "vent") return {type:"heat", icon:"heat", label:tr("Heat alert"), title:g.key === "vent" ? tr("Open the greenhouse") : tr("A hot spell"), lead:g.text};
  if(g.key === "wind") return {type:"wind", icon:"wind", label:tr("Wind alert"), title:tr("Strong gusts"), lead:g.text};
  if(g.key === "water") return {type:"water", icon:"drop", label:tr("Watering"), title:trn(n, "{n} plant likely needs water", "{n} plants likely need water"), lead:""};
  if(g.key === "rainWill") return {type:"water", icon:"drop", label:tr("Watering"), title:tr("Skip these, rain is coming"), lead:g.text};
  if(g.key === "waterUnknown") return {type:"water", icon:"drop", label:tr("Watering"), title:tr("Not sure about these"), lead:g.text};
  if(g.key === "goOut") return {type:"info", icon:"move", label:tr("Good news"), title:tr("Safe to move outside"), lead:g.text};
  return {type:"info", icon:"move", label:tr("Heads-up"), title:g.title, lead:g.text};
}
/* Feedback on a suggestion, under each plant: what the gardener actually found. */
const FB = {water:tr("Watered"), wet:tr("Already wet"), fine:tr("Looks fine"), later:tr("Later")};
const fbRow = (g, p) => g.feedback ? `<span class="fb" role="group" aria-label="${tr("What did you find?")}">${g.feedback.map(k => `<button class="fb-b" data-act="fb" data-kind="${k}" data-id="${p.id}">${FB[k]}</button>`).join("")}</span>` : "";
/* Garden today: what matters now, in a few lines, then plainly "nothing else is urgent". */
const GT_ICON = {frost:"snow", heat:"heat", wind:"wind", water:"drop", rain:"drop", soon:"drop", move:"move", unknown:"drop"};
function gardenTodayHtml(groups){
  const G = GA.gardenToday(groups, state.plants, ctx());
  return `<div class="acard gtoday ${G.lines.length ? "" : "t-calm"}">
    <div class="a-ic">${ICON.leaf}</div>
    <div class="a-main"><span class="a-lab">${esc(G.greet)}</span><h3>${esc(G.head)}</h3>
      ${G.lines.length ? `<ul class="gt-lines">${G.lines.map(l => `<li><button class="gt-line k-${l.kind} ${l.urgent ? "urgent" : ""}" data-act="seePlants" data-ids="${l.ids.join(",")}"><span class="gt-ic">${ICON[GT_ICON[l.kind]]}</span><span>${esc(l.text)}</span><span class="chev">›</span></button></li>`).join("")}</ul>
      <p class="gt-calm">${esc(G.calm)}</p>` : ""}
      ${G.stale ? `<p class="gt-stale">${esc(G.stale)}</p>` : ""}</div>
  </div>`;
}
const alertsOpen = new Set();   // kinds of alert opened on this visit
function renderAlerts(groups){
  const el = $("#alerts");
  if(!state.plants.length){
    el.innerHTML = `<div class="acard t-info"><div class="a-ic">${ICON.sprout}</div><div class="a-main"><h3>${tr("Start with your plants")}</h3><p class="a-lead">${tr("Add each plant once. Alerts and watering reminders then appear here every day.")}</p></div><div class="a-act"><button class="btn primary" data-act="add">${tr("Add plant")}</button></div></div>`;
    return;
  }
  const today = gardenTodayHtml(groups);
  if(!groups.length){ el.innerHTML = today; return; }
  // One card per kind of alert (frost, heat, wind, watering…), closed by default: the count first, the plants on a tap.
  const kinds = [];
  groups.forEach(g => {
    const L = alertLook(g);
    let k = kinds.find(x => x.type === L.type);
    if(!k) kinds.push(k = {type:L.type, parts:[]});
    k.parts.push({g, L});
  });
  el.innerHTML = today + kinds.map(k => {
    const head = (k.parts.find(x => x.g.level === "danger") || k.parts[0]).L;
    const n = new Set(k.parts.flatMap(x => x.g.items.map(i => i.p.id))).size;
    const open = alertsOpen.has(k.type), many = k.parts.length > 1;
    const chip = k.parts.map(x => x.L.chip).find(Boolean) || "";
    const title = k.type === "water" && k.parts.some(x => x.g.key === "water") ? k.parts.find(x => x.g.key === "water").L.title : head.title;
    const parts = k.parts.map(({g, L}) => {
      const ids = g.items.map(i => i.p.id).join(",");
      const btn = g.move ? `<button class="btn primary" data-act="moveAll" data-to="${g.move}" data-ids="${ids}">${tr("Mark as moved")}</button>`
        : g.waterAll ? `<button class="btn primary" data-act="waterAll" data-ids="${ids}">${tr("Mark all watered")}</button>`
        : g.key === "frostOk" || g.key === "waterUnknown" ? ""
        : `<button class="btn primary" data-act="seePlants" data-ids="${ids}">${tr("See plants")}</button>`;
      return `<div class="a-sub">
        ${many && L.title !== title ? `<h4>${esc(L.title)}</h4>` : ""}
        ${L.lead ? `<p class="a-lead">${esc(L.lead)}</p>` : ""}
        <ul>${g.items.map(i => `<li>${ICON.leaf}<span><span class="pn">${esc(i.p.name)}</span>${i.p.species && i.p.species !== i.p.name ? ` <i>(${esc(i.p.species)})</i>` : ""}<small>${i.stage === "urgent" ? `<b class="st st-urgent">${STAGE_WORD.urgent}</b> · ` : ""}${esc(i.why)}</small>${fbRow(g, i.p)}</span></li>`).join("")}</ul>
        ${L.tip ? `<p class="a-tip">${esc(L.tip)}</p>` : ""}
        ${btn ? `<div class="a-act">${btn}</div>` : ""}
      </div>`;
    }).join("");
    return `<div class="acard agroup t-${k.type} ${open ? "open" : ""}">
      <div class="a-ic">${ICON[head.icon]}</div>
      <button class="a-head" data-atype="${k.type}" aria-expanded="${open}">
        <span class="a-top"><span class="a-lab">${esc(head.label)}</span>${chip ? `<span class="a-chip">${esc(chip)}</span>` : ""}</span>
        <h3>${esc(title)}</h3>
        ${/^\d/.test(title) ? "" : `<span class="a-count">${trn(n, "{n} plant", "{n} plants")}</span>`}
        <svg class="a-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      <div class="a-body" ${open ? "" : "hidden"}>${parts}</div>
    </div>`;
  }).join("");
}
$("#alerts").addEventListener("click", e => {
  const h = e.target.closest("[data-atype]"); if(!h) return;
  const t = h.dataset.atype, card = h.closest(".agroup"), open = !alertsOpen.has(t);
  if(open) alertsOpen.add(t); else alertsOpen.delete(t);
  card.classList.toggle("open", open); h.setAttribute("aria-expanded", open);
  card.querySelector(".a-body").hidden = !open;
});

/* Per-plant status icons, from the same rules as the alerts */
let plantFlags = {};
function flagsFrom(groups){
  const f = {};
  const put = (id, k) => { (f[id] ||= new Set()).add(k); };
  groups.forEach(g => g.items.forEach(i => {
    const k = COLD.includes(g.key) ? "frost" : g.key === "heat" || g.key === "vent" ? "heat" : g.key === "wind" ? "wind"
      : g.key === "water" ? "water" : g.key === "plan" || g.key === "goOut" ? "move" : null;
    if(k) put(i.p.id, k);
    if(g.move) put(i.p.id, "move");
  }));
  return f;
}
const FLAG_INFO = {frost:["snow",tr("Too cold")], heat:["heat",tr("Too hot")], wind:["wind",tr("Strong wind")], water:["drop",tr("Needs water")], move:["move",tr("Time to move")]};
const flagIcons = id => [...(plantFlags[id] || [])].sort().map(k => `<span class="flag f-${k}" title="${FLAG_INFO[k][1]}" aria-label="${FLAG_INFO[k][1]}">${ICON[FLAG_INFO[k][0]]}</span>`).join("");

/* ---------- The illustrated scene ---------- */
/* Positions are % of the square picture. */
/* Positions are % of the square picture. */
const SCENES = {
  house:{
    img:["scene-day.webp","scene-night.webp"], alt:tr("Your house and garden"),
    hot:`<button class="hot" data-go="house" style="left:22%;top:6%;width:44%;height:46%" aria-label="House"></button>
      <button class="hot" data-go="porch" style="left:1%;top:38%;width:36%;height:38%" aria-label="Porch"></button>
      <button class="hot" data-go="greenhouse" style="left:72%;top:43%;width:27%;height:32%" aria-label="Greenhouse"></button>
      <button class="hot base" data-go="outside" style="left:20%;top:50%;width:60%;height:48%" aria-label="Outside"></button>`,
    views:{
      overview:{s:1, cx:50, cy:50, pills:[{k:"house", at:[41,17]}, {k:"porch", at:[15,63]}, {k:"outside", at:[58,88]}, {k:"greenhouse", at:[86,42]}]},
      outside:{s:1.6, cx:58, cy:68, pills:[{z:"out-sun", at:[55,84]}, {z:"out-partial", at:[42,64]}, {z:"out-shade", at:[64,51]}]},
      porch:{s:2.1, cx:25, cy:55, pills:[{z:"porch-partial", at:[25,70]}, {z:"porch-shade", at:[13,50]}]},
      house:{s:1, cx:50, cy:50, interior:true, pills:[{z:"house-window", at:[74,63]}, {z:"house-low", at:[23,62]}, {z:"house-cabinet", at:[45,27]}]}
    },
    title:{overview:"", outside:tr("Outside"), porch:tr("The porch"), house:tr("Inside the house")}
  },
  apartment:{
    img:["apt-day.webp","apt-night.webp"], alt:tr("Your apartment and balcony"),
    hot:`<button class="hot" data-go="house" style="left:20%;top:4%;width:62%;height:44%" aria-label="Inside"></button>
      <button class="hot base" data-go="balcony" style="left:3%;top:44%;width:94%;height:54%" aria-label="Balcony"></button>`,
    views:{
      overview:{s:1, cx:50, cy:50, pills:[{k:"house", at:[51,27]}, {k:"balcony", at:[51,80]}]},
      balcony:{s:1.2, cx:50, cy:58, pills:[{z:"balc-sun", at:[25,64]}, {z:"balc-partial", at:[66,58]}, {z:"balc-shade", at:[77,43]}]},
      house:{s:1, cx:50, cy:50, interior:true, pills:[{z:"house-window", at:[74,63]}, {z:"house-low", at:[23,62]}, {z:"house-cabinet", at:[45,27]}]}
    },
    title:{overview:"", balcony:tr("The balcony"), house:tr("Inside")}
  }
};
const sceneSet = () => SCENES[isApt() ? "apartment" : "house"];
const SCENE_HINT = {overview:tr("Tap an area to look closer.")};
let sceneMode = "overview";
function ensureScene(){
  const el = $("#places");
  const home = isApt() ? "apartment" : "house";
  if(el.querySelector(".orb") && el.dataset.home === home) return;
  el.dataset.home = home; sceneMode = "overview";
  const SS = SCENES[home];
  el.innerHTML = `<div class="scene-top"><button class="round-back" data-act="sceneBack" aria-label="${tr("Back to the whole garden")}">${ICON.back}</button><h2 id="sceneTitle"></h2></div>
    <div class="orb" id="orb">
      <div class="stage" id="stage">
        <img class="img-day" src="${SS.img[0]}" alt="${SS.alt}" draggable="false">
        <img class="img-night" src="${SS.img[1]}" alt="" draggable="false">
        <img class="img-in" src="interior.webp" alt="${tr("Inside the house")}" draggable="false">
        <div class="glow-cab"></div>
        ${SS.hot}
      </div>
      <div class="fx-tint"></div><div class="fx-glow"></div><div class="fx-haze"></div><div class="fx-frost"></div><div class="fx-flash"></div>
      <canvas class="fx" id="fx" aria-hidden="true"></canvas>
      <div class="pills" id="pills"></div>
    </div>
    <p class="scene-hint" id="sceneHint"></p>`;
  el.querySelector(".orb").addEventListener("click", e => {
    const t = e.target.closest("[data-go],[data-pz]"); if(!t) return;
    if(t.dataset.pz){ plantFilter = t.dataset.pz; showTab("plants"); renderPlants(); return; }
    const go = t.dataset.go;
    if(go === "greenhouse"){ plantFilter = "greenhouse"; showTab("plants"); renderPlants(); return; }
    if(sceneMode === "overview") goScene(go);
  });
}
function renderPlaces(W){
  const el = $("#places");
  if(!state.plants.length){ el.innerHTML = ""; return; }
  ensureScene();
  const SS = sceneSet(), S = SS.views[sceneMode] || SS.views.overview, orb = $("#orb"), stage = $("#stage");
  const next3 = W ? W.next.slice(0,3) : [];
  const risk = p => p.current !== "inside" && GA.coldOn(p) && next3.some(d => effMin(p, d) < coldLimit(p));
  const tx = 50 - Math.min(100 - 50 / S.s, Math.max(50 / S.s, S.cx)), ty = 50 - Math.min(100 - 50 / S.s, Math.max(50 / S.s, S.cy));
  stage.style.transform = `scale(${S.s}) translate(${tx}%, ${ty}%)`;
  stage.style.setProperty("--inv", 1 / S.s);
  orb.classList.toggle("inside", !!S.interior);
  orb.classList.toggle("zoomed", sceneMode !== "overview");
  $("#places .scene-top").classList.toggle("show", sceneMode !== "overview");
  $("#sceneTitle").textContent = SS.title[sceneMode] || "";
  $("#sceneHint").textContent = SCENE_HINT[sceneMode] || tr("Tap a spot to see its plants.");
  $("#pills").innerHTML = S.pills.map(pl => {
    const list = state.plants.filter(p => pl.k ? p.area === pl.k : p.zone === pl.z);
    const atRisk = list.some(risk);
    const icon = pl.k ? pl.k : ZONES[pl.z].icon;
    const label = pl.k ? areaLabel(pl.k) : ZONES[pl.z].short;
    const attrs = pl.k ? `data-go="${pl.k}"` : `data-pz="${pl.z}"`;
    const sx = 50 + S.s * (pl.at[0] - 50 + tx), sy = 50 + S.s * (pl.at[1] - 50 + ty);
    return `<button class="pill ${pl.k ? "area" : "spot"} ${atRisk ? "risk" : ""} ${list.length ? "" : "empty"}" ${attrs} style="left:${sx.toFixed(2)}%;top:${sy.toFixed(2)}%" aria-label="${esc(label)}: ${trn(list.length, "{n} plant", "{n} plants")}">
      ${ICON[icon]}${pl.k ? "" : `<span>${esc(label)}</span>`}<b>${list.length}</b></button>`;
  }).join("");
  applySky();
}
function goScene(mode){
  if(mode === sceneMode) return;
  sceneMode = mode;
  renderPlaces(wx());
}

/* Weather on the picture: day/night, sun, cloud, rain, snow, fog, frost */
let fxState = {type:"none", parts:[], raf:0, flashAt:0};
const reduceMotion = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
function skyPhase(){
  const w = state.weather, cur = w && w.current;
  if(!cur) return "day";
  const d = w.daily, i = d.time.indexOf(today());
  const now = Date.now(), near = t => t && Math.abs(now - new Date(t).getTime()) < 30 * 60000;
  if(i >= 0 && d.sunrise && (near(d.sunrise[i]) || near(d.sunset[i]))) return "dusk";
  return cur.is_day === 0 ? "night" : "day";
}
function applySky(){
  const orb = $("#orb"); if(!orb) return applyBackdrop();
  const cur = state.weather && state.weather.current;
  const type = cur ? sky(cur.weather_code) : "partly";
  const phase = skyPhase();
  orb.className = orb.className.replace(/\b(sky-\S+|ph-\S+|frosty)\b/g, "").trim();
  orb.classList.add("sky-" + type, "ph-" + phase);
  if(cur && cur.temperature_2m <= 0 && type !== "snow") orb.classList.add("frosty");
  const want = orb.classList.contains("inside") ? "none" : type === "rain" || type === "storm" ? "rain" : type === "snow" ? "snow" : "none";
  startFx(want, type === "storm");
}
function startFx(type, storm){
  const cv = $("#fx"); if(!cv) return;
  const sameType = fxState.type === type;
  fxState.type = type; fxState.storm = storm;
  const box = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
  if(!box.width) return;
  cv.width = box.width * dpr; cv.height = box.height * dpr;
  const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W = box.width, H = box.height;
  if(!sameType || !fxState.parts.length){
    const n = type === "rain" ? 70 : type === "snow" ? 45 : 0;
    fxState.parts = Array.from({length:n}, () => ({x:Math.random() * W, y:Math.random() * H, v:type === "rain" ? 6 + Math.random() * 4 : .5 + Math.random() * .8, r:type === "snow" ? 1.4 + Math.random() * 2 : 0, ph:Math.random() * 6}));
  }
  cancelAnimationFrame(fxState.raf);
  const draw = () => {
    g.clearRect(0, 0, W, H);
    if(fxState.type === "rain"){
      g.strokeStyle = !document.getElementById("orb") ? "rgba(232,240,248,.6)" : skyPhase() === "night" ? "rgba(205,225,245,.7)" : "rgba(105,135,170,.5)"; g.lineWidth = 1.3; g.beginPath();
      fxState.parts.forEach(p => { g.moveTo(p.x, p.y); g.lineTo(p.x - 2, p.y + 11); });
      g.stroke();
    }else if(fxState.type === "snow"){
      g.fillStyle = "rgba(255,255,255,.92)";
      fxState.parts.forEach(p => { g.beginPath(); g.arc(p.x, p.y, p.r, 0, 7); g.fill(); });
    }
  };
  const step = t => {
    fxState.parts.forEach(p => {
      if(fxState.type === "rain"){ p.y += p.v; p.x -= p.v * .18; }
      else { p.y += p.v; p.x += Math.sin(t / 900 + p.ph) * .35; }
      if(p.y > H + 12){ p.y = -12; p.x = Math.random() * (W + 20); }
    });
    if(fxState.storm && t > fxState.flashAt){ fxState.flashAt = t + 7000 + Math.random() * 9000; const f = document.querySelector(".fx-flash"); if(f){ f.classList.remove("on"); void f.offsetWidth; f.classList.add("on"); } }
    draw();
    fxState.raf = requestAnimationFrame(step);
  };
  const visible = currentTab === "today" && !document.hidden;
  if(type === "none"){ g.clearRect(0, 0, W, H); return; }
  if(reduceMotion() || !visible) draw(); else fxState.raf = requestAnimationFrame(step);
}
document.addEventListener("visibilitychange", () => { if(document.hidden) cancelAnimationFrame(fxState.raf); else applySky(); });
window.addEventListener("resize", () => { fxState.parts = []; applySky(); });
setInterval(() => { if(!document.hidden && currentTab === "today") applySky(); }, 5 * 60000);


/* ---------- Home hero, photo backdrop, locations ---------- */
const SKY_WORD = {clear:tr("Clear"), partly:tr("Partly cloudy"), cloudy:tr("Cloudy"), fog:tr("Fog"), rain:tr("Rain"), snow:tr("Snow"), storm:tr("Thunderstorm")};
function renderHero(W, groups){
  $("#heroPlace").textContent = state.settings.place || tr("Your garden");
  const w = state.weather, cur = w && w.current;
  if(!(cur && W && W.next.length)){
    $("#heroNow").innerHTML = `<span class="hn-wait">${w ? tr("Tap to refresh the weather") : tr("Loading forecast…")}</span>`;
    $("#heroChips").innerHTML = ""; $("#heroUpd").textContent = ""; return;
  }
  const t = W.next[0];
  $("#heroNow").innerHTML = `<span class="hn-ic">${wIcon(cur.weather_code, cur.is_day !== 0)}</span><b class="hn-t">${deg(cur.temperature_2m)}</b><span class="hn-s"><span>${SKY_WORD[sky(cur.weather_code)] || ""}</span><small>${tr("H {t}", {t:deg(t.max)})} · ${tr("L {t}", {t:deg(t.min)})}</small></span>`;
  $("#heroUpd").textContent = updLine(w);
  /* The chips count the same plants as the alerts and Garden today (the next three nights). */
  const r = dayRisks(t), chips = [];
  const coldItems = (groups || []).filter(g => GA.COLD_KEYS.includes(g.key)).flatMap(g => g.items);
  const coldIds = [...new Set(coldItems.map(i => i.p.id))], lowest = coldItems.length ? Math.min(...coldItems.map(i => i.t)) : 99;
  if(coldIds.length) chips.push(`<button class="hchip frost" data-act="seePlants" data-ids="${coldIds.join(",")}">${ICON.snow}<span>${lowest <= 0 ? tr("Frost risk") : tr("Cold night")} · ${trn(coldIds.length, "{n} plant", "{n} plants")}</span></button>`);
  if(r.heat.length) chips.push(`<button class="hchip heat" data-act="seePlants" data-ids="${r.heat.map(p => p.id).join(",")}">${ICON.heat}<span>${tr("Heat")} · ${trn(r.heat.length, "{n} plant", "{n} plants")}</span></button>`);
  const thirsty = state.plants.filter(p => (plantFlags[p.id] || new Set()).has("water"));
  if(thirsty.length) chips.push(`<button class="hchip water" data-act="seePlants" data-ids="${thirsty.map(p => p.id).join(",")}">${ICON.drop}<span>${trn(thirsty.length, "{n} needs water", "{n} need water")}</span></button>`);
  if(!chips.length && state.plants.length) chips.push(`<span class="hchip calm">${ICON.leaf}<span>${tr("All calm today")}</span></span>`);
  $("#heroChips").innerHTML = chips.join("");
}
$("#heroNow").addEventListener("click", () => fetchWeather(true));

function applyBackdrop(){
  const cur = state.weather && state.weather.current, b = document.body;
  const type = cur ? sky(cur.weather_code) : "partly";
  b.dataset.sky = type; b.dataset.phase = skyPhase();
  b.classList.toggle("frosty", !!(cur && cur.temperature_2m <= 0 && type !== "snow"));
  const want = currentTab !== "today" ? "none" : type === "rain" || type === "storm" ? "rain" : type === "snow" ? "snow" : "none";
  startFx(want, type === "storm" && currentTab === "today");
}

const LOCS = () => isApt()
  ? [{k:"house", label:tr("House"), sub:tr("Indoors"), areas:["house"], icon:"house"},
     {k:"balcony", label:tr("Balcony"), sub:tr("Outdoors"), areas:["balcony"], icon:"balcony"}]
  : [{k:"house", label:tr("House"), sub:tr("Indoors"), areas:["house"], icon:"house"},
     {k:"garden", label:tr("Garden"), sub:tr("Outdoors"), areas:["outside","porch"], icon:"leaf"},
     {k:"greenhouse", label:tr("Greenhouse"), sub:tr("Sheltered"), areas:["greenhouse"], icon:"greenhouse"}];
function renderLocations(W){
  const el = $("#locList"); if(!el) return;
  const n = state.plants.length;
  if($("#allCount")) $("#allCount").textContent = trn(n, "{n} plant", "{n} plants");
  $("#locSub").textContent = isApt() ? tr("Two spaces, one home") : tr("Three spaces, one garden");
  const r0 = {frost:state.plants.filter(p => (plantFlags[p.id] || new Set()).has("frost"))};   // same plants as the alerts
  el.innerHTML = LOCS().map(L => {
    const list = state.plants.filter(p => L.areas.includes(p.area));
    const risk = r0.frost.filter(p => L.areas.includes(p.area)).length;
    const thirsty = list.filter(p => (plantFlags[p.id] || new Set()).has("water")).length;
    const spots = [];
    L.areas.forEach(a => {
      if(a === "porch"){ const c = list.filter(p => p.area === "porch").length; spots.push({f:"porch", icon:"porch", label:tr("Porch"), c}); return; }
      AREAS[a].zones.forEach(z => { if(z === "greenhouse") return; spots.push({f:z, icon:ZONES[z].icon, label:ZONES[z].short, c:list.filter(p => p.zone === z).length}); });
    });
    if(L.k === "greenhouse"){ const g = list.filter(p => p.pattern === "greenhouse").length; if(g) spots.push({f:"greenhouse", icon:"snow", label:tr("Wintering guests"), c:g}); }
    const status = risk ? `<span class="lchip frost">${ICON.snow}${tr("{n} at risk from the cold", {n:risk})}</span>` : thirsty ? `<span class="lchip water">${ICON.drop}${trn(thirsty, "{n} needs water", "{n} need water")}</span>` : "";
    const mine = locPicSrc(L.k), canPic = online && !!me && !!token;
    return `<div class="loc loc-${L.k} ${list.length ? "" : "empty"} ${mine ? "has-img" : ""}" style="${mine ? "" : locStyle(look().style, L.k)}">
      ${mine ? `<img class="loc-img" src="${mine}" alt="">` : `<span class="loc-art">${ICON[L.icon]}</span>`}
      ${canPic ? `<button class="loc-pic ${look().locs && look().locs[L.k] ? "on" : ""}" data-locpic="${L.k}" aria-label="${look().locs && look().locs[L.k] ? tr("Change your own {place} photo", {place:L.label.toLowerCase()}) : tr("Add your own {place} photo", {place:L.label.toLowerCase()})}">${look().locs && look().locs[L.k] ? ICON.camera : ICON.plus}</button>` : ""}
      <button class="loc-main" data-loc="${L.k === "garden" ? "garden" : L.areas[0]}" aria-label="${L.label}: ${trn(list.length, "{n} plant", "{n} plants")}">
        <span class="loc-ic">${ICON[L.icon]}</span>
        <span class="loc-t"><b>${L.label}</b><small>${L.sub} · ${list.length ? trn(list.length, "{n} plant", "{n} plants") : tr("no plants yet")}</small></span>
        <span class="chev">›</span>
      </button>
      ${status ? `<div class="loc-status">${status}</div>` : ""}
      ${spots.length > 1 || L.k === "greenhouse" ? `<div class="loc-spots">${spots.filter(x => x.c || L.k !== "greenhouse").map(x => `<button class="spot" data-loc="${x.f}">${ICON[x.icon] || ""}<span>${esc(x.label)}</span><b>${x.c}</b></button>`).join("")}</div>` : ""}
    </div>`;
  }).join("");
}
const LOC_TITLE = {all:tr("All plants"), garden:tr("Garden"), house:tr("House"), greenhouse:tr("Greenhouse"), balcony:tr("Balcony"), porch:tr("Porch"), outside:tr("Open garden"), vault:tr("Only me")};
const plantsTitle = () => idsFilter ? tr("Selected plants") : LOC_TITLE[plantFilter] || (ZONES[plantFilter] ? ZONES[plantFilter].label : tr("Plants"));
$("#view-locations").addEventListener("click", e => {
  const pic = e.target.closest("[data-locpic]"); if(pic){ openLocPic(pic.dataset.locpic); return; }
  const b = e.target.closest("[data-loc]"); if(!b) return;
  idsFilter = null; plantFilter = b.dataset.loc;
  showTab("plants"); renderPlants();
});
