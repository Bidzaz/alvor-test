/* Alvor · Plants: list, grid and tiles, actions, the spot picker, photos, the plant screen, species suggestions.
   Plain script (no build step): loaded by index.html in a fixed order and sharing one global scope. */
"use strict";
/* ---------- Plants: list or grid ---------- */
let plantView = (() => { try{ const v = localStorage.getItem("garden-view"); return ["list","grid","tiles"].includes(v) ? v : "list"; }catch(e){ return "list"; } })();
let idsFilter = null;
function renderPlants(){
  const pt = $("#plantsTitle"); if(pt) pt.textContent = plantsTitle();
  const counts = {all:state.plants.length};
  ALL_AREAS.forEach(a => counts[a] = state.plants.filter(p => p.area === a).length);
  counts.vault = online ? state.plants.filter(p => visOf(p) === "vault").length : 0;
  if(plantFilter === "vault" && !counts.vault) plantFilter = "all";
  const chips = ["all", ...ALL_AREAS.filter(a => counts[a]), ...(counts.vault ? ["vault"] : [])];
  if(ZONES[plantFilter] && plantFilter !== "greenhouse") chips.push(plantFilter);
  $("#chips").innerHTML = (idsFilter ? `<button class="chip" data-act="clearIds" aria-pressed="true">${tr("From the alert: {n}", {n:idsFilter.length})} ✕</button>` : "") +
    chips.map(k => {
      const label = k === "all" ? tr("All") : k === "vault" ? `${ICON.lock}${tr("Vault")}` : AREAS[k] ? areaLabel(k) : ZONES[k].label;
      const n = k === "all" || k === "vault" ? counts[k] : AREAS[k] ? counts[k] : state.plants.filter(p => p.zone === k).length;
      return `<button class="chip" data-act="filter" data-f="${k}" aria-pressed="${!idsFilter && plantFilter === k}">${label} ${n}</button>`;
    }).join("");
  document.querySelectorAll("[data-view]").forEach(b => b.setAttribute("aria-pressed", b.dataset.view === plantView));
  const q = $("#search").value.trim().toLowerCase();
  const W = wx();
  const match = p => idsFilter ? idsFilter.includes(p.id) : plantFilter === "all" || (plantFilter === "vault" ? visOf(p) === "vault" : plantFilter === "garden" ? (p.area === "outside" || p.area === "porch") : p.area === plantFilter || p.zone === plantFilter);
  const list = state.plants.filter(p => match(p) && (!q || [p.name, p.species, p.genus, p.notes].join(" ").toLowerCase().includes(q)));
  const el = $("#plantList");
  el.className = "plist v-" + plantView;
  if(!state.plants.length){
    el.innerHTML = `<div class="empty"><h3>${tr("No plants yet")}</h3><p>${tr("Tap Add plant and take a photo; the app suggests the species for you.")}</p><button class="btn primary" data-act="add">${tr("Add plant")}</button></div>`;
    return;
  }
  if(!list.length){ el.innerHTML = `<p style="color:var(--muted)">${tr("No plants match. Clear the search or pick another filter.")}</p>`; return; }
  const by = Object.fromEntries(ALL_AREAS.map(a => [a, []]));
  list.sort((a, b) => a.name.localeCompare(b.name)).forEach(p => by[p.area].push(p));
  el.innerHTML = ALL_AREAS.filter(a => by[a].length).map(a => `
    <h2 class="group-h">${zi(a)} ${areaLabel(a)} <small>${by[a].length}</small></h2>
    <div class="pgroup">${by[a].map(p => plantView === "grid" ? plantCard(p, W) : plantView === "tiles" ? plantTile(p) : plantRow(p, W)).join("")}</div>`).join("");
}
const vaultMark = p => online && visOf(p) === "vault" ? `<span class="vmark" title="${tr("In your Vault: only you see it")}" aria-label="${tr("(in your Vault)")}">${ICON.lock}</span>` : "";
function thumbHtml(p){
  const ph = latestPhoto(p.id);
  return ph ? `<img src="${ph.data}" alt="">` : `<span class="initial a-${p.area}">${esc((p.name || "?").trim().charAt(0).toUpperCase())}</span>`;
}
function wateredText(p, W){
  const st = waterStatus(p, W);
  return st.days === null ? tr("never watered") : st.byRain ? tr("rain {n}d ago", {n:st.days}) : tr("watered {n}d ago", {n:st.days});
}
const ownMini = p => online && me && token && typeof miniCounts === "function" ? miniCounts({owner:me.id, type:"plant", id:p.id}) : "";
const plantBg = p => { const ph = latestPhoto(p.id); return ph ? `<img class="p-bg" src="${ph.data}" alt="" aria-hidden="true">` : ""; };
function plantRow(p, W){
  return `<div class="plant ${latestPhoto(p.id) ? "has-bg" : ""}">${plantBg(p)}
    <button class="thumb" data-act="edit" data-id="${p.id}" aria-label="${tr("Open {name}", {name:esc(p.name)})}">${thumbHtml(p)}</button>
    <div class="pmain"><button class="nm" data-act="edit" data-id="${p.id}">${esc(p.name)}${vaultMark(p)}</button>
      ${p.species ? `<div class="sp">${esc(p.species)}</div>` : ""}
      <div class="where">${zi(p.zone)}<span>${esc(zoneLabel(p))}</span></div>${ownMini(p)}</div>
    <div class="flags">${flagIcons(p.id)}</div>
    <div class="facts">${coldTag(p)}<span class="tag">${wateredText(p, W)}</span>
      <span class="acts"><button class="btn small" data-act="move" data-id="${p.id}">${tr("Move")}</button><button class="btn small primary" data-act="water" data-id="${p.id}">${tr("Watered")}</button></span></div>
  </div>`;
}
/* Small tiles: four plants a row, just the photo and the name; tap to open */
function plantTile(p){
  return `<button class="ptile" data-act="edit" data-id="${p.id}" aria-label="${tr("Open {name}", {name:esc(p.name)})}">${thumbHtml(p)}
    <span class="pt-flags">${flagIcons(p.id)}</span><span class="pt-name">${vaultMark(p)}${esc(p.name)}</span></button>`;
}
function plantCard(p, W){
  return `<div class="pcard ${latestPhoto(p.id) ? "has-bg" : ""}">${plantBg(p)}
    <button class="pc-photo" data-act="edit" data-id="${p.id}" aria-label="${tr("Open {name}", {name:esc(p.name)})}">${thumbHtml(p)}<span class="pc-flags">${flagIcons(p.id)}</span></button>
    <div class="pc-body">
      <button class="nm" data-act="edit" data-id="${p.id}">${esc(p.name)}${vaultMark(p)}</button>
      ${p.species ? `<div class="sp">${esc(p.species)}</div>` : ""}
      <div class="where">${zi(p.zone)}<span>${esc(ZONES[p.zone].short)}</span></div>${ownMini(p)}
      <div class="pc-acts"><button class="icon-btn" data-act="move" data-id="${p.id}" aria-label="${tr("Move {name}", {name:esc(p.name)})}">${ICON.move}</button><button class="icon-btn water" data-act="water" data-id="${p.id}" aria-label="${tr("Mark {name} watered", {name:esc(p.name)})}">${ICON.drop}</button></div>
    </div>
  </div>`;
}
document.querySelectorAll("[data-view]").forEach(b => b.addEventListener("click", () => {
  plantView = b.dataset.view; try{ localStorage.setItem("garden-view", plantView); }catch(e){}
  renderPlants();
}));

