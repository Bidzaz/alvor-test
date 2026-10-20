/* Alvor · The Living Compass: the dock (Today, Garden, +, Journal, Circle), the way back, and the + action hub.
   Today, Garden, Journal and Circle are the four places you live in; everything else (a place's plants, a friend's
   garden, Settings) opens from one of them and goes back to exactly where you came from.
   The phone's back button and Escape close what's on top first (the + menu, a sheet), then go back a step, then to Today.
   Plain script (no build step): loaded by index.html in a fixed order and sharing one global scope. */
"use strict";

/* ---------- The way back ---------- */
/* NAV: where to go back to, one entry per step into a page that isn't one of the four (see showTab in js/plants.js). */
function navCtx(){ return {tab:currentTab, filter:plantFilter, ids:idsFilter, y:window.scrollY, visit:visit && visit.id}; }
function navBack(fallback){
  const c = NAV.pop();
  if(!c){ showTab(fallback && fallback !== currentTab ? fallback : rootTab !== currentTab ? rootTab : "today", {back:true}); return; }
  if(c.tab === "plants"){ plantFilter = c.filter; idsFilter = c.ids; }
  if(c.tab === "friend" && c.visit && (!visit || visit.id !== c.visit)){ openFriend(c.visit); return; }
  showTab(c.tab, {back:true});
  if(c.tab === "plants") renderPlants();
  requestAnimationFrame(() => window.scrollTo(0, c.y || 0));
}
/* The + menu and every sheet are <dialog>s: remember the order they opened in, so back closes the top one. */
const dlgOrder = [];
const openDialogs = () => dlgOrder.filter(d => d.open);
(() => {
  const show = HTMLDialogElement.prototype.showModal;
  HTMLDialogElement.prototype.showModal = function(){
    show.call(this);
    const i = dlgOrder.indexOf(this); if(i >= 0) dlgOrder.splice(i, 1);
    dlgOrder.push(this); syncTrap();
  };
})();
document.querySelectorAll("dialog").forEach(d => d.addEventListener("close", () => { const i = dlgOrder.indexOf(d); if(i >= 0) dlgOrder.splice(i, 1); }));
/* Closing the top sheet as Escape would: its own "cancel" handling runs first. */
function cancelDialog(d){
  const ev = new Event("cancel", {cancelable:true});
  d.dispatchEvent(ev);
  if(!ev.defaultPrevented && d.open) d.close();
}
/* One extra history entry while there's somewhere to go back to, so the phone's back button stays inside Alvor.
   When you're on Today with nothing open, back leaves the app as before. */
let backTrap = false;
const canGoBack = () => openDialogs().length > 0 || NAV.length > 0 || currentTab !== "today";
function syncTrap(){
  if(backTrap || !canGoBack()) return;
  try{ history.pushState({alvor:"back"}, ""); backTrap = true; }catch(e){}
}
window.addEventListener("popstate", () => {
  backTrap = false;
  const top = openDialogs().pop();
  if(top) cancelDialog(top);
  else if(NAV.length || currentTab !== rootTab) navBack();
  else if(currentTab !== "today") showTab("today");
  syncTrap();
});

/* ---------- Header: your profile and settings, the same round button on every page ---------- */
function fillMeButtons(){
  const signed = online && me && token;
  const html = signed && me.avatar ? `<img src="${avatarUrl(me.avatar)}" alt="">`
    : signed ? `<span class="me-i">${esc(((me.name || me.user || "?").replace(/^@/, "").trim().charAt(0) || "?").toUpperCase())}</span>` : ICON.gear;
  document.querySelectorAll(".me-btn").forEach(b => { b.innerHTML = html; b.classList.toggle("has-me", !!signed); });
}
document.addEventListener("click", e => {
  const g = e.target.closest("[data-goto]"); if(!g) return;
  const el = document.getElementById(g.dataset.goto); if(!el || el.hidden) return;
  el.scrollIntoView({block:"start", behavior:reduceMotion() ? "auto" : "smooth"});
  const h = el.querySelector("h2"); if(h){ h.tabIndex = -1; h.focus({preventScroll:true}); }
});
function fillSetIndex(){ document.querySelectorAll(".set-index [data-need]").forEach(b => { const c = document.getElementById(b.dataset.need); b.hidden = !c || c.hidden; }); }

