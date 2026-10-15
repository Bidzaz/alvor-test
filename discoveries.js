/* Alvor · Discoveries: small marks of what you notice and record in your garden (a first flower, a cutting, a plant's
   first year with you). They celebrate the garden's own story, never app use: no streaks, no points, no ranking.

   Pure: no screen, no storage, no network. Shared by the app (js/discover.js, for the gallery and the gentle "how
   it's going" lines) and the "discoveries" server function (copied in by tests/notify-sync.js), which is the only
   place an unlock is recorded: it reads what's saved in the account, runs evaluate() and writes the result itself.
   The app never sends an unlock, so changing the app or the phone's storage can't create one.

   Every rule reads explicit records only: journal entries you wrote, photos you added, answers you gave to Alvor's
   suggestions, the plant's family from plant-kb.js. Nothing is guessed from a photo or the weather: a photo never
   means it flowered, a warm week never means it survived. A plant Alvor doesn't know never counts as a fern.

   A garden (G), as the app and the server both build it:
     plants   every plant, in the garden and in the Archive: {id, name, species, genus, created, journal, archived, from}
     photos   [{id, plantId, d}]   d: the day it was taken (the garden's own day)
     log      the history: [{t, plantId, type, detail, k?, fb?, wx?}]
     settings {lat, tz}            south of the equator the seasons turn round
     facts    what only the server knows, or null in the app: {identified:{n, d}, cuttings:{n, d}}
   Texts are in the app (js/discover.js), so this file has none. */