function renderLog(){
  const el = $("#logList");
  if(!state.log.length){ el.innerHTML = `<div class="empty"><h3>${tr("No history yet")}</h3><p>${tr("Every watering and every move you log shows up here.")}</p></div>`; return; }
  const names = Object.fromEntries(state.plants.map(p => [p.id, p.name]));
  let html = "", lastDay = "";
  for(const e of state.log.slice(0,300)){
    const d = new Date(e.t), key = ymd(d);
    if(key !== lastDay){ html += `<div class="log-day">${d.toLocaleDateString(LOCALE,{weekday:"long", day:"numeric", month:"long"})}</div>`; lastDay = key; }
    html += `<div class="log-row"><span>${esc(names[e.plantId] || tr("Deleted plant"))}</span><span>${esc(logText(e.detail))}</span></div>`;
  }
  el.innerHTML = html;
}

/* ---------- Actions ---------- */
function water(ids){
  const t = today();
  ids.forEach(id => { const p = state.plants.find(x => x.id === id); if(p){ p.lastWatered = t; addLog(id,"water","Watered"); }});
  save(); render(); toast(ids.length > 1 ? tr("{n} plants watered", {n:ids.length}) : tr("Watered"));
}
function setZone(p, z, planting){
  planting = canGround(z) ? (planting || p.planting || "pot") : "pot";
  if(!ZONES[z] || (p.zone === z && p.planting === planting)) return false;
  const old = p.zone, oldPlant = p.planting;
  if(ZONES[old] && ZONES[old].area === "house") p.lastInside = old;
  if(ZONES[old] && (ZONES[old].area === "outside" || ZONES[old].area === "balcony")) p.lastOutside = old;
  applyZone(p, z, planting);
  let text = `Moved to: ${ZONES[z].label}`;
  if(planting === "ground" && oldPlant !== "ground") text = `Planted in the ground (${ZONES[z].short.toLowerCase()})`;
  else if(oldPlant === "ground" && planting !== "ground") text = `Dug up, now: ${ZONES[z].label}`;
  addLog(p.id, "move", text);
  return true;
}
/* From alert buttons: "inside", "greenhouse" or "outside"; goes back to the plant's usual spot. */
function moveGroup(ids, to){
  ids.forEach(id => {
    const p = state.plants.find(x => x.id === id); if(!p) return;
    const z = to === "inside" ? (p.lastInside || "house-window") : to === "greenhouse" ? "greenhouse" : (p.lastOutside || (isApt() ? "balc-sun" : "out-sun"));
    setZone(p, z, "pot");
  });
  save(); render(); toast(tr("Moved"));
}

