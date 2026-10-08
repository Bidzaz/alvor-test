/* Garden alert engine. Shared by the app (browser) and the daily check (server).
   Its texts are in English in the code and in Spanish in ES below (the server has no other tables);
   the app sets the language with setLang, the server passes ctx.lang for each person. */
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
/* Spanish (Spain, "tú"). Another language: add a table like this one and list it in TABLES. */
const ES = {
  "today":"hoy", "tomorrow":"mañana", "tonight":"esta noche",
  "Bring inside":"Meter dentro", "Cold is coming that these can't take outside.":"Llega un frío que estas plantas no aguantan fuera.",
  "Move to the greenhouse":"Pasar al invernadero",
  "Protect in the greenhouse":"Proteger en el invernadero", "The greenhouse could drop to about {t}. Add fleece or turn on a heater.":"El invernadero podría bajar a unos {t}. Pon manta térmica o enciende un calefactor.",
  "Shelter the pots":"Resguardar las macetas", "Move them against a house wall, lift them off the ground and wrap the pots.":"Ponlas contra una pared de la casa, sepáralas del suelo y envuelve las macetas.",
  "Protect plants in the ground":"Proteger las plantas en tierra", "Fleece and mulch. Check each plant's note.":"Manta térmica y acolchado. Mira la nota de cada planta.",
  "{t} {when}, takes {min}":"{t} {when}, aguanta {min}",
  "Get ready to move soon":"Prepárate para moverlas pronto", "Nights are getting close to their limit later this week.":"Las noches se acercan a su límite a finales de semana.",
  "Safe to move outside":"Ya pueden salir fuera", "No night this week drops below {t}.":"Ninguna noche de esta semana baja de {t}.", "takes {t}":"aguanta {t}",
  "Hot spell":"Ola de calor", "{t} {when}. Water these early in the morning and give them shade where you can.":"{t} {when}. Riégalas temprano por la mañana y dales sombra donde puedas.",
  "pot in partial sun":"maceta a semisombra", "pot in the sun":"maceta al sol",
  "Open the greenhouse":"Abre el invernadero", "Outside will reach {t}; the greenhouse gets much hotter. Open vents or the door.":"Fuera llegará a {t}; el invernadero se calienta mucho más. Abre las ventanas o la puerta.",
  "in the greenhouse":"en el invernadero",
  "Strong gusts":"Rachas fuertes", "Up to {n} km/h {when}. Secure pots, stake tall plants, close the greenhouse.":"Hasta {n} km/h {when}. Sujeta las macetas, entutora las plantas altas y cierra el invernadero.",
  "pot":"maceta", "in the ground":"en tierra",
  "not logged yet":"sin registrar aún", "{n} days, every {iv}":"{n} días, cada {iv}",
  "Skip these, rain is coming":"No las riegues, viene lluvia", "About {n} mm expected over the next two days.":"Se esperan unos {n} mm en los próximos dos días.",
  "Needs water":"Necesita agua",
  "{list} and {n} more":"{list} y {n} más",
  "Cold tonight: down to {t}":"Frío esta noche: hasta {t}",
  "{lo} to {hi}, {rain} mm rain":"De {lo} a {hi}, {rain} mm de lluvia", "{lo} to {hi}, dry":"De {lo} a {hi}, sin lluvia",
  "Nothing to do in the garden today":"Hoy no hay nada que hacer en el jardín",
  "Frost warning: down to {t}":"Aviso de helada: hasta {t}", "Low temperature warning: down to {t}":"Aviso de frío: hasta {t}",
  "1 thing to do in the garden":"1 cosa que hacer en el jardín", "{n} things to do in the garden":"{n} cosas que hacer en el jardín"
};
const TABLES = {es:ES}, LOCALES = {en:"en-GB", es:"es-ES"};
let lang = "en";
function setLang(l){ lang = TABLES[l] ? l : "en"; }
function T(s, v){
  const r = (TABLES[lang] && TABLES[lang][s]) || s;
  return v ? r.replace(/\{(\w+)\}/g, (m, k) => k in v ? v[k] : m) : r;
}
const LOC = {inside:"Inside", outside:"Outside", greenhouse:"Greenhouse"};
const ALLOWED = {indoor:["inside"], outdoor:["outside"], mover:["outside","inside"], greenhouse:["outside","greenhouse"]};

