/* Alvor · Today, built around what to do and where (the audit's "Now").
   From the top: the morning after a cold night (how did they do?), a question Alvor needs answered now (is the
   greenhouse heated?), the decision with its deadline and the frost line (each plant at the coldest it can be
   left at, the night as a line), the season's move in or out, Walk the garden (the jobs grouped by where you'll
   be, each with a tick), and the week ahead with the jobs on their days (js/home.js renderForecast).
   Everything comes from the care engine (alerts.js) through buildAlerts(); nothing here decides anything new.
   Plain script (no build step): loaded by index.html in a fixed order and sharing one global scope. */
"use strict";

/* ---------- Jobs: one per plant and thing to do, from the alert groups ---------- */
/* Each job: {key (group key), id (key:plant), p, title, why, place, done, tick:{label, act}, more:[{label, act}]}.
   tick.act and more[].act are data-today actions handled below. */
const TODO_DONE = "alvor-done";   // jobs with nothing to record (secure for wind, shade at midday): done today, this phone
let todoDone = (() => { try{ const a = JSON.parse(localStorage.getItem(TODO_DONE) || "null"); if(a && Array.isArray(a.k)) return a; }catch(e){} return {d:"", k:[]}; })();
const localDone = k => todoDone.d === today() && todoDone.k.includes(k);
function setLocalDone(k, on){
  if(todoDone.d !== today()) todoDone = {d:today(), k:[]};
  todoDone.k = todoDone.k.filter(x => x !== k); if(on) todoDone.k.push(k);
  try{ localStorage.setItem(TODO_DONE, JSON.stringify(todoDone)); }catch(e){}
}
/* What doing it is called, on the tick and in one-at-a-time. */
const TICK = {bringIn:tr("Brought inside"), toGh:tr("In the greenhouse"), potProtect:tr("Sheltered"), groundProtect:tr("Fleeced"), crownProtect:tr("Crown protected"),
  mulchRoots:tr("Mulched"), springGrowth:tr("Covered"), ghProtect:tr("Fleeced"), warmerSpot:tr("Moved…"), storeCold:tr("Storage temperature…"), heater:tr("Checked"),
  heat:tr("Watered early"), vent:tr("Opened"), wind:tr("Secured"), settleSun:tr("Shaded"), takeOff:tr("Taken off"), water:tr("Watered"), feed:tr("Fed"),
  repot:tr("Repotted…"), goOut:tr("Moved outside"), waterUnknown:tr("Watered today")};
const LOCAL_KEYS = ["heater", "vent", "wind", "settleSun"];
/* A job says what to do; the alert groups' titles say what's happening ("Needs water", "Strong gusts"). */
const JOB_TITLE = {bringIn:tr("Bring it inside"), toGh:tr("Move it to the greenhouse"), potProtect:tr("Shelter the pot"), groundProtect:tr("Fleece it overnight, mulch the base"),
  crownProtect:tr("Protect the crown"), mulchRoots:tr("Mulch the roots"), springGrowth:tr("Cover the new growth"), ghProtect:tr("Fleece it in the greenhouse"),
  warmerSpot:tr("Find it a warmer spot"), storeCold:tr("Too cold in storage for it"), takeOff:tr("Take the protection off"), water:tr("Water it"), waterUnknown:tr("When did you last water it?"), heat:tr("Water it early and give it shade"), wind:tr("Secure it against the gusts"),
  settleSun:tr("Shade it around midday"), vent:tr("Open the greenhouse"), heater:tr("Check the greenhouse heater"), feed:tr("Ready for feeding"), repot:tr("Time to repot"), goOut:tr("Safe to move outside")};
const placeKey = p => whereKey(p) || "outside";
const WALK0 = ["porch", "outside", "balcony", "greenhouse", "store", "house"];
/* The walk's order: Alvor's places, each followed by your own places of the same kind. */
const walkOrder = () => WALK0.flatMap(a => [a, ...myPlaces().filter(L => placeArea(L) === a).map(L => "pl:" + L.id)]);
const PLACE_WORD = () => ({porch:tr("Porch"), outside:isApt() ? tr("Balcony") : tr("Outside"), balcony:tr("Balcony"), greenhouse:tr("Greenhouse"), store:tr("Winter storage"), house:areaLabel("house"),
  ...Object.fromEntries(myPlaces().map(L => ["pl:" + L.id, L.n]))});
