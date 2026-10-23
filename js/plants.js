/* Alvor · Plants: list, grid and tiles, actions, the spot picker, photos, the plant screen, species suggestions.
   Plain script (no build step): loaded by index.html in a fixed order and sharing one global scope. */
"use strict";
/* ---------- Plants: list or grid ---------- */
/* Two views: a list, and a grid of photos ("tiles" from before is the grid now). */
let plantView = (() => { try{ const v = localStorage.getItem("garden-view"); return v === "tiles" || v === "grid" ? "grid" : "list"; }catch(e){ return "list"; } })();
let idsFilter = null;
/* At the top of a place's plants: its picture, how it's doing right now, and adding a plant right there. */
const ctxLoc = f => plKey(f) ? f : ["house","house-window","house-low","house-cabinet"].includes(f) ? "house" : f === "greenhouse" ? "greenhouse"
  : f === "balcony" || /^balc-/.test(f) ? "balcony" : f === "garden" || f === "outside" || f === "porch" || /^(out|porch)-/.test(f) ? "garden" : null;
function renderPlantsCtx(){
  const el = $("#plantsCtx"); if(!el) return;
  const k = !idsFilter && ctxLoc(plantFilter), L = k && LOCS().find(x => x.k === k);
  if(!L){ el.innerHTML = ""; return; }
  const list = state.plants.filter(p => locHas(L, p));
  const risk = list.filter(p => (plantFlags[p.id] || new Set()).has("frost")).length, thirsty = list.filter(p => (plantFlags[p.id] || new Set()).has("water")).length;
  const temp = tempChip(L.k), mine = locPicSrc(L.k), cls = L.loc || L.k, canPic = online && !!me && !!token;
  el.innerHTML = `<div class="pctx loc-${cls} ${mine ? "has-img" : ""}" style="${mine ? `--img:url('${mine}')` : locStyle(look().style, cls)}">
      <span class="pctx-ic" aria-hidden="true">${ICON[L.icon]}</span>${canPic ? locPicBtn(L) : ""}
      <div class="pctx-st">${risk ? `<span class="lchip frost">${ICON.snow}${tr("{n} at risk from the cold", {n:risk})}</span>` : ""}${thirsty ? `<span class="lchip water">${ICON.drop}${trn(thirsty, "{n} needs water", "{n} need water")}</span>` : ""}
        ${temp ? `<button class="lchip temp" data-loctemp="${L.k}" aria-label="${tr("{place} temperature", {place:L.label})}: ${esc(temp)}">${ICON.thermo}${esc(temp)}</button>` : ""}
        ${!risk && !thirsty && list.length ? `<span class="lchip calm">${ICON.leaf}${tr("Nothing needs doing here")}</span>` : ""}</div>
    </div>
    <div class="pctx-acts"><button class="btn primary small" data-hub="add">${ICON.plus}${tr("Add a plant here")}</button>${L.place ? `<button class="btn small" data-place-edit="${esc(L.place.id)}">${tr("Edit this place")}</button>` : ""}</div>`;
}
$("#plantsCtx").addEventListener("click", e => {
  const th = e.target.closest("[data-loctemp]"); if(th) return openLocTemp(th.dataset.loctemp);
  const pic = e.target.closest("[data-locpic]"); if(pic) return openLocPic(pic.dataset.locpic);
  const ed = e.target.closest("[data-place-edit]"); if(ed) openPlace(ed.dataset.placeEdit);
});
function renderPlants(){
  const pt = $("#plantsTitle"); if(pt) pt.textContent = plantsTitle();
  renderPlantsCtx();
  if(plantFilter && plantFilter.startsWith("pl:") && !plKey(plantFilter)) plantFilter = "all";   // a place deleted meanwhile
  const counts = {all:state.plants.length};
  ALL_AREAS.forEach(a => counts[a] = state.plants.filter(p => inArea(p, a)).length);
  myPlaces().forEach(L => counts["pl:" + L.id] = state.plants.filter(p => whereKey(p) === "pl:" + L.id).length);
  counts.vault = online ? state.plants.filter(p => visOf(p) === "vault").length : 0;
  counts.archive = (state.archive || []).length;
  if(plantFilter === "vault" && !counts.vault) plantFilter = "all";
  if(plantFilter === "archive" && !counts.archive) plantFilter = "all";
  const chips = ["all", ...ALL_AREAS.filter(a => counts[a] || plantFilter === a), ...myPlaces().map(L => "pl:" + L.id).filter(k => counts[k] || plantFilter === k), ...(counts.vault ? ["vault"] : []), ...(counts.archive ? ["archive"] : [])];
  if(ZONES[plantFilter] && !chips.includes(plantFilter)) chips.push(plantFilter);   // a spot: its own chip, once
  /* Opened from Garden's Outside card (the garden and the porch together): one chip for it, lit, so the list always
     shows which filter it is under. */
  if(plantFilter === "garden"){
    const at = chips.findIndex(k => k === "porch" || k === "outside");
    counts.garden = state.plants.filter(p => inArea(p, "outside") || inArea(p, "porch")).length;
    chips.splice(0, chips.length, ...chips.filter(k => k !== "porch" && k !== "outside"));
    chips.splice(at < 0 ? 1 : at, 0, "garden");
  }
  $("#chips").innerHTML = (idsFilter ? `<button class="chip" data-act="clearIds" aria-pressed="true">${tr("From the alert: {n}", {n:idsFilter.length})} ✕</button>` : "") +
    chips.map(k => {
      const label = k === "all" ? tr("All") : k === "garden" ? LOC_TITLE.garden : k === "vault" ? `${ICON.lock}${tr("Vault")}` : k === "archive" ? `${ARC_ICON}${tr("Archive")}` : plKey(k) ? esc(plKey(k).n) : AREAS[k] ? areaLabel(k) : ZONES[k].label;
      const n = k === "all" || k === "garden" || k === "vault" || k === "archive" || plKey(k) ? counts[k] : AREAS[k] ? counts[k] : state.plants.filter(p => p.zone === k && !plPlace(p)).length;
      return `<button class="chip" data-act="filter" data-f="${k}" aria-pressed="${!idsFilter && plantFilter === k}">${label} ${n}</button>`;
    }).join("");
  document.querySelectorAll("[data-view]").forEach(b => b.setAttribute("aria-pressed", b.dataset.view === plantView));
  const q = $("#search").value.trim().toLowerCase();
  const W = wx();
  const match = p => idsFilter ? idsFilter.includes(p.id) : plantFilter === "all" || (plantFilter === "vault" ? visOf(p) === "vault" : plKey(plantFilter) ? whereKey(p) === plantFilter
    : plantFilter === "garden" ? (inArea(p, "outside") || inArea(p, "porch")) : inArea(p, plantFilter) || (p.zone === plantFilter && !plPlace(p)));
  const list = state.plants.filter(p => match(p) && (!q || [p.name, p.species, p.genus, p.notes].join(" ").toLowerCase().includes(q)));
  const el = $("#plantList");
  /* The Archive is its own list: no place chips or views from the garden as it is now. */
  const arc = plantFilter === "archive" && !idsFilter;
  $("#chips").hidden = arc; document.querySelector("#view-plants .viewtog").hidden = arc;
  if(arc){ renderArchiveList(el, q); return; }
  el.className = "plist v-" + (plantView === "grid" ? "tiles" : "list");
  if(!state.plants.length){
    el.innerHTML = `<div class="empty"><h3>${tr("No plants yet")}</h3><p>${tr("Tap Add plant and take a photo; the app suggests the species for you.")}</p><button class="btn primary" data-hub="add">${tr("Add plant")}</button></div>`;
    return;
  }
  if(!list.length){ const searching = q || idsFilter || plantFilter === "vault";
    el.innerHTML = `<div class="empty slim"><p>${searching ? tr("No plants match. Clear the search or pick another filter.") : tr("No plants here yet.")}</p>${searching ? `<button class="btn small" data-act="clearFind">${tr("Clear search and filters")}</button>` : ""}</div>`; return; }
  /* Grouped by where they are: Alvor's places, then yours. */
  const keys = [...ALL_AREAS, ...myPlaces().map(L => "pl:" + L.id)];
  const by = Object.fromEntries(keys.map(a => [a, []]));
  list.sort((a, b) => a.name.localeCompare(b.name)).forEach(p => (by[whereKey(p)] || (by[p.area] ||= [])).push(p));
  el.innerHTML = keys.filter(a => by[a].length).map(a => { const L = plKey(a);
    return `<h2 class="group-h">${L ? `<span class="zi a-${placeArea(L)}">${ICON[PLACE_KINDS[L.k].icon]}</span>` : zi(a)} ${L ? esc(L.n) : areaLabel(a)} <small>${by[a].length}</small></h2>
    <div class="pgroup">${by[a].map(p => plantView === "grid" ? plantTile(p) : plantRow(p, W)).join("")}</div>`; }).join("");
}
const vaultMark = p => online && visOf(p) === "vault" ? `<span class="vmark" title="${tr("In your Vault: only you see it")}" aria-label="${tr("(in your Vault)")}">${ICON.lock}</span>` : "";
function thumbHtml(p){
  const ph = latestPhoto(p.id);
  return ph ? `<img src="${phSrc(ph)}" alt="" loading="lazy" decoding="async">` : `<span class="initial a-${p.area}">${esc((p.name || "?").trim().charAt(0).toUpperCase())}</span>`;
}
function wateredText(p, W){
  const st = waterStatus(p, W);
  const when = st.days === null ? tr("never watered") : st.byRain ? tr("rain {n}d ago", {n:st.days}) : st.anchor === "check" ? tr("checked {n}d ago", {n:st.days}) : tr("watered {n}d ago", {n:st.days});
  return ["consider","likely","urgent"].includes(st.stage) ? `${STAGE_WORD[st.stage]} · ${when}` : when;
}
const waterTagCls = (p, W) => "tag w-" + waterStatus(p, W).stage;
const ownMini = p => online && me && token && typeof miniCounts === "function" ? miniCounts({owner:me.id, type:"plant", id:p.id}) : "";
const plantBg = p => { const ph = latestPhoto(p.id); return ph ? `<img class="p-bg" src="${phSrc(ph)}" alt="" aria-hidden="true" loading="lazy" decoding="async">` : ""; };
/* The one button a plant card carries, only when there's something to do now: its job's own tick (Today's jobs). */
function cardAction(p){
  const j = typeof plantJob === "function" ? plantJob(p) : null;
  if(!j) return "";
  return `<button class="btn small ${j.risk || j.key === "water" ? "primary" : ""}" data-today="tick" data-job="${esc(j.id)}" aria-label="${esc(j.tick.label + " · " + p.name)}">${esc(j.tick.label)}</button>`;
}
function plantRow(p, W){
  return `<div class="plant ${latestPhoto(p.id) ? "has-bg" : ""}">${plantBg(p)}
    <button class="thumb" data-act="edit" data-id="${p.id}" aria-label="${tr("Open {name}", {name:esc(p.name)})}">${thumbHtml(p)}</button>
    <div class="pmain"><button class="nm" data-act="edit" data-id="${p.id}">${esc(p.name)}${vaultMark(p)}</button>
      ${p.species ? `<div class="sp">${esc(p.species)}</div>` : ""}
      <div class="where">${zi(p.zone)}<span>${esc(zoneLabel(p))}</span></div>${ownMini(p)}</div>
    <div class="flags">${flagIcons(p.id)}</div>
    <div class="facts">${coldTag(p)}<span class="${waterTagCls(p, W)}">${wateredText(p, W)}</span>
      <span class="acts">${cardAction(p)}</span></div>
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
      <div class="where">${zi(p.zone)}<span>${esc(zoneShort(p))}</span></div>${ownMini(p)}
      <div class="pc-acts"><button class="icon-btn" data-act="move" data-id="${p.id}" aria-label="${tr("Move {name}", {name:esc(p.name)})}">${ICON.move}</button><button class="icon-btn water" data-act="water" data-id="${p.id}" aria-label="${tr("Mark {name} watered", {name:esc(p.name)})}">${ICON.drop}</button></div>
    </div>
  </div>`;
}
document.querySelectorAll("[data-view]").forEach(b => b.addEventListener("click", () => {
  plantView = b.dataset.view; try{ localStorage.setItem("garden-view", plantView); }catch(e){}
  renderPlants();
}));

