/* Alvor · Seasonal snapshots: a month or a season of your garden on one page. The best photos, new plants,
   flowering, fruiting and other milestones from the journals, plants that left, and how much care went in.
   Made on the phone from what's already there (journals, photos, history), so nothing new is stored.
   Early each month Home offers last month's; More → Snapshots has every month and season. Shared as a picture.
   Plain script (no build step): loaded by index.html in a fixed order and sharing one global scope. */
"use strict";
const SNAP_ICON = SV('<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><path d="M3.5 15.5l4.5-4.5 4 4 3-3 5 5"/><circle cx="15.5" cy="9" r="1.6"/>');
const SEASONS = [["spring", tr("Spring"), [3,4,5]], ["summer", tr("Summer"), [6,7,8]], ["autumn", tr("Autumn"), [9,10,11]], ["winter", tr("Winter"), [12,1,2]]];
/* The happy milestones, best first: they pick the photos and lead the page. */
const SNAP_RANK = {flower:5, fruit:4, growth:3, acquired:2, planted:2, propagated:2};

/* A period: {kind:"month", y, m} or {kind:"season", y, s (0 spring … 3 winter)} → its first and last day.
   Seasons follow the hemisphere: south of the equator, winter is June to August. A winter starts in December. */
function snapRange(P){
  if(P.kind === "month"){ const last = new Date(P.y, P.m, 0).getDate(); return {from:`${P.y}-${pad(P.m)}-01`, to:`${P.y}-${pad(P.m)}-${pad(last)}`}; }
  const south = +state.settings.lat < 0, north = SEASONS[P.s][2];
  const real = north.map(m => south ? ((m + 5) % 12) + 1 : m);   // the real months of that season here
  const start = real[0], y0 = P.y, y2 = real[2] < start ? y0 + 1 : y0;
  const last = new Date(y2, real[2], 0).getDate();
  return {from:`${y0}-${pad(start)}-01`, to:`${y2}-${pad(real[2])}-${pad(last)}`};
}
function snapNow(kind){
  const d = new Date(), y = d.getFullYear(), m = d.getMonth() + 1;
  if(kind === "month") return {kind, y, m};
  const nm = GA.seasonMonth(m, state.settings), s = SEASONS.findIndex(x => x[2].includes(nm));
  // A winter that started last December belongs to last year.
  const r = snapRange({kind, y, s});
  return r.from > today() ? {kind, y:y - 1, s} : {kind, y, s};
}
/* Months step through the calendar; seasons go spring → summer → autumn → winter (which starts in December) → next spring. */
function snapNext(P, n){
  if(P.kind === "month"){ const i = P.y * 12 + P.m - 1 + n; return {kind:"month", y:Math.floor(i / 12), m:i % 12 + 1}; }
  let s = P.s + n, y = P.y;
  while(s > 3){ s -= 4; y++; } while(s < 0){ s += 4; y--; }
  return {kind:"season", y, s};
}
function snapTitle(P){
  if(P.kind === "month") return cap(new Date(P.y, P.m - 1, 15).toLocaleDateString(LOCALE, {month:"long", year:"numeric"}));
  const r = snapRange(P), y1 = r.from.slice(0, 4), y2 = r.to.slice(0, 4);
  return `${SEASONS[P.s][1]} ${y1 === y2 ? y1 : `${y1}–${y2.slice(2)}`}`;
}

