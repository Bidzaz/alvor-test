/* Alvor · Your garden's story: every plant's journal in one timeline, newest first. What you recorded (got it,
   flowering, a cutting, a problem noticed, photos, plants that left) is the story; a few lines Alvor adds by itself
   (a plant's year with you, a discovery, the day a plant was added) are marked as Alvor's, so it's always clear
   which moments are yours. Nothing is guessed from photos or the weather. Made on the phone, nothing new is stored.
   Plain script (no build step): loaded by index.html in a fixed order and sharing one global scope. */
"use strict";
const STORY_KINDS = ["acquired","planted","growth","flower","fruit","pruned","repotted","propagated","protected","unprotected","moved","issue","outcome","note","gone","back"];

/* Everything, newest first. mine: you recorded it; alvor: Alvor noticed it. */
function storyItems(f){
  const items = [], T = today();
  for(const p of allPlants()){
    if(f !== "photos"){
      for(const e of jEntries(p)){
        if(!STORY_KINDS.includes(e.k) || e.auto || e.task || e.d > T) continue;
        items.push({d:e.d, t:+e.m || 0, type:"ms", p, e});
      }
    }
    if(f !== "ms"){
      const byDay = {};
      (photos[p.id] || []).forEach(ph => { if(ph.date <= T) (byDay[ph.date] ||= []).push(ph); });
      Object.entries(byDay).forEach(([d, list]) => items.push({d, t:Math.max(...list.map(x => x.ts || 0)), type:"photos", p, list:sortPh(list.slice())}));
    }
    if(f === "all"){
      // Alvor's own lines: the day it was added (when you never said when you got it), and each year with you.
      const s = jSince(p);
      if(s && !s.got && s.d <= T) items.push({d:s.d, t:-1, type:"added", p, alvor:true});
      if(s){
        const end = p.archived && p.archived.d ? p.archived.d : T;
        for(let y = 1; y <= 60; y++){
          const a = `${+s.d.slice(0, 4) + y}${s.d.slice(4)}`.replace(/-02-29$/, "-02-28");
          if(a > end) break;
          items.push({d:a, t:-2, type:"year", p, n:y, alvor:true});
        }
      }
    }
  }
  // A discovery earned by a journal entry is already marked on that entry; the others get a line of their own.
  if(f === "all") discRows().filter(r => DSC.BY_ID[r.discovery] && !(r.evidence && r.evidence.e && (plantById(r.evidence.p) || {journal:[]}).journal.some(e => !e.del && String(e.id) === String(r.evidence.e))))
    .forEach(r => items.push({d:String(r.unlocked_at).slice(0, 10), t:Date.parse(r.unlocked_at) || 0, type:"disc", r, alvor:true}));
  return items.sort((a, b) => a.d < b.d ? 1 : a.d > b.d ? -1 : b.t - a.t);
}
function storyItemHtml(it){
  const p = it.p, who = p ? `<span class="st-plant">${esc(p.name)}</span>` : "";
  if(it.type === "ms"){
    const e = it.e, k = JK[e.k] ? e.k : e.k === "gone" || e.k === "back" ? e.k : "note";
    const label = e.k === "gone" ? arcWhat(e) : e.k === "back" ? tr("Back in the garden") : JK[k].label;
    const img = e.ph && (photos[p.id] || []).find(x => x.id === e.ph);
    return `<button type="button" class="jr-item k-${k}" data-story="plant" data-id="${esc(p.id)}"><span class="jr-ic">${JI[k] || JI.note}</span>
      <span class="jr-txt"><b>${who} · ${esc(label)}</b><small>${jDate(e.d)}</small>${e.n ? `<span class="jr-note">${esc(e.n)}</span>` : ""}${typeof discMarks === "function" ? discMarks(p, e) : ""}</span>
      ${img ? `<img class="jr-img" src="${phSrc(img)}" alt="" loading="lazy" decoding="async">` : ""}</button>`;
  }
  if(it.type === "photos") return `<div class="jr-item k-photo"><span class="jr-ic">${JI.photo}</span><span class="jr-txt"><b>${who} · ${trn(it.list.length, "{n} photo", "{n} photos")}</b><small>${jDate(it.d)}</small>
      <span class="jr-thumbs">${it.list.slice(0, 6).map(x => `<button type="button" data-story="photo" data-id="${esc(p.id)}" data-ph="${x.id}"><img src="${phSrc(x)}" loading="lazy" decoding="async" alt="${esc(tr("Photo of {name} from {date}", {name:p.name, date:jDate(x.date)}))}"></button>`).join("")}</span></span></div>`;
  const alvor = `<span class="st-alvor">${tr("Alvor")}</span>`;
  if(it.type === "added") return `<button type="button" class="jr-item k-start quiet" data-story="plant" data-id="${esc(p.id)}"><span class="jr-ic">${JI.start}</span><span class="jr-txt"><span>${alvor}${tr("{name} added to Alvor", {name:esc(p.name)})}</span><small>${jDate(it.d)}</small></span></button>`;
  if(it.type === "year") return `<button type="button" class="jr-item k-acquired quiet" data-story="plant" data-id="${esc(p.id)}"><span class="jr-ic">${JI.acquired}</span><span class="jr-txt"><span>${alvor}${trn(it.n, "{name}: a year in your garden", "{name}: {n} years in your garden", {name:esc(p.name)})}</span><small>${jDate(it.d)}</small></span></button>`;
  if(it.type === "disc") return `<button type="button" class="jr-item quiet st-disc" data-disc="see" data-id="${esc(it.r.discovery)}"><span class="jr-ic st-seal">${discSeal(it.r.discovery, true, 34)}</span><span class="jr-txt"><span>${alvor}${esc(tr("Discovery: {name}", {name:discName(it.r.discovery)}))}</span><small>${jDate(it.d)}</small></span></button>`;
  return "";
}
/* The timeline as HTML, for the Journal page and the garden journal sheet. S = {f, months, q (plant or note), place}. */
const STORY_PLACE = p => p.archived ? "archive" : plPlace(p) ? "pl:" + p.place : p.area === "porch" || p.area === "outside" ? "garden" : p.area;   // "garden": outside and the porch; "pl:…" one of your own places
function storyHtml(S, page){
  const q = fold(String(S.q || "").trim().toLowerCase());
  const hit = it => (!S.place || (it.p && STORY_PLACE(it.p) === S.place)) &&
    (!q || (it.p && fold([it.p.name, it.p.species, it.p.genus, it.e && it.e.n, it.e && JK[it.e.k] && JK[it.e.k].label].join(" ").toLowerCase()).includes(q)));
  const all = storyItems(S.f).filter(it => it.type === "disc" ? !S.place && !q : hit(it));
  const months = [...new Set(all.map(it => it.d.slice(0, 7)))];
  /* 12 months at a time, and at most about 300 entries (whole months, at least one): a big garden with thousands
     of photos and milestones stays quick. "Show earlier" brings the next ones. */
  const perMonth = {}; all.forEach(it => { const m = it.d.slice(0, 7); perMonth[m] = (perMonth[m] || 0) + 1; });
  const cap = 300 * S.months / 12; let nShown = 0, upto = 0;
  for(const m of months.slice(0, S.months)){ if(upto && nShown + perMonth[m] > cap) break; nShown += perMonth[m]; upto++; }
  const shown = new Set(months.slice(0, upto));
  const items = all.filter(it => shown.has(it.d.slice(0, 7)));
  const plants = allPlants(), nph = plants.reduce((n, p) => n + (photos[p.id] || []).length, 0);
  const nms = plants.reduce((n, p) => n + jEntries(p).filter(e => STORY_KINDS.includes(e.k) && !e.auto && !e.task).length, 0);
  const first = all.length ? all[all.length - 1].d : null;
  const F = {all:tr("Everything"), ms:tr("Milestones"), photos:tr("Photos")};
  const filtered = !!(q || S.place);
  let h = !page && first ? `<p class="st-sum">${[tr("Since {date}", {date:jMonth(first)}), trn(plants.length, "{n} plant", "{n} plants"), nms ? trn(nms, "{n} milestone", "{n} milestones") : "", nph ? trn(nph, "{n} photo", "{n} photos") : ""].filter(Boolean).join(" · ")}</p>` : "";
  h += `<div class="chips jr-chips" role="group" aria-label="${tr("Show")}">${Object.keys(F).map(k => `<button type="button" class="chip" data-stf="${k}" aria-pressed="${S.f === k}">${F[k]}</button>`).join("")}</div>`;
  if(!items.length){
    h += `<div class="jr-empty-box"><p class="status jr-empty st-empty">${filtered ? tr("Nothing recorded matches. Your journal is all still there: clear the search to see it.")
      : plants.length ? tr("Nothing recorded yet. When a plant flowers, gets repotted or you take its photo, add it to its journal: it all comes together here.") : tr("Your garden's story starts with your first plant.")}</p>
      ${filtered ? `<button type="button" class="btn small" data-jp="clear">${tr("Clear the search")}</button>` : page && plants.length ? "" : page ? `<button type="button" class="btn small primary" data-hub="add">${tr("Add plant")}</button>` : ""}</div>`;
  }else{
    let month = "";
    for(const it of items){
      const m = it.d.slice(0, 7);
      if(m !== month){ if(month) h += `</div>`; h += `<h3 class="jr-month">${jMonth(it.d)}</h3><div class="jr-list">`; month = m; }
      h += storyItemHtml(it);
    }
    h += `</div>`;
    if(months.length > upto) h += `<div class="jr-acts st-more"><button type="button" class="btn small" data-story="more">${tr("Show earlier")}</button></div>`;
  }
  h += `<p class="status st-key"><span class="st-alvor">${tr("Alvor")}</span>${tr("marks what Alvor noticed: a plant's years with you, a discovery. Everything else is what you recorded.")}</p>
    <p class="status jr-private">${ICON.lock}${tr("Only you see your garden's story. Friends see your shared plants' photos and happy moments, as before.")}</p>`;
  return h;
}