const placeIcon = k => { const L = plKey(k); return ICON[L ? PLACE_KINDS[L.k].icon : k === "outside" ? "outside" : k === "store" ? "store" : k === "porch" ? "porch" : k === "balcony" ? "balcony" : k === "greenhouse" ? "greenhouse" : "house"]; };
const JOB_RANK = k => GA.COLD_KEYS.includes(k) ? 0 : ["heater","heat","vent","wind"].includes(k) ? 1 : ["takeOff","settleSun","goOut"].includes(k) ? 2 : k === "water" ? 3 : 4;
function buildJobs(groups){
  const out = [];
  for(const g of groups){
    if(["frostOk", "rainWill", "plan"].includes(g.key)) continue;
    const L = alertLook(g);
    for(const i of g.items){
      const p = i.p, id = `${g.key}:${p.id}`;
      let done = !!i.done, act = "tick", more = [];
      if(LOCAL_KEYS.includes(g.key)) done = localDone(id);
      if(g.key === "water") more = [{label:FB.wet, act:"wet"}, {label:FB.fine, act:"fine"}];
      if(g.key === "waterUnknown") more = [{label:FB.fine, act:"fine"}];
      if(g.key === "feed") more = [{label:FB.skip, act:"skip"}];
      if(g.key === "repot") more = [{label:FB.notYear, act:"notYear"}];
      if(g.key === "settleSun") more = [{label:FB.settled, act:"settled"}];
      out.push({key:g.key, id, p, title:JOB_TITLE[g.key] || g.title || L.title, why:i.why, place:placeKey(p), done, risk:GA.COLD_KEYS.includes(g.key) && g.key !== "warmerSpot",
        date:i.first || i.date, tick:{label:TICK[g.key] || tr("Done"), act}, more});
    }
  }
  return out.sort((a, b) => JOB_RANK(a.key) - JOB_RANK(b.key) || (a.done - b.done) || a.p.name.localeCompare(b.p.name));
}
/* Doing a job: the same actions as everywhere else in Alvor (they log, journal and sync as usual). */
function doJob(j, act){
  const id = j.p.id;
  if(act === "wet" || act === "fine" || act === "skip" || act === "notYear" || act === "settled") return careFeedback(id, act);
  if(j.done){   // untick: what can be taken back
    if(LOCAL_KEYS.includes(j.key)){ setLocalDone(j.id, false); return render(); }
    if(GA.PROTECT_KEYS.includes(j.key)) return unprotect([id], true);
    return;
  }
  const k = j.key;
  if(k === "bringIn") return moveGroup([id], "inside", "frost");
  if(k === "toGh") return moveGroup([id], "greenhouse", "frost");
  if(GA.PROTECT_KEYS.includes(k)) return protectGroup([id], j.title, "frost", k);
  if(k === "warmerSpot") return openMove(id);
  if(k === "storeCold") return openLocTemp("store");
  if(LOCAL_KEYS.includes(k)){ setLocalDone(j.id, true); render(); return toast(tr("Done")); }
  if(k === "heat" || k === "water" || k === "waterUnknown") return water([id], true, true);
  if(k === "takeOff") return unprotect([id]);
  if(k === "feed") return feedPlants([id]);
  if(k === "repot") return openMs(id, null, {k:"repotted"});
  if(k === "goOut") return moveGroup([id], "outside");
}
/* "Protection off": the fleece or the mulch came off (or a protection ticked by mistake today is taken back). */
function unprotect(ids, undo){
  const d = today();
  ids.forEach(id => {
    const p = plantById(id); if(!p) return;
    const t = undo && jEntries(p).find(e => e.k === "protected" && e.d === d);
    if(t){ jDelete(p, t.id); return; }
    jPut(p, {id:uid(), d, k:"unprotected"});
    addLog(id, "protect", "Protection off");
  });
  save(); render(); refreshJournal();
  toast(undo ? tr("Taken back") : ids.length > 1 ? tr("{n} plants: protection off", {n:ids.length}) : tr("Protection off"));
}

