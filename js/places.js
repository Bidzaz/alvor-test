/* Alvor · Your own places (Phase G): making, changing and deleting them.
   Plain script (no build step): loaded by index.html in a fixed order and sharing one global scope.
   What a place is, and how the rest of Alvor reads it, is at "Your own places" in js/core.js; the care engine takes
   its temperatures in alerts.js (placeSet). */
"use strict";
const placeDlg = $("#placeDlg");
let PLD = null;   // {id (null for a new place), n, k, heated, heat, gh, low}
const plantsIn = id => allPlants().filter(p => p.place === id);
function openPlace(id){
  const L = placeById(id);
  PLD = L ? {id:L.id, n:L.n, k:L.k, heated:isNum(L.heat), heat:isNum(L.heat) ? +L.heat : "", gh:isNum(L.gh) ? +L.gh : GA.RULES.place.gh, low:isNum(L.low) ? +L.low : ""}
          : {id:null, n:"", k:null, heated:false, heat:"", gh:GA.RULES.place.gh, low:""};
  $("#plTitle").textContent = L ? L.n : tr("Your own place");
  renderPlace();
  placeDlg.showModal();
  requestAnimationFrame(() => { const n = $("#plName"); if(n && !L) n.focus(); });
}
function renderPlace(){
  const D = PLD, used = D.id ? plantsIn(D.id).length : 0, lock = used > 0;
  const kindBtn = k => { const K = PLACE_KINDS[k];
    return `<button type="button" class="zone-opt" data-plkind="${k}" aria-pressed="${D.k === k}" ${lock && D.k !== k ? "disabled" : ""}><span class="zi a-${K.area}">${ICON[K.icon]}</span><span><b>${K.label}</b><small>${K.hint}</small></span></button>`; };
  const temp = D.k === "greenhouse" ? `
      <div class="seg" role="group" aria-label="${tr("Heating")}">
        <button type="button" data-plheat="0" aria-pressed="${!D.heated}">${tr("Unheated")}</button>
        <button type="button" data-plheat="1" aria-pressed="${D.heated}">${tr("Heated")}</button>
      </div>
      <div class="field" id="plHeatF" ${D.heated ? "" : "hidden"}><label for="plHeat">${tr("The heater keeps it above (°C)")}</label>
        <input id="plHeat" type="number" step="0.5" inputmode="decimal" value="${esc(String(D.heat))}" placeholder="5"></div>
      <div class="field"><label for="plGh">${tr("Without heat: warmer than outside by (°C)")}</label>
        <input id="plGh" type="number" step="0.5" min="0" max="15" inputmode="decimal" value="${esc(String(D.gh))}">
        <span class="hint">${tr("On a cold, clear night. A cold frame or a small polytunnel often only 1 to 2°, a glass greenhouse 2 to 4°.")}</span></div>`
    : D.k === "room" ? `<div class="field"><label for="plLow">${tr("The lowest it gets on a cold winter night (°C)")}</label>
        <input id="plLow" type="number" step="0.5" inputmode="decimal" value="${esc(String(D.low))}" placeholder="${tr("Warm")}">
        <span class="hint">${tr("Empty if it stays warm: Alvor then never warns about it.")}</span></div>`
    : D.k === "store" ? `<div class="field"><label for="plLow">${tr("The lowest it gets on a cold winter night (°C)")}</label>
        <input id="plLow" type="number" step="0.5" inputmode="decimal" value="${esc(String(D.low))}" placeholder="${GA.RULES.store.low}">
        <span class="hint">${tr("Empty: Alvor assumes about {t}. A min/max thermometer tells you for sure.", {t:GA.RULES.store.low + "°"})}</span></div>`
    : D.k ? `<p class="lt-note">${D.k === "covered" ? tr("Like the porch: rain doesn't reach it, and it stays a degree warmer than the open garden. Walls and shelter are set on each plant.")
        : tr("It follows the weather outside, like the rest of the garden. Walls, trees and shelter are set on each plant.")}</p>` : "";
  $("#plBody").innerHTML = `
    <p class="lt-intro">${tr("Name a place of your own. Alvor treats it like the kind you choose, with its own temperatures.")}</p>
    <div class="field"><label for="plName">${tr("Name")}</label><input id="plName" maxlength="30" autocomplete="off" value="${esc(D.n)}" placeholder="${isApt() ? tr("Storage room") : tr("Polytunnel")}"></div>
    <p class="pick-lead">${tr("What kind of place is it?")}</p>
    <div class="zone-pick" role="group" aria-label="${tr("What kind of place is it?")}">${placeKinds().map(kindBtn).join("")}</div>
    ${lock ? `<p class="status">${trn(used, "It has {n} plant: move it out to change the kind.", "It has {n} plants: move them out to change the kind.")}</p>` : ""}
    ${temp ? `<div class="pl-temp"><h3 class="sub-h">${tr("How warm it stays")}</h3>${temp}</div>` : ""}
    <div class="a-act"><button type="button" class="btn primary" id="plSave">${D.id ? tr("Save") : tr("Add this place")}</button>
      ${D.id ? `<button type="button" class="btn danger" id="plDel">${tr("Delete this place")}</button>` : ""}</div>`;
}
/* What's typed is kept while the kind changes (the sheet is drawn again). */
function readPlace(){
  const v = id => { const el = $("#" + id); return el ? el.value : null; };
  if(v("plName") != null) PLD.n = v("plName");
  if(v("plHeat") != null) PLD.heat = v("plHeat");
  if(v("plGh") != null) PLD.gh = v("plGh");
  if(v("plLow") != null) PLD.low = v("plLow");
}
$("#plClose").addEventListener("click", () => placeDlg.close());
$("#plBody").addEventListener("click", e => {
  const k = e.target.closest("[data-plkind]");
  if(k && !k.disabled){ readPlace(); PLD.k = k.dataset.plkind; renderPlace(); const f = $("#plBody").querySelector(`[data-plkind="${PLD.k}"]`); if(f) f.focus(); return; }
  const h = e.target.closest("[data-plheat]");
  if(h){ readPlace(); PLD.heated = h.dataset.plheat === "1"; renderPlace(); if(PLD.heated && $("#plHeat") && !$("#plHeat").value) $("#plHeat").focus(); return; }
  if(e.target.closest("#plSave")) return savePlace();
  if(e.target.closest("#plDel")) return deletePlace(PLD.id);
});
function savePlace(){
  readPlace();
  const D = PLD, name = String(D.n || "").replace(/\s+/g, " ").trim().slice(0, 30);
  if(!name){ toast(tr("Give the place a name")); $("#plName").focus(); return; }
  if(!D.k){ toast(tr("Choose what kind of place it is")); return; }
  if(myPlaces().some(L => L.id !== D.id && L.n.toLowerCase() === name.toLowerCase())){ toast(tr("You already have a place called {name}", {name})); $("#plName").focus(); return; }
  const val = x => { const n = parseFloat(String(x ?? "").replace(",", ".")); return isNaN(n) ? null : n; }, clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  if(D.k === "greenhouse" && D.heated && val(D.heat) == null){ toast(tr("Say how warm the heater keeps it")); $("#plHeat").focus(); return; }
  const rec = {id:D.id || uid().replace(/-/g, "").slice(0, 10), n:name, k:D.k, m:Date.now()};
  if(D.k === "greenhouse"){ const g = val(D.gh); rec.gh = g == null ? GA.RULES.place.gh : clamp(g, 0, 15); rec.heat = D.heated ? clamp(val(D.heat), -5, 30) : null; }
  if(D.k === "room" || D.k === "store"){ const l = val(D.low); rec.low = l == null ? null : clamp(l, D.k === "store" ? -15 : -10, 30); }
  const list = Array.isArray(state.settings.places) ? state.settings.places.filter(Boolean) : [];
  state.settings = {...state.settings, places:list.some(L => L.id === rec.id) ? list.map(L => L.id === rec.id ? rec : L) : [...list, rec]};   // an edited place keeps its turn
  save(); placeDlg.close();
  if(D.id){ render(); toast(tr("Saved")); return; }
  // A new place: open it, ready for its first plants.
  idsFilter = null; plantFilter = "pl:" + rec.id;
  showTab("plants"); render(); renderPlants();
  toast(tr("{name} is ready. Add a plant here, or move plants in with Move.", {name}), 4500);
}
function deletePlace(id){
  const L = placeById(id); if(!L) return;
  const list = plantsIn(id), where = AREAS[placeArea(L)] ? areaLabel(placeArea(L)) : "";
  if(!confirm(list.length ? trn(list.length, "Delete {name}? Its {n} plant stays where it is, in {where}.", "Delete {name}? Its {n} plants stay where they are, in {where}.", {name:L.n, where})
    : tr("Delete {name}?", {name:L.n}))) return;
  list.forEach(p => { delete p.place; });
  state.settings = {...state.settings, places:state.settings.places.map(x => x && x.id === id ? {id, del:1, m:Date.now()} : x)};
  save(); placeDlg.close();
  if(plantFilter === "pl:" + id){ plantFilter = "all"; showTab("locations"); }
  render(); toast(tr("{name} deleted", {name:L.n}));
}