/* ---------- Actions ---------- */
/* Watering and feedback go through the care engine, which also notes what it had estimated (for learning). */
/* fb: given as the answer to one of Alvor's watering suggestions (after checking the soil), not a plain tap. */
function water(ids, single, fb){
  const c = ctx(), W = wx();
  ids.forEach(id => { const p = state.plants.find(x => x.id === id); if(!p) return;
    const f = GA.feedback(p, "water", W, c, state.plants, {single:!!single});
    Object.assign(p, f.patch); addLog(id, "water", "Watered", {est:f.log.est, stage:f.log.stage, ...(fb ? {fb:1} : {})}); });
  save(); render(); refreshCareBox(); toast(ids.length > 1 ? tr("{n} plants watered", {n:ids.length}) : tr("Watered"));
}
/* Feeding: a "Fed" entry in each plant's journal, with what was used last time (change it in the journal).
   One a day at most, so a second tap doesn't add another. */
function feedPlants(ids){
  const d = today(); let n = 0;
  ids.forEach(id => {
    const p = plantById(id); if(!p || p.archived) return;
    const fed = jEntries(p).filter(e => e.k === "fed").sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : (+a.m || 0) - (+b.m || 0));
    n++;
    if(fed.some(e => e.d === d)) return;
    const last = fed[fed.length - 1];
    jPut(p, {id:uid(), d, k:"fed", ...(last && last.n ? {n:last.n} : {})});
    delete p.feedSkip;
    addLog(id, "feed", "Fed");
  });
  if(!n) return;
  save(); render(); refreshJournal(); refreshCareBox();
  toast(ids.length > 1 ? tr("{n} plants fed", {n}) : tr("Fed"));
}
/* The spring window of repotting this plant: "Not this year" waits for the next one. */
function repotNotYear(id){
  const p = plantById(id); if(!p) return;
  const r = repotState(p);
  p.rpSkip = r.next ? +r.next.slice(0, 4) : new Date().getFullYear();
  save(); render(); refreshCareBox();
  toast(tr("Alvor will ask again next spring."));
}
function careFeedback(id, kind){
  if(kind === "water") return water([id], true, true);
  if(kind === "fed") return feedPlants([id]);
  if(kind === "skip"){ const p = plantById(id); if(!p) return; p.feedSkip = today(); save(); render(); refreshCareBox(); return toast(tr("Skipped. Alvor counts the next feed from today.")); }
  if(kind === "repotted") return openMs(id, null, {k:"repotted"});
  if(kind === "notYear") return repotNotYear(id);
  if(kind === "unprotect") return unprotect([id]);
  const p = state.plants.find(x => x.id === id); if(!p) return;
  const f = GA.feedback(p, kind, wx(), ctx(), state.plants);
  Object.assign(p, f.patch);
  addLog(id, "care", f.log.detail, {est:f.log.est, stage:f.log.stage, k:f.log.k});
  save(); render(); refreshCareBox();
  if(kind === "settled") return toast(tr("Got it. Alvor treats {name} as used to its spot.", {name:p.name}));
  toast(kind === "wet" ? tr("Got it. Alvor will expect {name} to dry more slowly.", {name:p.name})
    : kind === "fine" ? tr("Got it. Alvor will look at {name} again in a few days.", {name:p.name}) : tr("Alvor will ask again tomorrow."));
}
/* place: one of your own places (its id), or none for Alvor's. */
function setZone(p, z, planting, place){
  planting = canGround(z) ? (planting || p.planting || "pot") : "pot";
  const L = placeById(place), pl = L && placeZones(L).includes(z) ? L.id : null, oldPl = plPlace(p) ? p.place : null;
  if(!ZONES[z] || (p.zone === z && p.planting === planting && oldPl === pl)) return false;
  const old = p.zone, oldPlant = p.planting;
  const remember = (k, kp) => { p[k] = old; if(oldPl) p[kp] = oldPl; else delete p[kp]; };   // where it goes back to (and in which of your places)
  if(ZONES[old] && ZONES[old].area === "house") remember("lastInside", "lastInPl");
  if(ZONES[old] && (ZONES[old].area === "outside" || ZONES[old].area === "balcony")) remember("lastOutside", "lastOutPl");
  if(z !== old || pl !== oldPl) p.moved = GA.moveRecord(p, z, today());   // acclimatisation: when it left the house, greenhouse or shade
  applyZone(p, z, planting);
  if(pl) p.place = pl; else delete p.place;
  const where = L && pl ? L.n + (placeZones(L).length > 1 ? ", " + ZONES[z].short : "") : ZONES[z].label;
  let text = `Moved to: ${where}`;
  if(planting === "ground" && oldPlant !== "ground") text = `Planted in the ground (${L && pl ? L.n : ZONES[z].short.toLowerCase()})`;
  else if(oldPlant === "ground" && planting !== "ground") text = `Dug up, now: ${where}`;
  addLog(p.id, "move", text);
  jNoteMove(p);   // and in its journal
  return true;
}
/* After a move: where it went, and only when the move matters (just out of the house, into full sun, brought
   inside) what Alvor does about it, from the same settling-in rules as the alerts. Any other move is just confirmed. */
function moveToast(p){
  const st = GA.settling(p, today()), where = tr("Moved to: {spot}", {spot:zoneLabel(p)});
  if(!st || st.days !== 0) return toast(where);
  const why = st.kind === "in" ? tr("A few yellow leaves in the first weeks are normal.")
    : st.cold ? tr("For {n} days Alvor treats it as a little more tender to cold and wind.", {n:GA.RULES.settle.days})
    : tr("Shade it around midday for the first week or so.");
  toast(`${where}. ${why}`, 6500);
}
/* From alert buttons: "inside", "greenhouse" or "outside"; goes back to the plant's usual spot.
   wx: the warning it answered (frost, heat, wind), kept on the move in the history and the journal. */
