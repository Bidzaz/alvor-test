/* Alvor · The plant journal: milestones (got it, planted, new growth, flowering, pruned, repotted…), moves,
   photos over time and before and after.
   Each plant keeps its own journal in p.journal: [{id, d (day), k (kind), n (note), ph (photo id), m (when it
   last changed), txt (a move's history line), auto (written by Alvor), del (deleted)}]. Two phones' journals
   are merged entry by entry (sync.js), so nothing added on one phone is lost on the other. The journal is
   only yours: friends see the plant's photos, never its journal.
   Plain script (no build step): loaded by index.html in a fixed order and sharing one global scope. */
"use strict";
/* ---------- Kinds of entry ---------- */
const JI = {
  acquired:SV('<path d="M5 8.5h14l-1.2 11.5H6.2z"/><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5"/>'),
  planted:SV('<path d="M12 20v-7"/><path d="M12 13c0-3.2 2-5.2 5.2-5.2 0 3.2-2 5.2-5.2 5.2z"/><path d="M12 15.2c0-2.6-1.7-4.2-4.2-4.2 0 2.6 1.7 4.2 4.2 4.2z"/><path d="M4 20h16"/>'),
  growth:ICON.sprout,
  flower:SV('<g transform="translate(12 9.2)"><ellipse cy="-3.7" rx="2.1" ry="3.1"/><ellipse cy="-3.7" rx="2.1" ry="3.1" transform="rotate(72)"/><ellipse cy="-3.7" rx="2.1" ry="3.1" transform="rotate(144)"/><ellipse cy="-3.7" rx="2.1" ry="3.1" transform="rotate(216)"/><ellipse cy="-3.7" rx="2.1" ry="3.1" transform="rotate(288)"/><circle r="1.3"/></g><path d="M12 15.6V21.5"/>'),
  fruit:SV('<circle cx="8" cy="16" r="3.6"/><circle cx="16.2" cy="17" r="3.4"/><path d="M8 12.4c.8-4.2 3-7.2 7-8.9M16.2 13.6c-.3-4-.6-7-1.2-10.1"/>'),
  pruned:SV('<circle cx="6.5" cy="17.5" r="2.6"/><circle cx="17.5" cy="17.5" r="2.6"/><path d="M8.4 15.6 18 4M15.6 15.6 6 4"/>'),
  repotted:ICON.repot, fed:ICON.feed,
  propagated:SV('<path d="M7 20v-5.5"/><path d="M7 14.5c0-2.6 1.5-4.2 4-4.2 0 2.6-1.5 4.2-4 4.2z"/><path d="M17 20v-8.5"/><path d="M17 11.5c0-3 1.7-4.9 4.6-4.9 0 3-1.7 4.9-4.6 4.9zM17 13.5c0-2.6-1.6-4.1-4.2-4.1"/><path d="M3 20h18"/>'),
  protected:SV('<path d="M12 3.5 19 6v5.6c0 4.4-3 7.5-7 8.9-4-1.4-7-4.5-7-8.9V6z"/><path d="M12 8v6M9.4 9.5l5.2 3M14.6 9.5l-5.2 3"/>'),
  unprotected:ICON.sun,
  moved:ICON.move,
  note:SV('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>'),
  issue:SV('<path d="M12 3.5 21 19.5H3z"/><path d="M12 10v4.5"/><circle cx="12" cy="17" r=".9" fill="currentColor"/>'),
  outcome:SV('<path d="M12 3.5 19 6v5.6c0 4.4-3 7.5-7 8.9-4-1.4-7-4.5-7-8.9V6z"/><path d="M8.8 12.2l2.2 2.2 4.2-4.6"/>'),
  photo:ICON.camera, care:ICON.drop, start:ICON.leaf,
  gone:SV('<rect x="3.5" y="4" width="17" height="5" rx="1.5"/><path d="M5 9v9.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V9"/><path d="M10 13h4"/>'),
  back:SV('<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4.5h4.5"/><path d="M12 16v-4.5"/><path d="M12 12.5c0-2 1.3-3.3 3.3-3.3 0 2-1.3 3.3-3.3 3.3z"/>')
};
const JK = {
  acquired:{label:tr("Got it"), hint:tr("Where from, a gift, what it cost…")},
  planted:{label:tr("Planted"), hint:tr("Where, and in what soil…")},
  growth:{label:tr("New growth"), hint:tr("A new leaf, a new shoot, a pup…")},
  flower:{label:tr("Flowering"), hint:tr("First flower, how many, the colour…")},
  fruit:{label:tr("Fruiting"), hint:tr("How many, ripe or not…")},
  pruned:{label:tr("Pruned"), hint:tr("What you cut and why…")},
  repotted:{label:tr("Repotted"), hint:tr("Pot size, the compost you used…")},
  fed:{label:tr("Fed"), hint:tr("What you used, and how strong…")},
  propagated:{label:tr("Propagated"), hint:tr("Cuttings, division, seeds, who got one…")},
  protected:{label:tr("Protected from cold"), hint:tr("Fleece, wrapped the trunk, mulched the roots, covered the new growth…")},
  unprotected:{label:tr("Protection off"), hint:tr("Took the fleece or wrapping off…")},
  moved:{label:tr("Moved"), hint:tr("Where to, and why…")},
  issue:{label:tr("Problem noticed"), hint:tr("What you saw, and what you did about it…")},
  outcome:{label:tr("After the cold"), hint:tr("How it came through, what you'd do next time…")},
  note:{label:tr("Note"), hint:tr("Anything worth remembering…")}
};
const JK_ORDER = ["acquired","planted","growth","flower","fruit","pruned","repotted","fed","propagated","protected","unprotected","moved","issue","note"];

