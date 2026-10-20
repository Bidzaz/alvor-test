/* Alvor · Discoveries: small marks of what you notice and record in your garden.
   The rules are in discoveries.js (shared with the server). Only the "discoveries" server function records one:
   after this phone has saved to the account, the app asks it to look, and shows what it found. A discovery is never
   sent from here, so nothing on the phone can make one up.

   Where they show: a quiet moment at the bottom of the screen when one is found (never over an open sheet, never on
   top of a warning, and switchable off), the collection in More → Your garden's story, and a small mark on the
   journal entry that earned one. No streaks, no points, nothing to keep up with; friends never see them.
   Until part 11 and the function are deployed, all of this stays hidden.
   Plain script (no build step): loaded by index.html in a fixed order and sharing one global scope. */
"use strict";
const DSC = window.AlvorDiscoveries;
const DISC_KEY = "alvor-discoveries";   // this phone's copy, so the collection opens offline
/* ready: null (not asked yet), true, or false (not deployed: hidden). list: rows from the server. */
let DISC = (() => {
  try{ const c = JSON.parse(localStorage.getItem(DISC_KEY) || "null"); if(c && c.account && c.list) return {ready:true, list:c.list, account:c.account, shown:c.shown || [], at:0, day:""}; }catch(e){}
  return {ready:null, list:[], account:null, shown:[], at:0, day:""};
})();
const discMine = () => !!(me && DISC.account === me.id);
const discRows = () => discMine() ? DISC.list : [];
const discHas = id => discRows().find(r => r.discovery === id);
function discSave(){ try{ localStorage.setItem(DISC_KEY, JSON.stringify({account:DISC.account, list:DISC.list, shown:DISC.shown.slice(-40)})); }catch(e){} }

