/* Alvor · The season's big moves: the autumn move-in and the spring move-out, as one plan each.
   The plants that live outside in summer and inside (or in the greenhouse, or in winter storage) in winter, ranked by
   how tender they are, with the night each one has to be in by (the care engine's own limits) and what you did last
   year (the moves in their journals). Shown on Today while the season's move is under way.
   Plain script (no build step): loaded by index.html in a fixed order and sharing one global scope. */
"use strict";
const MOVERS = p => p.planting !== "ground" && ["mover", "greenhouse"].includes(p.pattern);
const SHELTERED = ["house", "greenhouse", "store"];
/* The day a plant last went in (autumn) or out (spring) in an earlier year, from its journal's moves. */
function lastYearMove(p, inward){
  const thisYear = +today().slice(0, 4), area = e => e.to ? (ZONES[e.to] || {}).area : Object.values(ZONES).find(z => e.txt && e.txt.endsWith(z.label)) ? Object.values(ZONES).find(z => e.txt.endsWith(z.label)).area : null;
  const hits = jEntries(p).filter(e => e.k === "moved" && e.d && +e.d.slice(0, 4) < thisYear && area(e)).filter(e => inward === SHELTERED.includes(area(e)));
  const months = inward ? [8, 9, 10, 11, 12] : [3, 4, 5, 6];
  return hits.filter(e => months.includes(GA.seasonMonth(+e.d.slice(5, 7), state.settings))).map(e => e.d).sort().pop() || null;
}
function campaignHtml(){
  const W = wx(); if(!W || !state.plants.length) return "";
  const sm = GA.seasonMonth(new Date().getMonth() + 1, state.settings);
  const movers = state.plants.filter(MOVERS).sort((a, b) => (+b.minTemp || 0) - (+a.minTemp || 0));
  if(!movers.length) return "";
  const x = {W, today:today()};
  if([9, 10, 11, 12].includes(sm)){
    const out = movers.filter(p => !SHELTERED.includes(p.area)), total = movers.length, inN = total - out.length;
    if(!out.length) return "";
    const near = out.some(p => W.next.some(d => { const t = GA.effMin(p, d, state.settings); return t != null && t < GA.coldLimit(p, state.settings, x) + 4; }));
    if(!near && sm < 10) return "";
    const due = p => { const i = W.next.findIndex(d => { const t = GA.effMin(p, d, state.settings); return t != null && t < GA.coldLimit(p, state.settings, x) + 2; });
      return i < 0 ? tr("before the first frost") : i <= 1 ? tr("tonight") : tr("by {day}", {day:longDay(W.next[i - 1].date)}); };
    const dest = p => p.pattern === "greenhouse" && !isApt() ? tr("to the greenhouse") : tr("inside");
    const ly = out.map(p => ({p, d:lastYearMove(p, true)})).find(o => o.d);
    /* Plants that have to move now are already jobs in Walk the garden: here they're only counted. */
    const now = new Set((typeof JOBS !== "undefined" ? JOBS : []).filter(j => ["bringIn", "toGh"].includes(j.key)).map(j => j.p.id));
    const later = out.filter(p => !now.has(p.id));
    const nowN = out.length - later.length;
    return `<div class="acard season-card">
      <div class="a-main"><span class="a-lab">${ICON.move}${tr("Autumn move-in")}</span>
        <h2 class="gt-h">${tr("{d} of {n} in for the winter", {d:inN, n:total})}</h2>
        <div class="gt-prog"><span class="pbar"><i style="width:${Math.round(inN / total * 100)}%"></i></span></div>
        ${nowN ? `<p class="a-lead">${esc(trn(nowN, "1 has to come in now: it's in Walk the garden.", "{n} have to come in now: they're in Walk the garden."))}</p>` : ""}
        <ul class="jobs">${later.slice(0, 6).map(p => `<li class="job"><span class="job-ph">${latestPhoto(p.id) ? `<img src="${phSrc(latestPhoto(p.id))}" alt="" loading="lazy">` : `<span class="initial a-${p.area}">${esc(p.name.charAt(0).toUpperCase())}</span>`}</span>
          <span class="job-t"><button type="button" class="pn" data-act="edit" data-id="${p.id}">${esc(p.name)}</button><small>${esc(tr("Takes {t}", {t:deg(p.minTemp)}) + " · " + tr("{where}, {when}", {where:dest(p), when:due(p)}))}</small></span>
          <button type="button" class="btn small" data-act="move" data-id="${p.id}">${tr("Move")}</button></li>`).join("")}</ul>
        ${later.length > 6 ? `<p class="status">${trn(later.length - 6, "and {n} more", "and {n} more")}</p>` : ""}
        ${ly ? `<p class="a-lead">${esc(tr("Last year you brought the {name} in on {date}.", {name:ly.p.name, date:jDate(ly.d, false)}))}</p>` : ""}
      </div></div>`;
  }
  if([3, 4, 5, 6].includes(sm)){
    const inside = movers.filter(p => SHELTERED.includes(p.area)), total = movers.length, outN = total - inside.length;
    if(!inside.length) return "";
    const ready = new Set((LAST_GROUPS.find(g => g.key === "goOut") || {items:[]}).items.map(i => i.p.id));
    const lowest = Math.min(...W.next.map(d => d.min));
    const ly = inside.map(p => ({p, d:lastYearMove(p, false)})).find(o => o.d);
    const readyIds = inside.filter(p => ready.has(p.id)).map(p => p.id);
    return `<div class="acard season-card">
      <div class="a-main"><span class="a-lab">${ICON.move}${tr("Spring move-out")}</span>
        <h2 class="gt-h">${tr("{d} of {n} back outside", {d:outN, n:total})}</h2>
        <div class="gt-prog"><span class="pbar"><i style="width:${Math.round(outN / total * 100)}%"></i></span></div>
        <ul class="jobs">${inside.slice(0, 6).map(p => `<li class="job"><span class="job-ph">${latestPhoto(p.id) ? `<img src="${phSrc(latestPhoto(p.id))}" alt="" loading="lazy">` : `<span class="initial a-${p.area}">${esc(p.name.charAt(0).toUpperCase())}</span>`}</span>
          <span class="job-t"><button type="button" class="pn" data-act="edit" data-id="${p.id}">${esc(p.name)}</button><small>${esc(ready.has(p.id) ? tr("Ready: ease it out over a week or two") : tr("Waiting: nights still down to {t}, it takes {min}", {t:deg(lowest), min:deg(p.minTemp)}))}</small></span></li>`).join("")}</ul>
        ${readyIds.length ? `<div class="a-act"><button class="btn primary small" data-act="moveAll" data-to="outside" data-ids="${readyIds.join(",")}">${trn(readyIds.length, "Mark {n} as moved out", "Mark {n} as moved out")}</button></div>` : ""}
        ${ly ? `<p class="a-lead">${esc(tr("Last year the {name} went out on {date}.", {name:ly.p.name, date:jDate(ly.d, false)}))}</p>` : ""}
      </div></div>`;
  }
  return "";
}