/* ---------- Dates and ages ---------- */
const jDate = (d, year = true) => parseDay(d).toLocaleDateString(LOCALE, year ? {day:"numeric", month:"short", year:"numeric"} : {day:"numeric", month:"short"});
const jMonth = d => cap(parseDay(d).toLocaleDateString(LOCALE, {month:"long", year:"numeric"}));
/* "5 days", "3 months", "2 years 7 months" between two days */
function jAge(from, to){
  const a = parseDay(from), b = parseDay(to || today());
  const days = daysBetween(from, to || today());
  if(days < 31) return trn(Math.max(0, days), "{n} day", "{n} days");
  let months = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth() - (b.getDate() < a.getDate() ? 1 : 0);
  months = Math.max(1, months);
  if(months < 24) return trn(months, "{n} month", "{n} months");
  const y = Math.floor(months / 12), m = months % 12;
  return trn(y, "{n} year", "{n} years") + (m ? " " + trn(m, "{n} month", "{n} months") : "");
}

/* ---------- The journal's data ---------- */
const jEntries = p => (p && p.journal || []).filter(e => e && !e.del);
function jPut(p, e){
  e.m = Math.max(Date.now(), ...((p.journal || []).filter(x => x.id === e.id).map(x => (+x.m || 0) + 1)));
  p.journal = GS.mergeJournal(p.journal, [e]);
}
function jDelete(p, id){
  const e = (p.journal || []).find(x => x.id === id); if(!e) return;
  jPut(p, {id, d:e.d, k:e.k, del:1});
}
/* A move in the history becomes a journal entry with an id made from the history line itself,
   so every phone makes the same entry and older moves join the journal once. */