/* ---------- Words ---------- */
const DISC_FAM = [["collect", tr("Discovering plants")], ["journal", tr("Your garden's story")], ["care", tr("Care through the seasons")], ["learn", tr("Growing and learning")]];
const DISC_TXT = {
  "first-roots":{name:tr("First Roots"), how:tr("Add your first plant to Alvor.")},
  "curious-eye":{name:tr("Curious Eye"), how:tr("Ask Alvor what a plant is, from a photo: tap + and take a picture.")},
  "fern-friend":{name:tr("Fern Friend"), how:""},
  "world-of-leaves":{name:tr("A World of Leaves"), how:""},
  "moment-in-green":{name:tr("A Moment in Green"), how:tr("Add a photo of a plant, or write something in its journal.")},
  "first-bloom":{name:tr("First Bloom"), how:tr("When a plant flowers, add Flowering to its journal. A photo alone isn't enough: Alvor can't see the flower.")},
  "season-by-season":{name:tr("Season by Season"), how:tr("Record one plant in spring, summer, autumn and winter, with photos or journal entries.")},
  "garden-historian":{name:tr("Garden Historian"), how:tr("Keep one plant's story: records on six different days, over at least six months.")},
  "year-together":{name:tr("A Year Together"), how:tr("Comes by itself: a plant's first year in your garden, counted from Got it, or from the day you added it.")},
  "thoughtful-watering":{name:tr("Thoughtful Watering"), how:tr("When Alvor suggests watering, feel the soil first and tell it what you found: Watered, Already wet or Looks fine.")},
  "weather-wise":{name:tr("Weather Wise"), how:tr("When a cold night is coming, act on the warning with its button: Mark as moved or Mark as protected.")},
  "winter-guardian":{name:tr("Winter Guardian"), how:tr("Protect a plant from the cold (fleece, a wrap, a thick mulch) and add Protected from cold to its journal.")},
  "new-beginnings":{name:tr("New Beginnings"), how:tr("Take a cutting, divide a plant or sow its seeds, and add Propagated to its journal.")},
  "lesson-learned":{name:tr("A Lesson Learned"), how:tr("Write down what you learned: a note in a plant's journal, or a problem you noticed.")},
  "passed-along":{name:tr("Passed Along"), how:""}
};
const discName = id => (DISC_TXT[id] || {}).name || id;
const discDay = d => d ? parseDay(String(d).slice(0, 10)).toLocaleDateString(LOCALE, {day:"numeric", month:"long", year:"numeric"}) : "";
const WX_WORD = {frost:tr("cold"), heat:tr("heat"), wind:tr("wind")};
/* Why it was earned, in a sentence, from what earned it (ev) and the plant as it is now (its name may have changed). */
function discWhy(id, ev){
  ev = ev || {};
  const p = ev.p && plantById(ev.p), plant = esc(p ? p.name : ev.pn || tr("a plant")), date = discDay(ev.d);
  const kind = ev.kind === "photo" ? tr("a photo") : ev.k && JK[ev.k] ? JK[ev.k].label : tr("a journal entry");
  switch(id){
    case "first-roots": return tr("{plant} was the first plant you added, on {date}.", {plant, date});
    case "curious-eye": return ev.d ? tr("You first asked Alvor to name a plant on {date}.", {date}) : tr("You asked Alvor to name a plant from a photo.");
    case "fern-friend": return tr("{plant} is a fern ({family}). Ferns are older than flowers: they spread by spores, not seeds.", {plant, family:esc((ev.f || [])[0] || "")});
    case "world-of-leaves": return tr("Your garden holds plants from five botanical families: {list}. A family groups plants that share their flowers and their ancestry.", {list:esc((ev.f || []).slice(0, 5).join(", "))});
    case "moment-in-green": return tr("Your first record of {plant}: {what}, {date}.", {what:esc(String(kind).toLowerCase()), plant, date});
    case "first-bloom": return tr("You noted {plant} flowering on {date}.", {plant, date});
    case "season-by-season": return tr("{plant} through the year: spring, summer, autumn and winter, all recorded.", {plant});
    case "garden-historian": return tr("{plant}'s story: records on {n} different days since {date}.", {plant, n:ev.n || 6, date:discDay(ev.from)});
    case "year-together": return tr("{plant} had its first year with you on {date}.", {plant, date});
    case "thoughtful-watering": return tr("You checked {plant} and told Alvor what you found, on {date}.", {plant, date});
    case "weather-wise": return tr("You acted on a {kind} warning for {plant}, on {date}.", {kind:WX_WORD[ev.wx] || WX_WORD.frost, plant, date});
    case "winter-guardian": return tr("You protected {plant} from the cold on {date}.", {plant, date});
    case "new-beginnings": return tr("You noted propagating {plant} on {date}.", {plant, date});
    case "lesson-learned": return tr("You wrote down something you learned about {plant}, on {date}.", {plant, date});
    case "passed-along": return ev.k === "received" ? tr("{plant} came to you as a cutting from a friend.", {plant})
      : ev.k === "given" ? tr("You gave a friend a cutting of {plant}, on {date}.", {plant, date}) : tr("A cutting changed hands through Alvor, on {date}.", {date});
  }
  return "";
}
/* How it's going, for a few that build up slowly. Gentle, and only in the detail. */
function discProgress(id, r){
  const pr = r && r.pr; if(!pr) return "";
  const P = pr.p && plantById(pr.p), plant = esc(P ? P.name : pr.pn || "");
  const SW = {spring:tr("spring"), summer:tr("summer"), autumn:tr("autumn"), winter:tr("winter")};
  if(id === "season-by-season" && pr.s && pr.s.length) return tr("So far: {plant} in {seasons}.", {plant, seasons:pr.s.map(s => SW[s]).join(", ")});
  if(id === "garden-historian" && pr.n) return trn(pr.n, "So far: {plant}, records on {n} day.", "So far: {plant}, records on {n} days.", {plant});
  if(id === "year-together" && pr.d) return tr("Next: {plant}, on {date}.", {plant, date:discDay(pr.d)});
  return "";
}