/* ---------- The frost line: every plant at the coldest night it can be left out in, and the night as a line ---------- */
/* The outside temperature at which a plant needs something done (its limit, the margin, its spot's warmth), or
   null when nothing outside reaches it (a heated greenhouse warmer than it needs). */
function frostThreshold(p){
  const s = GA.placeSet(p, state.settings), P = GA.placeOf(p), lim = coldLimit(p);   // your own places: their own temperatures
  if(P.inside || P.store || !GA.coldOn(p)) return null;
  if(P.gh){ const h = GA.RULES && s.ghHeat != null && isFinite(+s.ghHeat) ? +s.ghHeat : null; if(h != null && h >= lim) return null; return lim - (+s.gh || 0); }
  return lim - GA.frostBonus(p, s);
}
/* Two plain groups instead of a chart: the plants that would be too cold that night as they are (each with a tick
   and what was done once it's protected, otherwise the coldest it takes), then the ones that are fine, folded away.
   Plants already brought inside for the night stay in the first group, ticked, so it matches the progress bar. */
const FRL_SHOW = 8;    // more than this in the first group: the rest behind "N more"
function frostLineHtml(day, jobs){
  if(!day) return "";
  const low = day.min, coldJobs = jobs.filter(j => j.risk), jobsOf = id => coldJobs.filter(j => j.p.id === id);
  const all = state.plants.map(p => ({p, x:frostThreshold(p), js:jobsOf(p.id)}));
  const risk = all.filter(o => o.js.length || (o.x != null && o.x > low))
    .map(o => ({...o, done:o.js.length > 0 && o.js.every(j => j.done)}))
    .sort((a, b) => (a.done - b.done) || ((b.x ?? -99) - (a.x ?? -99)) || a.p.name.localeCompare(b.p.name));
  const fine = all.filter(o => !o.js.length && o.x != null && o.x <= low).sort((a, b) => b.x - a.x || a.p.name.localeCompare(b.p.name));
  if(!risk.length && !fine.length) return "";
  const t = degSigned(low);
  const face = p => { const ph = latestPhoto(p.id);
    return ph ? `<img src="${phSrc(ph)}" alt="" loading="lazy" decoding="async">` : `<span class="frl-i a-${p.area}">${esc(p.name.trim().charAt(0).toUpperCase())}</span>`; };
  /* Under each name: what was done once it is protected; otherwise the night it needs (too cold) or takes (fine). */
  const tile = o => {
    const note = o.done ? TICK[o.js[0].key] || tr("Done") : o.x == null ? "" : o.risk ? tr("needs {t}", {t:degSigned(o.x)}) : tr("takes {t}", {t:degSigned(o.x)});
    return `<li><button type="button" class="frl-p ${o.risk ? "risk" : ""} ${o.done ? "done" : ""}" data-act="edit" data-id="${o.p.id}">
      <span class="frl-ph">${face(o.p)}${o.done ? `<i class="frl-ok">${ICON.check}</i>` : ""}</span>
      <span class="frl-n">${esc(o.p.name)}</span>${note ? `<small>${esc(note)}</small>` : ""}</button></li>`;
  };
  const grid = list => `<ul class="frl-grid">${list.map(tile).join("")}</ul>`;
  const riskT = risk.map(o => ({...o, risk:true}));
  return `<div class="frl">
    ${risk.length ? `<section class="frl-g frl-cold">
      <h3>${ICON.snow}<span>${esc(tr("Too cold at {t} as they are", {t}))}</span><b class="frl-c">${risk.length}</b></h3>
      ${grid(riskT.slice(0, FRL_SHOW))}
      ${riskT.length > FRL_SHOW ? `<details class="frl-more"><summary>${esc(tr("{n} more", {n:riskT.length - FRL_SHOW}))}<span class="chev">›</span></summary>${grid(riskT.slice(FRL_SHOW))}</details>` : ""}
    </section>` : ""}
    ${fine.length ? `<details class="frl-g frl-fine"><summary>
        <span class="frl-stack" aria-hidden="true">${fine.slice(0, 4).map(o => `<span class="frl-ph">${face(o.p)}</span>`).join("")}</span>
        <span>${esc(tr("Fine at {t} as they are", {t}))}</span><b class="frl-c">${fine.length}</b><span class="chev">›</span></summary>
      ${grid(fine)}</details>` : ""}
  </div>`;
}
const degSigned = n => `${Math.round(n) < 0 ? "−" + Math.abs(Math.round(n)) : Math.round(n)}°`;