const jLogId = e => "lg-" + GS.sig(`${e.t}|${e.plantId}|${e.type}|${e.detail ?? ""}`);
const jFromLog = e => ({id:jLogId(e), d:ymd(new Date(e.t)), k:"moved", txt:e.detail, auto:1, m:Date.parse(e.t) || 0});
function jNoteMove(p){
  const e = state.log[0];
  if(!e || e.plantId !== p.id || e.type !== "move") return;
  p.journal = GS.mergeJournal(p.journal, [{...jFromLog(e), to:p.zone}]);   // where it went: the season's moves read it back
}
/* Once per start: moves still in the history that aren't in their plant's journal yet. Returns true if any. */
function migrateJournal(){
  const byId = new Map(allPlants().map(p => [p.id, p]));
  const add = new Map();
  for(const e of state.log){
    if(e.type !== "move" || !byId.has(e.plantId)) continue;
    const p = byId.get(e.plantId), id = jLogId(e);
    if((p.journal || []).some(x => x.id === id)) continue;
    (add.get(p) || add.set(p, []).get(p)).push(jFromLog(e));
  }
  add.forEach((list, p) => { p.journal = GS.mergeJournal(p.journal, list); });
  return add.size > 0;
}
/* Since when the plant is yours: the "Got it" day, else the day it was added to Alvor. */
function jSince(p){
  const got = jEntries(p).filter(e => e.k === "acquired").map(e => e.d).sort()[0];
  if(got) return {d:got, got:true};
  const added = p.created ? ymd(new Date(p.created)) : (state.log.filter(e => e.plantId === p.id && e.type === "add").map(e => ymd(new Date(e.t))).sort()[0] || null);
  return added ? {d:added, got:false} : null;
}
function jSinceHtml(p, link){
  const s = jSince(p); if(!s) return "";
  const end = p.archived && p.archived.d >= s.d ? p.archived.d : null;   // an archived plant's time with you ended that day
  const age = daysBetween(s.d, end || today()) >= 1 ? ` · ${jAge(s.d, end || today())}` : "";
  const mY = d => parseDay(d).toLocaleDateString(LOCALE, {month:"long", year:"numeric"}), when = mY(s.d);
  const head = end ? (s.got ? tr("In your garden from {from} to {to}", {from:when, to:mY(end)}) : tr("With Alvor from {from} to {to}", {from:when, to:mY(end)}))
    : s.got ? tr("In your garden since {date}", {date:when}) : tr("With Alvor since {date}", {date:when});
  return `<p class="jr-since">${head}${age}` +
    (!s.got && link ? ` · <button type="button" class="linkish" data-j="since">${tr("When did you get it?")}</button>` : "") + `</p>`;
}
const jPhotos = id => (photos[id] || []).slice().sort((a, b) => a.ts - b.ts);   // oldest first