function moveGroup(ids, to, wx){
  ids.forEach(id => {
    const p = state.plants.find(x => x.id === id); if(!p) return;
    const z = to === "inside" ? (p.lastInside || "house-window") : to === "greenhouse" ? "greenhouse" : (p.lastOutside || (isApt() ? "balc-sun" : "out-sun"));
    const pl = to === "inside" ? p.lastInPl : to === "greenhouse" ? null : p.lastOutPl;   // back to the same one of your places
    if(!setZone(p, z, "pot", pl) || !WX_KINDS.includes(wx)) return;
    const l = state.log[0];
    if(l && l.plantId === p.id && l.type === "move"){
      l.wx = wx;
      const e = (p.journal || []).find(x => x.id === jLogId(l));
      if(e) jPut(p, {...e, wx});
    }
  });
  save(); render(); toast(tr("Moved"));
}
const WX_KINDS = ["frost", "heat", "wind"];
/* "Mark as protected" under a frost plan (fleece, wrap the pots, protect the crown…): a "Protected from cold" entry
   in each plant's journal, saying what was done. Once a day per plant, so a second tap adds nothing. */
/* pk: the plan it carried out (mulchRoots, potProtect…): the care engine then knows the plant is protected until
   "Protection off", and suggests taking it off when the cold has passed. */
function protectGroup(ids, what, wx, pk){
  const d = today(); let n = 0;
  ids.forEach(id => {
    const p = state.plants.find(x => x.id === id); if(!p) return;
    n++;
    if(jEntries(p).some(e => e.k === "protected" && e.d === d)) return;
    jPut(p, {id:uid(), d, k:"protected", ...(what ? {n:String(what).slice(0, 200)} : {}), ...(WX_KINDS.includes(wx) ? {wx} : {}), ...(GA.PROTECT_KEYS.includes(pk) ? {pk} : {})});
    addLog(id, "protect", "Protected from cold", WX_KINDS.includes(wx) ? {wx} : null);
  });
  if(!n) return;
  save(); render(); refreshJournal();
  toast(n > 1 ? tr("{n} plants marked as protected", {n}) : tr("Marked as protected"));
}
/* Already protected today (the frost plan then says so instead of offering the button again). */
const protectedToday = ids => ids.length > 0 && ids.every(id => { const p = state.plants.find(x => x.id === id); return p && jEntries(p).some(e => e.k === "protected" && e.d === today()); });