/* Everything that happened in a period. */
function snapData(P){
  const {from, to} = snapRange(P), inR = d => d && d >= from && d <= to;
  const plants = allPlants(), byId = new Map(plants.map(p => [p.id, p]));
  const ms = [];
  plants.forEach(p => jEntries(p).forEach(e => { if(inR(e.d) && !(e.k === "moved" && e.auto) && !e.task && e.k !== "gone" && e.k !== "back") ms.push({p, e}); }));
  ms.sort((a, b) => (SNAP_RANK[b.e.k] || 0) - (SNAP_RANK[a.e.k] || 0) || (a.e.d < b.e.d ? -1 : 1));
  const phs = [];
  plants.forEach(p => (photos[p.id] || []).forEach(ph => { if(inR(ph.date)) phs.push({p, ph}); }));
  // The best photos: those of a happy milestone first, then one per plant (newest), then the rest, at most 7.
  const msPh = new Map(ms.filter(x => x.e.ph).map(x => [x.e.ph, SNAP_RANK[x.e.k] || 1]));
  const ranked = phs.map(x => ({...x, r:(msPh.get(x.ph.id) || 0) * 10 + x.ph.ts / 1e13})).sort((a, b) => b.r - a.r);
  const best = [], seen = new Set();
  ranked.forEach(x => { if(best.length < 7 && (msPh.has(x.ph.id) || !seen.has(x.p.id))){ best.push(x); seen.add(x.p.id); } });
  ranked.forEach(x => { if(best.length < 7 && !best.includes(x)) best.push(x); });
  const firstEver = (p, k, d) => !jEntries(p).some(e => e.k === k && e.d < d);
  const newPlants = plants.filter(p => { const s = jSince(p); return s && inR(s.d); });
  const gone = plants.filter(p => p.archived && inR(p.archived.d));
  const logIn = t => state.log.filter(l => l.type === t && inR(ymd(new Date(l.t))));
  return {from, to, ms, photos:phs, best, newPlants, gone,
    happy:ms.filter(x => ["flower", "fruit", "growth"].includes(x.e.k)).map(x => ({...x, first:firstEver(x.p, x.e.k, x.e.d)})),
    other:ms.filter(x => !["flower", "fruit", "growth", "acquired"].includes(x.e.k)),
    waterings:logIn("water").length, feeds:ms.filter(x => x.e.k === "fed").length, moves:logIn("move").length,
    tasks:GA.taskList(state.settings).filter(x => inR(x.done) || inR(x.last)).length,
    empty:!ms.length && !phs.length && !newPlants.length && !gone.length, byId};
}

/* ---------- On Home, early in the month: last month's snapshot ---------- */
const SNAP_SEEN = "alvor-snap-seen";
function snapCardHtml(){
  const d = new Date();
  if(d.getDate() > 10) return "";
  const P = snapNext(snapNow("month"), -1), key = `${P.y}-${pad(P.m)}`;
  try{ if(localStorage.getItem(SNAP_SEEN) === key) return ""; }catch(e){}
  const D = snapData(P);
  if(D.empty || (D.photos.length < 2 && !D.happy.length && !D.newPlants.length)) return "";
  const lead = [D.newPlants.length ? trn(D.newPlants.length, "{n} new plant", "{n} new plants") : "",
    D.happy.filter(x => x.e.k === "flower").length ? trn(D.happy.filter(x => x.e.k === "flower").length, "{n} flowering", "{n} flowerings") : "",
    D.photos.length ? trn(D.photos.length, "{n} photo", "{n} photos") : ""].filter(Boolean).join(" · ");
  return `<div class="acard snap-card">
    <div class="a-ic">${SNAP_ICON}</div>
    <div class="a-main"><span class="a-lab">${tr("Snapshot")}</span><h3>${tr("Your {month} in the garden", {month:new Date(P.y, P.m - 1, 15).toLocaleDateString(LOCALE, {month:"long"})})}</h3>
      ${lead ? `<p class="a-lead">${esc(lead)}</p>` : ""}
      ${D.best.length ? `<div class="snap-mini">${D.best.slice(0, 4).map(x => `<img src="${x.ph.data}" alt="">`).join("")}</div>` : ""}
      <div class="tk-acts"><button class="btn small primary" data-snap="open" data-y="${P.y}" data-m="${P.m}">${tr("Open")}</button><button class="btn small" data-snap="hide" data-key="${key}">${tr("Not now")}</button></div>
    </div></div>`;
}