/* Everything that happened to a plant, newest first. filter: all, ms (milestones), photos, moves, care, feed. */
function jItems(p, filter){
  const items = [], E = jEntries(p);
  const linked = new Set(E.map(e => e.ph).filter(Boolean));
  if(filter === "all" || filter === "ms") E.filter(e => e.k !== "moved" || !e.auto).forEach(e => items.push({d:e.d, t:e.m, type:"ms", e}));
  if(filter === "all" || filter === "moves") E.filter(e => e.k === "moved" && e.auto).forEach(e => items.push({d:e.d, t:e.m, type:"move", e}));
  if(filter === "moves") E.filter(e => e.k === "moved" && !e.auto).forEach(e => items.push({d:e.d, t:e.m, type:"ms", e}));
  if(filter === "feed") E.filter(e => e.k === "fed").forEach(e => items.push({d:e.d, t:e.m, type:"ms", e}));
  if(filter === "all" || filter === "photos"){
    const byDay = {};
    (photos[p.id] || []).filter(ph => filter === "photos" || !linked.has(ph.id)).forEach(ph => (byDay[ph.date] ||= []).push(ph));
    Object.entries(byDay).forEach(([d, list]) => items.push({d, t:Math.max(...list.map(x => x.ts)), type:"photos", list:sortPh(list)}));
  }
  const care = state.log.filter(l => l.plantId === p.id && (l.type === "water" || l.type === "care"));
  if(filter === "care") care.forEach(l => items.push({d:ymd(new Date(l.t)), t:Date.parse(l.t), type:"care", l}));
  if(filter === "all"){
    const byMonth = {};
    care.filter(l => l.type === "water").forEach(l => { const d = ymd(new Date(l.t)), k = d.slice(0, 7); (byMonth[k] ||= {d, n:0}).n++; });
    Object.values(byMonth).forEach(x => items.push({d:x.d, t:0, type:"waterings", n:x.n}));
  }
  if(filter === "all"){
    const s = p.created ? ymd(new Date(p.created)) : null;
    if(s) items.push({d:s, t:-1, type:"start"});
  }
  return items.sort((a, b) => a.d < b.d ? 1 : a.d > b.d ? -1 : b.t - a.t);
}
function jItemHtml(it, p){
  const ph = id => (photos[p.id] || []).find(x => x.id === id);
  if(it.type === "ms" && (it.e.k === "gone" || it.e.k === "back")){   // the Archive's own entries: changed from its banner
    const e = it.e, gone = e.k === "gone";
    return `<div class="jr-item k-${e.k}"><span class="jr-ic">${JI[e.k]}</span><span class="jr-txt"><b>${gone ? esc(arcWhat(e)) : tr("Back in the garden")}</b><small>${jDate(e.d)}</small>${e.n ? `<span class="jr-note">${esc(e.n)}</span>` : ""}</span></div>`;
  }
  if(it.type === "ms"){
    const e = it.e, k = JK[e.k] ? e.k : "note", img = e.ph && ph(e.ph);
    return `<button type="button" class="jr-item k-${k}" data-j="edit" data-e="${esc(e.id)}"><span class="jr-ic">${JI[k]}</span>
      <span class="jr-txt"><b>${JK[k].label}</b><small>${jDate(e.d)}</small>${e.n ? `<span class="jr-note">${esc(e.n)}</span>` : ""}${typeof discMarks === "function" ? discMarks(p, e) : ""}</span>
      ${img ? `<img class="jr-img" src="${phSrc(img)}" alt="" loading="lazy" decoding="async">` : ""}</button>`;
  }
  if(it.type === "photos") return `<div class="jr-item k-photo"><span class="jr-ic">${JI.photo}</span><span class="jr-txt"><b>${trn(it.list.length, "{n} photo", "{n} photos")}</b><small>${jDate(it.d)}</small>
      <span class="jr-thumbs">${it.list.map(x => `<button type="button" data-act="viewPhoto" data-ph="${x.id}"><img src="${phSrc(x)}" loading="lazy" decoding="async" alt="${tr("Photo from {date}", {date:jDate(x.date)})}"></button>`).join("")}</span></span></div>`;
  if(it.type === "move") return `<div class="jr-item k-moved quiet"><span class="jr-ic">${JI.moved}</span><span class="jr-txt"><span>${esc(logText(it.e.txt))}</span><small>${jDate(it.d)}</small></span></div>`;
  if(it.type === "care") return `<div class="jr-item k-care quiet"><span class="jr-ic">${JI.care}</span><span class="jr-txt"><span>${esc(logText(it.l.detail))}</span><small>${jDate(it.d)}</small></span></div>`;
  if(it.type === "waterings") return `<div class="jr-item k-care quiet"><span class="jr-ic">${JI.care}</span><span class="jr-txt"><span>${trn(it.n, "Watered once this month", "Watered {n} times this month")}</span></span></div>`;
  return `<div class="jr-item k-start quiet"><span class="jr-ic">${JI.start}</span><span class="jr-txt"><span>${tr("Added to Alvor")}</span><small>${jDate(it.d)}</small></span></div>`;
}
function jTimeline(p, filter){
  const items = jItems(p, filter);
  if(!items.length) return `<p class="status jr-empty">${{ms:tr("No milestones yet."), photos:tr("No photos yet."), moves:tr("No moves yet."), care:tr("No waterings logged yet."), feed:tr("No feeding logged yet.")}[filter] || tr("Nothing here yet.")}</p>`;
  let html = "", month = "";
  for(const it of items){
    const m = it.d.slice(0, 7);
    if(m !== month){ if(month) html += `</div>`; html += `<h3 class="jr-month">${jMonth(it.d)}</h3><div class="jr-list">`; month = m; }
    html += jItemHtml(it, p);
  }
  return html + `</div>`;
}

/* ---------- In the plant sheet: the start of the journal ---------- */
/* The plant page, layer 2: its story, newest first, photos and milestones in one strip, and the way into the whole
   journal. Feeding (its own row) and Alvor's own move lines stay out. */