/* A two-step spot picker: area, then light (and pot or ground outside). Used by Move, Add and Edit. */
/* The spot picker follows the way people think: where roughly, then the details, then pot or ground only where both are possible. */
const TOPS = {
  inside:{label:tr("Inside"), icon:"house", cls:"house", lead:tr("Where inside?")},
  outside:{label:tr("Outside"), icon:"outside", cls:"outside", lead:tr("Where outside?")},
  greenhouse:{label:tr("Greenhouse"), icon:"greenhouse", cls:"greenhouse", lead:""},
  balcony:{label:tr("Balcony"), icon:"balcony", cls:"balcony", lead:tr("Which part of the balcony?")}
};
const topOf = area => area === "house" ? "inside" : area === "porch" ? "outside" : area || null;
const topList = () => isApt() ? ["inside","balcony"] : ["inside","outside","greenhouse"];
function pickerHtml(sel){
  const top = sel.top || topOf(sel.area);
  const tops = topList();
  const topBtn = t => `<button class="area-opt ${top === t ? "on" : ""}" data-ptop="${t}" aria-pressed="${top === t}"><span class="zi a-${TOPS[t].cls}">${ICON[TOPS[t].icon]}</span><b>${TOPS[t].label}</b></button>`;
  const opt = z => `<button class="zone-opt" data-pzone="${z}" aria-pressed="${sel.zone === z}">${zi(z)}<span><b>${ZONES[z].short}</b><small>${ZONES[z].hint}</small></span></button>`;
  let html = `<div class="area-row" style="grid-template-columns:repeat(${tops.length},minmax(0,1fr))">${tops.map(topBtn).join("")}</div>`;
  if(top === "inside") html += `<p class="pick-lead">${TOPS.inside.lead}</p><div class="zone-pick">${AREAS.house.zones.map(opt).join("")}</div>`;
  else if(top === "outside") html += `<p class="pick-lead">${TOPS.outside.lead}</p><div class="zone-pick"><h3 class="pick-h">${tr("In the garden")}</h3>${AREAS.outside.zones.map(opt).join("")}<h3 class="pick-h">${tr("On the porch")} <span>${tr("covered, rain doesn't reach")}</span></h3>${AREAS.porch.zones.map(opt).join("")}</div>`;
  else if(top === "balcony") html += `<p class="pick-lead">${TOPS.balcony.lead}</p><div class="zone-pick">${AREAS.balcony.zones.map(opt).join("")}</div>`;
  if(sel.zone && canGround(sel.zone) && top === topOf(ZONES[sel.zone].area))
    html += `<p class="pick-lead">${tr("How is it planted?")}</p><div class="seg small plant-seg" role="radiogroup" aria-label="${tr("Planted")}"><button data-pplant="pot" aria-pressed="${sel.planting !== "ground"}">${ICON.pot} ${tr("In a pot")}</button><button data-pplant="ground" aria-pressed="${sel.planting === "ground"}">${ICON.ground} ${tr("In the ground")}</button></div>`;
  return html;
}
function pickerClick(e, sel){
  const b = e.target.closest("[data-ptop],[data-pzone],[data-pplant]"); if(!b) return null;
  if(b.dataset.ptop){
    sel.top = b.dataset.ptop;
    if(sel.top === "greenhouse"){ sel.zone = "greenhouse"; sel.area = "greenhouse"; }
    else if(!sel.zone || topOf(ZONES[sel.zone].area) !== sel.top){ sel.zone = null; sel.area = null; }
    return "top";
  }
  if(b.dataset.pzone){ sel.zone = b.dataset.pzone; sel.area = ZONES[sel.zone].area; sel.top = topOf(sel.area); return "zone"; }
  sel.planting = b.dataset.pplant; return "plant";
}
const moveDlg = $("#moveDlg");
let movingId = null, moveSel = null;
function openMove(id){
  const p = state.plants.find(x => x.id === id); if(!p) return;
  movingId = id; moveSel = {area:p.area, zone:p.zone, planting:p.planting, top:topOf(p.area)};
  $("#moveTitle").textContent = tr("Move {name}", {name:p.name});
  $("#zonePick").innerHTML = pickerHtml(moveSel);
  moveDlg.showModal();
}
$("#zonePick").addEventListener("click", e => {
  const what = pickerClick(e, moveSel); if(!what) return;
  const p = state.plants.find(x => x.id === movingId);
  const done = (what === "zone" && !canGround(moveSel.zone)) || (what === "plant" && moveSel.zone);
  if(done && p){
    if(setZone(p, moveSel.zone, moveSel.planting)){ save(); render(); toast(zoneLabel(p)); }
    moveDlg.close(); return;
  }
  $("#zonePick").innerHTML = pickerHtml(moveSel);
});
$("#moveClose").addEventListener("click", () => moveDlg.close());