/* ---------- The snapshot ---------- */
const snapDlg = $("#snapDlg");
let SNAP = null;   // the period shown
function openSnap(P){
  SNAP = P || snapNext(snapNow("month"), new Date().getDate() <= 10 ? -1 : 0);
  renderSnap(); snapDlg.showModal(); $("#snapBody").scrollTop = 0;
}
const snapDay = d => parseDay(d).toLocaleDateString(LOCALE, {day:"numeric", month:"short"});
function renderSnap(){
  const P = SNAP, D = snapData(P), nowP = snapNow(P.kind);
  const atNow = P.kind === "month" ? P.y === nowP.y && P.m === nowP.m : P.y === nowP.y && P.s === nowP.s;
  $("#snapTitle").textContent = tr("Snapshots");
  const stat = (n, one, many) => n ? `<span class="snap-stat"><b>${n}</b>${esc(trn(n, one, many).replace(/^\S+\s/, ""))}</span>` : "";
  const msLine = x => `<li class="k-${x.e.k}"><span class="jr-ic">${JI[x.e.k] || JI.note}</span><span><span><b>${esc(x.p.name)}</b> · ${esc((JK[x.e.k] || JK.note).label)}${x.first ? ` <em>${tr("first time")}</em>` : ""}</span><small>${snapDay(x.e.d)}${x.e.n ? " · " + esc(x.e.n) : ""}</small></span></li>`;
  let h = `<div class="snap-nav">
      <div class="seg small" role="radiogroup" aria-label="${tr("Month or season")}"><button type="button" data-snap="kind" data-k="month" aria-pressed="${P.kind === "month"}">${tr("Month")}</button><button type="button" data-snap="kind" data-k="season" aria-pressed="${P.kind === "season"}">${tr("Season")}</button></div>
      <div class="snap-step"><button type="button" class="round-back" data-snap="prev" aria-label="${tr("Earlier")}">${ICON.back}</button><h3>${esc(snapTitle(P))}</h3><button type="button" class="round-back fwd" data-snap="next" aria-label="${tr("Later")}" ${atNow ? "disabled" : ""}>${ICON.back}</button></div>
    </div>`;
  if(D.empty){ $("#snapBody").innerHTML = h + `<p class="status jr-empty" style="text-align:center;margin:30px 0">${tr("Nothing noted in this period. Photos and journal milestones make the snapshot.")}</p>`; return; }
  if(D.best.length) h += `<div class="snap-grid n${Math.min(D.best.length, 7)}">${D.best.map((x, i) => `<button type="button" data-snap="photo" data-p="${x.p.id}" data-ph="${x.ph.id}"><img src="${x.ph.data}" alt="${esc(x.p.name)}"><span>${esc(x.p.name)}</span></button>`).join("")}</div>`;
  h += `<div class="snap-stats">${stat(D.newPlants.length, "{n} new plant", "{n} new plants")}${stat(D.happy.filter(x => x.e.k === "flower").length, "{n} flowering", "{n} flowerings")}${stat(D.photos.length, "{n} photo", "{n} photos")}${stat(D.waterings, "{n} watering", "{n} waterings")}${stat(D.feeds, "{n} feed", "{n} feeds")}${stat(D.tasks, "{n} task done", "{n} tasks done")}</div>`;
  if(D.happy.length) h += `<h3 class="pick-h">${tr("Highlights")}</h3><ul class="snap-ms">${D.happy.slice(0, 12).map(msLine).join("")}</ul>`;
  if(D.newPlants.length) h += `<h3 class="pick-h">${tr("New in the garden")}</h3><div class="snap-plants">${D.newPlants.map(p => `<button type="button" data-snap="plant" data-p="${p.id}">${thumbHtml(p)}<span class="sp-n">${esc(p.name)}</span></button>`).join("")}</div>`;
  if(D.other.length) h += `<h3 class="pick-h">${tr("Also noted")}</h3><ul class="snap-ms">${D.other.slice(0, 10).map(msLine).join("")}</ul>`;
  if(D.gone.length) h += `<h3 class="pick-h">${tr("Gone from the garden")}</h3><ul class="snap-ms">${D.gone.map(p => `<li class="k-gone"><span class="jr-ic">${JI.gone}</span><span><span><b>${esc(p.name)}</b> · ${esc(arcWhat(p.archived))}</span><small>${snapDay(p.archived.d)}</small></span></li>`).join("")}</ul>`;
  h += `<div class="jr-acts snap-share"><button type="button" class="btn primary" data-snap="share">${tr("Share as a picture")}</button></div>
    <p class="status jr-private">${ICON.lock}${tr("Made on your phone from your journals and photos. Only you see it unless you share the picture.")}</p>`;
  $("#snapBody").innerHTML = h;
}
$("#snapClose").addEventListener("click", () => snapDlg.close());
document.addEventListener("click", e => {
  const b = e.target.closest("[data-snap]"); if(!b || b.disabled) return;
  const a = b.dataset.snap;
  if(a === "open") return openSnap(b.dataset.m ? {kind:"month", y:+b.dataset.y, m:+b.dataset.m} : null);
  if(a === "hide"){ try{ localStorage.setItem(SNAP_SEEN, b.dataset.key); }catch(err){} render(); return; }
  if(!SNAP) return;
  if(a === "kind"){
    if(b.dataset.k === "season") SNAP = snapOf(SNAP);
    else if(SNAP.kind === "season"){ const to = snapRange(SNAP).to, now = snapNow("month"); SNAP = to.slice(0, 7) > `${now.y}-${pad(now.m)}` ? now : {kind:"month", y:+to.slice(0, 4), m:+to.slice(5, 7)}; }
    renderSnap();
  }
  else if(a === "prev"){ SNAP = snapNext(SNAP, -1); renderSnap(); }
  else if(a === "next"){ SNAP = snapNext(SNAP, 1); renderSnap(); }
  else if(a === "plant"){ snapDlg.close(); openDialog(b.dataset.p); }
  else if(a === "photo"){ const p = plantById(b.dataset.p); if(p){ snapDlg.close(); openDialog(p.id); setTimeout(() => viewPhoto(b.dataset.ph), 50); } }
  else if(a === "share") shareSnap();
});
/* The season a month belongs to. */
function snapOf(P){
  if(P.kind === "season") return P;
  const nm = GA.seasonMonth(P.m, state.settings), s = SEASONS.findIndex(x => x[2].includes(nm));
  const r = snapRange({kind:"season", y:P.y, s});
  return r.from > `${P.y}-${pad(P.m)}-31` ? {kind:"season", y:P.y - 1, s} : {kind:"season", y:P.y, s};
}