function renderJBox(){
  const p = editingId && plantById(editingId);
  $("#jrnBox").hidden = !p; if(!p) return;
  const items = jItems(p, "all").filter(it => !["waterings", "start", "move"].includes(it.type) && !(it.type === "ms" && it.e.k === "fed")).slice(0, 10);
  const n = jEntries(p).filter(e => !e.auto).length, nph = (photos[p.id] || []).length;
  const tile = it => {
    if(it.type === "photos"){ const ph = it.list && it.list[it.list.length - 1]; if(!ph) return "";
      return `<button type="button" data-act="viewPhoto" data-ph="${ph.id}"><span class="im"><img src="${phSrc(ph)}" alt="" loading="lazy" decoding="async"></span><small>${esc(jDate(it.d, false))}${it.list && it.list.length > 1 ? ` · ${it.list.length}` : ""}</small></button>`; }
    if(it.type === "ms"){ const e = it.e, ph = e.ph && galleryPhoto(e.ph), K = JK[e.k] || JK.note;
      if(e.k === "gone" || e.k === "back") return "";
      return `<button type="button" data-j="edit" data-e="${esc(e.id)}"><span class="im">${ph ? `<img src="${phSrc(ph)}" alt="" loading="lazy" decoding="async">` : (JI[e.k] || JI.note)}</span><small>${esc(K.label)} · ${esc(jDate(e.d, false))}</small></button>`; }
    return "";
  };
  $("#jrnPrev").innerHTML = `<div class="ps-story-h"><h3>${tr("Its story")}</h3>${jSinceHtml(p, true)}</div>
    <div class="ps-strip"><button type="button" class="add" data-j="add"><span class="im">${ICON.plus}</span><small>${tr("Add a moment")}</small></button>${items.map(tile).join("")}</div>
    <div class="jr-acts">${nph >= 2 ? `<button type="button" class="btn small" data-j="cmp">${tr("Before and after")}</button>` : ""}${n || nph ? `<button type="button" class="btn small" data-j="open">${tr("Whole journal")}</button>` : ""}</div>`;
}
const galleryPhoto = id => Object.values(photos).flat().find(x => x.id === id);

/* ---------- The whole journal ---------- */
const jrnDlg = $("#jrnDlg");
let J = null;   // {id, f}
function openJournal(id, f){
  J = {id, f:f || "all"};
  renderJournal(); jrnDlg.showModal();
  $("#jrnBody").scrollTop = 0;
}
function renderJournal(){
  const p = J && plantById(J.id);
  if(!p){ if(jrnDlg.open) jrnDlg.close(); return; }
  $("#jrnTitle").textContent = tr("{name}'s journal", {name:p.name});
  const list = jPhotos(p.id);
  const strip = list.length >= 2 ? `<h3 class="pick-h">${tr("Photos over time")}</h3><div class="jr-strip">${list.map((x, i) =>
    `<button type="button" data-act="viewPhoto" data-ph="${x.id}"><img src="${phSrc(x)}" loading="lazy" decoding="async" alt="${tr("Photo from {date}", {date:jDate(x.date)})}"><span>${parseDay(x.date).toLocaleDateString(LOCALE, {month:"short", year:"numeric"})}</span>${i ? `<small>+${jAge(list[0].date, x.date)}</small>` : `<small>${tr("first")}</small>`}</button>`).join("")}</div>` : "";
  const E = jEntries(p);
  const count = {all:null, ms:E.filter(e => !(e.k === "moved" && e.auto)).length, photos:(photos[p.id] || []).length, moves:E.filter(e => e.k === "moved").length,
    care:state.log.filter(l => l.plantId === p.id && (l.type === "water" || l.type === "care")).length, feed:E.filter(e => e.k === "fed").length};
  const F = {all:tr("Everything"), ms:tr("Milestones"), photos:tr("Photos"), moves:tr("Moves"), care:tr("Watering"), feed:tr("Feeding")};
  $("#jrnBody").innerHTML = arcBannerHtml(p) + jSinceHtml(p, true) +
    `<div class="jr-acts"><button type="button" class="btn small primary" data-j="add">${ICON.plus}${tr("Add to journal")}</button>${list.length >= 2 ? `<button type="button" class="btn small" data-j="cmp">${tr("Before and after")}</button>` : ""}</div>` +
    strip +
    `<div class="chips jr-chips">${Object.keys(F).filter(k => k === "all" || count[k] || k === J.f).map(k => `<button type="button" class="chip" data-jf="${k}" aria-pressed="${J.f === k}">${F[k]}${count[k] != null ? ` ${count[k]}` : ""}</button>`).join("")}</div>` +
    jTimeline(p, J.f) +
    `<p class="status jr-private">${ICON.lock}${tr("Only you see the journal. Friends see the plant's photos, as before.")}</p>`;
}
$("#jrnClose").addEventListener("click", () => jrnDlg.close());
function refreshJournal(){
  if(jrnDlg.open) renderJournal();
  if(dlg.open && editingId){ renderJBox(); refreshCareBox(); }   // a "Fed" or "Repotted" entry changes the feeding box too
}