/* ---------- The seals: a field-notebook stamp per discovery ---------- */
const DISC_ART = {
  "first-roots":'<path d="M12 13.5V7.5"/><path d="M12 9.5c0-2.6-1.8-4.3-4.6-4.3 0 2.6 1.8 4.3 4.6 4.3zM12 8.4c0-2.3 1.6-3.8 4-3.8 0 2.3-1.6 3.8-4 3.8z"/><path d="M5 13.5h14" stroke-dasharray="1.4 1.8"/><path d="M12 13.5v3.2M12 15l-2.4 2.6M12 15.4l2.6 2.2M9.6 17.6l-1.2 1.6M14.6 17.6l1 1.8"/>',
  "curious-eye":'<circle cx="10.5" cy="10.5" r="5.5"/><path d="M14.6 14.6 19.5 19.5"/><path d="M8.2 12.4c.2-2.7 1.6-4.3 4.4-4.6-.2 2.7-1.7 4.4-4.4 4.6z"/>',
  "fern-friend":'<path d="M7 20c3-4 5-9 4.6-15"/><path d="M10.9 7.5 14.6 6M11.3 10l4-1.2M11.1 12.6l4 .2M10.4 15.2l3.6 1.2M9.3 17.6l3 1.8M10.9 7.5 8 5.8M11.3 10l-3.6-.9M11.1 12.6l-3.8.4M10.4 15.2l-3.4 1.4"/><path d="M11.6 5c.9-.9 2.1-.8 2.5.2-.6.8-1.5.8-2.1.3"/>',
  "world-of-leaves":'<path d="M6.5 18.5c0-5 2.6-8.2 7.5-8.6-.4 5-3.2 8.2-7.5 8.6z"/><path d="M6.5 18.5 11 14"/><path d="M13.5 9.5c-.6-2.8.6-5 3.6-6 .7 2.9-.6 5.1-3.6 6z"/><path d="M16 15.5c1.9-.9 3.6-.5 4.5 1.1-1.9.9-3.5.5-4.5-1.1z"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>',
  "moment-in-green":'<rect x="4.5" y="6.5" width="15" height="12" rx="2"/><path d="M9 6.5l1.2-2h3.6l1.2 2"/><path d="M10 15.5c0-2.6 1.4-4.2 4-4.4-.2 2.6-1.6 4.2-4 4.4z"/><path d="M10 15.5l2.2-2.2"/>',
  "first-bloom":'<g transform="translate(12 10)"><ellipse cy="-3.4" rx="2" ry="2.9"/><ellipse cy="-3.4" rx="2" ry="2.9" transform="rotate(72)"/><ellipse cy="-3.4" rx="2" ry="2.9" transform="rotate(144)"/><ellipse cy="-3.4" rx="2" ry="2.9" transform="rotate(216)"/><ellipse cy="-3.4" rx="2" ry="2.9" transform="rotate(288)"/><circle r="1.2"/></g><path d="M12 16v4.5M12 18.4c-1.6-1.4-3-1.5-4-.8"/>',
  "season-by-season":'<circle cx="12" cy="12" r="7.5"/><path d="M12 4.5v15M4.5 12h15"/><circle cx="8.6" cy="8.6" r="1.1"/><path d="M15.4 7.3v2.6M14.1 8.6h2.6"/><path d="M7.6 15.6c.6-1 1.6-1.4 2.4-1.2"/><path d="M15.4 14.2v2.8M14.2 14.9l2.4 1.4M14.2 16.3l2.4-1.4"/>',
  "garden-historian":'<path d="M12 7.5c-2-1.6-4.8-2-7.5-1.5v12c2.7-.5 5.5-.1 7.5 1.5 2-1.6 4.8-2 7.5-1.5V6c-2.7-.5-5.5-.1-7.5 1.5z"/><path d="M12 7.5v11.5"/><path d="M14.3 14c0-2.4 1.2-3.8 3.4-4.1-.1 2.3-1.3 3.8-3.4 4.1z"/><path d="M6.7 10h3M6.7 12.6h3"/>',
  "year-together":'<circle cx="12" cy="12" r="7.6"/><circle cx="12.4" cy="12.3" r="5"/><circle cx="12.7" cy="12.6" r="2.4"/><path d="M12 4.4c1.2 2.4 1.2 4.8.7 7.5"/>',
  "thoughtful-watering":'<path d="M10.5 3.8s4.6 4.9 4.6 8.2a4.6 4.6 0 0 1-9.2 0c0-3.3 4.6-8.2 4.6-8.2z"/><path d="M4 19.5h16" stroke-dasharray="1.4 1.8"/><path d="M15.5 14.6l1.8 1.8 3.4-3.8"/>',
  "weather-wise":'<path d="M7.5 15.5h9.2a3.3 3.3 0 0 0 .3-6.6 5 5 0 0 0-9.6 1.4A2.6 2.6 0 0 0 7.5 15.5z"/><path d="M9 18.5v2.4M8 19.7h2M15 18.5v2.4M14 19.7h2M12 17.6v2"/>',
  "winter-guardian":'<path d="M12 3.5 19 6v5.6c0 4.4-3 7.5-7 8.9-4-1.4-7-4.5-7-8.9V6z"/><path d="M12 8v6.4M9.3 9.6l5.4 3.2M14.7 9.6l-5.4 3.2"/>',
  "new-beginnings":'<path d="M7 20v-5.5"/><path d="M7 14.5c0-2.6 1.5-4.2 4-4.2 0 2.6-1.5 4.2-4 4.2z"/><path d="M17 20v-8.5"/><path d="M17 11.5c0-3 1.7-4.9 4.6-4.9 0 3-1.7 4.9-4.6 4.9zM17 13.5c0-2.6-1.6-4.1-4.2-4.1"/><path d="M3 20h18"/>',
  "lesson-learned":'<path d="M5 19.5c2.3-.4 4.7-1.6 7-4L19.2 8a2 2 0 0 0-2.9-2.9L9 12.3c-2.4 2.4-3.6 4.8-4 7.2z"/><path d="M12.5 8.8l2.7 2.7"/><path d="M4 21h8"/>',
  "passed-along":'<path d="M6 18c0-5 2-8.4 6-10"/><path d="M12 8c-.4-3 1.3-5.1 4.7-5.5.2 3.4-1.4 5.6-4.7 5.5z"/><path d="M14.5 15h6M18.2 12.6 20.5 15l-2.3 2.4"/><path d="M3.5 18h7"/>'
};
const DISC_COL = {"first-roots":"#3F6224", "curious-eye":"#4F5A7A", "fern-friend":"#2E6A4E", "world-of-leaves":"#3B6E57",
  "moment-in-green":"#6B5BA6", "first-bloom":"#AD4A74", "season-by-season":"#8A6A00", "garden-historian":"#6A5236",
  "year-together":"#8C5A0E", "thoughtful-watering":"#1F6F78", "weather-wise":"#2C6C99", "winter-guardian":"#3D5F8A",
  "new-beginnings":"#5C6B2A", "lesson-learned":"#56675D", "passed-along":"#7B5A3E"};