const deg = n => `${Math.round(n)}°`;
const utc = s => Date.parse(s + "T12:00:00Z");
const daysBetween = (a, b) => Math.round((utc(b) - utc(a)) / 86400000);
const presetFor = s => PRESETS.find(p => p.s.toLowerCase() === String(s || "").trim().toLowerCase());
function when(date, today){
  const n = daysBetween(today, date);
  if(n === 0) return T("today");
  if(n === 1) return T("tomorrow");
  return new Date(utc(date)).toLocaleDateString(LOCALES[lang] || "en-GB", {weekday:"long", timeZone:"UTC"});
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
/* Cold warnings are per plant: off when the owner switched them off, or when no limit is set. */
const coldOn = p => p.coldAlert !== false && p.minTemp !== null && p.minTemp !== undefined && p.minTemp !== "" && isFinite(+p.minTemp);
const coldLimit = (p, s) => +p.minTemp + +s.margin + (p.planting === "pot" && p.current === "outside" ? 1 : 0);

const COLD_KEYS = ["bringIn","toGh","ghProtect","potProtect","groundProtect"];
const ORDER = [...COLD_KEYS, "vent","heat","wind","water","rainWill","plan","goOut"];
const RANK = {danger:0, warn:1, heat:2, wind:3, water:4, info:5};

/* ctx: {settings, daily, today:"YYYY-MM-DD", month:1-12, mode:"full"|"evening"} */
function compute(plants, ctx){
  if(ctx.lang) setLang(ctx.lang);
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
      if(p.current === "inside" || !coldOn(p)) continue;
      let worst = null;
      for(const d of look){ const t = effMin(p, d, s); if(!worst || t < worst.t) worst = {t, date:d.date}; }
      if(!worst || worst.t >= coldLimit(p, s)) continue;
      coldIds.add(p.id);
      const level = worst.t < +p.minTemp ? "danger" : "warn";
      let key, base;
      if(p.current === "outside" && p.planting === "pot" && (p.pattern === "mover" || p.pattern === "indoor"))
        {key = "bringIn"; base = {title:T("Bring inside"), text:T("Cold is coming that these can't take outside."), move:"inside"};}
      else if(p.current === "outside" && p.planting === "pot" && p.pattern === "greenhouse")
        {key = "toGh"; base = {title:T("Move to the greenhouse"), text:T("Cold is coming that these can't take outside."), move:"greenhouse"};}
      else if(p.current === "greenhouse")
        {key = "ghProtect"; base = {title:T("Protect in the greenhouse"), text:T("The greenhouse could drop to about {t}. Add fleece or turn on a heater.", {t:deg(worst.t)})};}
      else if(p.planting === "pot")
        {key = "potProtect"; base = {title:T("Shelter the pots"), text:T("Move them against a house wall, lift them off the ground and wrap the pots.")};}
      else
        {key = "groundProtect"; base = {title:T("Protect plants in the ground"), text:T("Fleece and mulch. Check each plant's note.")};}
      const whenTxt = evening ? T("tonight") : when(worst.date, ctx.today);
      add(key, {...base, level}, {p, t:worst.t, why:T("{t} {when}, takes {min}", {t:deg(worst.t), when:whenTxt, min:deg(p.minTemp)})});
    }

    if(!evening){
      for(const p of plants){
        if(coldIds.has(p.id) || !coldOn(p)) continue;
        const movable = p.pattern === "mover" || p.pattern === "greenhouse";
        if(p.current === "outside" && p.planting === "pot" && movable && ctx.month >= 8 && ctx.month <= 11){
          const hit = W.next.slice(3).find(d => d.min < coldLimit(p, s) + 2);
          if(hit) add("plan", {level:"info", title:T("Get ready to move soon"), text:T("Nights are getting close to their limit later this week.")},
            {p, why:`${deg(hit.min)} ${when(hit.date, ctx.today)}`});
        }
        const sheltered = (p.current === "inside" && p.pattern === "mover") || (p.current === "greenhouse" && p.pattern === "greenhouse");
        if(sheltered && ctx.month >= 3 && ctx.month <= 6 && W.next.length){
          const lowest = Math.min(...W.next.map(d => d.min));
          if(lowest >= +p.minTemp + +s.margin + 3)
            add("goOut", {level:"info", title:T("Safe to move outside"), text:T("No night this week drops below {t}.", {t:deg(lowest)}), move:"outside"},
              {p, why:T("takes {t}", {t:deg(p.minTemp)})});
        }
      }

      const hottest = look.reduce((a, d) => !a || d.max > a.max ? d : a, null);
      if(hottest && hottest.max >= +s.heat){
        plants.filter(p => p.current === "outside" && p.planting === "pot" &&
          (p.sun === "full" || p.sun === true || p.sun === undefined || (p.sun === "partial" && hottest.max >= +s.heat + 3))).forEach(p =>
          add("heat", {level:"heat", title:T("Hot spell"), text:T("{t} {when}. Water these early in the morning and give them shade where you can.", {t:deg(hottest.max), when:when(hottest.date, ctx.today)})}, {p, why:p.sun === "partial" ? T("pot in partial sun") : T("pot in the sun")}));
      }
      if(hottest && hottest.max + 8 >= 35){
        plants.filter(p => p.current === "greenhouse").forEach(p =>
          add("vent", {level:"heat", title:T("Open the greenhouse"), text:T("Outside will reach {t}; the greenhouse gets much hotter. Open vents or the door.", {t:deg(hottest.max)})}, {p, why:T("in the greenhouse")}));
      }
      const windy = look.reduce((a, d) => !a || d.gust > a.gust ? d : a, null);
      if(windy && windy.gust >= +s.wind){
        plants.filter(p => p.current === "outside").forEach(p =>
          add("wind", {level:"wind", title:T("Strong gusts"), text:T("Up to {n} km/h {when}. Secure pots, stake tall plants, close the greenhouse.", {n:Math.round(windy.gust), when:when(windy.date, ctx.today)})},
            {p, why:p.planting === "pot" ? T("pot") : T("in the ground")}));
      }
    }
  }

  if(!evening){
    const soon = W ? W.next.slice(0, 2).reduce((a, d) => a + (d.prob >= 60 ? d.rain : 0), 0) : 0;
    for(const p of plants){
      const st = waterStatus(p, W, ctx);
      if(!st.due) continue;
      const why = st.days === null ? T("not logged yet") : T("{n} days, every {iv}", {n:st.days, iv:st.iv});
      if(exposedToRain(p) && soon >= +s.rain)
        add("rainWill", {level:"info", title:T("Skip these, rain is coming"), text:T("About {n} mm expected over the next two days.", {n:Math.round(soon)})}, {p, why});
      else
        add("water", {level:"water", title:T("Needs water"), text:"", waterAll:true}, {p, why});
    }
  }

  return ORDER.filter(k => groups[k]).map(k => ({key:k, ...groups[k]}))
    .sort((a, b) => RANK[a.level] - RANK[b.level]);
}