/* A two-step spot picker: area, then light (and pot or ground outside). Used by Move, Add and Edit. */
/* The spot picker follows the way people think: where roughly, then the details, then pot or ground only where both are possible. */
const TOPS = {
  inside:{label:tr("Inside"), icon:"house", cls:"house", lead:tr("Where inside?")},
  outside:{label:tr("Outside"), icon:"outside", cls:"outside", lead:tr("Where outside?")},
  greenhouse:{label:tr("Greenhouse"), icon:"greenhouse", cls:"greenhouse", lead:""},
  balcony:{label:tr("Balcony"), icon:"balcony", cls:"balcony", lead:tr("Which part of the balcony?")},
  store:{label:tr("Winter storage"), icon:"store", cls:"store", lead:""}
};
const topOf = area => area === "house" ? "inside" : area === "porch" ? "outside" : area || null;
const topList = () => [...(isApt() ? ["inside","balcony","store"] : ["inside","outside","greenhouse","store"]), ...myPlaces().map(L => "pl:" + L.id)];
/* sel: {area, zone, planting, top, place}. Your own places are tops of their own, after Alvor's. */
const selTop = sel => sel.top || (placeById(sel.place) ? "pl:" + sel.place : topOf(sel.area));
const topZones = t => { const L = plKey(t); return L ? placeZones(L) : t === "inside" ? AREAS.house.zones : t === "outside" ? [...AREAS.outside.zones, ...AREAS.porch.zones] : AREAS[t] ? AREAS[t].zones : []; };
function pickerHtml(sel){
  const top = selTop(sel);
  const tops = topList();
  const topBtn = t => { const L = plKey(t), cls = L ? placeArea(L) : TOPS[t].cls, ic = L ? PLACE_KINDS[L.k].icon : TOPS[t].icon;
    return `<button class="area-opt ${L ? "mine" : ""} ${top === t ? "on" : ""}" data-ptop="${t}" aria-pressed="${top === t}"><span class="zi a-${cls}">${ICON[ic]}</span><b>${esc(L ? L.n : TOPS[t].label)}</b></button>`; };
  const opt = z => `<button class="zone-opt" data-pzone="${z}" aria-pressed="${sel.zone === z}">${zi(z)}<span><b>${ZONES[z].short}</b><small>${ZONES[z].hint}</small></span></button>`;
  let html = `<div class="area-row" style="grid-template-columns:repeat(${Math.min(tops.length, 4)},minmax(0,1fr))">${tops.map(topBtn).join("")}</div>`;
  const L = plKey(top);
  if(L){ if(placeZones(L).length > 1) html += `<p class="pick-lead">${tr("Where in {place}?", {place:esc(L.n)})}</p><div class="zone-pick">${placeZones(L).map(opt).join("")}</div>`; }
  else if(top === "inside") html += `<p class="pick-lead">${TOPS.inside.lead}</p><div class="zone-pick">${AREAS.house.zones.map(opt).join("")}</div>`;
  else if(top === "outside") html += `<p class="pick-lead">${TOPS.outside.lead}</p><div class="zone-pick"><h3 class="pick-h">${tr("In the garden")}</h3>${AREAS.outside.zones.map(opt).join("")}<h3 class="pick-h">${tr("On the porch")} <span>${tr("covered, rain doesn't reach")}</span></h3>${AREAS.porch.zones.map(opt).join("")}</div>`;
  else if(top === "balcony") html += `<p class="pick-lead">${TOPS.balcony.lead}</p><div class="zone-pick">${AREAS.balcony.zones.map(opt).join("")}</div>`;
  if(sel.zone && canGround(sel.zone) && topZones(top).includes(sel.zone))
    html += `<p class="pick-lead">${tr("How is it planted?")}</p><div class="seg small plant-seg" role="group" aria-label="${tr("Planted")}"><button data-pplant="pot" aria-pressed="${sel.planting !== "ground"}">${ICON.pot} ${tr("In a pot")}</button><button data-pplant="ground" aria-pressed="${sel.planting === "ground"}">${ICON.ground} ${tr("In the ground")}</button></div>`;
  return html;
}
function pickerClick(e, sel){
  const b = e.target.closest("[data-ptop],[data-pzone],[data-pplant]"); if(!b) return null;
  if(b.dataset.ptop){
    sel.top = b.dataset.ptop;
    const L = plKey(sel.top), zs = topZones(sel.top);
    sel.place = L ? L.id : null;
    if(zs.length === 1){ sel.zone = zs[0]; sel.area = ZONES[sel.zone].area; }
    else if(!sel.zone || !zs.includes(sel.zone)){ sel.zone = null; sel.area = null; }
    return "top";
  }
  if(b.dataset.pzone){
    sel.zone = b.dataset.pzone; sel.area = ZONES[sel.zone].area;
    if(!(placeById(sel.place) && placeZones(placeById(sel.place)).includes(sel.zone))){ sel.place = null; sel.top = topOf(sel.area); }
    return "zone";
  }
  sel.planting = b.dataset.pplant; return "plant";
}
const moveDlg = $("#moveDlg");
let movingId = null, moveSel = null;
function openMove(id){
  const p = state.plants.find(x => x.id === id); if(!p) return;
  movingId = id; moveSel = {area:p.area, zone:p.zone, planting:p.planting, place:plPlace(p) ? p.place : null}; moveSel.top = selTop(moveSel);
  $("#moveTitle").textContent = tr("Move {name}", {name:p.name});
  $("#zonePick").innerHTML = pickerHtml(moveSel);
  moveDlg.showModal();
}
$("#zonePick").addEventListener("click", e => {
  const what = pickerClick(e, moveSel); if(!what) return;
  const p = state.plants.find(x => x.id === movingId);
  const done = (what === "zone" && !canGround(moveSel.zone)) || (what === "plant" && moveSel.zone) || (what === "top" && moveSel.zone === "store");
  if(done && p){
    if(setZone(p, moveSel.zone, moveSel.planting, moveSel.place)){
      if(dlg.open && editingId === p.id){ editSel = {area:p.area, zone:p.zone, planting:p.planting, place:p.place || null}; drawEditPick(); }   // the sheet's own picker follows, so Save doesn't move it back
      save(); render(); moveToast(p);
    }
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
  else if(act === "water") water([b.dataset.id], true);
  else if(act === "fb") careFeedback(b.dataset.id, b.dataset.kind);
  else if(act === "waterAll") water(ids);
  else if(act === "feedAll") feedPlants(ids);
  else if(act === "fedOn"){ const p = plantById(b.dataset.id), last = p && jEntries(p).filter(x => x.k === "fed").sort((x, y) => x.d < y.d ? -1 : 1).pop(); openMs(b.dataset.id, null, {k:"fed", n:(last && last.n) || ""}); }
  else if(act === "move") openMove(b.dataset.id);
  else if(act === "health") openHealth(b.dataset.id);
  else if(act === "moveAll") moveGroup(ids, b.dataset.to, b.dataset.wx);
  else if(act === "protectAll") protectGroup(ids, b.dataset.what, b.dataset.wx, b.dataset.pk);
  else if(act === "seePlants"){ idsFilter = ids; showTab("plants"); renderPlants(); }
  else if(act === "allPlants") openAllPlants(b.dataset.focus === "search");
  else if(act === "clearFind"){ idsFilter = null; plantFilter = "all"; $("#search").value = ""; renderPlants(); }
  else if(act === "openArchiveList"){ idsFilter = null; plantFilter = "archive"; showTab("plants"); renderPlants(); }
  else if(act === "clearIds"){ idsFilter = null; renderPlants(); }
  else if(act === "sceneBack") goScene("overview");
  else if(act === "viewPhoto") viewPhoto(b.dataset.ph);
  else if(act === "openArc") openJournal(b.dataset.id);
  else if(act === "filter"){ idsFilter = null; plantFilter = b.dataset.f; renderPlants(); }
});

/* ---------- The Living Compass: the four places, and pages opened from them ----------
   Today, Garden (locations), Journal and Circle (friends) are roots: the dock lights the one you're in.
   Any other page (a place's plants, a friend's garden, Settings…) remembers where it was opened from (NAV, js/compass.js),
   and its back arrow returns there. */
const dial = $("#dial");
const ROOTS = ["today", "locations", "journal", "friends"];
const NAV = [];
let rootTab = "today";
document.addEventListener("click", e => {
  const b = e.target.closest("[data-tab]"); if(!b) return;
  if(b.classList.contains("round-back")) return navBack(b.dataset.tab);
  if(b.closest("#dial") && b.dataset.tab === currentTab && ROOTS.includes(currentTab)){ window.scrollTo({top:0, behavior:reduceMotion() ? "auto" : "smooth"}); return; }   // tapping where you are: back to its top
  showTab(b.dataset.tab);
});
/* opt.back: going back (nothing new to remember). */
function showTab(tab, opt){
  const back = !!(opt && opt.back);
  if(ROOTS.includes(tab)){ NAV.length = 0; rootTab = tab; }
  else if(!back && tab !== currentTab) NAV.push(navCtx());
  currentTab = tab;
  if(tab !== "plants") idsFilter = null;
  document.body.dataset.page = tab;
  document.body.dataset.root = rootTab;
  document.querySelectorAll("#dial [data-tab]").forEach(b => { if(b.dataset.tab === rootTab) b.setAttribute("aria-current","page"); else b.removeAttribute("aria-current"); });
  ["today","locations","plants","journal","settings","profile","friends","friend"].forEach(t => $("#view-" + t).hidden = t !== tab);
  if(tab === "settings") fillSettings();
  if(tab === "profile") fillProfile();
  if(tab === "friends") openFriends();
  if(tab === "friend") renderFriend();
  if(tab === "journal") renderJournalPage();
  applyBackdrop();
  applyLook();
  window.scrollTo(0,0);
  syncTrap();
}
$("#search").addEventListener("input", renderPlants);

/* ---------- Photos ----------
   On the phone, in two IndexedDB databases:
   · "garden-photos" (as always): each photo whole: id, plantId, date, ts, data (the 2000 px JPEG as a data URL),
     synced, hidden, hideDirty, dateDirty. This is the photo itself; older versions of Alvor read it unchanged.
   · "garden-thumbs": the same details without data, plus th, a small copy (480 px JPEG Blob) for lists, cards,
     journals and tiles. It's only a copy: rebuilt from garden-photos whenever one is missing.
   The app keeps only the small copies in memory (as blob: addresses in ph.src), so a garden with thousands of
   photos opens fast and light. The whole photo is read when it's shown large (viewer, the plant's picture,
   before and after), shared, used as a backdrop or sent to the account: fullPhoto(ph). */
const idb = (() => {
  const open = (name, store) => { let p; return () => p ||= new Promise((res, rej) => {
    const r = indexedDB.open(name, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(store, {keyPath:"id"});
    r.onsuccess = () => { const d = r.result; d.onversionchange = () => d.close(); res(d); }; r.onerror = () => rej(r.error);
  }); };
  const photoDb = open("garden-photos", "photos"), thumbDb = open("garden-thumbs", "thumbs");
  const run = async (dbf, store, mode, fn) => {
    const d = await dbf();
    return new Promise((res, rej) => {
      const t = d.transaction(store, mode), req = fn(t.objectStore(store));
      t.oncomplete = () => res(req ? req.result : undefined); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    });
  };
  const P = (mode, fn) => run(photoDb, "photos", mode, fn), T = (mode, fn) => run(thumbDb, "thumbs", mode, fn);
  const clean = ph => { const o = {...ph}; delete o.src; delete o.th; delete o.data; return o; };
  /* Writes a photo. With data: the whole photo and a new small copy. Without (a changed detail: synced, hidden,
     a new date): the details change in both, and the photo itself stays as it is. */
  async function put(ph){
    let th = ph.th instanceof Blob ? ph.th : null;
    if(ph.data){
      if(!th) th = await makeThumb(ph.data).catch(() => null);
      await P("readwrite", s => s.put({...clean(ph), data:ph.data}));
    }else{
      let found = false;
      await P("readwrite", s => { const g = s.get(ph.id); g.onsuccess = () => { if(g.result){ found = true; s.put({...g.result, ...clean(ph), data:g.result.data}); } }; return null; });
      if(!found) throw new Error("photo not on this phone");
      if(!th){ const old = await T("readonly", s => s.get(ph.id)); th = old && old.th || null; }
      if(!th){ const full = await get(ph.id); th = full && await makeThumb(full.data).catch(() => null); }
    }
    // The small copy is only a copy: if it can't be written, the photo is still saved (it's rebuilt next time).
    await T("readwrite", s => s.put({...clean(ph), th})).catch(() => {});
    if(th){ ph.th = th; ph.src = thumbUrl(ph.id, th, true); delete ph.data; }   // in memory: the small copy only
  }
  const get = id => P("readonly", s => s.get(id));
  return {put, get,
    all:() => P("readonly", s => s.getAll()),        // every photo whole (the test rig reads it; the app reads one at a time)
    del:async id => { await P("readwrite", s => s.delete(id)); await T("readwrite", s => s.delete(id)).catch(() => {}); dropThumbUrl(id); },
    // Every photo's details and small copy. If the copies can't be read, the photos themselves (as before).
    meta:() => T("readonly", s => s.getAll()).catch(() => P("readonly", s => s.getAll())),
    keys:() => P("readonly", s => s.getAllKeys()), thumbKeys:() => T("readonly", s => s.getAllKeys()),
    putThumb:rec => T("readwrite", s => s.put(rec)), delThumb:id => T("readwrite", s => s.delete(id)),
    clear:async () => { await P("readwrite", s => s.clear()); await T("readwrite", s => s.clear()).catch(() => {}); dropThumbUrl(); }};
})();
/* The small copy as an address an <img> can show. One per photo, kept while the photo is on the phone. */
const thumbUrls = new Map();
function thumbUrl(id, blob, fresh){
  const had = thumbUrls.get(id);
  if(had && !fresh) return had;
  if(had) setTimeout(() => URL.revokeObjectURL(had), 60000);   // screens drawn a moment ago may still show it
  const u = URL.createObjectURL(blob); thumbUrls.set(id, u); return u;
}
function dropThumbUrl(id){
  for(const [k, u] of thumbUrls) if(id == null || k === id){ setTimeout(() => URL.revokeObjectURL(u), 60000); thumbUrls.delete(k); }
}
async function makeThumb(data){
  const c = await drawJpeg(data, 480);
  return new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error("thumb")), "image/jpeg", 0.74));
}
/* Builds the small copies that are missing (the first time this version opens, a photo another version
   added), and drops copies of photos that are gone. One photo at a time, so memory stays low. */
let thumbsReady = null;
function ensureThumbs(onProgress){
  return thumbsReady ||= (async () => {
    try{
      const [keys, tkeys] = await Promise.all([idb.keys(), idb.thumbKeys()]);
      const have = new Set(tkeys), want = new Set(keys);
      for(const k of tkeys) if(!want.has(k)) await idb.delThumb(k).catch(() => {});
      const missing = keys.filter(k => !have.has(k));
      for(let i = 0; i < missing.length; i++){
        const ph = await idb.get(missing[i]).catch(() => null);
        if(ph && ph.data){
          const th = await makeThumb(ph.data).catch(() => null);
          const o = {...ph}; delete o.data;
          await idb.putThumb({...o, th}).catch(() => {});
        }
        if(onProgress && (i + 1) % 100 === 0) await onProgress();   // the photos appear as they're ready
      }
    }catch(e){}
  })();
}
/* The whole photo (data URL), for showing it large, sharing or sending it. The last few are kept. */
const fullCache = new Map();
async function fullPhoto(ph){
  if(!ph) return "";
  if(ph.data) return ph.data;
  if(fullCache.has(ph.id)) return fullCache.get(ph.id);
  let r = null; try{ r = await idb.get(ph.id); }catch(e){}
  const d = r && r.data || ph.src || "";
  if(r && r.data){ fullCache.set(ph.id, d); if(fullCache.size > 6) fullCache.delete(fullCache.keys().next().value); }
  return d;
}
/* For an <img>: the small copy when there is one (or the photo itself, for one just taken). Its address is made
   the first time it's shown. */