/* ---------- Share as a picture: the photos, the title and the highlights, 1080 × 1350 ---------- */
async function snapPicture(P){
  const D = snapData(P), c = document.createElement("canvas"); c.width = 1080; c.height = 1350;
  const g = c.getContext("2d"), font = (w, s) => `${w} ${s}px Manrope, system-ui, sans-serif`;
  g.fillStyle = "#F3F1EA"; g.fillRect(0, 0, 1080, 1350);
  const imgs = await Promise.all(D.best.slice(0, 5).map(x => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = x.ph.data; })));
  const cover = (img, x, y, w, h) => {
    if(!img) return;
    const k = Math.max(w / img.width, h / img.height), sw = w / k, sh = h / k;
    g.save(); g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, 28) : g.rect(x, y, w, h); g.clip();
    g.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h); g.restore();
  };
  const L = imgs.filter(Boolean);
  const boxes = L.length >= 5 ? [[60, 60, 600, 640], [680, 60, 340, 310], [680, 390, 340, 310], [60, 720, 470, 300], [550, 720, 470, 300]]
    : L.length === 4 ? [[60, 60, 470, 470], [550, 60, 470, 470], [60, 550, 470, 470], [550, 550, 470, 470]]
    : L.length === 3 ? [[60, 60, 960, 560], [60, 640, 470, 380], [550, 640, 470, 380]]
    : L.length === 2 ? [[60, 60, 470, 960], [550, 60, 470, 960]] : L.length === 1 ? [[60, 60, 960, 960]] : [];
  L.forEach((img, i) => cover(img, ...boxes[i]));
  const top = L.length ? 1080 : 140;
  g.fillStyle = "#1F3A2A"; g.font = font(700, 64); g.fillText(snapTitle(P), 60, top);
  const facts = [D.newPlants.length ? trn(D.newPlants.length, "{n} new plant", "{n} new plants") : "", D.happy.filter(x => x.e.k === "flower").length ? trn(D.happy.filter(x => x.e.k === "flower").length, "{n} flowering", "{n} flowerings") : "",
    trn(D.photos.length, "{n} photo", "{n} photos")].filter(Boolean).join("  ·  ");
  g.fillStyle = "#4C5E52"; g.font = font(500, 36); g.fillText(facts, 60, top + 62);
  const hl = D.happy.slice(0, 3).map(x => `${x.p.name}: ${(JK[x.e.k] || JK.note).label.toLowerCase()}`).join("  ·  ");
  if(hl){ g.font = font(500, 32); g.fillText(hl.length > 60 ? hl.slice(0, 58) + "…" : hl, 60, top + 118); }
  g.fillStyle = "#2E6A4E"; g.font = font(700, 30); g.fillText("Alvor", 60, 1300);
  return new Promise(res => c.toBlob(res, "image/jpeg", 0.9));
}
async function shareSnap(){
  try{
    const blob = await snapPicture(SNAP), name = `alvor-${snapRange(SNAP).from.slice(0, 7)}.jpg`;
    const file = new File([blob], name, {type:"image/jpeg"});
    if(navigator.canShare && navigator.canShare({files:[file]})){ await navigator.share({files:[file], title:snapTitle(SNAP)}); return; }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    toast(tr("Picture saved"));
  }catch(e){ if(!(e && e.name === "AbortError")) toast(tr("Couldn't make the picture")); }
}