document.addEventListener("click", e => {
  const b = e.target.closest("[data-act]"); if(!b) return;
  const act = b.dataset.act, ids = (b.dataset.ids || "").split(",").filter(Boolean);
  if(act === "add") openWizard();
  else if(act === "edit") openDialog(b.dataset.id);
  else if(act === "water") water([b.dataset.id]);
  else if(act === "waterAll") water(ids);
  else if(act === "move") openMove(b.dataset.id);
  else if(act === "moveAll") moveGroup(ids, b.dataset.to);
  else if(act === "seePlants"){ idsFilter = ids; showTab("plants"); renderPlants(); }
  else if(act === "clearIds"){ idsFilter = null; renderPlants(); }
  else if(act === "sceneBack") goScene("overview");
  else if(act === "viewPhoto") viewPhoto(b.dataset.ph);
  else if(act === "filter"){ idsFilter = null; plantFilter = b.dataset.f; renderPlants(); }
});

/* ---------- The round menu ---------- */
const dial = $("#dial");
document.addEventListener("click", e => {
  const b = e.target.closest("[data-tab]"); if(!b) return;
  if(b.dataset.all){ idsFilter = null; plantFilter = "all"; }   // the Plants button always opens the whole list
  showTab(b.dataset.tab, b.dataset.all ? "plants" : "");
  if(b.dataset.all) renderPlants();
});
let plantsFrom = "locations";   // which bar button stays lit on the plant list: Plants, or Locations when a place was opened
function showTab(tab, from){
  currentTab = tab;
  if(tab === "plants"){ plantsFrom = from || "locations"; const rb = $("#view-plants .round-back"); if(rb) rb.hidden = plantsFrom === "plants"; }
  if(tab !== "plants") idsFilter = null;
  const main = tab === "log" || tab === "profile" ? "settings" : tab === "friend" ? "friends" : tab === "plants" ? plantsFrom : tab;
  document.body.dataset.page = tab;
  document.querySelectorAll("#dial [data-tab]").forEach(b => { if(b.dataset.tab === main) b.setAttribute("aria-current","page"); else b.removeAttribute("aria-current"); });
  ["today","locations","plants","log","settings","profile","friends","friend"].forEach(t => $("#view-" + t).hidden = t !== tab);
  if(tab === "settings") fillSettings();
  if(tab === "profile") fillProfile();
  if(tab === "friends") openFriends();
  if(tab === "friend") renderFriend();
  if(tab === "today") applySky(); else { cancelAnimationFrame(fxState.raf); applyBackdrop(); }
  applyLook();
  dial.classList.remove("folded");
  window.scrollTo(0,0);
}
$("#search").addEventListener("input", renderPlants);
$("#addBtn").addEventListener("click", () => openWizard());