/* Short text for a phone notification. Returns null when there is nothing worth sending. */
function summarize(groups, ctx){
  if(ctx.lang) setLang(ctx.lang);
  const W = splitWeather(ctx.daily, ctx.today);
  const evening = ctx.mode === "evening";
  const lines = groups.map(g => {
    const names = g.items.map(i => i.p.name);
    const list = names.length > 4 ? T("{list} and {n} more", {list:names.slice(0, 4).join(", "), n:names.length - 4}) : names.join(", ");
    return `${g.title}: ${list}`;
  });
  const cold = groups.filter(g => COLD_KEYS.includes(g.key));
  const lowest = cold.length ? Math.min(...cold.flatMap(g => g.items.map(i => i.t))) : null;
  if(evening){
    if(!cold.length) return null;
    return {title:T("Cold tonight: down to {t}", {t:deg(lowest)}), body:lines.join("\n"), tag:"garden-evening"};
  }
  const t = W && W.next[0];
  const wLine = t ? (t.rain >= 0.5 ? T("{lo} to {hi}, {rain} mm rain", {lo:deg(t.min), hi:deg(t.max), rain:Math.round(t.rain)}) : T("{lo} to {hi}, dry", {lo:deg(t.min), hi:deg(t.max)})) : "";
  if(!groups.length) return {title:T("Nothing to do in the garden today"), body:wLine, tag:"garden-morning"};
  const title = cold.length ? T(lowest <= 0 ? "Frost warning: down to {t}" : "Low temperature warning: down to {t}", {t:deg(lowest)})
    : groups.length === 1 ? T("1 thing to do in the garden") : T("{n} things to do in the garden", {n:groups.length});
  return {title, body:[...lines, wLine].filter(Boolean).join("\n"), tag:"garden-morning"};
}

return {setLang, ES, PRESETS, LOC, ALLOWED, deg, daysBetween, presetFor, splitWeather, interval, waterStatus, effMin, coldLimit, coldOn, compute, summarize, COLD_KEYS};
});