/* ---------- The whole collection, from Garden or Today ---------- */
function openAllPlants(focusSearch){
  idsFilter = null; plantFilter = "all";
  showTab("plants"); renderPlants();
  if(focusSearch) setTimeout(() => $("#search").focus(), 30);
}

/* ---------- The + action hub ----------
   A compact sheet of the things worth doing right now: only what can actually be done in this state of the app,
   with a plain reason when something can't. It closes as soon as an action opens its own sheet. */
const hubDlg = $("#hubDlg");
let HUB = null;   // {step:"main"|"pick"|"care", kind, id, q}
const HUB_IC = {
  identify:ICON.camera, add:ICON.sprout, moment:SV('<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><path d="M3.5 15.5l4.5-4.5 4 4 3-3 5 5"/><circle cx="15.5" cy="9" r="1.6"/>'),
  care:ICON.drop, task:ICON.calendar
};
/* What Add a plant starts with when you're looking at one place: that place. */
function hubZone(){
  if(currentTab !== "plants" || idsFilter) return null;
  const f = plantFilter;
  const z = ZONES[f] ? f : f === "house" ? "house-window" : f === "garden" || f === "outside" ? "out-sun" : f === "porch" ? "porch-partial" : f === "greenhouse" ? "greenhouse" : f === "balcony" ? "balc-sun" : null;
  return z && ZONES[z] && (isApt() ? ["house","balcony"] : ["house","porch","outside","greenhouse"]).includes(ZONES[z].area) ? z : null;
}
function hubActions(){
  const has = state.plants.length > 0, net = navigator.onLine !== false, acct = online && !!token;
  const A = {
    identify:{label:tr("Identify a plant"), sub:tr("Take a photo and Alvor suggests what it is"),
      off:!net ? tr("Needs a connection. You can still add a plant by its name.") : !acct ? tr("Needs an Alvor account. You can still add a plant by its name.") : ""},
    add:{label:hubZone() ? tr("Add a plant here") : tr("Add a plant"), sub:hubZone() ? tr("In {spot}, by its name", {spot:ZONES[hubZone()].label}) : tr("By its name, with its spot and care")},
    moment:{label:tr("Add a photo or happy moment"), sub:tr("Flowering, new growth, a photo for its journal"), off:has ? "" : tr("Add a plant first.")},
    care:{label:tr("Log care"), sub:tr("Watered, fed, moved, repotted…"), off:has ? "" : tr("Add a plant first.")},
    task:{label:tr("Add a garden task"), sub:tr("Your own reminder: buy compost, plant bulbs…")}
  };
  /* Context first: in Journal a moment, in a place adding a plant there. */
  const order = rootTab === "journal" && currentTab === "journal" ? ["moment","identify","add","care","task"]
    : hubZone() ? ["add","identify","care","moment","task"] : ["identify","add","moment","care","task"];
  return order.map(k => ({k, ...A[k]}));
}
function openHub(step){
  HUB = {step:"main", q:"", ...(step || {})};
  renderHub();
  if(!hubDlg.open) hubDlg.showModal();
  document.body.classList.add("hub-open"); $("#addBtn").setAttribute("aria-expanded", "true");
  focusHub();
}
/* Focus goes to the first choice, not the search field, so a phone doesn't throw its keyboard up uninvited. */
function focusHub(){ requestAnimationFrame(() => { const f = $("#hubBody").querySelector("button:not([disabled]):not([aria-disabled=true])") || $("#hubBody").querySelector("input"); if(f) f.focus(); }); }
hubDlg.addEventListener("close", () => { HUB = null; document.body.classList.remove("hub-open"); $("#addBtn").setAttribute("aria-expanded", "false"); });
/* Escape or the phone's back inside a step goes back to all the actions first. */
hubDlg.addEventListener("cancel", e => { if(HUB && HUB.step !== "main"){ e.preventDefault(); HUB = {step:"main", q:""}; renderHub(); focusHub(); } });
function hubPlantRow(p){
  const ph = latestPhoto(p.id);
  return `<button type="button" class="hub-plant" data-hubp="${p.id}">${ph ? `<img src="${phSrc(ph)}" alt="" loading="lazy" decoding="async">` : `<span class="initial a-${p.area}">${esc((p.name || "?").trim().charAt(0).toUpperCase())}</span>`}
    <span class="hp-t"><b>${esc(p.name)}</b><small>${esc(ZONES[p.zone] ? ZONES[p.zone].label : "")}</small></span><span class="hp-f">${flagIcons(p.id)}</span></button>`;
}
function renderHub(){
  if(!HUB) return;
  const body = $("#hubBody"), back = $("#hubBack");
  back.hidden = HUB.step === "main";
  if(HUB.step === "main"){
    $("#hubTitle").textContent = tr("What would you like to do?");
    body.innerHTML = `<div class="hub-list">${hubActions().map(a => `<button type="button" class="hub-act k-${a.k}" data-hub="${a.k}" ${a.off ? `aria-disabled="true" aria-describedby="hub-why-${a.k}"` : ""}>
        <span class="hub-ic" aria-hidden="true">${HUB_IC[a.k]}</span><span class="hub-t"><b>${esc(a.label)}</b><small ${a.off ? `id="hub-why-${a.k}" class="hub-off"` : ""}>${esc(a.off || a.sub)}</small></span></button>`).join("")}</div>`;
    return;
  }
  if(HUB.step === "pick"){
    $("#hubTitle").textContent = HUB.kind === "moment" ? tr("Which plant?") : tr("Log care for which plant?");
    const q = fold(HUB.q.trim().toLowerCase());
    const list = state.plants.filter(p => !q || fold([p.name, p.species, p.genus].join(" ").toLowerCase()).includes(q));
    /* Plants that need something first when logging care, then by name. */
    const need = p => (plantFlags[p.id] || new Set()).size ? 0 : 1;
    list.sort((a, b) => (HUB.kind === "care" ? need(a) - need(b) : 0) || a.name.localeCompare(b.name));
    const had = document.activeElement && document.activeElement.id === "hubQ";
    body.innerHTML = `<input type="search" id="hubQ" class="hub-q" placeholder="${tr("Search plants")}" aria-label="${tr("Search plants")}" value="${esc(HUB.q)}">
      <div class="hub-plants" role="list">${list.map(hubPlantRow).join("") || `<p class="status">${tr("No plants match. Clear the search.")}</p>`}</div>`;
    if(had){ const i = $("#hubQ"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
    return;
  }
  /* Care for one plant: each button runs the same action as in the plant's own sheet. */
  const p = plantById(HUB.id); if(!p){ HUB = {step:"main", q:""}; return renderHub(); }
  $("#hubTitle").textContent = p.name;
  const fs = feedState(p), C = [
    ["water", ICON.drop, tr("Watered"), tr("Logs a watering today")],
    ...(fs.stage !== "none" ? [["fed", ICON.feed, tr("Fed today"), fs.stage === "due" ? tr("It's ready for feeding") : tr("Logs a feed in its journal")]] : []),
    ["move", ICON.move, tr("Moved…"), tr("Choose its new spot")],
    ...(p.planting !== "ground" ? [["repotted", ICON.repot, tr("Repotted…"), tr("Pot size and compost in its journal")]] : []),
    ["protect", JI.protected, tr("Protected from cold"), tr("Fleece, wrapping, mulch: noted in its journal")],
    ["health", ICON.warn, tr("Something wrong?"), tr("Likely causes from what you see")],
    ["open", ICON.leaf, tr("Open {name}", {name:p.name}), tr("Its photos, journal and care")]
  ];
  body.innerHTML = `<div class="hub-list">${C.map(([k, ic, t, s]) => `<button type="button" class="hub-act" data-hubc="${k}"><span class="hub-ic" aria-hidden="true">${ic}</span><span class="hub-t"><b>${esc(t)}</b><small>${esc(s)}</small></span></button>`).join("")}</div>`;
}
/* Runs after the hub has closed, so the next sheet opens on top of the page rather than on the hub. */
function hubRun(fn){ hubDlg.close(); setTimeout(fn, 0); }
function hubDo(k){
  if(k === "identify") return hubRun(() => openWizard());
  if(k === "add"){ const z = hubZone(); return hubRun(() => openWizard({step:1, typed:true, ...(z ? {zone:z, area:ZONES[z].area, top:null, zoneTouched:true, pattern:ZONES[z].area === "house" ? "indoor" : ZONES[z].area === "greenhouse" ? "greenhouse" : "outdoor", planting:canGround(z) && z !== "greenhouse" ? "ground" : "pot"} : {})})); }
  if(k === "task") return hubRun(() => openTasks({mode:"form", f:blankTask(), back:"home"}));
  if(k === "moment" || k === "care"){
    if(!state.plants.length) return;
    HUB = {step:"pick", kind:k, q:""};
    if(state.plants.length === 1) return hubPick(state.plants[0].id);   // only one plant: no need to choose
    renderHub(); focusHub();
  }
}
function hubPick(id){
  if(HUB.kind === "moment") return hubRun(() => openMs(id, null, {}));
  HUB = {step:"care", kind:"care", id, q:""}; renderHub(); focusHub();
}
$("#hubBody").addEventListener("click", e => {
  const a = e.target.closest("[data-hub]"), p = e.target.closest("[data-hubp]"), c = e.target.closest("[data-hubc]");
  if(a){ if(a.getAttribute("aria-disabled") === "true"){ const w = $("#hub-why-" + a.dataset.hub); if(w){ w.classList.remove("flash"); void w.offsetWidth; w.classList.add("flash"); } return; } return hubDo(a.dataset.hub); }
  if(p) return hubPick(p.dataset.hubp);
  if(!c || !HUB) return;
  const id = HUB.id, k = c.dataset.hubc;
  if(k === "water") hubRun(() => water([id], true));
  else if(k === "fed") hubRun(() => feedPlants([id]));
  else if(k === "move") hubRun(() => openMove(id));
  else if(k === "repotted") hubRun(() => openMs(id, null, {k:"repotted"}));
  else if(k === "protect") hubRun(() => protectGroup([id], "", ""));
  else if(k === "health") hubRun(() => openHealth(id));
  else if(k === "open") hubRun(() => openDialog(id));
});
$("#hubBody").addEventListener("input", e => { if(e.target.id === "hubQ" && HUB){ HUB.q = e.target.value; renderHub(); } });
$("#hubBack").addEventListener("click", () => { HUB = {step:"main", q:""}; renderHub(); focusHub(); });
$("#hubClose").addEventListener("click", () => hubDlg.close());
/* Light dismiss: a tap on the dimmed page around the sheet closes it. */
hubDlg.addEventListener("click", e => { if(e.target === hubDlg){ const r = hubDlg.getBoundingClientRect(); if(e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) hubDlg.close(); } });
$("#addBtn").addEventListener("click", () => { if(hubDlg.open) hubDlg.close(); else openHub(); });
/* The + action can also be asked for from a page (Journal's "Add a moment"). */
document.addEventListener("click", e => {
  const b = e.target.closest("[data-hub]"); if(!b || b.closest("#hubDlg")) return;
  openHub();
  const a = hubActions().find(x => x.k === b.dataset.hub);
  if(a && !a.off) hubDo(a.k);   // otherwise the menu shows why it can't be done yet
});

/* While typing on a phone, the dock steps aside so it never sits on the keyboard or the field. */
const isField = el => el && (el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && !["checkbox","radio","button","file","range","color"].includes(el.type)) || el.tagName === "SELECT");
document.addEventListener("focusin", e => { if(isField(e.target)) document.body.classList.add("typing"); });
document.addEventListener("focusout", e => { if(isField(e.target)) setTimeout(() => { if(!isField(document.activeElement)) document.body.classList.remove("typing"); }, 60); });