/* ---------- Photos ---------- */
const idb = (() => {
  let dbp;
  const db = () => dbp ||= new Promise((res, rej) => {
    const r = indexedDB.open("garden-photos", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("photos", {keyPath:"id"});
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  const run = async (mode, fn) => {
    const d = await db();
    return new Promise((res, rej) => {
      const t = d.transaction("photos", mode), req = fn(t.objectStore("photos"));
      t.oncomplete = () => res(req ? req.result : undefined); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    });
  };
  return {put:ph => run("readwrite", s => s.put(ph)), del:id => run("readwrite", s => s.delete(id)),
    all:() => run("readonly", s => s.getAll()), clear:() => run("readwrite", s => s.clear())};
})();
let photos = {};   // plantId -> newest first
let pending = [];  // photos for a plant not saved yet
const latestPhoto = id => (photos[id] || [])[0];
const sortPh = a => a.sort((x,y) => y.ts - x.ts);
async function loadPhotos(){
  try{
    const all = await idb.all(); photos = {};
    all.forEach(ph => (photos[ph.plantId] ||= []).push(ph));
    Object.values(photos).forEach(sortPh);
  }catch(e){}
  renderPlants();
}
/* Photos are kept at up to 2000 px (about 0.3 to 0.6 MB); friends get an 800 px copy. */
async function drawJpeg(src, max, quality){
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = src; });
  const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas");
  c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return c;
}
async function resizeImage(file){
  const url = URL.createObjectURL(file);
  try{ return (await drawJpeg(url, 2000, 0.8)).toDataURL("image/jpeg", 0.8); }
  finally{ URL.revokeObjectURL(url); }
}
const smallJpeg = async data => { const c = await drawJpeg(data, 800, 0.78); return new Promise(res => c.toBlob(res, "image/jpeg", 0.78)); };
const dataToBlob = async data => (await fetch(data)).blob();
const blobToData = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
const galleryList = () => editingId ? (photos[editingId] || []) : pending;
function renderGallery(){
  const list = galleryList();
  $("#gallery").innerHTML = list.length ? list.map(ph =>
    `<button class="ph" data-act="viewPhoto" data-ph="${ph.id}"><img src="${ph.data}" alt="${tr("Photo from {date}", {date:ph.date})}">${ph.hidden && online ? `<span class="ph-hid" title="${tr("Hidden from friends")}">${ICON.eyeOff}</span>` : ""}${parseDay(ph.date).toLocaleDateString(LOCALE,{day:"numeric",month:"short",year:"2-digit"})}</button>`).join("")
    : `<p class="none">${tr("No photos yet. The newest photo becomes the plant's picture.")}</p>`;
}
$("#addPhoto").addEventListener("click", () => $("#photoFile").click());
$("#takePhoto").addEventListener("click", () => $("#photoCam").click());
$("#photoCam").addEventListener("change", e => $("#photoFile").dispatchEvent(new CustomEvent("change", {detail:e.target})));
$("#photoFile").addEventListener("change", async e => {
  const input = e.detail || e.target;
  const files = [...input.files]; input.value = "";
  for(const f of files){
    try{
      const ph = {id:uid(), plantId:editingId, date:today(), ts:Date.now(), data:await resizeImage(f)};
      if(editingId){
        await idb.put(ph);
        (photos[editingId] ||= []).unshift(ph);
        addLog(editingId, "photo", "Photo added"); save();
      }else pending.unshift(ph);
    }catch(err){ toast(tr("Couldn't add that photo")); }
  }
  renderGallery(); renderPlants(); renderLog();
});
let viewing = null;
const viewer = $("#viewer");
function viewPhoto(id){
  viewing = galleryList().find(p => p.id === id); if(!viewing) return;
  $("#viewerImg").src = viewing.data;
  $("#viewerDate").textContent = parseDay(viewing.date).toLocaleDateString(LOCALE,{day:"numeric",month:"long",year:"numeric"});
  fillViewerHide();
  viewer.showModal();
}
/* "Hide this photo": friends never see it, even when the plant is shared. */
function fillViewerHide(){
  const h = !!(viewing && viewing.hidden);
  $("#viewerHide").hidden = !online;
  $("#viewerHide").textContent = h ? tr("Show to friends") : tr("Hide from friends");
  $("#viewerHid").innerHTML = h && online ? ` · ${ICON.eyeOff} ${tr("Hidden from friends")}` : "";
}
$("#viewerHide").addEventListener("click", async () => {
  if(!viewing) return;
  viewing.hidden = !viewing.hidden;
  if(viewing.plantId){ viewing.hideDirty = true; try{ await idb.put(viewing); }catch(e){} queuePhotoSync(); }
  fillViewerHide(); renderGallery();
  toast(viewing.hidden ? tr("Hidden from friends") : tr("Friends can see this photo"));
});
$("#viewerClose").addEventListener("click", () => viewer.close());
$("#viewerDelete").addEventListener("click", async () => {
  if(!viewing || !confirm(tr("Delete this photo?"))) return;
  if(viewing.plantId){
    try{ await idb.del(viewing.id); }catch(e){}
    forgetPhoto(viewing.id);
    photos[viewing.plantId] = (photos[viewing.plantId] || []).filter(p => p.id !== viewing.id);
  }else pending = pending.filter(p => p.id !== viewing.id);
  viewer.close(); renderGallery(); renderPlants(); toast(tr("Photo deleted"));
});

/* ---------- Dialog ---------- */
const dlg = $("#dlg");
$("#presetList").innerHTML = PRESETS.map(p => `<option value="${esc(p.s)}"></option>`).join("");
let editSel = {area:"outside", zone:"out-sun", planting:"pot"};
/* "Visible to: Friends · Change", shared by the edit screen and the add-plant steps. */
const defaultVis = () => (me && VIS[me.defaultVisibility] && me.defaultVisibility) || "vault";
function visBlock(vis, open){
  const v = VIS[vis] || VIS.vault;
  return `<div class="vis-row"><span class="vis-ic">${v.icon}</span><span>${tr("Visible to:")} <b>${v.label}</b></span><button type="button" class="linkish" data-vis-change>${open ? tr("Done") : tr("Change")}</button></div>` +
    (open ? `<div class="seg small vis-seg" role="radiogroup" aria-label="${tr("Visible to")}">${["friends","vault"].map(k => `<button type="button" role="radio" data-vis="${k}" aria-pressed="${k === vis}">${VIS[k].icon}${VIS[k].short}</button>`).join("")}</div><p class="status">${v.hint}</p>` : "");
}
function onVisClick(e, st, el){
  const c = e.target.closest("[data-vis-change]"), v = e.target.closest("[data-vis]");
  if(c) st.visOpen = !st.visOpen;
  else if(v) st.visibility = v.dataset.vis;
  else return;
  el.innerHTML = visBlock(st.visibility, st.visOpen);
  if(st.visOpen) el.scrollIntoView({block:"nearest", behavior:"smooth"});
}
let editVis = {visibility:"vault", visOpen:false};
$("#fVis").addEventListener("click", e => onVisClick(e, editVis, $("#fVis")));
const drawEditPick = () => { $("#fZonePick").innerHTML = pickerHtml(editSel); };
$("#fZonePick").addEventListener("click", e => { if(pickerClick(e, editSel)) drawEditPick(); });
attachSuggest($("#fSpecies"), it => { $("#fGenus").value = it.genus; showPresetNote(); $("#fSpecies").dispatchEvent(new Event("change")); });
function showPresetNote(){
  const p = presetFor($("#fSpecies").value), n = $("#presetNote");
  if(p && p.note){ n.textContent = tr(p.note); n.hidden = false; } else n.hidden = true;
}
function openDialog(id){
  editingId = id;
  const p = id ? state.plants.find(x => x.id === id) : null;
  $("#dlgTitle").textContent = p ? tr("Edit plant") : tr("Add plant");
  $("#dlgDelete").hidden = !p;
  $("#fName").value = p ? p.name : "";
  $("#fSpecies").value = p ? p.species : "";
  $("#fGenus").value = p ? (p.genus || "") : "";
  $("#fPattern").innerHTML = patternOptions();
  $("#fPattern").value = p ? (isApt() && p.pattern === "greenhouse" ? "mover" : p.pattern) : "outdoor";
  editSel = p ? {area:p.area, zone:p.zone, planting:p.planting} : {area:"outside", zone:"out-sun", planting:"ground"};
  drawEditPick();
  $("#fMin").value = p && hasMin(p) ? p.minTemp : "";
  $("#fCold").checked = p ? p.coldAlert !== false : true;
  coldHintEdit();
  $("#fWs").value = p ? p.ws : 7;
  $("#fWw").value = p ? p.ww : 14;
  $("#fLast").value = p && p.lastWatered ? p.lastWatered : "";
  $("#fNotes").value = p ? p.notes : "";
  showPresetNote();
  pending = [];
  renderGallery();
  const hist = p ? state.log.filter(e => e.plantId === p.id).slice(0, 25) : [];
  $("#plantHistBox").hidden = !p;
  const ownT = p && online && token && me ? {owner:me.id, type:"plant", id:p.id, name:p.name, ownerName:tr("You")} : null;
  const showTalk = ownT && (visOf(p) !== "vault" || talkCount(ownT).r || talkCount(ownT).c);
  $("#plantTalkBox").hidden = !showTalk;
  if(showTalk) mountTalk($("#plantTalk"), ownT, "full"); else $("#plantTalk").innerHTML = "";
  editVis = {visibility:p ? visOf(p) : defaultVis(), visOpen:false};
  $("#fVis").hidden = !online;
  $("#fVis").innerHTML = visBlock(editVis.visibility, false);
  $("#plantHist").innerHTML = hist.length ? hist.map(e => `<div class="ph-row"><span class="ph-dot t-${e.type}"></span><span>${esc(logText(e.detail))}</span><small>${new Date(e.t).toLocaleDateString(LOCALE, {day:"numeric", month:"short"})}</small></div>`).join("")
    : `<p class="status" style="margin:0">${tr("Nothing logged yet.")}</p>`;
  dlg.showModal();
  if(!p) $("#fName").focus();
}

$("#fSpecies").addEventListener("change", () => {
  const pr = presetFor($("#fSpecies").value);
  showPresetNote();
  if(!pr) return;
  const isNew = !editingId;
  if(isNew || $("#fMin").value === "") $("#fMin").value = pr.min;
  if(isNew){
    $("#fPattern").value = isApt() && pr.pat === "greenhouse" ? "mover" : pr.pat;
    if(pr.ws) $("#fWs").value = pr.ws;
    if(pr.ww) $("#fWw").value = pr.ww;
    $("#fCold").checked = coldDefault(pr.min); coldHintEdit();
    if(!$("#fName").value.trim()) $("#fName").value = pr.s;
  }
});
const COLD_HINT_ON = tr("You're warned when the forecast gets close to the lowest temperature it takes.");
const COLD_HINT_OFF = tr("No low temperature warnings for this plant. Heat, wind and watering reminders still come.");
function coldHintEdit(){ $("#fColdHint").textContent = $("#fCold").checked ? COLD_HINT_ON : COLD_HINT_OFF; }
$("#fCold").addEventListener("change", coldHintEdit);
$("#dlgClose").addEventListener("click", () => dlg.close());
$("#dlgSave").addEventListener("click", async () => {
  const name = $("#fName").value.trim();
  const min = parseFloat($("#fMin").value);
  if(!name){ toast(tr("Give the plant a name")); $("#fName").focus(); return; }
  const coldAlert = $("#fCold").checked;
  if(coldAlert && isNaN(min)){ toast(tr("Add the lowest temperature it takes, or switch low temperature warnings off")); $("#fMin").focus(); return; }
  const data = {
    name, species:$("#fSpecies").value.trim(), genus:$("#fGenus").value.trim() || ($("#fSpecies").value.trim().split(" ")[0] || ""), pattern:$("#fPattern").value, minTemp:isNaN(min) ? null : min, coldAlert,
    ws:Math.max(1, parseInt($("#fWs").value) || 7), ww:Math.max(1, parseInt($("#fWw").value) || 14),
    lastWatered:$("#fLast").value || null, notes:$("#fNotes").value.trim(), visibility:editVis.visibility
  };
  if(editingId){
    const p = state.plants.find(x => x.id === editingId);
    if(online && visOf(p) !== data.visibility) addLog(p.id, "share", data.visibility === "vault" ? "Moved to the Vault" : "Shared with friends");
    Object.assign(p, data);
    if(editSel.zone) setZone(p, editSel.zone, editSel.planting);
  }else{
    const p = {id:uid(), created:new Date().toISOString(), ...data};
    applyZone(p, editSel.zone || "out-sun", editSel.planting);
    state.plants.push(p); addLog(p.id, "add", "Added");
    if(pending.length){
      for(const ph of pending){ ph.plantId = p.id; try{ await idb.put(ph); }catch(e){ toast(tr("Couldn't save the photo")); } }
      photos[p.id] = sortPh(pending); pending = [];
    }
  }
  save(); dlg.close(); render(); toast(tr("Plant saved"));
});
$("#dlgDelete").addEventListener("click", async () => {
  const p = state.plants.find(x => x.id === editingId); if(!p) return;
  if(!confirm(tr("Delete {name}? Its history stays in the log.", {name:p.name}))) return;
  for(const ph of photos[editingId] || []){ try{ await idb.del(ph.id); }catch(e){} }
  delete photos[editingId];
  state.plants = state.plants.filter(x => x.id !== editingId);
  save(); dlg.close(); render(); toast(tr("Plant deleted"));
});

/* ---------- Species suggestions while typing ---------- */
const SPX = (() => {
  const genera = [], species = [];
  /* Common names in the app's language (species-es.js…); search finds the English names too. */
  const words = (a, b) => [...new Set(fold(`${a} ${b}`.toLowerCase()).split(/[\s-]+/).filter(Boolean))];
  (window.GARDEN_SPECIES || []).forEach(([g, common, family, list]) => {
    const cg = plantName(g, common);
    genera.push({kind:"genus", name:g, genus:g, family, common:cg, key:g.toLowerCase(), words:words(cg, common), other:common.toLowerCase()});
    list.forEach(([ep, c]) => { const cs = plantName(`${g} ${ep}`, c);
      species.push({kind:"species", name:`${g} ${ep}`, genus:g, family, common:cs, key:`${g} ${ep}`.toLowerCase(), words:words(cs, c), other:c.toLowerCase()}); });
  });
  return {genera, species};
})();
function searchSpecies(q){
  q = q.replace(/^\s+/, "").toLowerCase().replace(/\s+/g, " ");
  if(!q.trim()) return [];
  const byName = (a, b) => a.name.localeCompare(b.name);
  if(q.includes(" ")) return SPX.species.filter(x => x.key.startsWith(q)).sort(byName).slice(0, 30);
  q = q.trim();
  const sci = SPX.genera.filter(x => x.key.startsWith(q)).sort(byName);
  if(q.length < 3) return sci;
  const seen = new Set(sci.map(x => x.name));
  const common = [...SPX.genera, ...SPX.species].filter(x => !seen.has(x.name) && (x.words.some(w => w.startsWith(fold(q))) || fold(x.common.toLowerCase()).startsWith(fold(q)) || x.other.startsWith(q))).sort(byName);
  return [...sci, ...common].slice(0, 30);
}
const gbifCache = {};
async function gbifSpecies(q){
  const k = q.trim().toLowerCase();
  if(gbifCache[k]) return gbifCache[k];
  try{
    const r = await fetch(`https://api.gbif.org/v1/species/suggest?q=${encodeURIComponent(q.trim())}&limit=10&highertaxonKey=6`);
    const j = await r.json();
    const out = [], seen = new Set();
    (j || []).forEach(x => {
      const name = x.canonicalName; if(!name || seen.has(name) || !/^(SPECIES|GENUS)$/.test(x.rank)) return;
      seen.add(name);
      out.push({kind:x.rank === "GENUS" ? "genus" : "species", name, genus:x.genus || name.split(" ")[0], family:x.family || "", common:"", gbif:true});
    });
    return gbifCache[k] = out.sort((a, b) => a.name.localeCompare(b.name));
  }catch(e){ return []; }
}
/* Adds a suggestion list under a species field. onPick gets {name, genus, family, common}. */
function attachSuggest(input, onPick){
  const wrap = document.createElement("div"); wrap.className = "sg-wrap";
  input.parentNode.insertBefore(wrap, input); wrap.appendChild(input);
  const box = document.createElement("div"); box.className = "sg-list"; box.hidden = true; box.setAttribute("role", "listbox");
  wrap.appendChild(box);
  let items = [], timer = null, seq = 0;
  const row = (x, i) => `<button type="button" class="sg-item" data-i="${i}" role="option"><i>${esc(x.name)}</i>${x.kind === "genus" ? `<span class="sg-tag">${tr("genus")}</span>` : ""}${x.common && x.common !== x.name ? `<small>${esc(x.common)}</small>` : ""}</button>`;
  function draw(local, remote){
    items = [...local, ...remote];
    if(!items.length){ box.hidden = true; return; }
    box.innerHTML = local.map(row).join("") + (remote.length ? `<div class="sg-h">${tr("More species from GBIF")}</div>` + remote.map((x, j) => row(x, local.length + j)).join("") : "");
    box.hidden = false;
  }
  function update(){
    const q = input.value, my = ++seq;
    const local = searchSpecies(q);
    draw(local, []);
    clearTimeout(timer);
    if(q.trim().length >= 3 && local.length < 5 && online){
      timer = setTimeout(async () => {
        const have = new Set(local.map(x => x.name));
        const remote = (await gbifSpecies(q)).filter(x => !have.has(x.name));
        if(my === seq && document.activeElement === input) draw(local, remote);
      }, 350);
    }
  }
  input.addEventListener("input", update);
  input.addEventListener("focus", () => { if(input.value.trim()) update(); });
  input.addEventListener("blur", () => setTimeout(() => { box.hidden = true; }, 180));
  input.addEventListener("keydown", e => { if(e.key === "Escape") box.hidden = true; });
  box.addEventListener("mousedown", e => e.preventDefault());
  box.addEventListener("click", e => {
    const b = e.target.closest(".sg-item"); if(!b) return;
    const it = items[+b.dataset.i];
    if(it.kind === "genus" && !it.gbif){
      input.value = it.name + " ";
      onPick({name:it.name, genus:it.genus, family:it.family, common:""});
      input.focus(); update();
      return;
    }
    input.value = it.name; box.hidden = true;
    onPick({name:it.name, genus:it.genus, family:it.family, common:it.common});
  });
}
