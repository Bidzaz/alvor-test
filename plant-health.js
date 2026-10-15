/* Alvor · plant health: "Something wrong?". You pick what you see (yellow leaves, brown edges, holes…) and Alvor
   gives the likely causes, weighed by what it knows about this plant: its recent nights at its spot, the heat, how
   it's been watered and what you told Alvor about it, its light, feeding, repotting and any recent move.
   No photo diagnosis (that would need a paid service): Alvor says "likely" or "possible", never "it is".

   Pure: no screen and no storage. Used by the app (js/health.js) and the tests (tests/health.test.js).
   Texts are English here and translated by the app (js/lang-es.js): every one is listed by texts().
   Each cause: symptoms it explains (weight 1 to 3) and what in the plant's situation makes it likelier (or less).
   A cause needs at least one of the chosen symptoms; the situation only moves causes up or down. */
(function(root, factory){
  const lib = factory();
  if(typeof module === "object" && module.exports) module.exports = lib;
  else root.AlvorHealth = lib;
})(typeof self !== "undefined" ? self : this, function(){
"use strict";
const GA = typeof GardenAlerts !== "undefined" ? GardenAlerts : require("./alerts.js");
const KB = typeof AlvorKB !== "undefined" ? AlvorKB : require("./plant-kb.js");

/* What you can pick, in this order. */
const SYMPTOMS = [
  ["yellow", "Yellow leaves"], ["brownEdges", "Brown, crispy tips or edges"], ["blackSoft", "Black or brown soft patches"],
  ["spots", "Spots on the leaves"], ["wilting", "Wilting or drooping"], ["dropping", "Leaves falling off"],
  ["curling", "Curling leaves"], ["bleached", "Pale or bleached patches facing the sun"], ["pale", "Pale, leggy or stretching"],
  ["slow", "Slow or no new growth"], ["holes", "Holes in the leaves"], ["sticky", "Sticky leaves or tiny insects"],
  ["webbing", "Fine webbing, speckled leaves"], ["powder", "White powder or grey fuzzy mould"], ["mushy", "Soft, mushy stem or base"],
  ["rootsOut", "Roots coming out of the pot"]
];

/* The causes. s: symptom weights. Advice is what to do, in one or two sentences. */
const CAUSES = {
  overwater:{title:"Too much water", s:{yellow:2, wilting:2, dropping:1, mushy:1, blackSoft:1, spots:1, slow:1},
    advice:"Let the top few centimetres dry out before watering again, and empty any saucer. If the pot doesn't drain, repot into a pot with holes."},
  dry:{title:"Too dry", s:{wilting:3, brownEdges:2, dropping:1, curling:2, yellow:1, slow:1},
    advice:"Water it thoroughly, until water runs out of the bottom, then again when the top few centimetres are dry. A pot that dried out completely can stand in a bucket of water for half an hour."},
  cold:{title:"Cold damage", s:{blackSoft:3, wilting:2, dropping:2, spots:1, curling:1, mushy:1},
    advice:"Don't cut the damaged parts yet: they shield the rest from the next cold night. Keep it sheltered, and trim in spring once new growth shows what's alive."},
  scorch:{title:"Sun or heat scorch", s:{bleached:3, brownEdges:2, curling:1, wilting:1},
    advice:"Give it shade around midday for a week or two. Scorched patches won't turn green again, but new leaves grow used to the light."},
  light:{title:"Not enough light", s:{pale:3, slow:2, yellow:1, dropping:1},
    advice:"Move it somewhere brighter, step by step if it's going into direct sun. Turning the pot every week or two keeps it growing straight."},
  hungry:{title:"Hungry: it needs feeding", s:{yellow:2, pale:2, slow:2},
    advice:"In the growing season, feed it at the strength on the label, and log it so Alvor reminds you of the next one. Yellowing that starts on the oldest leaves is the usual sign."},
  potbound:{title:"Outgrown its pot", s:{rootsOut:3, slow:2, wilting:1, yellow:1},
    advice:"Repot it into a pot one size bigger with fresh compost, ideally in spring. If it's already in a big pot, replace the top few centimetres of compost instead."},
  sapsuckers:{title:"Aphids, scale or mealybugs", s:{sticky:3, curling:2, yellow:1, spots:1},
    advice:"Look under the leaves and along the stems. Wipe or spray them off with water or a mild soap solution every few days for two weeks, and keep the plant away from others meanwhile."},
  mites:{title:"Spider mites", s:{webbing:3, spots:1, yellow:1, dropping:1, curling:1},
    advice:"Rinse the leaves, above all underneath, and raise the humidity: mites hate damp air. Repeat every few days for two weeks."},
  chewers:{title:"Slugs, snails or caterpillars", s:{holes:3},
    advice:"Look at dusk or after rain and pick them off. Grit, copper tape or a beer trap protect young plants; caterpillars hide under the leaves."},
  mildew:{title:"Mildew or mould", s:{powder:3, spots:1, yellow:1},
    advice:"Take off the worst leaves, give it more air, and water the soil rather than the leaves, in the morning. Grey fuzzy mould means it's too damp and still: let it dry out more."},
  leafspot:{title:"Leaf spot (a fungus)", s:{spots:3, yellow:1, dropping:1},
    advice:"Pick off the spotted leaves and don't compost them. Water the soil, not the leaves, and give it more air."},
  rot:{title:"Root or stem rot", s:{mushy:3, wilting:2, blackSoft:1, yellow:1},
    advice:"Take it out of the pot and look at the roots: healthy ones are firm and pale. Cut away soft, brown ones, repot into fresh, barely damp compost and water sparingly until it grows again."},
  shock:{title:"Settling in after a change", s:{dropping:3, yellow:2, wilting:1},
    advice:"Give it time and steady care: don't move it again, water a little less while it adjusts, and wait a few weeks before feeding. New leaves usually follow within a month."},
  season:{title:"Natural ageing or the season", s:{yellow:2, dropping:1, slow:1},
    advice:"A few of the oldest leaves yellowing and dropping now and then is normal. Remove them; it's only a worry if it spreads to the new leaves."},
  overfed:{title:"Too much feed", s:{brownEdges:2, yellow:1, wilting:1},
    advice:"Flush the pot with plenty of plain water and skip the next feed. Use feed at the strength on the label, or weaker."},
  draught:{title:"A cold window or draughts", s:{dropping:2, brownEdges:1, curling:1, blackSoft:1},
    advice:"Move it a little away from the window, outside doors and radiators. Most houseplants like a steady temperature."},
  dryair:{title:"Dry air indoors", s:{brownEdges:2, curling:1},
    advice:"Heating dries the air. Group plants together, stand the pot on a tray of wet pebbles, and keep it away from radiators."}
};
const ORDER = Object.keys(CAUSES);

/* Why lines: [English text, values]. The app translates them. */
const W = (t, v) => [t, v || null];
const deg = n => `${Math.round(n)}°`;
const season = (m, s) => { const k = GA.seasonMonth(m, s); return [3,4,5].includes(k) ? "spring" : [6,7,8].includes(k) ? "summer" : [9,10,11].includes(k) ? "autumn" : "winter"; };
const daysAgo = (d, today) => d ? GA.daysBetween(d, today) : null;
const entries = p => (p.journal || []).filter(e => e && !e.del);
const lastOf = (p, k) => entries(p).filter(e => e.k === k).map(e => e.d).sort().pop() || null;

/* What Alvor knows about this plant right now, for the causes below.
   ctx: the care engine's ctx (settings, daily, hourly, today, month). opt: {log, plants} (the history and the garden). */
function facts(p, ctx, opt){
  opt = opt || {};
  const s = ctx.settings || {}, today = ctx.today, Wx = GA.splitWeather(ctx.daily, today, ctx.hourly);
  const P = GA.placeOf(p), out = !P.inside && !P.gh, pr = KB.profile(p.species, p.genus), tr = GA.traitsFor(p.species, p.genus);
  const f = {indoor:!!P.inside, gh:!!P.gh, outdoors:out, pot:P.pot, sun:P.sun, zone:p.zone, light:pr ? pr.light : null,
    season:season(ctx.month, s), min:p.minTemp != null && p.minTemp !== "" && isFinite(+p.minTemp) ? +p.minTemp : null, need:tr.d || 2, wetCold:!!tr.w, rootsBack:tr.r != null};
  // Watering: Alvor's estimate, how long since, and what you told it lately
  const st = GA.waterState(p, Wx, ctx, opt.plants || [p]);
  f.water = st.stage; f.dryRatio = st.d;
  f.interval = GA.interval(p, ctx.month);
  const log = (opt.log || []).filter(l => l.plantId === p.id), since = d => l => daysAgo(String(l.t).slice(0, 10), today) <= d;
  f.wetSaid = log.filter(since(30)).filter(l => l.type === "care" && (l.k === "wet" || /already wet/i.test(l.detail || ""))).length;
  f.waterings14 = log.filter(since(14)).filter(l => l.type === "water").length;
  f.lastWatered = p.lastWatered ? daysAgo(p.lastWatered, today) : null;
  // The last week's nights at its spot, and its days
  const past = Wx ? Wx.past.slice(-10).concat(Wx.next.slice(0, 1)) : [];
  let coldest = null;
  for(const d of past){ const t = GA.spotLow(p, d.min, s); if(t != null && (!coldest || t < coldest.t)) coldest = {t, date:d.date}; }
  f.coldest = coldest;
  f.hot = past.filter(d => d.max >= 30).reduce((a, d) => !a || d.max > a.max ? d : a, null);
  f.rain7 = past.slice(-7).reduce((a, d) => a + (d.rain || 0), 0);
  // Moves and changes
  const m = p.moved || {};
  f.movedOut = m.out ? daysAgo(m.out, today) : null;
  f.movedSun = m.sun ? daysAgo(m.sun, today) : null;
  f.broughtIn = P.inside && m.date && !m.out ? daysAgo(m.date, today) : null;
  f.repotted = daysAgo(lastOf(p, "repotted"), today);
  f.fed = daysAgo(lastOf(p, "fed"), today);
  f.got = daysAgo(lastOf(p, "acquired") || (p.created ? String(p.created).slice(0, 10) : null), today);
  const fs = GA.feedState(p, ctx), rs = GA.repotState(p, ctx);
  f.feed = fs.stage; f.repot = rs.stage; f.heavy = (KB.feeding(p.species, p.genus) || {}).f === 3;
  f.roomLow = P.inside && s.rooms && s.rooms[p.zone] != null ? +s.rooms[p.zone] : null;
  return f;
}

/* How each cause fits this plant's situation: [points, why lines]. */
function context(k, f, p){
  const why = [];
  let n = 0;
  const add = (x, line) => { n += x; if(line && x > 0) why.push(line); };
  const wet = ["ok", "soon"].includes(f.water), due = ["likely", "urgent"].includes(f.water);
  const lowSpot = f.zone === "house-low" || f.sun === "none" && !f.indoor && !f.gh;
  const brightSpot = f.sun === "full" || f.zone === "house-window" || f.zone === "house-cabinet";
  switch(k){
    case "overwater":
      if(f.wetSaid) add(2, W("you told Alvor it was already wet recently"));
      if(f.interval && f.waterings14 > Math.max(2, 14 / f.interval * 1.5)) add(2, W("watered {n} times in two weeks", {n:f.waterings14}));
      if(wet) add(1, W("Alvor estimates the soil is still moist"));
      if(due) add(-2);
      if(f.season === "winter" && f.pot) add(1, W("pots dry slowly in winter"));
      if(f.outdoors && !f.pot && f.rain7 >= 25) add(1, W("{n} mm of rain this week", {n:Math.round(f.rain7)}));
      if(f.need === 1) add(1, W("it likes to dry out between waterings"));
      break;
    case "dry":
      if(due) add(3, W("Alvor estimates it's due water"));
      if(f.lastWatered != null && f.interval && f.lastWatered > f.interval * 1.3) add(1, W("{n} days since watering", {n:f.lastWatered}));
      if(f.hot) add(1, W("{t} on {day}", {t:deg(f.hot.max), day:f.hot.date}));
      if(f.pot && f.sun === "full" && f.outdoors) add(0.5, W("a pot in full sun"));
      if(f.need === 3) add(1, W("it likes the soil kept moist"));
      if(wet) add(-2);
      if(f.wetSaid) add(-1);
      break;
    case "cold":
      if(f.min != null && f.coldest){
        const by = f.min - f.coldest.t;
        if(by > 0) add(3 + Math.min(2, by / 2), W("{t} at its spot on {day}, it takes {min}", {t:deg(f.coldest.t), day:f.coldest.date, min:deg(f.min)}));
        else if(by > -2) add(1, W("{t} at its spot on {day}, close to its limit", {t:deg(f.coldest.t), day:f.coldest.date}));
        else add(-2);
      }
      if(f.movedOut != null && f.movedOut <= 21) add(1, W("moved out {n} days ago, not used to cold nights yet", {n:f.movedOut}));
      if(f.roomLow != null && f.min != null && f.roomLow < f.min + 2) add(2, W("its spot indoors gets down to {t}", {t:deg(f.roomLow)}));
      break;
    case "scorch":
      if(f.movedSun != null && f.movedSun <= 21) add(3, W("moved into full sun {n} days ago", {n:f.movedSun}));
      if(f.hot && !f.indoor) add(1.5, W("{t} on {day}", {t:deg(f.hot.max), day:f.hot.date}));
      if(f.sun === "full" && (f.light === "P" || f.light === "H")) add(2, W("it prefers some shade, and it's in full sun"));
      if(f.zone === "house-window" && f.light === "H") add(1, W("it likes low light, and it's by a window"));
      if(f.sun === "none" && !f.indoor) add(-2);
      break;
    case "light":
      if(lowSpot && f.light === "S") add(3, W("it likes bright light or sun, and it's in a shady spot"));
      else if(lowSpot && f.light === "P") add(1.5, W("it likes good light, and it's in a shady spot"));
      if(f.indoor && f.season === "winter") add(1, W("winter light indoors is weak"));
      if(brightSpot) add(-2);
      break;
    case "hungry":
      if(!f.pot) add(-1);
      if(f.feed === "due") add(2, f.fed != null ? W("last fed {n} weeks ago", {n:Math.round(f.fed / 7)}) : W("ready for feeding"));
      else if(f.feed === "unknown" && f.pot && ["spring", "summer"].includes(f.season)) add(1, W("no feeding logged"));
      if(f.heavy && f.pot) add(1, W("a hungry kind of plant in a pot"));
      if(f.fed != null && f.fed <= 21) add(-2);
      if(f.feed === "rest") add(-1);
      break;
    case "potbound":
      if(!f.pot) return [-10, []];
      if(f.repot === "due" || f.repot === "next") add(2, f.repotted != null ? W("repotted {n} months ago", {n:Math.round(f.repotted / 30)}) : W("due for a bigger pot"));
      if(f.repotted != null && f.repotted < 300) add(-2);
      if(f.need !== 1 && f.water === "urgent") add(0.5, W("it dries out fast"));
      break;
    case "sapsuckers":
      if(f.indoor || f.gh) add(0.5, W("indoors and greenhouses suit them"));
      if(["spring", "summer"].includes(f.season)) add(0.5, W("their season"));
      break;
    case "mites":
      if(f.indoor || f.gh) add(1, W("dry, warm air indoors suits them"));
      if(f.hot) add(1, W("hot weather"));
      break;
    case "chewers":
      if(f.indoor) add(-2);
      else add(1, W("outdoors"));
      if(f.outdoors && f.rain7 >= 5) add(1, W("damp weather brings slugs out"));
      break;
    case "mildew":
      if(f.outdoors && f.rain7 >= 10) add(1, W("damp weather"));
      if(["spring", "autumn"].includes(f.season)) add(0.5, W("cool nights and warm days suit it"));
      if(f.gh) add(0.5, W("still air under glass"));
      break;
    case "leafspot":
      if(f.outdoors && f.rain7 >= 10) add(1, W("{n} mm of rain this week", {n:Math.round(f.rain7)}));
      if(f.wetSaid) add(0.5);
      break;
    case "rot":
      if(f.wetSaid) add(2, W("you told Alvor it was already wet recently"));
      if(f.pot && f.season === "winter") add(1, W("wet compost in winter"));
      if(f.wetCold) add(1, W("it hates wet cold"));
      if(f.need === 1) add(1, W("it likes to dry out between waterings"));
      if(wet) add(1, W("Alvor estimates the soil is still moist"));
      if(due) add(-1);
      break;
    case "shock":
      if(f.broughtIn != null && f.broughtIn <= 30) add(3, W("brought inside {n} days ago", {n:f.broughtIn}));
      if(f.movedOut != null && f.movedOut <= 14) add(1.5, W("moved out {n} days ago", {n:f.movedOut}));
      if(f.repotted != null && f.repotted <= 21) add(2, W("repotted {n} days ago", {n:f.repotted}));
      if(f.got != null && f.got <= 30) add(1.5, W("new to your garden"));
      if(!n) add(-2);   // no recent change: something else is going on
      break;
    case "season":
      if(f.season === "autumn" && f.outdoors && f.min != null && f.min <= -10) add(2, W("autumn: hardy plants shed and die back now"));
      if(f.rootsBack && ["autumn", "winter"].includes(f.season)) add(1.5, W("it dies back in the cold and regrows from the roots"));
      if(f.season === "winter") add(1, W("growth slows in winter"));
      break;
    case "overfed":
      if(f.fed == null) return [-10, []];
      if(f.fed <= 14) add(2, W("fed {n} days ago", {n:f.fed}));
      else add(-1);
      break;
    case "draught":
      if(!f.indoor) return [-10, []];
      if(f.zone === "house-window" && ["autumn", "winter"].includes(f.season)) add(2, W("by a window in the cold months"));
      if(f.roomLow != null && f.min != null && f.roomLow < f.min + 3) add(2, W("its spot indoors gets down to {t}", {t:deg(f.roomLow)}));
      break;
    case "dryair":
      if(!f.indoor) return [-10, []];
      if(["autumn", "winter"].includes(f.season)) add(1.5, W("the heating is on"));
      if(f.need === 3 || (f.min != null && f.min >= 10)) add(1, W("a plant from humid places"));
      break;
  }
  return [n, why];
}

/* The likely causes for the symptoms picked, best first (at most 3): {key, title, advice, sure ("likely",
   "possible", "less likely"), why:[[text, values]…], score}. f: facts(p, ctx, opt). */
function diagnose(symptoms, f, p){
  const picked = new Set(symptoms || []);
  if(!picked.size) return [];
  const out = [];
  for(const k of ORDER){
    const C = CAUSES[k], hit = [...picked].reduce((a, s) => a + (C.s[s] || 0), 0);
    if(!hit) continue;
    const [ctxPts, why] = context(k, f, p || {});
    // How much of what you picked this explains: a cause that explains everything ranks above one that explains a part.
    const cover = [...picked].filter(s => C.s[s]).length / picked.size;
    const score = hit + ctxPts + cover * 2;
    if(score < 2) continue;
    out.push({key:k, title:C.title, advice:C.advice, why, score:Math.round(score * 10) / 10, ctx:ctxPts});
  }
  out.sort((a, b) => b.score - a.score || ORDER.indexOf(a.key) - ORDER.indexOf(b.key));
  const top = out.slice(0, 3), best = top[0] ? top[0].score : 0;
  top.forEach((c, i) => { c.sure = i === 0 && c.score >= 5 && c.ctx >= 2 ? "likely" : c.score >= Math.max(3.5, best - 2.5) ? "possible" : "less likely"; });
  return top;
}

/* Every English text the app may show from here, for the language tests. */
function texts(){
  const t = new Set([...SYMPTOMS.map(x => x[1]), ...Object.values(CAUSES).flatMap(c => [c.title, c.advice])]);
  const src = String(context);
  for(const m of src.matchAll(/W\("([^"]+)"/g)) t.add(m[1]);
  return [...t];
}

return {SYMPTOMS, CAUSES, facts, context, diagnose, texts};
});