/* ---------- The Journal page (the Compass's third place) ---------- */
let JP = {f:"all", months:12, q:"", place:""};
function renderJournalPage(){
  const plants = allPlants(), nph = plants.reduce((n, p) => n + (photos[p.id] || []).length, 0);
  const nms = plants.reduce((n, p) => n + jEntries(p).filter(e => STORY_KINDS.includes(e.k) && !e.auto && !e.task).length, 0);
  $("#jpSum").textContent = plants.length ? [trn(state.plants.length, "{n} plant", "{n} plants"), nms ? trn(nms, "{n} milestone", "{n} milestones") : "", nph ? trn(nph, "{n} photo", "{n} photos") : ""].filter(Boolean).join(" · ") : tr("Your garden's story");
  const arc = (state.archive || []).length;
  $("#arcEntry").hidden = !arc;
  $("#arcCount").textContent = arc ? trn(arc, "{n} plant that left your garden", "{n} plants that left your garden") : "";
  if(typeof renderDiscCard === "function") renderDiscCard();
  /* Where: only the places that have plants (and the Archive when it has some). */
  const places = [...new Set(plants.map(STORY_PLACE))];
  const PL = {house:areaLabel("house"), garden:tr("Outside"), greenhouse:tr("Greenhouse"), balcony:tr("Balcony"), store:tr("Winter storage"), archive:tr("Archive"),
    ...Object.fromEntries(myPlaces().map(L => ["pl:" + L.id, esc(L.n)]))};
  const order = ["house", "garden", "greenhouse", "balcony", "store", ...myPlaces().map(L => "pl:" + L.id), "archive"].filter(k => places.includes(k));
  if(JP.place && !order.includes(JP.place)) JP.place = "";
  $("#jpPlaces").innerHTML = order.length > 1 ? [`<button type="button" class="chip" data-jpp="" aria-pressed="${!JP.place}">${tr("All places")}</button>`, ...order.map(k => `<button type="button" class="chip" data-jpp="${k}" aria-pressed="${JP.place === k}">${PL[k]}</button>`)].join("") : "";
  $("#jpSearch").value = JP.q;
  /* This season's photos sit above the search and the filters, so they stay put (and never jump) while you filter. */
  $("#jpTop").innerHTML = jpTopHtml();
  $("#journalBody").innerHTML = storyHtml(JP, true);
}
/* Photos first: last month's snapshot early in a month, then the season's newest photos across the garden. */
const SEASON_WORD = {spring:tr("This spring"), summer:tr("This summer"), autumn:tr("This autumn"), winter:tr("This winter")};
function jpTopHtml(){
  const m = GA.seasonMonth(new Date().getMonth() + 1, state.settings), season = [3,4,5].includes(m) ? "spring" : [6,7,8].includes(m) ? "summer" : [9,10,11].includes(m) ? "autumn" : "winter";
  const list = state.plants.flatMap(p => (photos[p.id] || []).map(ph => ({p, ph}))).sort((a, b) => (b.ph.ts || 0) - (a.ph.ts || 0)).slice(0, 12);
  const snap = typeof snapCardHtml === "function" ? snapCardHtml() : "";
  return (snap ? `<div class="jp-snap">${snap}</div>` : "") + (list.length ? `<h2 class="jp-season">${SEASON_WORD[season]}</h2>
    <div class="jp-photos">${list.map(({p, ph}) => `<button type="button" data-story="photo" data-id="${p.id}" data-ph="${ph.id}" aria-label="${esc(tr("{name}, {date}", {name:p.name, date:jDate(ph.date)}))}"><img src="${phSrc(ph)}" alt="" loading="lazy" decoding="async"><span>${esc(p.name)}</span></button>`).join("")}</div>` : "");
}
$("#jpSearch").addEventListener("input", e => { JP.q = e.target.value; JP.months = 12; $("#journalBody").innerHTML = storyHtml(JP, true); });
$("#jpPlaces").addEventListener("click", e => { const b = e.target.closest("[data-jpp]"); if(!b) return; JP.place = b.dataset.jpp; JP.months = 12; renderJournalPage(); });
$("#view-journal").addEventListener("click", e => {
  const b = e.target.closest("[data-jp]"); if(!b) return;
  if(b.dataset.jp === "clear"){ JP.q = ""; JP.place = ""; renderJournalPage(); $("#jpSearch").focus(); }
});
document.addEventListener("click", e => {
  const f = e.target.closest("[data-stf]");
  if(f && f.closest("#journalBody")){ JP.f = f.dataset.stf; JP.months = 12; $("#journalBody").innerHTML = storyHtml(JP, true); return; }
  const b = e.target.closest("[data-story]"); if(!b) return;
  const a = b.dataset.story;
  if(a === "open") return showTab("journal");
  if(a === "more"){ JP.months += 12; $("#journalBody").innerHTML = storyHtml(JP, true); }
  else if(a === "plant"){ if(plantById(b.dataset.id)) openJournal(b.dataset.id); }
  else if(a === "photo"){
    const p = plantById(b.dataset.id); if(!p) return;
    if(p.archived){ openJournal(p.id); return; }   // a plant in the Archive opens its journal, where its photos are
    openDialog(p.id); setTimeout(() => viewPhoto(b.dataset.ph), 50);
  }
});