/* A seal: a double ring like a herbarium stamp, the motif inside. found: solid and in colour; not yet: pencil-light. */
function discSeal(id, found, size){
  const rot = (id.length * 37) % 360;   // each stamp sits at its own angle, like real ones
  return `<svg class="seal ${found ? "is-found" : "is-open"}" style="--dc:${DISC_COL[id] || "var(--fern)"}" width="${size || 64}" height="${size || 64}" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
    <circle class="seal-bg" cx="32" cy="32" r="30"/>
    <circle class="seal-o" cx="32" cy="32" r="29" fill="none" stroke-width="2"/>
    <circle class="seal-i" cx="32" cy="32" r="24.5" fill="none" stroke-width="1" stroke-dasharray="${found ? "2.2 2.6" : "1 3.2"}" transform="rotate(${rot} 32 32)"/>
    <g transform="translate(14 14) scale(1.5)" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round">${DISC_ART[id] || ""}</g>
  </svg>`;
}

/* ---------- Asking the server ---------- */
let discTimer = null, discBusy = null;
/* After a save reached the account (or a photo did): ask, a moment later. Not more than every 15 seconds,
   unless something changed; once a day at least (a plant's first year comes with time alone). */
function discQueue(changed){
  if(!online || !token || !me || DISC.ready === false) return;
  const due = changed || DISC.day !== today() || Date.now() - DISC.at > 6 * 3600e3;
  if(!due) return;
  clearTimeout(discTimer);
  discTimer = setTimeout(discCheck, Math.max(1500, 15000 - (Date.now() - DISC.at)));
}
async function discCheck(){
  if(!online || !token || !me) return;
  if(discBusy) return discBusy;
  discBusy = (async () => {
    try{
      const {r, j} = await callFn("discoveries", {});
      if(r.status === 503 || r.status === 404){ DISC.ready = false; renderDiscCard(); return; }   // part 11 or the function isn't there yet
      if(!r.ok || !Array.isArray(j.list)) return;
      if(DISC.account !== me.id) DISC.shown = [];
      DISC = {...DISC, ready:true, account:me.id, list:j.list, at:Date.now(), day:today()};
      discSave(); renderDiscCard(); discMoments();
      if(discDlg.open) renderDisc();
      if(typeof refreshJournal === "function") refreshJournal();
    }catch(e){ /* offline: try again with the next save */ }
    finally{ discBusy = null; }
  })();
  return discBusy;
}
/* Signed out, or another account: forget this phone's copy. */
function discForget(){ DISC = {ready:null, list:[], account:null, shown:[], at:0, day:""}; try{ localStorage.removeItem(DISC_KEY); }catch(e){} renderDiscCard(); }