const phSrc = ph => !ph ? "" : ph.src || (ph.th instanceof Blob ? (ph.src = thumbUrl(ph.id, ph.th)) : ph.data || "");
/* Images marked data-full="photo id" are drawn small first and swapped for the whole photo once it's read. */
function upFull(root){
  (root || document).querySelectorAll("img[data-full]").forEach(img => {
    const id = img.dataset.full; img.removeAttribute("data-full");
    const ph = Object.values(photos).flat().find(x => x.id === id) || pending.find(x => x.id === id);
    if(ph && !ph.data) fullPhoto(ph).then(d => { if(d && img.isConnected) img.src = d; });
  });
}
let photos = {};   // plantId -> newest first (details and small copies; no data)
let pending = [];  // photos for a plant not saved yet (with their data)
const latestPhoto = id => (photos[id] || [])[0];
const sortPh = a => a.sort((x,y) => y.ts - x.ts);
async function loadPhotos(){
  try{
    await ensureThumbs(fillPhotos);
    await fillPhotos(false);
  }catch(e){}
  renderPlants();
}
async function fillPhotos(draw = true){
  const all = await idb.meta(), next = {}, seen = new Set();
  for(const ph of all){
    if(thumbUrls.has(ph.id)) ph.src = thumbUrls.get(ph.id);
    seen.add(ph.id); (next[ph.plantId] ||= []).push(ph);
  }
  for(const id of [...thumbUrls.keys()]) if(!seen.has(id)) dropThumbUrl(id);
  Object.values(next).forEach(sortPh);
  photos = next;
  if(draw) renderPlants();
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
/* When a photo was taken: the camera's own date inside the file (EXIF DateTimeOriginal), else the file's date,
   else now. So a photo added later from the gallery lands on its real day in the journal. */
async function photoWhen(file){
  const now = Date.now(), ok = t => t && t > Date.UTC(1990, 0, 1) && t <= now + 60000;
  try{
    const t = exifTime(new DataView(await file.slice(0, 196608).arrayBuffer()));
    if(ok(t)) return Math.min(t, now);
  }catch(e){}
  return ok(file.lastModified) && file.lastModified < now - 120000 ? file.lastModified : now;
}
function exifTime(v){
  if(v.byteLength < 4 || v.getUint16(0) !== 0xFFD8) return null;
  let o = 2;
  while(o + 4 < v.byteLength){
    if(v.getUint8(o) !== 0xFF) return null;
    const mk = v.getUint8(o + 1), len = v.getUint16(o + 2);
    if(mk === 0xE1 && v.getUint32(o + 4) === 0x45786966){   // "Exif"
      const t = o + 10, le = v.getUint16(t) === 0x4949;
      const u16 = x => v.getUint16(t + x, le), u32 = x => v.getUint32(t + x, le);
      const ifd = (at, want) => {   // the value of tag `want` in the directory at `at` (offset or ASCII text)
        if(t + at + 2 > v.byteLength) return null;
        const n = u16(at);
        for(let i = 0; i < n; i++){
          const e = at + 2 + i * 12; if(t + e + 12 > v.byteLength) return null;
          if(u16(e) !== want) continue;
          if(u16(e + 2) !== 2) return u32(e + 8);
          const off = u32(e + 8); let str = "";
          for(let k = 0; k < 19 && t + off + k < v.byteLength; k++) str += String.fromCharCode(v.getUint8(t + off + k));
          return str;
        }
        return null;
      };
      const first = u32(4), sub = ifd(first, 0x8769);
      const s = (typeof sub === "number" && ifd(sub, 0x9003)) || ifd(first, 0x0132);
      const m = typeof s === "string" && s.match(/^(\d{4}):(\d\d):(\d\d) (\d\d):(\d\d):(\d\d)/);
      return m ? new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime() : null;
    }
    if(mk === 0xDA) return null;
    o += 2 + len;
  }
  return null;
}
const galleryList = () => editingId ? (photos[editingId] || []) : pending;
function renderGallery(){
  const list = galleryList();
  $("#gallery").innerHTML = list.length ? list.map(ph =>
    `<button class="ph" data-act="viewPhoto" data-ph="${ph.id}"><img src="${phSrc(ph)}" loading="lazy" decoding="async" alt="${tr("Photo from {date}", {date:ph.date})}">${ph.hidden && online ? `<span class="ph-hid" title="${tr("Hidden from friends")}">${ICON.eyeOff}</span>` : ""}${parseDay(ph.date).toLocaleDateString(LOCALE,{day:"numeric",month:"short",year:"2-digit"})}</button>`).join("")
    : `<p class="none">${tr("No photos yet. The newest photo becomes the plant's picture.")}</p>`;
}
$("#addPhoto").addEventListener("click", () => $("#photoFile").click());
$("#takePhoto").addEventListener("click", () => $("#photoCam").click());
$("#photoCam").addEventListener("change", e => $("#photoFile").dispatchEvent(new CustomEvent("change", {detail:e.target})));
$("#photoFile").addEventListener("change", async e => {
  const input = e.detail || e.target;
  const files = [...input.files]; input.value = "";
  let older = null;
  for(const f of files){
    try{
      const ts = await photoWhen(f), date = ymd(new Date(ts));
      const ph = {id:uid(), plantId:editingId, date, ts, data:await resizeImage(f)};
      if(date !== today()) older = date;
      if(editingId){
        await idb.put(ph);
        photos[editingId] = sortPh([ph, ...(photos[editingId] || [])]);
        addLog(editingId, "photo", "Photo added"); save();
      }else pending = sortPh([ph, ...pending]);
    }catch(err){ toast(tr("Couldn't add that photo")); }
  }
  renderGallery(); renderPlants(); refreshJournal();
  if(older) toast(tr("Dated {date}, the day it was taken", {date:jDate(older)}));
});
let viewing = null;
const viewer = $("#viewer");
function viewPhoto(id){
  viewing = galleryList().find(p => p.id === id); if(!viewing) return;
  const v = viewing, img = $("#viewerImg");
  img.src = phSrc(v);
  if(!v.data) fullPhoto(v).then(d => { if(d && viewing === v) img.src = d; });
  $("#viewerDate").textContent = parseDay(viewing.date).toLocaleDateString(LOCALE,{day:"numeric",month:"long",year:"numeric"});
  fillViewerHide(); fillViewerJournal();
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
  viewer.close(); renderGallery(); renderPlants(); refreshJournal(); toast(tr("Photo deleted"));
});