/* ---------- Add or edit an entry ---------- */
const msDlg = $("#msDlg");
let MS = null;   // {plantId, id, k, d, n, ph, newPh:{data, ts}, dateTouched}
function openMs(plantId, id, preset){
  const p = plantById(plantId); if(!p) return;
  const e = id && jEntries(p).find(x => x.id === id);
  MS = e ? {plantId, id, k:e.k, d:e.d, n:e.n || "", ph:e.ph || null, txt:e.txt, auto:e.auto, newPh:null, dateTouched:true}
    : {plantId, id:null, k:null, d:today(), n:"", ph:null, newPh:null, dateTouched:false, ...(preset || {})};
  if(preset && preset.d) MS.dateTouched = true;
  renderMs(); msDlg.showModal();
}
function renderMs(){
  const p = plantById(MS.plantId); if(!p) return msDlg.close();
  $("#msTitle").textContent = MS.id ? (MS.auto ? tr("Move") : tr("Journal entry")) : tr("Add to {name}'s journal", {name:p.name});
  $("#msDelete").hidden = !MS.id;
  const sel = MS.newPh ? MS.newPh.data : MS.ph && phSrc((photos[p.id] || []).find(x => x.id === MS.ph));
  const own = (photos[p.id] || []);
  $("#msBody").innerHTML = (MS.auto ? `<p class="jr-movetxt">${ICON.move} ${esc(logText(MS.txt))}</p><p class="status">${tr("Alvor wrote this when you moved it. Add a note if you like.")}</p>`
      : `<div class="ms-kinds" role="group" aria-label="${tr("What happened?")}">${JK_ORDER.map(k => `<button type="button" class="ms-k k-${k}" data-mk="${k}" aria-pressed="${MS.k === k}"><span class="jr-ic">${JI[k]}</span>${JK[k].label}</button>`).join("")}</div>`) +
    `<div class="row2"><div class="field"><label for="msDate">${tr("When")}</label><input id="msDate" type="date" max="${today()}" value="${esc(MS.d)}"></div></div>
     <div class="field"><label for="msNote">${tr("Note")}</label><textarea id="msNote" rows="2" placeholder="${esc(MS.k && JK[MS.k] ? JK[MS.k].hint : tr("Anything worth remembering…"))}">${esc(MS.n)}</textarea></div>
     <div class="field"><label>${tr("Photo")}</label>
       ${sel ? `<div class="ms-ph"><img src="${sel}" alt=""><button type="button" class="btn small" data-ms="rmPh">${tr("Remove")}</button></div>` : ""}
       <div class="jr-acts"><button type="button" class="btn small" data-ms="cam">${ICON.camera}${tr("Take a photo")}</button><button type="button" class="btn small" data-ms="file">${tr("From gallery")}</button></div>
       ${own.length ? `<p class="status">${tr("Or one of its photos:")}</p><div class="cmp-strip">${own.map(x => `<button type="button" data-ms="pick" data-id="${x.id}" aria-pressed="${!MS.newPh && MS.ph === x.id}"><img src="${phSrc(x)}" loading="lazy" decoding="async" alt="${tr("Photo from {date}", {date:jDate(x.date)})}"><small>${jDate(x.date, false)}</small></button>`).join("")}</div>` : ""}
     </div>`;
  $("#msDate").addEventListener("change", e => { MS.d = e.target.value || today(); MS.dateTouched = true; });
  $("#msNote").addEventListener("input", e => { MS.n = e.target.value; });
}
$("#msBody").addEventListener("click", e => {
  const k = e.target.closest("[data-mk]"), b = e.target.closest("[data-ms]");
  if(k){ MS.k = k.dataset.mk; renderMs(); return; }
  if(!b) return;
  const a = b.dataset.ms;
  if(a === "cam") $("#msCam").click();
  else if(a === "file") $("#msFile").click();
  else if(a === "rmPh"){ MS.ph = null; MS.newPh = null; renderMs(); }
  else if(a === "pick"){
    const x = (photos[MS.plantId] || []).find(y => y.id === b.dataset.id); if(!x) return;
    MS.ph = x.id; MS.newPh = null;
    if(!MS.dateTouched) MS.d = x.date;   // a photo of an earlier day brings its day along
    renderMs();
  }
});
async function msAddFile(input){
  const f = input.files && input.files[0]; input.value = ""; if(!f || !MS) return;
  try{
    const ts = await photoWhen(f);
    MS.newPh = {data:await resizeImage(f), ts}; MS.ph = null;
    if(!MS.dateTouched) MS.d = ymd(new Date(ts));
    renderMs();
  }catch(err){ toast(tr("Couldn't add that photo")); }
}
$("#msFile").addEventListener("change", e => msAddFile(e.target));
$("#msCam").addEventListener("change", e => msAddFile(e.target));
$("#msClose").addEventListener("click", () => { msDlg.close(); MS = null; });
$("#msSave").addEventListener("click", async () => {
  const p = MS && plantById(MS.plantId); if(!p) return;
  if(!MS.k){ toast(tr("Pick what happened")); return; }
  if(MS.d > today()) MS.d = today();
  let ph = MS.ph;
  if(MS.newPh){
    const ts = MS.d === ymd(new Date(MS.newPh.ts)) ? MS.newPh.ts : MS.d === today() ? Date.now() : parseDay(MS.d).getTime();
    const x = {id:uid(), plantId:p.id, date:MS.d, ts, data:MS.newPh.data};
    try{ await idb.put(x); }catch(err){ toast(tr("Couldn't save the photo")); return; }
    photos[p.id] = sortPh([x, ...(photos[p.id] || [])]);
    addLog(p.id, "photo", "Photo added");
    ph = x.id;
  }
  const old = MS.id && (p.journal || []).find(x => x.id === MS.id);
  const e = {...(old || {}), id:MS.id || uid(), d:MS.d, k:MS.k};
  delete e.del;
  if(MS.n.trim()) e.n = MS.n.trim().slice(0, 1000); else delete e.n;
  if(ph) e.ph = ph; else delete e.ph;
  jPut(p, e);
  const isNew = !MS.id;
  save(); msDlg.close(); MS = null;
  renderGallery(); render(); refreshJournal();
  toast(isNew ? tr("Added to the journal") : tr("Saved"));
});
$("#msDelete").addEventListener("click", () => {
  const p = MS && plantById(MS.plantId); if(!p || !MS.id) return;
  if(!confirm(tr("Delete this journal entry? Its photo stays with the plant."))) return;
  jDelete(p, MS.id);
  save(); msDlg.close(); MS = null; refreshJournal(); toast(tr("Deleted"));
});