/* ---------- The moment ---------- */
const discUnseen = () => discRows().filter(r => !r.seen_at && !DISC.shown.includes(r.discovery) && DSC.BY_ID[r.discovery]);
const discMomentsOn = () => state.settings.discMoments !== false;
let discWait = null;
/* Shown when nothing else needs the screen: no open sheet or dialog, not signing in, the app in front.
   A frost or heat warning on Home always stays above it: the moment sits at the bottom and is small. */
function discFree(){
  if(document.hidden || document.querySelector("dialog[open]") || !$("#auth").hidden || !$("#onb").hidden || $("#discMoment")) return false;
  // On Home, a frost, heat or wind warning has the screen to itself: the moment waits for another page or a calm day.
  if(currentTab === "today" && document.querySelector("#alerts .agroup.t-frost, #alerts .agroup.t-heat, #alerts .agroup.t-wind")) return false;
  return true;
}
function discMoments(){
  clearTimeout(discWait);
  const list = discUnseen();
  if(!list.length) return;
  if(!discMomentsOn()){ renderDiscCard(); return; }   // switched off: the collection still shows them as new
  if(!discFree()){ discWait = setTimeout(discMoments, 4000); return; }
  if(list.length >= 3) return discShow(null, list);   // many at once (first time, an import): one quiet line, not a parade
  discShow(list[0]);
}
function discShow(row, many){
  const ids = many ? many.map(r => r.discovery) : [row.discovery];
  DISC.shown.push(...ids); discSave();
  const el = document.createElement("div");
  // The moment is a labelled region that doesn't take the focus; a live region that is always on the page reads it
  // out (one added at the same moment as its text often isn't announced).
  el.id = "discMoment"; el.className = "disc-moment"; el.setAttribute("role", "region"); el.setAttribute("aria-label", many ? tr("Discoveries") : tr("New discovery"));
  el.innerHTML = many
    ? `<div class="dm-seals">${many.slice(0, 3).map(r => discSeal(r.discovery, true, 40)).join("")}</div>
       <div class="dm-txt"><span class="dm-lab">${tr("Discoveries")}</span><b>${trn(many.length, "Alvor found {n} discovery in your garden's story", "Alvor found {n} discoveries in your garden's story")}</b></div>`
    : `${discSeal(row.discovery, true, 52)}<div class="dm-txt"><span class="dm-lab">${tr("New discovery")}</span><b>${esc(discName(row.discovery))}</b><small>${discWhy(row.discovery, row.evidence)}</small></div>`;
  el.insertAdjacentHTML("beforeend", `<div class="dm-acts"><button type="button" class="btn small primary" data-disc="see" data-id="${many ? "" : esc(row.discovery)}">${tr("See it")}</button><button type="button" class="dm-x" data-disc="dismiss" aria-label="${tr("Close")}">${ICON.plus}</button></div>`);
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("in"));
  const live = $("#discLive");
  if(live){ live.textContent = ""; setTimeout(() => { live.textContent = many ? trn(many.length, "Alvor found {n} discovery in your garden's story", "Alvor found {n} discoveries in your garden's story") : `${tr("New discovery")}: ${discName(row.discovery)}`; }, 120); }
  discMarkSeen(ids);
}
function discDismiss(){
  const el = $("#discMoment"); if(!el) return;
  el.classList.remove("in"); setTimeout(() => { el.remove(); discMoments(); }, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 220);
}
async function discMarkSeen(ids){
  if(!ids.length || !token || !sb) return;
  try{
    const r = await sb.rpc("discoveries_seen", {p_ids:ids});
    if(r && !r.error){ const now = new Date().toISOString(); DISC.list.forEach(x => { if(ids.includes(x.discovery) && !x.seen_at) x.seen_at = now; }); discSave(); renderDiscCard(); }
  }catch(e){}
}
document.addEventListener("keydown", e => { if(e.key === "Escape" && $("#discMoment") && !document.querySelector("dialog[open]")) discDismiss(); });