/* ---------- The decision card: what matters, by when, and how far along you are ---------- */
function nightsLine(W){
  if(!W) return "";
  const nights = W.next.slice(0, 3).filter(d => GA.dayRisks(state.plants, d, state.settings, {W, today:today()}).frost.length)
    .map(d => `${cap(dayName(d.date === today() ? d.date : d.date))} ${degSigned(d.fmin != null ? d.fmin : d.min)}`);
  return nights.join(" · ");
}
function calibLine(day){
  if(!day || !day.adj) return "";
  const t = degSigned(day.min), when = longDay(day.date);
  if(day.learned) return day.adj < 0
    ? tr("Your garden runs about {d} colder than the forecast on nights like this, so Alvor plans for {t} {when}.", {d:Math.abs(Math.round(day.adj * 10) / 10) + "°", t, when})
    : tr("Your garden stays about {d} warmer than the forecast on nights like this, so Alvor plans for {t} {when}.", {d:Math.round(day.adj * 10) / 10 + "°", t, when});
  return tr("A clear, calm night: frost at plant height is colder than the forecast's air, so Alvor plans for {t} {when}.", {t, when});
}
function decisionHtml(groups, jobs){
  const G = GA.gardenToday(groups, state.plants, ctx()), W = wx();
  const cold = G.lines.find(l => l.kind === "frost" && l.ids && l.ids.length && l.done != null);
  const lineBtn = l => `<li><button class="gt-line k-${l.kind} ${l.urgent ? "urgent" : ""}" ${gtAttrs(l)}><span class="gt-ic">${ICON[GT_ICON[l.kind]] || ICON.leaf}</span><span>${esc(l.text)}</span><span class="chev">›</span></button></li>`;
  if(!cold){
    return `<div class="acard gtoday ${G.lines.length ? "" : "t-calm"}">
      <div class="a-ic">${ICON.leaf}</div>
      <div class="a-main"><span class="a-lab">${esc(G.greet)}</span><h2 class="gt-h">${esc(G.head)}</h2>
        ${G.lines.length ? `<ul class="gt-lines">${G.lines.map(lineBtn).join("")}</ul><p class="gt-calm">${esc(G.calm)}</p>` : `<p class="gt-calm">${esc(nextThing())}</p>`}
        ${G.stale ? `<p class="gt-stale">${esc(G.stale)}</p>` : ""}</div>
    </div>`;
  }
  /* A cold spell: the night that decides, the frost line for the worst of the next three nights, and progress. */
  const risky = W ? W.next.slice(0, 3).filter(d => GA.dayRisks(state.plants, d, state.settings, {W, today:today()}).frost.length || jobs.some(j => j.risk && j.date === d.date)) : [];
  const worst = risky.reduce((a, d) => !a || d.min < a.min ? d : a, null) || (W && W.next[1]);
  const coldJobs = jobs.filter(j => j.risk), doneN = coldJobs.filter(j => j.done).length, all = coldJobs.length;
  const rest = G.lines.filter(l => l !== cold);
  return `<div class="acard gtoday t-frost cold-card">
    <div class="a-main"><span class="a-lab">${ICON.snow}${esc(nightsLine(W) || tr("Cold nights"))}</span>
      <h2 class="gt-h">${esc(cap(cold.text))}</h2>
      ${calibLine(worst) ? `<p class="a-lead">${esc(calibLine(worst))}</p>` : ""}
      ${frostLineHtml(worst, jobs)}
      ${all ? `<div class="gt-prog" role="img" aria-label="${esc(tr("{d} of {n} done", {d:doneN, n:all}))}"><span class="pbar"><i style="width:${Math.round(doneN / all * 100)}%"></i></span><b>${esc(tr("{d} of {n} done", {d:doneN, n:all}))}</b></div>` : ""}
      ${rest.length ? `<ul class="gt-lines">${rest.map(lineBtn).join("")}</ul>` : ""}
      ${G.stale ? `<p class="gt-stale">${esc(G.stale)}</p>` : ""}
    </div></div>`;
}
/* On a calm day: the next thing worth knowing (a task, a job later this week), or simply that nothing's due. */
function nextThing(){
  const t = GA.taskList(state.settings).filter(x => GA.taskState(x, today()).stage === "soon").sort(byDue)[0];
  if(t) return tr("Next: {t}, {when}.", {t:t.t, when:taskWhen(t).toLowerCase()});
  return tr("Nothing needs doing this week.");
}