(function(root, factory){
  const lib = factory();
  if(typeof module === "object" && module.exports) module.exports = lib;
  else root.AlvorDiscoveries = lib;
})(typeof self !== "undefined" ? self : this, function(){
"use strict";
const KB = typeof AlvorKB !== "undefined" ? AlvorKB : require("./plant-kb.js");
const VERSION = "2026-10-15.disc-1";

/* fam: collect (discovering plants), journal (the garden's story), care (care through the seasons),
   learn (growing and learning). hidden: not shown before it's found (a surprise, and never a reason to buy a plant).
   server: needs a fact only the server has, so the app can't tell on its own. kept: never withdrawn (see reconcile). */
const CATALOGUE = [
  {id:"first-roots",          fam:"collect"},
  {id:"curious-eye",          fam:"collect", server:true, kept:true},
  {id:"fern-friend",          fam:"collect", hidden:true},
  {id:"world-of-leaves",      fam:"collect", hidden:true},
  {id:"moment-in-green",      fam:"journal"},
  {id:"first-bloom",          fam:"journal"},
  {id:"season-by-season",     fam:"journal"},
  {id:"garden-historian",     fam:"journal"},
  {id:"year-together",        fam:"journal"},
  {id:"thoughtful-watering",  fam:"care"},
  {id:"weather-wise",         fam:"care"},
  {id:"winter-guardian",      fam:"care"},
  {id:"new-beginnings",       fam:"learn"},
  {id:"lesson-learned",       fam:"learn"},
  {id:"passed-along",         fam:"learn", hidden:true, kept:true}
];
const IDS = CATALOGUE.map(c => c.id);
const BY_ID = Object.fromEntries(CATALOGUE.map(c => [c.id, c]));
const RULES = {
  families:5,          // A World of Leaves: plants from this many botanical families
  historianDays:6,     // Garden Historian: one plant's records on this many different days…
  historianSpan:182,   // …spread over at least this many days (about six months)
  noteMin:3            // A Lesson Learned: a note of at least this many characters
};
/* A discovery whose record is deleted within this time is taken back: it was a slip, not a moment.
   After that it stays, like a stamp in a field notebook (see reconcile). */
const WITHDRAW_MS = 24 * 3600 * 1000;

/* Entries that are your own observations: not Alvor's moves, not the feeding button, not a ticked task,
   not the Archive's own lines. */
const OBS_KINDS = new Set(["acquired","planted","growth","flower","fruit","pruned","repotted","propagated","protected","unprotected","moved","issue","note"]);
const DAY = /^\d{4}-\d\d-\d\d$/;
const ymdUTC = t => new Date(t).toISOString().slice(0, 10);
const dayNum = d => Math.round(Date.parse(d + "T12:00:00Z") / 86400000);
const addDays = (d, n) => ymdUTC(Date.parse(d + "T12:00:00Z") + n * 86400000);
/* The same day a year later (29 February becomes 28 February). */
function nextYear(d){
  const y = +d.slice(0, 4) + 1, m = d.slice(5, 7), dd = d.slice(8, 10);
  return m === "02" && dd === "29" ? `${y}-02-28` : `${y}-${m}-${dd}`;
}
/* Seasons as the northern hemisphere has them; south of the equator they turn round (as in alerts.js). */
function seasonOf(d, settings){
  let m = +d.slice(5, 7);
  if(settings && +settings.lat < 0) m = ((m + 5) % 12) + 1;
  return m === 12 || m <= 2 ? "winter" : m <= 5 ? "spring" : m <= 8 ? "summer" : "autumn";
}
const SEASONS = ["spring", "summer", "autumn", "winter"];
const entries = p => (Array.isArray(p && p.journal) ? p.journal : []).filter(e => e && !e.del && e.id != null && DAY.test(String(e.d || "")));
const isObs = e => OBS_KINDS.has(e.k) && !e.auto && !e.task;
const byDay = (a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0;
const familyOf = p => { const r = KB.find(p.species || "", p.genus || ""); return r && r.family ? r.family : ""; };
/* The day a plant became yours: "Got it" if you said, else the day it was added to Alvor. */
function sinceOf(p, G){
  const got = entries(p).filter(e => e.k === "acquired").map(e => e.d).sort()[0];
  if(got) return {d:got, got:true};
  const c = p.created && Date.parse(p.created);
  return c ? {d:G ? G.dayOf(c) : ymdUTC(c), got:false} : null;
}
const pname = p => String(p && p.name || "").slice(0, 80);

/* Everything your own on one plant: its photos and your journal entries, as days. */
function records(G, p, today){
  const out = [];
  for(const ph of G.photosBy.get(p.id) || []) if(ph.d <= today) out.push({d:ph.d, kind:"photo", id:ph.id});
  for(const e of entries(p)) if(isObs(e) && e.d <= today) out.push({d:e.d, kind:"entry", id:e.id, k:e.k});
  return out.sort(byDay);
}

/* The first entry (by day) of a kind, across every plant, as evidence. */
function firstEntry(G, test, today){
  let best = null;
  for(const p of G.plants) for(const e of entries(p)){
    if(e.d > today || !test(e, p)) continue;
    const c = {p:p.id, pn:pname(p), e:String(e.id), d:e.d, k:e.k};
    if(!best || byDay({d:c.d, id:c.p + c.e}, {d:best.d, id:best.p + best.e}) < 0) best = c;
  }
  return best;
}

/* Which discoveries this garden holds. today: "YYYY-MM-DD" in the garden's own time.
   Returns {id: {ok, known, d (the day it was earned by), ev (what earned it), pr (how it's going, if not yet)}}.
   known false: the app can't tell (a server fact), so it shows nothing rather than guess. */
function evaluate(input, today){
  const G = prepare(input);
  const out = {};
  const no = (pr) => ({ok:false, known:true, ...(pr ? {pr} : {})});
  const yes = (ev) => ({ok:true, known:true, d:ev.d, ev});
  const plants = G.plants;

  /* First Roots: your first plant. */
  {
    const added = p => { const c = p.created && Date.parse(p.created); return c ? G.dayOf(c) : (sinceOf(p, G) || {}).d || today; };
    const list = plants.map(p => ({p, d:added(p)})).sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : a.p.id < b.p.id ? -1 : 1);
    out["first-roots"] = list.length ? yes({p:list[0].p.id, pn:pname(list[0].p), d:list[0].d > today ? today : list[0].d}) : no();
  }

  /* Curious Eye: you asked Alvor what a plant is, from a photo (counted by the identify function). */
  out["curious-eye"] = !G.facts ? {ok:false, known:false}
    : G.facts.identified && G.facts.identified.n > 0 ? yes({d:G.facts.identified.d || today, n:G.facts.identified.n}) : no();

  /* Fern Friend: a fern, by its family in plant-kb.js. */
  {
    const ferns = plants.filter(p => KB.isFern(familyOf(p))).map(p => ({p, s:sinceOf(p, G)})).filter(x => x.s)
      .sort((a, b) => a.s.d < b.s.d ? -1 : a.s.d > b.s.d ? 1 : a.p.id < b.p.id ? -1 : 1);
    out["fern-friend"] = ferns.length ? yes({p:ferns[0].p.id, pn:pname(ferns[0].p), d:ferns[0].s.d > today ? today : ferns[0].s.d, f:[familyOf(ferns[0].p)]}) : no();
  }

  /* A World of Leaves: plants from five botanical families (unknown plants don't count). */
  {
    const first = new Map();
    plants.map(p => ({p, f:familyOf(p), s:sinceOf(p, G)})).filter(x => x.f && x.s)
      .sort((a, b) => a.s.d < b.s.d ? -1 : a.s.d > b.s.d ? 1 : a.p.id < b.p.id ? -1 : 1)
      .forEach(x => { if(!first.has(x.f)) first.set(x.f, x); });
    const fams = [...first.values()];
    out["world-of-leaves"] = fams.length >= RULES.families
      ? yes({d:fams[RULES.families - 1].s.d > today ? today : fams[RULES.families - 1].s.d, f:fams.slice(0, 12).map(x => x.f)})
      : no({n:fams.length, f:fams.map(x => x.f)});
  }

  /* A Moment in Green: your first photo or journal entry. */
  {
    let best = null;
    for(const p of plants){ const r = records(G, p, today)[0]; if(r && (!best || r.d < best.d)) best = {p:p.id, pn:pname(p), d:r.d, kind:r.kind, k:r.k}; }
    out["moment-in-green"] = best ? yes(best) : no();
  }

  /* First Bloom: you wrote "Flowering" in a journal. A photo of a flower isn't enough: Alvor can't see it. */
  { const e = firstEntry(G, e => e.k === "flower", today); out["first-bloom"] = e ? yes(e) : no(); }

  /* Season by Season and Garden Historian: one plant's own records over time. */
  {
    let season = null, seasonBest = null, hist = null, histBest = null;
    for(const p of plants){
      const R = records(G, p, today);
      if(!R.length) continue;
      const firstIn = {};
      R.forEach(r => { const s = seasonOf(r.d, G.settings); if(!firstIn[s]) firstIn[s] = r.d; });
      const have = SEASONS.filter(s => firstIn[s]);
      if(have.length === 4){
        const d = Object.values(firstIn).sort().pop();   // earned when the fourth season came
        if(!season || d < season.d) season = {p:p.id, pn:pname(p), d, ds:SEASONS.map(s => firstIn[s])};
      }else if(!seasonBest || have.length > seasonBest.s.length) seasonBest = {p:p.id, pn:pname(p), s:have};
      const days = [...new Set(R.map(r => r.d))].sort();
      // Earned on the first day by which there were six days of records spread over six months.
      let at = null;
      for(let i = RULES.historianDays - 1; i < days.length; i++){
        if(dayNum(days[i]) - dayNum(days[0]) >= RULES.historianSpan){ at = days[i]; break; }
      }
      if(at){ if(!hist || at < hist.d) hist = {p:p.id, pn:pname(p), d:at, n:days.filter(x => x <= at).length, from:days[0]}; }
      else if(!histBest || days.length > histBest.n) histBest = {p:p.id, pn:pname(p), n:days.length, span:dayNum(days[days.length - 1]) - dayNum(days[0])};
    }
    out["season-by-season"] = season ? yes(season) : no(seasonBest || undefined);
    out["garden-historian"] = hist ? yes(hist) : no(histBest || undefined);
  }

  /* A Year Together: a plant's first year with you (from "Got it", else the day it was added). A plant in the
     Archive counts if it had its year before it left. */
  {
    let best = null, next = null;
    for(const p of plants){
      const s = sinceOf(p, G); if(!s) continue;
      const a = nextYear(s.d), end = p.archived && DAY.test(String(p.archived.d || "")) ? p.archived.d : today;
      if(a <= end && a <= today){ if(!best || a < best.d) best = {p:p.id, pn:pname(p), d:a, since:s.d, got:s.got}; }
      else if(!p.archived && (!next || a < next.d)) next = {p:p.id, pn:pname(p), d:a};
    }
    out["year-together"] = best ? yes(best) : no(next || undefined);
  }

  /* Thoughtful Watering: you answered one of Alvor's watering suggestions with what you found
     (Watered, Already wet or Looks fine). Every honest answer counts the same, so it never pushes either way. */
  {
    const hit = (G.log || []).filter(l => l && l.t && ((l.type === "care" && (l.k === "wet" || l.k === "fine")) || (l.type === "water" && l.fb)))
      .map(l => ({p:l.plantId, d:G.dayOf(l.t), k:l.type === "water" ? "water" : l.k})).filter(x => x.d && x.d <= today).sort(byDay)[0];
    if(hit){ const p = G.byId.get(hit.p); hit.pn = pname(p); }
    out["thoughtful-watering"] = hit ? yes(hit) : no();
  }

  /* Weather Wise: you acted on a frost, heat or wind warning with its button (Mark as moved, Mark as protected). */
  {
    const WX = ["frost", "heat", "wind"];
    let e = firstEntry(G, e => WX.includes(e.wx), today);
    if(e){ const x = entries(G.byId.get(e.p)).find(y => String(y.id) === e.e); e.wx = x && x.wx; }
    if(!e){
      const l = (G.log || []).filter(l => l && l.t && l.type === "move" && WX.includes(l.wx)).map(l => ({p:l.plantId, d:G.dayOf(l.t), wx:l.wx})).filter(x => x.d && x.d <= today).sort(byDay)[0];
      if(l){ l.pn = pname(G.byId.get(l.p)); e = l; }
    }
    out["weather-wise"] = e ? yes(e) : no();
  }

  /* Winter Guardian: you protected a plant from the cold and noted it ("Protected from cold"). */
  { const e = firstEntry(G, e => e.k === "protected", today); out["winter-guardian"] = e ? yes(e) : no(); }

  /* New Beginnings: you noted a cutting, division or seeds ("Propagated"). */
  { const e = firstEntry(G, e => e.k === "propagated", today); out["new-beginnings"] = e ? yes(e) : no(); }

  /* A Lesson Learned: a note in a plant's journal in your own words, or a problem you noticed. */
  {
    const e = firstEntry(G, e => !e.task && !e.auto && ((e.k === "note" && String(e.n || "").trim().length >= RULES.noteMin) || e.k === "issue"), today);
    out["lesson-learned"] = e ? yes(e) : no();
  }

  /* Passed Along: a cutting given or received through Alvor (the server's record of the swap, a cutting you added
     from a friend, or "Propagated · A cutting for…" written by Alvor when you gave one). */
  {
    const fromFriend = plants.filter(p => p.from && typeof p.from === "object").map(p => ({p:p.id, pn:pname(p), d:(sinceOf(p, G) || {}).d || today, k:"received"}));
    const given = firstEntry(G, e => e.k === "propagated" && !!e.cut, today);
    const list = [...fromFriend, ...(given ? [{...given, k:"given"}] : [])].sort(byDay);
    if(list.length) out["passed-along"] = yes({...list[0], d:list[0].d > today ? today : list[0].d});
    else if(G.facts) out["passed-along"] = G.facts.cuttings && G.facts.cuttings.n > 0 ? yes({d:G.facts.cuttings.d || today, n:G.facts.cuttings.n}) : no();
    else out["passed-along"] = {ok:false, known:false};
  }
  return out;
}

/* Indexes, and the day of a moment in the garden's own time zone. */
function prepare(g){
  const plants = (g.plants || []).filter(p => p && p.id != null);
  const photosBy = new Map();
  for(const ph of g.photos || []){
    if(!ph || !DAY.test(String(ph.d || ""))) continue;
    (photosBy.get(ph.plantId) || photosBy.set(ph.plantId, []).get(ph.plantId)).push(ph);
  }
  const tz = g.settings && g.settings.tz;
  const dayOf = t => dayIn(t, tz);
  return {plants, photosBy, log:g.log || [], settings:g.settings || {}, facts:g.facts || null, byId:new Map(plants.map(p => [p.id, p])), dayOf};
}
/* "YYYY-MM-DD" of a moment (ISO text or ms) in a time zone (the garden's), else UTC. */
function dayIn(t, tz){
  const ms = typeof t === "number" ? t : Date.parse(t);
  if(!isFinite(ms)) return null;
  if(tz){ try{ return new Date(ms).toLocaleDateString("en-CA", {timeZone:tz}); }catch(e){} }
  return ymdUTC(ms);
}

/* The server's side: the garden as the database holds it.
   rows: {plants:[{id, name, species, created_at}], priv:[{plant_id, data}], photos:[{id, plant_id, taken_at, created_at}],
          garden:{settings, log}, identify:[{day, count}], cuttings:[{status, given_at}]} */
function gardenFromRows(rows){
  const settings = (rows.garden && rows.garden.settings) || {};
  const shared = new Map((rows.plants || []).map(r => [r.id, r]));
  const plants = (rows.priv || []).filter(r => shared.has(r.plant_id)).map(r => {
    const s = shared.get(r.plant_id), d = r.data && typeof r.data === "object" ? r.data : {};
    return {...d, id:r.plant_id, name:d.name || s.name, species:d.species != null ? d.species : s.species, created:d.created || s.created_at};
  });
  const photos = (rows.photos || []).map(r => ({id:r.id, plantId:r.plant_id, d:dayIn(r.taken_at || r.created_at, settings.tz)})).filter(x => x.d);
  const idRows = (rows.identify || []).filter(r => +r.count > 0);
  const given = (rows.cuttings || []).filter(r => r.status === "given");
  const facts = {
    identified:{n:idRows.reduce((a, r) => a + (+r.count || 0), 0), d:idRows.map(r => String(r.day).slice(0, 10)).sort()[0] || null},
    cuttings:{n:given.length, d:given.map(r => r.given_at ? dayIn(r.given_at, settings.tz) : null).filter(Boolean).sort()[0] || null}
  };
  return {plants, photos, log:Array.isArray(rows.garden && rows.garden.log) ? rows.garden.log : [], settings, facts};
}

/* What to write: new discoveries to add, and slips to take back.
   existing: [{discovery, unlocked_at}] already recorded. results: evaluate(). now: ms.
   - Added once: the database's key (account, discovery) makes a second add do nothing, from any phone or retry.
   - Taken back only when, within a day of being earned, nothing qualifies any more (the entry was a slip and was
     deleted, or its plant was). After that a discovery stays even if its record goes: deleting an old journal
     entry shouldn't take a memory away. Server-attested ones (identification, a swap) are never taken back. */
function reconcile(existing, results, now){
  const have = new Map((existing || []).map(r => [r.discovery, r]));
  const add = [], withdraw = [];
  for(const c of CATALOGUE){
    const r = results[c.id], ex = have.get(c.id);
    if(!r || !r.known) continue;
    if(r.ok && !ex) add.push({discovery:c.id, qualified_on:r.d || null, evidence:r.ev || {}});
    else if(!r.ok && ex && !c.kept && now - Date.parse(ex.unlocked_at) < WITHDRAW_MS) withdraw.push(c.id);
  }
  return {add, withdraw};
}

return {VERSION, CATALOGUE, IDS, BY_ID, RULES, WITHDRAW_MS, SEASONS, seasonOf, evaluate, gardenFromRows, reconcile, dayIn};
});