/* ---------- Before and after ---------- */
const cmpDlg = $("#cmpDlg");
let CMP = null;   // {id, a, b, mode, x}
function openCompare(id){
  const list = jPhotos(id); if(list.length < 2) return;
  CMP = {id, a:list[0].id, b:list[list.length - 1].id, mode:"slide", x:50};
  renderCompare(); cmpDlg.showModal();
}
function renderCompare(){
  const list = jPhotos(CMP.id);
  const A = list.find(x => x.id === CMP.a) || list[0], B = list.find(x => x.id === CMP.b) || list[list.length - 1];
  if(!A || !B) return cmpDlg.close();
  const gap = A.date === B.date ? tr("Same day") : tr("{age} apart", {age:jAge(A.date < B.date ? A.date : B.date, A.date < B.date ? B.date : A.date)});
  const strip = side => `<div class="cmp-strip">${list.map(x => `<button type="button" data-cpick="${side}" data-id="${x.id}" aria-pressed="${(side === "a" ? A : B).id === x.id}"><img src="${phSrc(x)}" loading="lazy" decoding="async" alt="${tr("Photo from {date}", {date:jDate(x.date)})}"><small>${jDate(x.date, false)}</small></button>`).join("")}</div>`;
  $("#cmpBody").innerHTML = `<div class="cmp-frame ${CMP.mode}" style="--x:${CMP.x}%">
      <img class="cmp-a" src="${phSrc(A)}" data-full="${A.id}" alt="${tr("Before: {date}", {date:jDate(A.date)})}"><img class="cmp-b" src="${phSrc(B)}" data-full="${B.id}" alt="${tr("After: {date}", {date:jDate(B.date)})}">
      ${CMP.mode === "slide" ? `<span class="cmp-line"></span><input type="range" class="cmp-range" min="0" max="100" value="${CMP.x}" aria-label="${tr("Slide between before and after")}">` : ""}
      <span class="cmp-lab l">${jDate(A.date)}</span><span class="cmp-lab r">${jDate(B.date)}</span></div>
    <p class="cmp-gap">${gap}</p>
    <div class="seg small" role="group" aria-label="${tr("How to compare")}"><button type="button" data-cmode="slide" aria-pressed="${CMP.mode === "slide"}">${tr("Slider")}</button><button type="button" data-cmode="side" aria-pressed="${CMP.mode === "side"}">${tr("Side by side")}</button></div>
    <h3 class="pick-h">${tr("Before")}</h3>${strip("a")}<h3 class="pick-h">${tr("After")}</h3>${strip("b")}`;
  upFull($("#cmpBody"));
  const r = $("#cmpBody .cmp-range");
  if(r) r.addEventListener("input", () => { CMP.x = +r.value; $("#cmpBody .cmp-frame").style.setProperty("--x", CMP.x + "%"); });
}
$("#cmpBody").addEventListener("click", e => {
  const m = e.target.closest("[data-cmode]"), c = e.target.closest("[data-cpick]");
  if(m){ CMP.mode = m.dataset.cmode; renderCompare(); }
  else if(c){ CMP[c.dataset.cpick] = c.dataset.id; renderCompare(); }
});
$("#cmpClose").addEventListener("click", () => cmpDlg.close());