/* ---------- Walk the garden: the jobs grouped by where you'll be ---------- */
function jobRow(j){
  const ph = latestPhoto(j.p.id);
  return `<li class="job ${j.done ? "done" : ""} k-${j.key}">
    <button type="button" class="job-tick" data-today="tick" data-job="${esc(j.id)}" aria-pressed="${j.done}" aria-label="${esc((j.done ? tr("Done: {what}", {what:j.title}) : tr("Mark done: {what}", {what:j.title})) + " · " + j.p.name)}">${ICON.check}</button>
    <button type="button" class="job-ph" data-act="edit" data-id="${j.p.id}" tabindex="-1" aria-hidden="true">${ph ? `<img src="${phSrc(ph)}" alt="" loading="lazy" decoding="async">` : `<span class="initial a-${j.p.area}">${esc(j.p.name.trim().charAt(0).toUpperCase())}</span>`}</button>
    <span class="job-t"><button type="button" class="pn" data-act="edit" data-id="${j.p.id}">${esc(j.p.name)}</button><b>${esc(j.title)}</b><small>${esc(j.why)}</small>
      ${j.more.length && !j.done ? `<span class="fb">${j.more.map(m => `<button type="button" class="fb-b" data-today="${m.act}" data-job="${esc(j.id)}">${esc(m.label)}</button>`).join("")}</span>` : ""}</span>
  </li>`;
}
let JOBS = [];
function walkHtml(jobs){
  const tasks = GA.tasksDue(state.settings, today());
  if(!jobs.length && !tasks.length) return GA.taskList(state.settings).length ? "" : `<button class="tk-start" data-task="new">${ICON.plus}<span>${tr("Add your own task: buy compost, plant bulbs…")}</span></button>`;
  const by = {}; jobs.forEach(j => (by[j.place] ||= []).push(j));
  const W = PLACE_WORD(), places = walkOrder().filter(k => by[k]);
  const open = jobs.filter(j => !j.done).length;
  return `<div class="acard walk-card">
    <div class="walk-h"><h2>${tr("Walk the garden")}</h2>${open > 1 ? `<button type="button" class="btn small" data-today="round">${tr("One at a time")}</button>` : ""}</div>
    ${places.map(k => `<section class="walk-pl"><h3>${placeIcon(k)}${esc(W[k])}</h3>
      <ul class="jobs">${by[k].map(jobRow).join("")}</ul></section>`).join("")}
    ${tasks.length || myTasks().length ? `<section class="walk-pl walk-tasks"><h3>${TASK_ICON}${tr("Your tasks")}</h3>
      ${tasks.length ? `<div class="tk-list">${tasks.map(x => taskRow(x)).join("")}</div>` : `<p class="status">${esc(nextThing())}</p>`}
      <div class="tk-acts"><button class="btn small" data-task="new">${ICON.plus}${tr("Add a task")}</button><button class="btn small" data-task="all">${tr("All tasks")}${myTasks().filter(x => GA.taskState(x, today()).stage !== "done").length ? ` · ${myTasks().filter(x => GA.taskState(x, today()).stage !== "done").length}` : ""}</button></div></section>` : ""}
  </div>`;
}

