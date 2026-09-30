/* Garden alert engine. Shared by the app (browser) and the daily check (server). */
(function(root, factory){
  const lib = factory();
  if(typeof module === "object" && module.exports) module.exports = lib;
  else root.GardenAlerts = lib;
})(typeof self !== "undefined" ? self : this, function(){
"use strict";
const PRESETS = [
  {s:"Musa basjoo",min:-3,pat:"outdoor",ws:4,ww:21,note:"The trunk is damaged around −3 °C; the roots survive to about −10 °C under thick mulch. Wrap the trunk or cut it back and mulch before hard frost."},
  {s:"Ensete ventricosum",min:1,pat:"mover",ws:4,ww:14,note:"Tender. Bring inside or lift before the first frost."},
  {s:"Dicksonia antarctica",min:-5,pat:"outdoor",ws:3,ww:10,note:"Water the trunk, not just the soil. Stuff the crown with straw or cover it with fleece below −5 °C."},
  {s:"Tetrapanax papyrifer",min:-8,pat:"outdoor",ws:5,ww:21,note:"Top can die back in hard frost and regrows from the roots. Mulch the base."},
  {s:"Fatsia japonica",min:-12,pat:"outdoor",ws:7,ww:21,note:"Very hardy. Keep pots from freezing solid."},
  {s:"Colocasia esculenta",min:2,pat:"mover",ws:3,ww:14,note:"Leaves collapse near 0 °C. Bring pots in, or cut back and mulch tubers heavily in the ground."},
  {s:"Alocasia",min:10,pat:"mover",ws:5,ww:10,note:"Tender. Inside once nights drop below about 10 °C."},
  {s:"Trachycarpus fortunei",min:-15,pat:"outdoor",ws:10,ww:30,note:"Very hardy palm. Keep water out of the crown in wet winters."},
  {s:"Chamaerops humilis",min:-10,pat:"outdoor",ws:10,ww:30,note:"Hardy fan palm. Dislikes wet roots in pots over winter."},
  {s:"Cordyline australis",min:-6,pat:"outdoor",ws:7,ww:30,note:"Tie the leaves up around the growing point in a hard frost."},
  {s:"Phormium",min:-8,pat:"outdoor",ws:7,ww:30,note:"Variegated forms are more tender."},
  {s:"Cycas revoluta",min:-6,pat:"greenhouse",ws:10,ww:30,note:"Keep fairly dry in winter and protect the crown from wet and frost."},
  {s:"Canna",min:0,pat:"mover",ws:3,ww:30,note:"Cut back after frost blackens the leaves; lift the rhizomes or mulch deeply."},
  {s:"Hedychium",min:-5,pat:"outdoor",ws:4,ww:30,note:"Dies back in winter; mulch the rhizomes."},
  {s:"Brugmansia",min:3,pat:"mover",ws:2,ww:14,note:"Very thirsty in summer. Keep cool and fairly dry indoors in winter."},
  {s:"Strelitzia reginae",min:3,pat:"mover",ws:7,ww:21,note:""},
  {s:"Agave americana",min:-5,pat:"outdoor",ws:14,ww:45,note:"Wet cold kills more than dry cold. Keep rain off it in winter."},
  {s:"Aeonium",min:3,pat:"mover",ws:10,ww:21,note:""},
  {s:"Citrus (lemon)",min:-2,pat:"greenhouse",ws:4,ww:14,note:"Flowers and fruit are damaged before the tree is."},
  {s:"Olea europaea",min:-8,pat:"outdoor",ws:10,ww:30,note:""},
  {s:"Nerium oleander",min:-5,pat:"greenhouse",ws:5,ww:21,note:""},
  {s:"Bougainvillea",min:3,pat:"greenhouse",ws:5,ww:21,note:""},
  {s:"Hibiscus rosa-sinensis",min:7,pat:"mover",ws:3,ww:10,note:""},
  {s:"Aloe vera",min:5,pat:"mover",ws:14,ww:30,note:""},
  {s:"Monstera deliciosa",min:12,pat:"indoor",ws:7,ww:14,note:""},
  {s:"Ficus lyrata",min:12,pat:"indoor",ws:7,ww:14,note:""}
];
const LOC = {inside:"Inside", outside:"Outside", greenhouse:"Greenhouse"};
const ALLOWED = {indoor:["inside"], outdoor:["outside"], mover:["outside","inside"], greenhouse:["outside","greenhouse"]};

const deg = n => `${Math.round(n)}°`;
const utc = s => Date.parse(s + "T12:00:00Z");
const daysBetween = (a, b) => Math.round((utc(b) - utc(a)) / 86400000);
const presetFor = s => PRESETS.find(p => p.s.toLowerCase() === String(s || "").trim().toLowerCase());
function when(date, today){
  const n = daysBetween(today, date);
  if(n === 0) return "today";
  if(n === 1) return "tomorrow";
  return new Date(utc(date)).toLocaleDateString("en-GB", {weekday:"long", timeZone:"UTC"});
}

function splitWeather(daily, today){
  if(!daily || !daily.time) return null;
  const idx = daily.time.indexOf(today);
  if(idx < 0) return null;
  const day = i => ({date:daily.time[i], min:daily.temperature_2m_min[i], max:daily.temperature_2m_max[i],
    rain:daily.precipitation_sum[i] ?? 0, prob:daily.precipitation_probability_max[i] ?? 0, gust:daily.wind_gusts_10m_max[i] ?? 0});
  const past = [], next = [];
  for(let i = 0; i < idx; i++) past.push(day(i));
  for(let i = idx; i < Math.min(idx + 7, daily.time.length); i++) next.push(day(i));
  return {past, next};
}

function interval(p, month){
  if([6,7,8,9].includes(month)) return +p.ws;
  if([12,1,2].includes(month)) return +p.ww;
  return Math.round((+p.ws + +p.ww) / 2);
}
const exposedToRain = p => p.current === "outside" && p.rainCounts;

function waterStatus(p, W, ctx){
  let last = p.lastWatered || null, byRain = false;
  if(W && exposedToRain(p)){
    for(let i = W.past.length - 1; i >= 0; i--){
      if(W.past[i].rain >= +ctx.settings.rain){
        if(!last || W.past[i].date > last){ last = W.past[i].date; byRain = true; }
        break;
      }
    }
  }
  const iv = interval(p, ctx.month);
  if(!last) return {due:true, days:null, iv, byRain};
  const days = daysBetween(last, ctx.today);
  return {due:days >= iv, days, iv, byRain, last};
}
const effMin = (p, d, s) => d.min + (p.current === "greenhouse" ? +s.gh : 0);
const coldLimit = (p, s) => +p.minTemp + +s.margin + (p.planting === "pot" && p.current === "outside" ? 1 : 0);

const COLD_KEYS = ["bringIn","toGh","ghProtect","potProtect","groundProtect"];
const ORDER = [...COLD_KEYS, "vent","heat","wind","water","rainWill","plan","goOut"];
const RANK = {danger:0, warn:1, heat:2, wind:3, water:4, info:5};

/* ctx: {settings, daily, today:"YYYY-MM-DD", month:1-12, mode:"full"|"evening"} */
function compute(plants, ctx){
  const s = ctx.settings, W = splitWeather(ctx.daily, ctx.today), groups = {};
  const evening = ctx.mode === "evening";
  const add = (key, base, item) => {
    const g = (groups[key] ||= {...base, items:[]});
    if(RANK[base.level] < RANK[g.level]) g.level = base.level;
    g.items.push(item);
  };

  if(W){
    // Evening: tonight's low is tomorrow's daily minimum. Full: today and the next two days.
    const look = evening ? W.next.slice(1, 2) : W.next.slice(0, 3);
    const coldIds = new Set();
    for(const p of plants){
      if(p.current === "inside") continue;
      let worst = null;
      for(const d of look){ const t = effMin(p, d, s); if(!worst || t < worst.t) worst = {t, date:d.date}; }
      if(!worst || worst.t >= coldLimit(p, s)) continue;
      coldIds.add(p.id);
      const level = worst.t < +p.minTemp ? "danger" : "warn";
      let key, base;
      if(p.current === "outside" && p.planting === "pot" && (p.pattern === "mover" || p.pattern === "indoor"))
        {key = "bringIn"; base = {title:"Bring inside", text:"Cold is coming that these can't take outside.", move:"inside"};}
      else if(p.current === "outside" && p.planting === "pot" && p.pattern === "greenhouse")
        {key = "toGh"; base = {title:"Move to the greenhouse", text:"Cold is coming that these can't take outside.", move:"greenhouse"};}
      else if(p.current === "greenhouse")
        {key = "ghProtect"; base = {title:"Protect in the greenhouse", text:`The greenhouse could drop to about ${deg(worst.t)}. Add fleece or turn on a heater.`};}
      else if(p.planting === "pot")
        {key = "potProtect"; base = {title:"Shelter the pots", text:"Move them against a house wall, lift them off the ground and wrap the pots."};}
      else
        {key = "groundProtect"; base = {title:"Protect plants in the ground", text:"Fleece and mulch. Check each plant's note."};}
      const whenTxt = evening ? "tonight" : when(worst.date, ctx.today);
      add(key, {...base, level}, {p, t:worst.t, why:`${deg(worst.t)} ${whenTxt}, takes ${deg(p.minTemp)}`});
    }

    if(!evening){
      for(const p of plants){
        if(coldIds.has(p.id)) continue;
        const movable = p.pattern === "mover" || p.pattern === "greenhouse";
        if(p.current === "outside" && p.planting === "pot" && movable && ctx.month >= 8 && ctx.month <= 11){
          const hit = W.next.slice(3).find(d => d.min < coldLimit(p, s) + 2);
          if(hit) add("plan", {level:"info", title:"Get ready to move soon", text:"Nights are getting close to their limit later this week."},
            {p, why:`${deg(hit.min)} ${when(hit.date, ctx.today)}`});
        }
        const sheltered = (p.current === "inside" && p.pattern === "mover") || (p.current === "greenhouse" && p.pattern === "greenhouse");
        if(sheltered && ctx.month >= 3 && ctx.month <= 6 && W.next.length){
          const lowest = Math.min(...W.next.map(d => d.min));
          if(lowest >= +p.minTemp + +s.margin + 3)
            add("goOut", {level:"info", title:"Safe to move outside", text:`No night this week drops below ${deg(lowest)}.`, move:"outside"},
              {p, why:`takes ${deg(p.minTemp)}`});
        }
      }

      const hottest = look.reduce((a, d) => !a || d.max > a.max ? d : a, null);
      if(hottest && hottest.max >= +s.heat){
        plants.filter(p => p.current === "outside" && p.planting === "pot" &&
          (p.sun === "full" || p.sun === true || p.sun === undefined || (p.sun === "partial" && hottest.max >= +s.heat + 3))).forEach(p =>
          add("heat", {level:"heat", title:"Hot spell", text:`${deg(hottest.max)} ${when(hottest.date, ctx.today)}. Water these early in the morning and give them shade where you can.`}, {p, why:p.sun === "partial" ? "pot in partial sun" : "pot in the sun"}));
      }
      if(hottest && hottest.max + 8 >= 35){
        plants.filter(p => p.current === "greenhouse").forEach(p =>
          add("vent", {level:"heat", title:"Open the greenhouse", text:`Outside will reach ${deg(hottest.max)}; the greenhouse gets much hotter. Open vents or the door.`}, {p, why:"in the greenhouse"}));
      }
      const windy = look.reduce((a, d) => !a || d.gust > a.gust ? d : a, null);
      if(windy && windy.gust >= +s.wind){
        plants.filter(p => p.current === "outside").forEach(p =>
          add("wind", {level:"wind", title:"Strong gusts", text:`Up to ${Math.round(windy.gust)} km/h ${when(windy.date, ctx.today)}. Secure pots, stake tall plants, close the greenhouse.`},
            {p, why:p.planting === "pot" ? "pot" : "in the ground"}));
      }
    }
  }

  if(!evening){
    const soon = W ? W.next.slice(0, 2).reduce((a, d) => a + (d.prob >= 60 ? d.rain : 0), 0) : 0;
    for(const p of plants){
      const st = waterStatus(p, W, ctx);
      if(!st.due) continue;
      const why = st.days === null ? "not logged yet" : `${st.days} days, every ${st.iv}`;
      if(exposedToRain(p) && soon >= +s.rain)
        add("rainWill", {level:"info", title:"Skip these, rain is coming", text:`About ${Math.round(soon)} mm expected over the next two days.`}, {p, why});
      else
        add("water", {level:"water", title:"Needs water", text:"", waterAll:true}, {p, why});
    }
  }

  return ORDER.filter(k => groups[k]).map(k => ({key:k, ...groups[k]}))
    .sort((a, b) => RANK[a.level] - RANK[b.level]);
}

/* Short text for a phone notification. Returns null when there is nothing worth sending. */
function summarize(groups, ctx){
  const W = splitWeather(ctx.daily, ctx.today);
  const evening = ctx.mode === "evening";
  const lines = groups.map(g => {
    const names = g.items.map(i => i.p.name);
    const list = names.length > 4 ? names.slice(0, 4).join(", ") + ` and ${names.length - 4} more` : names.join(", ");
    return `${g.title}: ${list}`;
  });
  const cold = groups.filter(g => COLD_KEYS.includes(g.key));
  const lowest = cold.length ? Math.min(...cold.flatMap(g => g.items.map(i => i.t))) : null;
  if(evening){
    if(!cold.length) return null;
    return {title:`Cold tonight: down to ${deg(lowest)}`, body:lines.join("\n"), tag:"garden-evening"};
  }
  const t = W && W.next[0];
  const wLine = t ? `${deg(t.min)} to ${deg(t.max)}, ${t.rain >= 0.5 ? Math.round(t.rain) + " mm rain" : "dry"}` : "";
  if(!groups.length) return {title:"Nothing to do in the garden today", body:wLine, tag:"garden-morning"};
  const title = cold.length ? `Frost warning: down to ${deg(lowest)}`
    : `${groups.length} ${groups.length === 1 ? "thing" : "things"} to do in the garden`;
  return {title, body:[...lines, wLine].filter(Boolean).join("\n"), tag:"garden-morning"};
}

return {PRESETS, LOC, ALLOWED, deg, daysBetween, presetFor, splitWeather, interval, waterStatus, effMin, coldLimit, compute, summarize, COLD_KEYS};
});