/* ---------- Journal → Discoveries (and the moments switch in Settings) ---------- */
function renderDiscCard(){
  const box = $("#discEntry"); if(!box) return;
  const show = online && !!token && DISC.ready !== false && (DISC.ready === true || discMine());
  box.hidden = !show;
  const n = discRows().filter(r => DSC.BY_ID[r.discovery]).length, fresh = discRows().some(r => !r.seen_at);
  $("#discCount").textContent = n ? trn(n, "{n} found", "{n} found") : "";
  $("#discDot").hidden = !fresh;
  $("#discMomentsOn").checked = discMomentsOn();
  $("#discMomentsRow").hidden = !show;
  const card = $("#discCard"); if(card) card.hidden = !show;   // Settings: the moments switch, only once Discoveries are on
}
$("#discMomentsOn").addEventListener("change", e => { state.settings.discMoments = e.target.checked ? undefined : false; if(e.target.checked) delete state.settings.discMoments; save(); });

/* ---------- The collection ---------- */
const discDlg = $("#discDlg");
let DV = null;   // {id} when one is open, else the collection
function openDisc(id){ DV = id ? {id} : {}; renderDisc(); if(!discDlg.open) discDlg.showModal(); $("#discBody").scrollTop = 0; if(Date.now() - DISC.at > 15000) discCheck(); }
function discLocal(){
  try{
    const G = {plants:allPlants(), photos:Object.values(photos).flat().map(ph => ({id:ph.id, plantId:ph.plantId, d:ph.date})), log:state.log, settings:state.settings, facts:null};
    return DSC.evaluate(G, today());
  }catch(e){ return {}; }
}
function renderDisc(){
  const body = $("#discBody"), rows = discRows(), got = new Map(rows.map(r => [r.discovery, r]));
  if(DV && DV.id) return renderDiscOne(DV.id, got.get(DV.id));
  $("#discTitle").textContent = tr("Discoveries");
  const found = DSC.CATALOGUE.filter(c => got.has(c.id));
  const hiddenLeft = DSC.CATALOGUE.filter(c => c.hidden && !got.has(c.id)).length;
  let h = `<p class="disc-intro">${found.length
    ? trn(found.length, "{n} found so far. Each one marks something you noticed or did in your garden.", "{n} found so far. Each one marks something you noticed or did in your garden.")
    : tr("Small marks of what you notice and record in your garden: a first flower, a cutting, a plant's first year with you. They come by themselves as you look after your plants; there's nothing to keep up with.")}</p>`;
  if(!state.plants.length && !(state.archive || []).length) h += `<div class="jr-acts"><button type="button" class="btn small primary" data-disc="add">${ICON.plus}${tr("Add your first plant")}</button></div>`;
  for(const [fam, label] of DISC_FAM){
    const list = DSC.CATALOGUE.filter(c => c.fam === fam && (!c.hidden || got.has(c.id)));
    if(!list.length) continue;
    h += `<h3 class="pick-h">${label}</h3><div class="disc-grid">${list.map(c => {
      const r = got.get(c.id);
      // Named by what it shows (its name, then the day it was found or "Not yet"), as a screen reader reads it.
      return `<button type="button" class="disc-tile ${r ? "found" : ""}" data-disc="one" data-id="${c.id}">
        ${discSeal(c.id, !!r, 64)}<b>${esc(discName(c.id))}</b><small>${r ? `<span class="vh">${esc(tr("Found"))}: </span>` + esc(parseDay(String(r.unlocked_at).slice(0, 10)).toLocaleDateString(LOCALE, {day:"numeric", month:"short", year:"numeric"})) : tr("Not yet")}</small>${r && !r.seen_at ? `<i class="disc-new">${tr("New")}</i>` : ""}</button>`;
    }).join("")}</div>`;
  }
  if(hiddenLeft) h += `<p class="status disc-hidden">${trn(hiddenLeft, "And 1 more, hidden: it shows itself when it's found.", "And {n} more, hidden: each shows itself when it's found.")}</p>`;
  h += `<p class="status jr-private">${ICON.lock}${tr("Only you see your discoveries. Friends never do, and nobody is compared.")}</p>`;
  body.innerHTML = h;
  const unseen = rows.filter(r => !r.seen_at).map(r => r.discovery);
  if(unseen.length){ DISC.shown.push(...unseen); discSave(); discMarkSeen(unseen); }
}
function renderDiscOne(id, row){
  const c = DSC.BY_ID[id]; if(!c){ DV = {}; return renderDisc(); }
  $("#discTitle").textContent = discName(id);
  const live = discLocal()[id];
  // What earned it: as it is now if this phone can still see it, else as it was when it was found.
  const ev = live && live.ok && live.ev ? live.ev : row && row.evidence;
  const gone = row && live && live.known && !live.ok;
  const p = ev && ev.p && plantById(ev.p);
  const how = (DISC_TXT[id] || {}).how;
  let h = `<button type="button" class="linkish disc-back" data-disc="all">${ICON.back}${tr("All discoveries")}</button>
    <div class="disc-hero ${row ? "found" : ""}">${discSeal(id, !!row, 112)}<h3>${esc(discName(id))}</h3>
      <p class="disc-when">${row ? esc(tr("Found {date}", {date:discDay(row.unlocked_at)})) : tr("Not found yet")}</p></div>`;
  if(row){
    h += `<p class="disc-why">${discWhy(id, ev)}</p>`;
    if(gone) h += `<p class="status">${tr("The record that earned it isn't in your journal any more. The discovery stays: it happened.")}</p>`;
    if(p) h += `<div class="jr-acts disc-acts"><button type="button" class="btn small" data-disc="plant" data-id="${esc(p.id)}">${tr("Open {name}'s journal", {name:esc(p.name)})}</button></div>`;
  }else{
    if(how) h += `<p class="disc-why">${how}</p>`;
    const pr = discProgress(id, live);
    if(pr) h += `<p class="status disc-pr">${pr}</p>`;
    if(c.server) h += `<p class="status">${tr("Alvor notices this one in your account, after it has saved.")}</p>`;
  }
  $("#discBody").innerHTML = h;
}
$("#discClose").addEventListener("click", () => discDlg.close());
document.addEventListener("click", e => {
  const b = e.target.closest("[data-disc]"); if(!b) return;
  const a = b.dataset.disc;
  if(a === "open") return openDisc();
  if(a === "dismiss") return discDismiss();
  if(a === "see"){ discDismiss(); return openDisc(b.dataset.id || null); }
  if(a === "one"){ DV = {id:b.dataset.id}; renderDisc(); $("#discBody").scrollTop = 0; const t = $("#discBody .disc-back"); if(t) t.focus(); return; }
  if(a === "all"){ const id = DV && DV.id; DV = {}; renderDisc(); const t = id && $(`#discBody [data-id="${id}"]`); if(t) t.focus(); return; }
  if(a === "plant"){ discDlg.close(); openJournal(b.dataset.id); return; }
  if(a === "add"){ discDlg.close(); openWizard(); }
});

/* ---------- In a plant's journal: the entry that earned one ---------- */
function discMarks(p, e){
  if(!p || !e) return "";
  const hit = discRows().filter(r => r.evidence && r.evidence.p === p.id && String(r.evidence.e || "") === String(e.id) && DSC.BY_ID[r.discovery]);
  // A label, not a button: the entry itself is the button (it opens the entry); the collection is one tap away in More.
  return hit.map(r => `<span class="jr-disc">${discSeal(r.discovery, true, 18)}<span>${esc(tr("Discovery: {name}", {name:discName(r.discovery)}))}</span></span>`).join("");
}