/* ---------- The morning after a cold night ---------- */
const AFTER_SKIP = "alvor-after-skip";
let AF = null;   // {date, answers:{plantId:"fine"|"damaged"|"lost"}, m:"" (thermometer), fz:null|true|false}
function afterHtml(){
  if(!state.plants.length || !state.weather) return "";
  let skip = ""; try{ skip = localStorage.getItem(AFTER_SKIP) || ""; }catch(e){}
  if(skip === today()) return "";
  const ma = GA.morningAfter(state.plants, ctx());
  if(!ma) return "";
  if(!AF || AF.date !== ma.date) AF = {date:ma.date, answers:{}, m:"", fz:null, ma};
  AF.ma = ma;
  const asked = !(state.settings.calib || []).some(x => x.d === today());
  const O = [["fine", tr("Fine")], ["damaged", tr("Damaged")], ["lost", tr("Lost")]];
  return `<div class="acard after-card t-frost">
    <div class="a-main"><span class="a-lab">${tr("The morning after")}</span>
      <h2 class="gt-h">${tr("Last night reached about {t}. How did they do?", {t:degSigned(ma.low)})}</h2>
      ${asked ? `<div class="af-temps">
        <div><small>${tr("Forecast")}</small><b>${degSigned(ma.fmin)}</b></div>
        <div><small>${tr("Alvor planned for")}</small><b>${degSigned(ma.low)}</b></div>
        <div class="af-m"><label for="afM"><small>${tr("Your thermometer")}</small></label><input id="afM" inputmode="decimal" placeholder="${tr("optional")}" value="${esc(AF.m)}" aria-describedby="afMHint"></div>
      </div>
      <p class="status" id="afMHint">${tr("The lowest a min/max thermometer showed. No thermometer? Say whether it froze.")}</p>
      <div class="seg small af-fz" role="group" aria-label="${tr("Did it freeze here last night?")}"><span class="af-q">${tr("Did it freeze here?")}</span>
        <button type="button" data-today="fz" data-v="1" aria-pressed="${AF.fz === true}">${tr("Yes")}</button><button type="button" data-today="fz" data-v="0" aria-pressed="${AF.fz === false}">${tr("No")}</button></div>` : ""}
      <ul class="af-list">${ma.items.map(i => `<li><span class="job-ph">${latestPhoto(i.p.id) ? `<img src="${phSrc(latestPhoto(i.p.id))}" alt="" loading="lazy">` : `<span class="initial a-${i.p.area}">${esc(i.p.name.charAt(0).toUpperCase())}</span>`}</span>
        <span class="job-t"><b>${esc(i.p.name)}</b><small>${esc([tr("about {t} at its spot", {t:degSigned(i.t)}), i.prot ? tr("protected") : ""].filter(Boolean).join(" · "))}</small></span>
        <span class="seg small af-o" role="group" aria-label="${esc(tr("How did {name} do?", {name:i.p.name}))}">${O.map(([k, l]) => `<button type="button" data-today="o" data-id="${i.p.id}" data-v="${k}" aria-pressed="${AF.answers[i.p.id] === k}">${l}</button>`).join("")}</span></li>`).join("")}</ul>
      <div class="a-act"><button type="button" class="btn primary" data-today="afterSave">${tr("Save")}</button><button type="button" class="btn" data-today="afterSkip">${tr("Not now")}</button></div>
    </div></div>`;
}
function saveAfter(){
  if(!AF || !AF.ma) return;
  const ma = AF.ma, d = today(), m = parseFloat(String(AF.m).replace(",", ".").replace("−", "-"));
  let n = 0;
  const lost = [];
  ma.items.forEach(i => {
    const o = AF.answers[i.p.id]; if(!o) return;
    const p = plantById(i.p.id); if(!p) return;
    jPut(p, {id:uid(), d, k:"outcome", o, t:i.t, ...(i.prot ? {prot:1} : {}), n:o === "fine" ? tr("Came through {t}", {t:degSigned(i.t)}) : o === "damaged" ? tr("Damaged at {t}", {t:degSigned(i.t)}) : tr("Lost at {t}", {t:degSigned(i.t)})});
    addLog(p.id, "care", o === "fine" ? "Came through the cold" : o === "damaged" ? "Damaged by the cold" : "Lost to the cold");
    n++; if(o === "lost") lost.push(p.id);
  });
  const hasM = isFinite(m), hasF = AF.fz === true || AF.fz === false;
  if(hasM || hasF){
    const e = {d, f:ma.fmin, ...(hasM ? {m:Math.round(m * 10) / 10} : {fz:AF.fz}), ...(ma.clear === true || ma.clear === false ? {c:ma.clear} : {})};
    state.settings.calib = [...(state.settings.calib || []).filter(x => x.d !== d), e].slice(-GA.RULES.calib.max);
  }
  if(!n && !hasM && !hasF){ toast(tr("Tap Fine, Damaged or Lost for a plant first")); return; }
  save(); refreshJournal();
  const K = GA.calibration(state.settings, d);
  const learnt = K.all.n >= GA.RULES.calib.min && K.all.off ? (K.all.off < 0 ? tr("Alvor now plans your garden about {t} colder than the forecast on nights like that.", {t:Math.abs(K.all.off) + "°"})
    : tr("Alvor now plans your garden about {t} warmer than the forecast on nights like that.", {t:K.all.off + "°"})) : "";
  AF = null; render();
  toast([tr("Saved in their journals."), learnt].filter(Boolean).join(" "), learnt ? 6500 : 2600);
  if(lost.length) setTimeout(() => { openArchive(lost[0]); AD.why = "died"; AD.cause = "frost"; renderArchive(); }, 300);
}