/* ---------- Dialog ---------- */
const dlg = $("#dlg");
$("#presetList").innerHTML = KB.starting().map(s => `<option value="${esc(s)}"></option>`).join("");
let editSel = {area:"outside", zone:"out-sun", planting:"pot"};
/* "Visible to: Friends · Change", shared by the edit screen and the add-plant steps. */
const defaultVis = () => (me && VIS[me.defaultVisibility] && me.defaultVisibility) || "vault";
function visBlock(vis, open){
  const v = VIS[vis] || VIS.vault;
  return `<div class="vis-row"><span class="vis-ic">${v.icon}</span><span>${tr("Visible to:")} <b>${v.label}</b></span><button type="button" class="linkish" data-vis-change>${open ? tr("Done") : tr("Change")}</button></div>` +
    (open ? `<div class="seg small vis-seg" role="group" aria-label="${tr("Visible to")}">${["friends","vault"].map(k => `<button type="button" data-vis="${k}" aria-pressed="${k === vis}">${VIS[k].icon}${VIS[k].short}</button>`).join("")}</div><p class="status">${v.hint}</p>` : "");
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
/* In the plant page, who sees it changes at once (it isn't part of the Edit screen's Save). */
$("#fVis").addEventListener("click", e => {
  onVisClick(e, editVis, $("#fVis"));
  const p = dlg.open && editingId && plantById(editingId);
  if(!p) return;
  if(e.target.closest("[data-vis]") && visOf(p) !== editVis.visibility){
    p.visibility = editVis.visibility;
    if(p.visibility === "vault") delete p.cuttings;
    addLog(p.id, "share", p.visibility === "vault" ? "Moved to the Vault" : "Shared with friends");
    save(); render(); fillRowSums(p);
    toast(p.visibility === "vault" ? tr("Only you see it now") : tr("Friends can see it now"));
  }
  drawCutBox(p);
});
$("#fCut").addEventListener("change", () => {
  const p = dlg.open && editingId && plantById(editingId); if(!p) return;
  if($("#fCut").checked && visOf(p) !== "vault") p.cuttings = true; else delete p.cuttings;
  save(); drawCutBox(p); toast($("#fCut").checked ? tr("Friends can ask you for a cutting") : tr("No more cuttings offered"));
});
const drawEditPick = () => { $("#fZonePick").innerHTML = pickerHtml(editSel); drawMicro(); if(dlg.open && editingId) drawFeedChoices(plantById(editingId)); };
/* About this spot: only what changes Alvor's advice (frost, rain, drying, wind). Outdoors only. */
let editMicro = {};
const MICRO = [["wall", tr("Against a wall")], ["tree", tr("Under a tree")], ["exposed", tr("Windy spot")], ["sheltered", tr("Sheltered")], ["pm", tr("Hot afternoon sun")]];
const microOn = (m, k) => k === "exposed" || k === "sheltered" ? m.wind === k : !!m[k];
function drawMicro(){
  const z = editSel.zone && ZONES[editSel.zone], show = !!z && ["outside","porch","balcony"].includes(z.area);
  $("#microBox").hidden = !show;
  if(show) $("#fMicro").innerHTML = MICRO.map(([k, label]) => `<button type="button" class="chip" data-micro="${k}" aria-pressed="${microOn(editMicro, k)}">${label}</button>`).join("");
}
$("#fMicro").addEventListener("click", e => {
  const b = e.target.closest("[data-micro]"); if(!b) return;
  const k = b.dataset.micro;
  if(k === "exposed" || k === "sheltered") editMicro.wind = editMicro.wind === k ? undefined : k;
  else editMicro[k] = !editMicro[k];
  drawMicro();
  /* An existing plant's spot details save at once; a new plant takes them with Save plant. */
  const p = dlg.open && editingId && plantById(editingId);
  if(p){ p.micro = cleanMicro(editMicro); save(); render(); fillRowSums(p); }
});
const cleanMicro = m => { const o = {}; ["wall","tree","pm"].forEach(k => { if(m[k]) o[k] = true; }); if(m.wind) o.wind = m.wind; return o; };
/* ---------- The plant page, layer 1: the plant, where it is, what it needs now, and the actions that fit ----------
   One status sentence: Alvor's most important job for this plant right now (from the same jobs as Today), or else
   how its watering stands. The first action is that job's own tick (or Watered, when watering is due); then Watered;
   Something wrong? sits under them, quieter. Adding a moment is the first tile of Its story, just below. */
function plantJob(p){ return (typeof JOBS !== "undefined" ? JOBS : []).find(j => j.p.id === p.id && !j.done) || null; }
function psTopHtml(p){
  const ph = latestPhoto(p.id), W = wx(), st = waterStatus(p, W);
  const kb = findPreset(p.species, p.genus), common = kb ? plantName(kb.s, kb.n) : "";
  const vis = online ? VIS[visOf(p)] : null, j = plantJob(p), doneJ = (typeof JOBS !== "undefined" ? JOBS : []).find(x => x.p.id === p.id && x.done);
  const K = j ? (j.risk ? "frost" : ["heat","vent"].includes(j.key) ? "heat" : ["water","waterUnknown"].includes(j.key) ? "water" : "calm") : "calm";
  const when = j && j.date && j.risk ? GA.nightWord(j.date, today()) : "";
  const head = j ? (when ? tr("{what} {when}", {what:j.title, when}) : j.title)
    : doneJ ? tr("Protected · {what}", {what:doneJ.title})
    : st.stage === "rest" ? STAGE_WORD.rest
    : ["ok","soon"].includes(st.stage) ? tr("Fine for now") : STAGE_WORD[st.stage];
  const small = j ? j.why : doneJ ? doneJ.why : [st.reasons && st.reasons[0], st.stage !== "rest" ? tr("an estimate") : ""].filter(Boolean).join(" · ");
  const icon = K === "frost" ? ICON.snow : K === "heat" ? ICON.heat : K === "water" ? ICON.drop : ICON.leaf;
  const tick = j ? `<button class="btn primary" data-today="tick" data-job="${esc(j.id)}">${ICON.check}${esc(j.tick.label)}</button>` : "";
  /* Watered leads only when watering is what's due: a plant that's "Fine for now" doesn't get a task-looking button. */
  const thirsty = !j && ["consider", "likely", "urgent"].includes(st.stage);
  const waterBtn = !j || j.key !== "water" ? `<button class="btn ${thirsty ? "primary" : ""}" data-act="water" data-id="${p.id}">${ICON.drop}${tr("Watered")}</button>` : "";
  return `<div class="ps-hero ${ph ? "has-ph" : ""}">${ph ? `<button class="ps-img" data-act="viewPhoto" data-ph="${ph.id}" aria-label="${tr("Open the newest photo of {name}", {name:esc(p.name)})}"><img src="${phSrc(ph)}" data-full="${ph.id}" alt=""></button>`
      : `<span class="ps-img ps-none a-${p.area}" aria-hidden="true">${esc((p.name || "?").trim().charAt(0).toUpperCase())}</span>`}
    <div class="ps-id">${p.species ? `<i>${esc(p.species)}</i>` : ""}${common && common !== p.name && common !== p.species ? `<small>${esc(common)}</small>` : ""}
      ${vis ? `<span class="ps-vis">${vis.icon}${esc(vis.short)}</span>` : ""}</div></div>
    <div class="ps-where">${zi(p.zone)}<span><b>${esc(zoneLabel(p))}</b><small>${esc(PAT_WORD[p.pattern] || "")}</small></span><button class="btn small" data-act="move" data-id="${p.id}">${ICON.move}${tr("Move")}</button></div>
    <div class="ps-status k-${K}" role="status">${icon}<span><b>${esc(cap(head))}</b><small>${esc(small)}</small></span></div>
    <div class="ps-acts"><div class="ps-do">${tick}${waterBtn}</div>
      <button class="btn small ps-quiet" data-act="health" data-id="${p.id}">${ICON.warn}${tr("Something wrong?")}</button>
    </div>`;
}
/* Layer 3: one line each, saying where it stands, so the page reads at a glance before anything is opened. */
function fillRowSums(p){
  if(!p) return;
  const st = waterStatus(p, wx()), f = feedState(p), n = (photos[p.id] || []).length, kb = findPreset(p.species, p.genus);
  const days = st.days == null ? "" : st.byRain ? tr("rain {n}d ago", {n:st.days}) : tr("watered {n}d ago", {n:st.days});
  $("#rowWaterSum").textContent = [STAGE_WORD[st.stage], days].filter(Boolean).join(" · ");
  $("#rowFeedSum").textContent = {due:tr("Ready for feeding"), soon:tr("Feed soon"), ok:tr("Fed"), rest:tr("Resting"), fresh:tr("Fresh compost"), unknown:tr("Not logged yet"), none:tr("No feeding")}[f.stage] || "";
  const m = p.micro || {}, micro = MICRO.filter(([k]) => microOn(m, k)).map(([, l]) => l.toLowerCase());
  $("#rowSpotSum").textContent = [zoneLabel(p), ...micro].join(" · ");
  const nt = myTasks().filter(x => (x.ids || []).includes(p.id) && GA.taskState(x, today()).stage !== "done").length;
  $("#rowTaskSum").textContent = nt ? trn(nt, "{n} task", "{n} tasks") : "";
  $("#rowAboutSum").textContent = kb ? [plantName(kb.s, kb.n) || kb.s, tr("takes {t}", {t:deg(kb.min)})].filter(Boolean).join(" · ") : tr("Not known to Alvor yet");
  $("#rowPhotosSum").textContent = n ? trn(n, "{n} photo", "{n} photos") : tr("No photos yet");
  const ownT = online && token && me ? {owner:me.id, type:"plant", id:p.id} : null, tc = ownT && typeof talkCount === "function" ? talkCount(ownT) : {r:0, c:0};
  $("#rowFriendsSum").textContent = [VIS[visOf(p)].short, p.cuttings ? tr("cuttings to share") : "", tc.r ? trn(tc.r, "{n} reaction", "{n} reactions") : "", tc.c ? trn(tc.c, "{n} comment", "{n} comments") : ""].filter(Boolean).join(" · ");
  $("#spotNote").textContent = canGround(p.zone) ? (p.planting === "ground" ? tr("In the ground. Move it to change its spot.") : tr("In a pot. Move it to change its spot.")) : tr("Move it to change its spot.");
}
let psCareOpen = false;   // "Why?" under the watering estimate stays open while you use the sheet
document.addEventListener("toggle", e => { if(e.target.classList && e.target.classList.contains("ps-care")) psCareOpen = e.target.open; }, true);
function refreshPsTop(){
  if(!dlg.open || !editingId) return;
  const p = state.plants.find(x => x.id === editingId); if(!p) return;
  $("#psTop").innerHTML = psTopHtml(p); upFull($("#psTop"));
  if(!dlg.classList.contains("editing")) $("#dlgTitle").textContent = p.name;
  fillRowSums(p);
}
/* Water now: Alvor's estimate for this plant, why, and what you found. */
function careBoxHtml(p){
  const st = waterStatus(p, wx());
  const fb = ["water","wet","fine"].map(k => `<button type="button" class="fb-b" data-act="fb" data-kind="${k}" data-id="${p.id}">${FB[k]}</button>`).join("");
  return `<div class="care-now st-${st.stage}"><b>${STAGE_WORD[st.stage]}</b><ul>${st.reasons.map(r => `<li>${esc(r)}</li>`).join("")}</ul>
    <p class="status">${tr("An estimate from the weather, the spot and what you've told Alvor. It can't see the soil, so trust your finger.")}</p><span class="fb">${fb}</span></div>`;
}
/* Settling in: just moved out of the house or greenhouse, into full sun, or brought inside (acclimatisation). */
function settleHtml(p){
  const st = GA.settling(p, today());
  if(!st) return "";
  const AGO = {in:[tr("Brought inside today."), tr("Brought inside yesterday."), n => tr("Brought inside {n} days ago.", {n})],
    out:[tr("Moved out today."), tr("Moved out yesterday."), n => tr("Moved out {n} days ago.", {n})],
    sun:[tr("Moved into full sun today."), tr("Moved into full sun yesterday."), n => tr("Moved into full sun {n} days ago.", {n})]};
  const ago = (n, k) => n === 0 ? AGO[k][0] : n === 1 ? AGO[k][1] : AGO[k][2](n);
  const S = GA.RULES.settle;
  if(st.kind === "in") return `<div class="settle"><b>${ago(st.days, "in")}</b><p>${tr("A few yellow or dropped leaves in the first weeks are normal while it gets used to less light. It also needs less water than outside.")}</p></div>`;
  const lines = [];
  if(st.cold) lines.push(tr("For the first {n} days Alvor counts it as {t} more tender: growth made indoors isn't used to cold nights or wind yet.", {n:S.days, t:S.cold + "°"}));
  if(st.sun) lines.push(tr("Give it shade around midday on sunny days for the first week or so, or the leaves can scorch."));
  return `<div class="settle"><b>${ago(st.days, st.cold ? "out" : "sun")}</b>${lines.map(l => `<p>${l}</p>`).join("")}
    <span class="fb"><button type="button" class="fb-b" data-act="fb" data-kind="settled" data-id="${p.id}">${FB.settled}</button></span></div>`;
}
function showSettle(p){
  const h = p ? settleHtml(p) : "";
  $("#settleBox").hidden = !h; $("#settleNow").innerHTML = h;
}
/* Feeding and repotting: what Alvor would do for this plant, when it was last done (from the journal) and your own choice. */
const FEED_EVERY = [7, 14, 21, 28, 42, 56, 365, 0], REPOT_EVERY = [1, 2, 3, 4, 5, 0];
const feedEveryText = n => !n ? tr("Never") : n >= 180 ? tr("Once a year, in spring") : n === 7 ? tr("Every week") : tr("Every {n} weeks", {n:n / 7});
const repotEveryText = n => !n ? tr("Never") : n === 1 ? tr("Every year") : tr("Every {n} years", {n});
function feedBoxHtml(p){
  const f = feedState(p), r = repotState(p), L = f.plan;
  const short = d => jDate(d, false), month = d => GA.monthName(+d.slice(5, 7));
  const head = {due:tr("Ready for feeding"), soon:f.next && tr("Feed soon: around {date}", {date:short(f.next)}), ok:f.next && tr("Next feed around {date}", {date:short(f.next)}),
    rest:f.next && tr("Resting until {month}", {month:month(f.next)}), fresh:f.next && tr("Fresh compost: no feed until {date}", {date:short(f.next)}),
    unknown:tr("Feeding not logged yet"),
    none:f.why === "carnivorous" ? tr("Never fed: it catches its own food") : f.why === "ground" ? tr("No feeding needed in the ground") : tr("You don't feed this one")}[f.stage];
  const fb = f.stage === "none" ? "" : `<span class="fb"><button type="button" class="fb-b" data-act="fb" data-kind="fed" data-id="${p.id}">${tr("Fed today")}</button>` +
    `<button type="button" class="fb-b" data-act="fedOn" data-id="${p.id}">${tr("Another day…")}</button>` +
    (f.stage === "due" ? `<button type="button" class="fb-b" data-act="fb" data-kind="skip" data-id="${p.id}">${FB.skip}</button>` : "") + `</span>`;
  let html = `<div class="care-now feed-now fs-${f.stage}"><b>${ICON.feed}${esc(head)}</b>${f.reasons.length ? `<ul>${f.reasons.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}` +
    (f.stage === "unknown" ? `<p class="status">${tr("Log a feed once and Alvor reminds you when the next one is due.")}</p>` : "") + fb + `</div>`;
  if(r.stage !== "ground"){
    const rh = {due:tr("Time to repot"), next:tr("Ready to repot: spring {y}", {y:r.nextYear}), ok:tr("Next repot: spring {y}", {y:r.nextYear}),
      unknown:tr("Repotting not logged yet"), none:tr("You don't repot this one")}[r.stage];
    html += `<div class="care-now feed-now rs-${r.stage}"><b>${ICON.repot}${esc(rh)}</b>${r.reasons.length ? `<ul>${r.reasons.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}` +
      (r.stage === "unknown" ? `<p class="status">${tr("Log the last repotting, or when you got it, and Alvor reminds you in spring.")}</p>` : "") +
      (r.stage === "none" ? "" : `<span class="fb"><button type="button" class="fb-b" data-act="fb" data-kind="repotted" data-id="${p.id}">${FB.repotted}</button>` +
        (r.stage === "due" ? `<button type="button" class="fb-b" data-act="fb" data-kind="notYear" data-id="${p.id}">${FB.notYear}</button>` : "") + `</span>`) + `</div>`;
  }
  return html;
}
/* The choices: Alvor's value first (it then follows Alvor), with the plant's species and planting as they are in the form. */
function drawFeedChoices(p){
  if(!p) return;
  const L = GA.feedPlan({...p, species:$("#fSpecies").value, genus:$("#fGenus").value, planting:editSel.planting || p.planting, fe:null, rpy:null});
  const opt = (v, label, sel) => `<option value="${v}"${sel ? " selected" : ""}>${esc(label)}</option>`;
  const fe = $("#fFe").dataset.v ?? (p.fe ?? ""), rp = $("#fRpy").dataset.v ?? (p.rpy ?? "");
  $("#fFe").innerHTML = opt("", tr("Alvor's: {v}", {v:feedEveryText(L.alvor).toLowerCase()}), fe === "") + FEED_EVERY.map(n => opt(n, feedEveryText(n), fe !== "" && +fe === n)).join("");
  $("#fRpy").innerHTML = opt("", tr("Alvor's: {v}", {v:repotEveryText(L.rpAlvor).toLowerCase()}), rp === "") + REPOT_EVERY.map(n => opt(n, repotEveryText(n), rp !== "" && +rp === n)).join("");
  $("#fRpyF").hidden = !L.pot;
  const every = fe === "" ? L.alvor : +fe;
  $("#fFeedWinterRow").hidden = !every || every >= 180;   // nothing to keep going in winter
}
/* Feeding and repotting choices save at once. Empty follows Alvor, so the key is left out. */
function saveFeedChoices(){
  const p = editingId && plantById(editingId); if(!p) return;
  const setOwn = (k, v) => { if(v === "" || v == null) delete p[k]; else p[k] = +v; };
  setOwn("fe", $("#fFe").value); setOwn("rpy", $("#fRpy").value);
  if($("#fFeedWinter").checked && !$("#fFeedWinterRow").hidden) p.feedWinter = true; else delete p.feedWinter;
  save(); render(); refreshCareBox();
}
["#fFe", "#fRpy"].forEach(id => $(id).addEventListener("change", e => { e.target.dataset.v = e.target.value; drawFeedChoices(plantById(editingId)); if(editingId) saveFeedChoices(); }));
$("#fFeedWinter").addEventListener("change", () => { if(editingId) saveFeedChoices(); });
function refreshCareBox(){
  if(!dlg.open || !editingId) return;
  const p = state.plants.find(x => x.id === editingId); if(!p) return;
  $("#careNow").innerHTML = careBoxHtml(p);
  $("#feedNow").innerHTML = feedBoxHtml(p);
  showSettle(p);
  refreshPsTop();
}
$("#fZonePick").addEventListener("click", e => { if(pickerClick(e, editSel)) drawEditPick(); });
attachSuggest($("#fSpecies"), it => { $("#fGenus").value = it.genus; showPresetNote(); $("#fSpecies").dispatchEvent(new Event("change")); });
/* What Alvor knows for the species typed (formKB), "About this plant", and where the cold limit and watering come from. */
let formKB = null;
const formFacts = () => ({species:$("#fSpecies").value, genus:$("#fGenus").value, minTemp:$("#fMin").value, ws:$("#fWs").value, ww:$("#fWw").value});
function showPresetNote(){
  const r = findPreset($("#fSpecies").value, $("#fGenus").value);
  $("#presetNote").innerHTML = kbCardHtml(r); $("#kbAbout").hidden = !r; $("#psAbout").hidden = !r;
  showKbSource();
}
function showKbSource(){ $("#fKbSrc").innerHTML = kbSourceHtml(formFacts()); }
["#fMin", "#fWs", "#fWw"].forEach(id => $(id).addEventListener("input", showKbSource));
$("#fGenus").addEventListener("change", showPresetNote);
$("#fKbSrc").addEventListener("click", e => {
  const b = e.target.closest("[data-kb]"); if(!b) return;
  const r = findPreset($("#fSpecies").value, $("#fGenus").value); if(!r) return;
  if(b.dataset.kb === "min"){ $("#fMin").value = r.min; if(!$("#fCold").checked && coldDefault(r.min)){ $("#fCold").checked = true; coldHintEdit(); } }
  else { $("#fWs").value = r.ws; $("#fWw").value = r.ww; }
  showKbSource();
});
/* Editing: the same sheet, its own layer (name, species, care values), with one Save. A new plant starts there. */
function setEditing(on){
  dlg.classList.toggle("editing", !!on);
  const p = editingId && plantById(editingId);
  $("#psBack").hidden = !on || !p;
  $("#dlgTitle").textContent = !p ? tr("Add plant") : on ? tr("Edit {name}", {name:p.name}) : p.name;
  $("#dlgSave").textContent = p ? tr("Save") : tr("Save plant");
  $(".plant-dlg .dlg-b").scrollTop = 0;
}
$("#psEditBtn").addEventListener("click", () => { setEditing(true); setTimeout(() => $("#fName").focus({preventScroll:true}), 30); });
function leaveEdit(){ const p = editingId && plantById(editingId); if(!p) return dlg.close(); fillForm(p); setEditing(false); refreshPsTop(); }
$("#psBack").addEventListener("click", leaveEdit);
$("#dlgCancel").addEventListener("click", leaveEdit);
/* Escape or the phone's back on the Edit screen goes back to the plant first. */
dlg.addEventListener("cancel", e => { if(dlg.classList.contains("editing") && editingId && plantById(editingId)){ e.preventDefault(); leaveEdit(); } });
function fillForm(p){
  $("#fName").value = p ? p.name : "";
  $("#fSpecies").value = p ? p.species : "";
  $("#fGenus").value = p ? (p.genus || "") : "";
  $("#fPattern").innerHTML = patternOptions();
  $("#fPattern").value = p ? (isApt() && p.pattern === "greenhouse" ? "mover" : p.pattern) : "outdoor";
  $("#fMin").value = p && hasMin(p) ? p.minTemp : "";
  $("#fCold").checked = p ? p.coldAlert !== false : true;
  coldHintEdit();
  $("#fWs").value = p ? p.ws : 7;
  $("#fWw").value = p ? p.ww : 14;
  $("#fNotes").value = p ? p.notes || "" : "";
  formKB = p ? findPreset(p.species, p.genus) : null;
  showPresetNote();
}
function openDialog(id){
  editingId = id;
  const p = id ? state.plants.find(x => x.id === id) : null;
  $("#dlgDelete").hidden = !p;
  $("#psTop").innerHTML = p ? psTopHtml(p) : ""; upFull($("#psTop"));
  $("#arcBox").hidden = !p;
  $("#fZoneF").hidden = !!p;   // an existing plant moves with Move
  $("#psRows").hidden = !p; $("#psEditBtn").hidden = !p;
  dlg.querySelectorAll(".ps-row").forEach(d => { d.open = false; });
  fillForm(p);
  editSel = p ? {area:p.area, zone:p.zone, planting:p.planting, place:p.place || null} : {area:"outside", zone:"out-sun", planting:"ground", place:null};
  editMicro = {...((p && p.micro) || {})};
  drawEditPick();
  $("#careNow").innerHTML = p ? careBoxHtml(p) : "";
  $("#feedBox").hidden = !p || !!p.archived;
  $("#feedNow").innerHTML = p && !p.archived ? feedBoxHtml(p) : "";
  delete $("#fFe").dataset.v; delete $("#fRpy").dataset.v;
  $("#fFeedWinter").checked = !!(p && p.feedWinter);
  showSettle(p);
  pending = [];
  renderGallery();
  const ownT = p && online && token && me ? {owner:me.id, type:"plant", id:p.id, name:p.name, ownerName:tr("You")} : null;
  const showTalk = ownT && (visOf(p) !== "vault" || talkCount(ownT).r || talkCount(ownT).c);
  $("#plantTalkBox").hidden = !showTalk;
  if(showTalk) mountTalk($("#plantTalk"), ownT, "full"); else $("#plantTalk").innerHTML = "";
  editVis = {visibility:p ? visOf(p) : defaultVis(), visOpen:false};
  $("#fVis").hidden = !online;
  $("#fVis").innerHTML = visBlock(editVis.visibility, false);
  renderJBox();
  renderPlantTasks();
  $("#rowFriends").hidden = !online || !p;
  drawCutBox(p);
  if(p){ drawFeedChoices(p); fillRowSums(p); }
  setEditing(!p);
  dlg.showModal();
  dlg.scrollTop = 0;   // a plant always opens at its top (who it is, where, what it needs), not where the last one was left
  if(!p) $("#fName").focus();
}

$("#fSpecies").addEventListener("change", () => {
  if(editingId) drawFeedChoices(plantById(editingId));
  const pr = presetFor($("#fSpecies").value), was = formKB;
  formKB = pr;
  if(!pr){ showPresetNote(); return; }
  const isNew = !editingId;
  /* A value that followed Alvor for the old species follows it for the new one; a value of your own stays. */
  const followed = (v, k) => was && was[k] != null && v !== "" && +v === was[k];
  if(isNew || $("#fMin").value === "" || followed($("#fMin").value, "min")) $("#fMin").value = pr.min;
  if(pr.ws != null && (isNew || (followed($("#fWs").value, "ws") && followed($("#fWw").value, "ww")))){ $("#fWs").value = pr.ws; $("#fWw").value = pr.ww; }
  if(isNew){
    $("#fPattern").value = isApt() && pr.pat === "greenhouse" ? "mover" : pr.pat;
    $("#fCold").checked = coldDefault(pr.min); coldHintEdit();
    if(!$("#fName").value.trim()) $("#fName").value = pr.s;
  }
  showPresetNote();
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
  /* The Edit screen saves only what it shows; spot, sharing, cuttings and feeding are saved where they're changed. */
  const data = {
    name, species:$("#fSpecies").value.trim(), genus:$("#fGenus").value.trim() || ($("#fSpecies").value.trim().split(" ")[0] || ""), pattern:$("#fPattern").value, minTemp:isNaN(min) ? null : min, coldAlert,
    ws:Math.max(1, parseInt($("#fWs").value) || 7), ww:Math.max(1, parseInt($("#fWw").value) || 14), notes:$("#fNotes").value.trim()
  };
  if(editingId){
    const p = state.plants.find(x => x.id === editingId);
    Object.assign(p, data);
    p.own = KB.ownOf(p);
    save(); render(); setEditing(false); refreshPsTop(); drawFeedChoices(p); refreshCareBox(); toast(tr("Saved"));
    return;
  }else{
    const p = {id:uid(), created:new Date().toISOString(), ...data, lastWatered:null, visibility:editVis.visibility, micro:cleanMicro(editMicro)};
    p.own = KB.ownOf(p);
    applyZone(p, editSel.zone || "out-sun", editSel.planting);
    const pl = placeById(editSel.place); if(pl && placeZones(pl).includes(p.zone)) p.place = pl.id;
    state.plants.push(p); addLog(p.id, "add", "Added");
    if(pending.length){
      for(const ph of pending){ ph.plantId = p.id; try{ await idb.put(ph); }catch(e){ toast(tr("Couldn't save the photo")); } }
      photos[p.id] = sortPh(pending); pending = [];
    }
  }
  save(); dlg.close(); render(); toast(tr("Plant saved"));
});
/* Gone for good: the plant, its photos and its journal, here and in the account. The Archive keeps them instead. */
async function deleteForGood(id){
  const p = plantById(id); if(!p) return false;
  if(!confirm(p.archived ? tr("Delete {name} for good, with its photos and journal? This can't be undone.", {name:p.name})
    : tr("Delete {name} for good, with its photos and journal? If it died or you gave it away, Move to the Archive keeps its story.", {name:p.name}))) return false;
  /* Each photo is also taken off the account by its files, not only through the plant: a photo whose upload was
     cut off half way has files there but no row yet, and would otherwise stay behind. */
  for(const ph of photos[id] || []){ try{ await idb.del(ph.id); }catch(e){} if(token) forgetPhoto(ph.id); }
  delete photos[id];
  state.plants = state.plants.filter(x => x.id !== id);
  state.archive = (state.archive || []).filter(x => x.id !== id);
  save(); if(dlg.open && editingId === id) dlg.close(); render(); toast(tr("Plant deleted"));
  return true;
}
$("#dlgDelete").addEventListener("click", () => deleteForGood(editingId));

/* ---------- Species suggestions while typing ---------- */
const SPX = (() => {
  const genera = [], species = [];
  /* Common names in the app's language (species-es.js…); search finds the English names too. */
  const words = (a, b) => [...new Set(fold(`${a} ${b}`.toLowerCase()).split(/[\s-]+/).filter(Boolean))];
  KB.names().forEach(x => {
    const c = plantName(x.name, x.common);
    (x.kind === "genus" ? genera : species).push({...x, common:c, key:x.name.toLowerCase(), words:words(c, x.common), other:x.common.toLowerCase()});
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