/* ---------- Buttons anywhere in the plant sheet and the journal ---------- */
document.addEventListener("click", e => {
  const f = e.target.closest("[data-jf]");
  if(f && J){ J.f = f.dataset.jf; renderJournal(); return; }
  const b = e.target.closest("[data-j]"); if(!b) return;
  const id = jrnDlg.open && J ? J.id : editingId; if(!id) return;
  const a = b.dataset.j;
  if(a === "add") openMs(id);
  else if(a === "since") openMs(id, null, {k:"acquired"});
  else if(a === "edit") openMs(id, b.dataset.e);
  else if(a === "open") openJournal(id);
  else if(a === "cmp") openCompare(id);
});

/* ---------- From the photo viewer: add it to the journal, or change its day ---------- */
function fillViewerJournal(){
  const saved = !!(viewing && viewing.plantId);
  $("#viewerActs").hidden = !saved;
  $("#viewerDateIn").hidden = true;
  if(saved){ $("#viewerDateIn").value = viewing.date; $("#viewerDateIn").max = today(); }
}
$("#viewerJournal").addEventListener("click", () => {
  if(!viewing || !viewing.plantId) return;
  const v = viewing; viewer.close();
  openMs(v.plantId, null, {ph:v.id, d:v.date});
});
$("#viewerDateBtn").addEventListener("click", () => {
  const i = $("#viewerDateIn"); i.hidden = !i.hidden;
  if(!i.hidden){ i.focus(); try{ i.showPicker && i.showPicker(); }catch(e){} }
});
$("#viewerDateIn").addEventListener("change", async e => {
  const d = e.target.value; if(!viewing || !viewing.plantId || !d || d > today() || d === viewing.date) return;
  const keepTime = new Date(viewing.ts || Date.now());
  const at = parseDay(d); at.setHours(keepTime.getHours(), keepTime.getMinutes(), keepTime.getSeconds());
  viewing.date = d; viewing.ts = at.getTime(); viewing.dateDirty = true;
  try{ await idb.put(viewing); }catch(err){}
  sortPh(photos[viewing.plantId] || []);
  queuePhotoSync();
  $("#viewerDate").textContent = parseDay(d).toLocaleDateString(LOCALE, {day:"numeric", month:"long", year:"numeric"});
  e.target.hidden = true;
  renderGallery(); renderPlants(); refreshJournal();
  toast(tr("Photo moved to {date}", {date:jDate(d)}));
});