/* ---------- A question Alvor needs answered now ---------- */
function askHtml(){
  const s = state.settings, W = wx(), out = [];
  const usesGh = !isApt() && state.plants.some(p => inArea(p, "greenhouse") || p.pattern === "greenhouse");
  const coldSoon = W && W.next.slice(0, 3).some(d => d.min <= 3);
  if(usesGh && coldSoon && !s.ghAsked && s.ghHeat == null && (s.gh == null || +s.gh === 3))
    out.push(`<div class="acard ask-card"><div class="a-ic">${ICON.greenhouse}</div><div class="a-main"><span class="a-lab">${tr("One question")}</span>
      <h3>${tr("Is your greenhouse heated?")}</h3><p class="a-lead">${tr("A cold night is coming. Alvor needs to know which plants are safe in the greenhouse.")}</p>
      <div class="a-act"><button type="button" class="btn" data-today="ghNo">${tr("Unheated")}</button><button type="button" class="btn primary" data-today="ghYes">${tr("Heated…")}</button></div></div></div>`);
  if(state.plants.some(p => inArea(p, "store")) && !isFinite(parseFloat(s.storeLow)) && !s.storeAsked)
    out.push(`<div class="acard ask-card"><div class="a-ic">${ICON.store}</div><div class="a-main"><span class="a-lab">${tr("One question")}</span>
      <h3>${tr("How cold does your winter storage get?")}</h3><p class="a-lead">${tr("Alvor assumes about {t} on the coldest nights. A min/max thermometer tells you for sure.", {t:GA.RULES.store.low + "°"})}</p>
      <div class="a-act"><button type="button" class="btn primary" data-today="storeSet">${tr("Set it")}</button><button type="button" class="btn" data-today="storeOk">${tr("That's about right")}</button></div></div></div>`);
  return out.join("");
}

/* ---------- Today, put together ---------- */
function renderToday(groups){
  const el = $("#alerts");
  $("#nowAfter").innerHTML = afterHtml();
  $("#nowAsk").innerHTML = state.plants.length ? askHtml() : "";
  if(!state.plants.length){
    JOBS = [];
    el.innerHTML = `<div class="acard t-info first-run"><div class="a-ic">${ICON.sprout}</div><div class="a-main"><h2 class="a-h">${tr("Start with your plants")}</h2><p class="a-lead">${tr("Add each plant once. Alerts and watering reminders then appear here every day.")}</p></div>
      <div class="a-act"><button class="btn primary" data-hub="add">${tr("Add plant")}</button>${online && token ? `<button class="btn" data-hub="identify">${tr("Identify a plant")}</button>` : ""}</div></div>`;
    return;
  }
  JOBS = buildJobs(groups);
  el.innerHTML = decisionHtml(groups, JOBS) + campaignHtml() + walkHtml(JOBS);
}
const jobOf = id => JOBS.find(j => j.id === id);
document.addEventListener("click", e => {
  const b = e.target.closest("[data-today]"); if(!b) return;
  const a = b.dataset.today;
  if(a === "tick" || ["wet","fine","skip","notYear","settled"].includes(a)){ const j = jobOf(b.dataset.job); if(j) doJob(j, a === "tick" ? null : a); if(RD && roundDlg.open) setTimeout(renderRound, 0); return; }
  if(a === "round") return openRound();
  if(a === "o"){ AF.answers[b.dataset.id] = AF.answers[b.dataset.id] === b.dataset.v ? undefined : b.dataset.v;
    b.closest(".af-o").querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", AF.answers[b.dataset.id] === x.dataset.v)); return; }
  if(a === "fz"){ const v = b.dataset.v === "1"; AF.fz = AF.fz === v ? null : v; b.parentNode.querySelectorAll("[data-today=fz]").forEach(x => x.setAttribute("aria-pressed", AF.fz === (x.dataset.v === "1"))); return; }
  if(a === "afterSave") return saveAfter();
  if(a === "afterSkip"){ try{ localStorage.setItem(AFTER_SKIP, today()); }catch(e){} AF = null; render(); return; }
  if(a === "ghNo"){ state.settings.ghAsked = true; state.settings.ghHeat = null; save(); render(); return toast(tr("Saved: unheated. Change it any time on the greenhouse card in Garden.")); }
  if(a === "ghYes"){ state.settings.ghAsked = true; save(); render(); return openLocTemp("greenhouse"); }
  if(a === "storeSet"){ state.settings.storeAsked = true; save(); render(); return openLocTemp("store"); }
  if(a === "storeOk"){ state.settings.storeAsked = true; save(); render(); return toast(tr("Saved")); }
});
document.addEventListener("input", e => { if(e.target.id === "afM" && AF) AF.m = e.target.value; });

/* ---------- One at a time: today's jobs as cards, for a round of the garden ---------- */
const roundDlg = $("#roundDlg");
let RD = null;   // {ids:[job ids in order], i, skipped:Set}
function openRound(){
  const open = JOBS.filter(j => !j.done);
  if(!open.length) return toast(tr("Nothing left to do"));
  RD = {ids:open.map(j => j.id), i:0};
  renderRound(); if(!roundDlg.open) roundDlg.showModal();
}
function renderRound(){
  if(!RD) return;
  const list = RD.ids.map(jobOf).filter(Boolean);
  const total = RD.ids.length, doneN = RD.ids.filter(id => { const j = jobOf(id); return !j || j.done; }).length;
  let j = null;
  for(let k = 0; k < total; k++){ const c = jobOf(RD.ids[(RD.i + k) % total]); if(c && !c.done){ j = c; RD.i = (RD.i + k) % total; break; } }
  $("#roundTitle").textContent = tr("{d} of {n} done", {d:doneN, n:total});
  if(!j){
    $("#roundBody").innerHTML = `<div class="rd-end">${ICON.check}<h3>${tr("All done")}</h3><p>${tr("That's everything for now. Alvor keeps an eye on the nights.")}</p><button type="button" class="btn primary" data-rd="close">${tr("Close")}</button></div>`;
    return;
  }
  const ph = latestPhoto(j.p.id), W = PLACE_WORD();
  $("#roundBody").innerHTML = `<div class="rd-card">
    <div class="rd-ph">${ph ? `<img src="${phSrc(ph)}" alt="">` : `<span class="initial a-${j.p.area}">${esc(j.p.name.charAt(0).toUpperCase())}</span>`}</div>
    <span class="a-lab">${esc(W[j.place] || "")}</span><h3>${esc(j.p.name)}</h3><p class="rd-what">${esc(j.title)}</p><p class="status">${esc(j.why)}</p>
    <div class="rd-acts"><button type="button" class="btn primary" data-today="tick" data-job="${esc(j.id)}">${ICON.check}${esc(j.tick.label)}</button>
      ${j.more.map(m => `<button type="button" class="btn" data-today="${m.act}" data-job="${esc(j.id)}">${esc(m.label)}</button>`).join("")}
      <button type="button" class="btn" data-rd="next">${tr("Skip for now")}</button></div>
    <div class="rd-bar"><span class="pbar"><i style="width:${Math.round(doneN / total * 100)}%"></i></span></div>
  </div>`;
}
$("#roundBody").addEventListener("click", e => {
  const b = e.target.closest("[data-rd]"); if(!b) return;
  if(b.dataset.rd === "close") return roundDlg.close();
  RD.i = (RD.i + 1) % RD.ids.length; renderRound();
});
$("#roundClose").addEventListener("click", () => roundDlg.close());
roundDlg.addEventListener("close", () => { RD = null; });
