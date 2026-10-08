/* Alvor care engine ("Alvor knows my garden"). Shared by the app (browser) and the notify function (server).
   One source of truth: the server's copy inside supabase/functions/notify/index.ts is made from this file by
   tests/notify-sync.js, and the tests fail if the two ever differ. VERSION tells the app which rules the server runs.

   Pure: no screen and no storage. Everything it needs comes in ctx:
     {settings, daily, hourly?, today:"YYYY-MM-DD", month:1-12, mode:"full"|"evening", lang?, hour?, weatherAt?, now?}

   In plain words:
   - Watering: each plant has an estimated water reserve. It drains every day by how drying the weather really was
     (evapotranspiration from the forecast, or an estimate from the temperatures), adjusted for the spot (sun, shade,
     greenhouse, wall, tree, wind, afternoon sun) and for pots on hot days, and it refills when watered or by the rain
     that actually reaches the plant. The plant's own interval ("every 7 days") is the anchor: in typical weather
     Alvor answers exactly as the interval would. Feedback (Already wet, Looks fine) teaches it how each plant and
     spot really behaves. Answers are stages (No need … Needs attention), never litres: Alvor has no soil sensor.
   - Frost: a plan per plant (bring inside, shelter the pot, protect the crown, mulch the roots, fleece, cover new
     growth, or nothing to do), from its limit, pot or ground, the spot, the species and how long the cold lasts.
   - Garden today: what matters now, in a few lines, and plainly when nothing else is urgent.
   Every number is in RULES, so a rule that an experienced gardener disagrees with is one edit.
   Texts are English in the code and Spanish in ES below (the server has no other tables). */
(function(root, factory){
  const lib = factory();
  if(typeof module === "object" && module.exports) module.exports = lib;
  else root.GardenAlerts = lib;
})(typeof self !== "undefined" ? self : this, function(){
"use strict";
const VERSION = "2026-10-08.care-1";

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

/* ---------- Rules: every number the care engine uses ---------- */
const RULES = {
  water:{
    /* The "typical" drying (reference evapotranspiration, mm a day) that a plant's interval describes: summer
       (Jun–Sep), winter (Dec–Feb) and the months between. A warm temperate garden; feedback corrects the rest. */
    refEt:{summer:4.0, shoulder:2.2, winter:0.9},
    /* The interval already describes the plant in its own spot, so the spot doesn't change a typical day.
       It changes how much an unusual day (hot, sunny, windy, or cool and dull) speeds up or slows down drying:
       a shaded plant feels a heatwave less than one in full sun, a pot against a hot wall more. */
    sun:{full:1, partial:0.75, none:0.5},
    micro:{wall:1.15, tree:0.85, exposed:1.2, sheltered:0.85, pm:1.15},
    greenhouse:1.2,                                   // under glass: the sun's heat, no wind
    hot:{from:28, pot:1.2, ground:0.9},               // on hot days pot walls heat up; roots in the ground stay cool
    interception:1,                                   // mm of each day's rain that never reaches the roots
    reach:{open:1, wall:0.5, tree:0.4, balcony:0.6},  // share of the rain that reaches the plant
    stages:{soon:0.6, consider:0.85, likely:1, urgent:1.35},
    fine:0.6,                                         // "Looks fine": counted as this dry, so Alvor looks again later
    learn:{min:0.5, max:2, wet:0.85, fine:0.92, early:1.04},
    rainSkip:{prob:60}                                // rain coming counts when it's at least this likely (%)
  },
  frost:{
    pot:1,                                            // pots outside: the roots are exposed, 1 °C more tender
    bonus:{porch:1, balcony:1, wall:1.5, tree:1, sheltered:0.5, max:2.5},   // °C warmer on a cold night
    bringIn:3,                                        // a pot this far below its limit comes inside whatever its pattern
    rootSafety:2,                                     // "mulch the roots" only when the roots have this much to spare
    spring:[3,4,5],                                   // months when new growth is tender (hemisphere-adjusted)
    okWithin:4                                        // "no action needed" lists plants within this of their limit
  },
  heat:{partial:3, pm:2, greenhouse:8, ghVent:35},
  wind:{sheltered:20}
};

/* What the species does in the cold, wind and wet, beyond its lowest temperature (hardiness.js).
   Key: genus or "Genus species" (the species adds to its genus).
   c: protect the crown or growing point. r: roots survive to (°C) when the top doesn't. s: new growth or blossom
   damaged below (°C) in spring. w: wet cold harms it more than dry cold. b: big leaves that tear in wind.
   d: water need, 1 dry (succulents, cacti) or 3 moist (ferns, marginals); used for the intervals of new plants. */
const TRAITS = {
  "Musa":{b:1,d:3}, "Musa basjoo":{r:-10}, "Musa sikkimensis":{r:-8}, "Musella":{r:-10,b:1}, "Ensete":{b:1,d:3},
  "Dicksonia":{c:1,d:3}, "Cyathea":{c:1,d:3}, "Cordyline":{c:1}, "Cordyline fruticosa":{c:0}, "Gunnera":{c:1,b:1,d:3}, "Echium":{c:1},
  "Trachycarpus":{c:1,w:1}, "Chamaerops":{w:1}, "Phoenix":{c:1}, "Butia":{c:1}, "Jubaea":{c:1}, "Washingtonia":{c:1}, "Brahea":{c:1}, "Sabal":{c:1}, "Livistona":{c:1},
  "Cycas":{c:1,w:1,d:1},
  "Tetrapanax":{r:-15,b:1}, "Melianthus":{r:-10}, "Colocasia":{r:-5,b:1,d:3}, "Alocasia":{b:1}, "Alocasia wentii":{r:-8}, "Alocasia odora":{r:-3},
  "Canna":{r:-5,b:1}, "Dahlia":{r:-5}, "Aloysia":{r:-12}, "Passiflora caerulea":{r:-15}, "Hedychium":{b:1},
  "Strelitzia nicolai":{b:1}, "Ricinus":{b:1}, "Paulownia":{b:1},
  "Actinidia":{s:-1}, "Hydrangea":{d:3}, "Hydrangea macrophylla":{s:-2}, "Prunus persica":{s:-2}, "Prunus armeniaca":{s:-2}, "Prunus dulcis":{s:-2},
  "Ficus carica":{s:-2}, "Juglans":{s:-1}, "Vitis":{s:-1}, "Acer palmatum":{s:-2}, "Hosta":{s:-1},
  "Agave":{w:1,d:1}, "Aloe":{w:1,d:1}, "Yucca":{w:1,d:1}, "Dasylirion":{w:1,d:1}, "Nolina":{d:1}, "Hesperaloe":{w:1,d:1}, "Puya":{w:1,d:1}, "Beschorneria":{w:1,d:1},
  "Aeonium":{w:1,d:1}, "Echeveria":{w:1,d:1}, "Crassula":{d:1}, "Sedum":{d:1}, "Sempervivum":{d:1}, "Haworthia":{d:1}, "Haworthiopsis":{d:1}, "Gasteria":{d:1},
  "Lithops":{d:1}, "Opuntia":{w:1,d:1}, "Cylindropuntia":{d:1}, "Echinocactus":{d:1}, "Echinopsis":{d:1}, "Mammillaria":{d:1}, "Gymnocalycium":{d:1}, "Cereus":{d:1},
  "Kalanchoe":{d:1}, "Beaucarnea":{d:1}, "Sansevieria":{d:1}, "Dracaena trifasciata":{d:1}, "Zamioculcas":{d:1}, "Delosperma":{d:1},
  "Lavandula":{d:1}, "Rosmarinus":{d:1}, "Salvia rosmarinus":{d:1}, "Cistus":{d:1}, "Senecio rowleyanus":{d:1}, "Curio":{d:1},
  "Cyperus":{d:3}, "Zantedeschia":{d:3}, "Lysichiton":{d:3}, "Caltha":{d:3}, "Darmera":{d:3}, "Ligularia":{d:3}, "Rodgersia":{d:3}, "Astilbe":{d:3},
  "Calathea":{d:3}, "Goeppertia":{d:3}, "Maranta":{d:3}, "Adiantum":{d:3}, "Nephrolepis":{d:3}, "Brugmansia":{d:3}, "Spathiphyllum":{d:3}, "Impatiens":{d:3},
  "Nepenthes":{d:3}, "Dionaea":{d:3}, "Drosera":{d:3}, "Acorus":{d:3}, "Juncus":{d:3}, "Equisetum":{d:3}, "Typha":{d:3}, "Pontederia":{d:3}, "Thalia":{d:3}, "Sagittaria":{d:3}
};
/* Intervals for a new plant with no preset, by water need (summer, winter). */
const NEED_INTERVALS = {1:{ws:14, ww:30}, 2:{ws:7, ww:14}, 3:{ws:3, ww:10}};

/* Spanish (Spain, "tú"). Another language: add a table like this one and list it in TABLES. */
const ES = {
  "today":"hoy", "tomorrow":"mañana", "tonight":"esta noche",
  "Bring inside":"Meter dentro", "Cold is coming that these can't take outside.":"Llega un frío que estas plantas no aguantan fuera.",
  "Move to the greenhouse":"Pasar al invernadero",
  "Protect in the greenhouse":"Proteger en el invernadero", "The greenhouse could drop to about {t}. Add fleece or turn on a heater.":"El invernadero podría bajar a unos {t}. Pon manta térmica o enciende un calefactor.",
  "Shelter the pots":"Resguardar las macetas", "Move them against a house wall, lift them off the ground and wrap the pots.":"Ponlas contra una pared de la casa, sepáralas del suelo y envuelve las macetas.",
  "Protect plants in the ground":"Proteger las plantas en tierra", "Cover them with fleece overnight and mulch the base.":"Cúbrelas con manta térmica por la noche y acolcha la base.",
  "Protect the crown":"Proteger la corona", "Cover the top with fleece and pack the crown with straw. The growing point is the part that mustn't freeze.":"Cubre la parte de arriba con manta térmica y rellena la corona con paja. El punto de crecimiento es lo que no debe helarse.",
  "Mulch the roots":"Acolchar las raíces", "The leaves or trunk may be damaged, but the roots should survive under a thick mulch. Wrap the stem if you want to keep it.":"Las hojas o el tronco pueden dañarse, pero las raíces deberían aguantar bajo un buen acolchado. Envuelve el tallo si quieres conservarlo.",
  "Cover new growth":"Cubrir los brotes nuevos", "A light frost can kill fresh shoots and blossom. Fleece overnight is enough.":"Una helada ligera puede matar los brotes y las flores nuevas. Basta con manta térmica por la noche.",
  "No action needed":"No hace falta hacer nada", "These stay within what they take.":"Estas aguantan lo que viene.",
  "{t} {when}, takes {min}":"{t} {when}, aguanta {min}", "for {n} hours":"durante {n} horas", "roots take {t}":"las raíces aguantan {t}",
  "against a wall":"contra una pared", "under a tree":"bajo un árbol", "sheltered":"resguardada", "on the porch":"en el porche", "on the balcony":"en el balcón",
  "keep rain off it":"protégela de la lluvia", "may not survive outside":"puede no sobrevivir fuera", "new growth":"brotes nuevos",
  "Get ready to move soon":"Prepárate para moverlas pronto", "Nights are getting close to their limit later this week.":"Las noches se acercan a su límite a finales de semana.",
  "Safe to move outside":"Ya pueden salir fuera", "No night this week drops below {t}.":"Ninguna noche de esta semana baja de {t}.", "takes {t}":"aguanta {t}",
  "Hot spell":"Ola de calor", "{t} {when}. Water these early in the morning and give them shade where you can.":"{t} {when}. Riégalas temprano por la mañana y dales sombra donde puedas.",
  "pot in partial sun":"maceta a semisombra", "pot in the sun":"maceta al sol", "pot in afternoon sun":"maceta con sol de tarde",
  "Open the greenhouse":"Abre el invernadero", "Outside will reach {t}; the greenhouse gets much hotter. Open vents or the door.":"Fuera llegará a {t}; el invernadero se calienta mucho más. Abre las ventanas o la puerta.",
  "in the greenhouse":"en el invernadero",
  "Strong gusts":"Rachas fuertes", "Up to {n} km/h {when}. Secure pots, stake tall plants, close the greenhouse.":"Hasta {n} km/h {when}. Sujeta las macetas, entutora las plantas altas y cierra el invernadero.",
  "pot":"maceta", "in the ground":"en tierra", "big leaves tear":"las hojas grandes se rompen", "windy spot":"sitio con viento",
  "Skip these, rain is coming":"No las riegues, viene lluvia", "About {n} mm expected over the next two days.":"Se esperan unos {n} mm en los próximos dos días.",
  "Needs water":"Necesita agua", "Not sure about these":"No sabemos de estas",
  "Alvor doesn't know when these were last watered. Tell it once and it follows them from there.":"Alvor no sabe cuándo las regaste por última vez. Díselo una vez y a partir de ahí las sigue.",
  "No need":"No hace falta", "Probably not yet":"Probablemente aún no", "Consider watering":"Plantéate regarla", "Likely needs water":"Seguramente necesita agua", "Needs attention":"Necesita atención", "Not sure yet":"Aún no se sabe",
  "no watering logged yet":"sin riegos registrados", "watered today":"regada hoy", "1 day since watering":"1 día desde el riego", "{n} days since watering":"{n} días desde el riego",
  "checked today":"revisada hoy", "1 day since you checked it":"1 día desde que la revisaste", "{n} days since you checked it":"{n} días desde que la revisaste",
  "rain on {day} counted as watering":"la lluvia del {day} contó como riego", "usually every {n} days":"normalmente cada {n} días",
  "{t} today":"{t} hoy", "up to {t}":"hasta {t}", "drying weather":"tiempo que seca", "cool, damp weather":"tiempo fresco y húmedo", "windy":"viento",
  "no real rain in {n} days":"sin lluvia de verdad en {n} días", "{n} mm of rain helped":"{n} mm de lluvia ayudaron", "rain doesn't reach it":"la lluvia no le llega", "little rain reaches it":"le llega poca lluvia",
  "full sun":"pleno sol", "partial sun":"semisombra", "shade":"sombra", "in a pot":"en maceta", "indoors":"dentro de casa", "afternoon sun":"sol de tarde",
  "dries faster than expected (your feedback)":"se seca antes de lo previsto (según lo que indicas)", "stays moist longer than expected (your feedback)":"aguanta húmeda más de lo previsto (según lo que indicas)",
  "this spot dries faster (your feedback)":"este sitio se seca antes (según lo que indicas)", "this spot stays moist longer (your feedback)":"este sitio aguanta húmedo más (según lo que indicas)",
  "{list} and {n} more":"{list} y {n} más",
  "Cold tonight: down to {t}":"Frío esta noche: hasta {t}", "No action needed for the others.":"Para las demás no hace falta hacer nada.",
  "{lo} to {hi}, {rain} mm rain":"De {lo} a {hi}, {rain} mm de lluvia", "{lo} to {hi}, dry":"De {lo} a {hi}, sin lluvia",
  "Nothing to do in the garden today":"Hoy no hay nada que hacer en el jardín",
  "Frost warning: down to {t}":"Aviso de helada: hasta {t}", "Low temperature warning: down to {t}":"Aviso de frío: hasta {t}",
  "1 thing to do in the garden":"1 cosa que hacer en el jardín", "{n} things to do in the garden":"{n} cosas que hacer en el jardín",
  "Good morning":"Buenos días", "Good afternoon":"Buenas tardes", "Good evening":"Buenas noches",
  "Your garden is happy today. Nothing needs doing.":"Tu jardín está bien hoy. No hay nada que hacer.",
  "Your garden is mostly happy today.":"Tu jardín está bastante bien hoy.",
  "A cold night is coming.":"Llega una noche fría.", "Cold is coming.":"Llega el frío.", "A few plants need you today.":"Hoy algunas plantas te necesitan.",
  "Nothing else is urgent.":"Nada más es urgente.", "Using the forecast from {n} hours ago.":"Con la previsión de hace {n} horas.",
  "1 plant needs protection {when}":"1 planta necesita protección {when}", "{n} plants need protection {when}":"{n} plantas necesitan protección {when}",
  "Cover new growth on 1 plant {when}":"Cubre los brotes de 1 planta {when}", "Cover new growth on {n} plants {when}":"Cubre los brotes de {n} plantas {when}",
  "1 plant likely needs water":"1 planta seguramente necesita agua", "{n} plants likely need water":"{n} plantas seguramente necesitan agua",
  "1 more may need water soon":"1 más puede necesitar agua pronto", "{n} more may need water soon":"{n} más pueden necesitar agua pronto",
  "Rain is coming: skip watering 1 plant":"Viene lluvia: no riegues 1 planta", "Rain is coming: skip watering {n} plants":"Viene lluvia: no riegues {n} plantas",
  "Heat {when}: shade and water 1 pot early":"Calor {when}: sombra y riego temprano para 1 maceta", "Heat {when}: shade and water {n} pots early":"Calor {when}: sombra y riego temprano para {n} macetas",
  "Open the greenhouse {when}":"Abre el invernadero {when}",
  "Gusts {when}: secure 1 plant":"Rachas {when}: sujeta 1 planta", "Gusts {when}: secure {n} plants":"Rachas {when}: sujeta {n} plantas",
  "1 plant can go back outside":"1 planta puede volver fuera", "{n} plants can go back outside":"{n} plantas pueden volver fuera",
  "Get 1 plant ready to move this week":"Prepara 1 planta para moverla esta semana", "Get {n} plants ready to move this week":"Prepara {n} plantas para moverlas esta semana",
  "Tell Alvor when 1 plant was last watered":"Dile a Alvor cuándo regaste 1 planta", "Tell Alvor when {n} plants were last watered":"Dile a Alvor cuándo regaste {n} plantas"
};
const TABLES = {es:ES}, LOCALES = {en:"en-GB", es:"es-ES"};
let lang = "en";
function setLang(l){ lang = TABLES[l] ? l : "en"; }
function T(s, v){
  const r = (TABLES[lang] && TABLES[lang][s]) || s;
  return v ? r.replace(/\{(\w+)\}/g, (m, k) => k in v ? v[k] : m) : r;
}
const P = (n, one, many, v) => T(n === 1 ? one : many, {n, ...(v || {})});
const LOC = {inside:"Inside", outside:"Outside", greenhouse:"Greenhouse"};
const ALLOWED = {indoor:["inside"], outdoor:["outside"], mover:["outside","inside"], greenhouse:["outside","greenhouse"]};

const deg = n => `${Math.round(n)}°`;
const degCold = n => `${-Math.round(-n)}°`;   // a cold night is never rounded up: −2.5 shows as −3
const utc = s => Date.parse(s + "T12:00:00Z");
const daysBetween = (a, b) => Math.round((utc(b) - utc(a)) / 86400000);
const addDays = (s, n) => new Date(utc(s) + n * 86400000).toISOString().slice(0, 10);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const num = x => x !== null && x !== undefined && x !== "" && isFinite(+x);
const presetFor = s => PRESETS.find(p => p.s.toLowerCase() === String(s || "").trim().toLowerCase());
function when(date, today){
  const n = daysBetween(today, date);
  if(n === 0) return T("today");
  if(n === 1) return T("tomorrow");
  return weekday(date);
}
/* A day's low comes around dawn, so tomorrow's low is tonight's cold. */
const nightWord = (date, today, evening) => evening || daysBetween(today, date) === 1 ? T("tonight") : when(date, today);
const weekday = date => new Date(utc(date)).toLocaleDateString(LOCALES[lang] || "en-GB", {weekday:"long", timeZone:"UTC"});

/* ---------- Seasons ---------- */
/* Months as the northern hemisphere has them, so "summer" means summer south of the equator too. */
const seasonMonth = (m, s) => s && +s.lat < 0 ? ((m + 5) % 12) + 1 : m;
const seasonOf = m => [6,7,8,9].includes(m) ? "summer" : [12,1,2].includes(m) ? "winter" : "shoulder";
function interval(p, month){
  const ws = Math.max(1, +p.ws || 7), ww = Math.max(1, +p.ww || 14);
  const k = seasonOf(month);
  return k === "summer" ? ws : k === "winter" ? ww : Math.round((ws + ww) / 2);
}

/* ---------- Species traits ---------- */
function speciesKey(s){
  const w = String(s || "").toLowerCase().replace(/×/g, "x").replace(/['"‘’“”(].*$/, "").trim().split(/\s+/).filter(Boolean);
  return (w[1] === "x" ? w.slice(0, 3) : w.slice(0, 2)).join(" ");
}
const TR = Object.fromEntries(Object.entries(TRAITS).map(([k, v]) => [k.toLowerCase(), v]));
function traitsFor(species, genus){
  const sp = speciesKey(species), g = (String(genus || "").trim().toLowerCase().split(/\s+/)[0]) || sp.split(" ")[0];
  return {...(TR[g] || {}), ...(sp.includes(" ") ? TR[sp] || {} : {})};
}
function intervalsFor(species, genus){
  const t = traitsFor(species, genus);
  return t.d ? {...NEED_INTERVALS[t.d], need:t.d} : null;
}

/* ---------- Weather (one adapter for the app and the server) ---------- */
/* Open-Meteo today. extended asks for evapotranspiration, sunshine and hourly temperatures; if the service ever
   refuses those, fetchForecast asks again the old way, so the forecast never breaks because of them. */
const DAILY = "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_gusts_10m_max";
const EXTRA = "et0_fao_evapotranspiration,sunshine_duration";
function weatherUrl(lat, lon, opt){
  const o = opt || {};
  return `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    (o.app ? `&current=temperature_2m,weather_code,is_day,cloud_cover` : "") +
    `&daily=${DAILY}${o.app ? ",weather_code,sunrise,sunset" : ""}${o.basic ? "" : "," + EXTRA}` +
    (o.basic ? "" : "&hourly=temperature_2m") +
    `&past_days=7&forecast_days=8&timezone=auto`;
}
async function fetchForecast(fetchFn, lat, lon, opt){
  let r = await fetchFn(weatherUrl(lat, lon, opt));
  if(r.status === 400){ r = await fetchFn(weatherUrl(lat, lon, {...(opt || {}), basic:true})); }
  if(!r.ok) throw new Error("Forecast failed: " + r.status);
  return r.json();
}
function splitWeather(daily, today, hourly){
  if(!daily || !daily.time) return null;
  const idx = daily.time.indexOf(today);
  if(idx < 0) return null;
  const at = (k, i) => daily[k] && daily[k][i] != null ? daily[k][i] : null;
  const day = i => ({date:daily.time[i], min:daily.temperature_2m_min[i], max:daily.temperature_2m_max[i],
    rain:at("precipitation_sum", i) ?? 0, prob:at("precipitation_probability_max", i) ?? 0, gust:at("wind_gusts_10m_max", i) ?? 0,
    et0:at("et0_fao_evapotranspiration", i), sun:at("sunshine_duration", i)});
  const past = [], next = [];
  for(let i = 0; i < idx; i++) past.push(day(i));
  for(let i = idx; i < Math.min(idx + 7, daily.time.length); i++) next.push(day(i));
  const h = hourly && hourly.time && hourly.temperature_2m ? {time:hourly.time, t:hourly.temperature_2m} : null;
  return {past, next, hourly:h};
}
/* Reference evapotranspiration estimated from the temperatures alone (Hargreaves), for days the forecast didn't give it. */
function hargreaves(d, lat, date){
  if(!d || !num(d.min) || !num(d.max) || !num(lat)) return null;
  const J = Math.round((utc(date) - Date.UTC(+date.slice(0, 4), 0, 0)) / 86400000);
  const phi = +lat * Math.PI / 180, dr = 1 + 0.033 * Math.cos(2 * Math.PI * J / 365), dec = 0.409 * Math.sin(2 * Math.PI * J / 365 - 1.39);
  const ws = Math.acos(clamp(-Math.tan(phi) * Math.tan(dec), -1, 1));
  const Ra = 24 * 60 / Math.PI * 0.082 * dr * (ws * Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.sin(ws));
  return Math.max(0, 0.0023 * 0.408 * Ra * ((d.max + d.min) / 2 + 17.8) * Math.sqrt(Math.max(0, d.max - d.min)));
}
/* Hours of the night before `date` (18:00 to 10:00) colder than `thr`, or null when there are no hourly figures. */
function nightHours(W, date, thr, bonus){
  if(!W || !W.hourly) return null;
  const from = addDays(date, -1) + "T18:00", to = date + "T10:00";
  let n = 0, seen = 0;
  W.hourly.time.forEach((t, i) => { if(t >= from && t <= to && num(W.hourly.t[i])){ seen++; if(+W.hourly.t[i] + bonus < thr) n++; } });
  return seen ? n : null;
}

/* ---------- Where a plant is ---------- */
function placeOf(p){
  const m = p.micro || {}, area = p.area || (p.current === "inside" ? "house" : p.current || "outside");
  return {area, inside:p.current === "inside", gh:p.current === "greenhouse", porch:area === "porch", balcony:area === "balcony",
    pot:p.planting !== "ground", sun:p.sun === "partial" ? "partial" : p.sun === "none" ? "none" : "full",
    wall:!!m.wall, tree:!!m.tree, wind:m.wind === "exposed" || m.wind === "sheltered" ? m.wind : "", pm:!!m.pm};
}
const outdoors = P => !P.inside && !P.gh;
function rainReach(p){
  const P = placeOf(p), R = RULES.water.reach;
  if(P.inside || P.gh || P.porch || p.rainCounts === false) return 0;
  if(P.balcony) return p.rainCounts ? R.balcony : 0;
  let k = R.open;
  if(P.wall) k = Math.min(k, R.wall);
  if(P.tree) k = Math.min(k, R.tree);
  return k;
}
/* How much warmer than the forecast a plant's spot stays on a cold night. */
function frostBonus(p, s){
  const P = placeOf(p), B = RULES.frost.bonus;
  if(P.inside) return 0;
  if(P.gh) return +s.gh || 0;
  let b = 0;
  if(P.porch) b += B.porch;
  if(P.balcony) b += B.balcony;
  if(P.wall) b += B.wall;
  if(P.tree) b += B.tree;
  if(P.wind === "sheltered") b += B.sheltered;
  return Math.min(b, B.max);
}
const effMin = (p, d, s) => d.min + frostBonus(p, s);
/* Cold warnings are per plant: off when the owner switched them off, or when no limit is set. */
const coldOn = p => p.coldAlert !== false && num(p.minTemp);
const coldLimit = (p, s) => +p.minTemp + +s.margin + (p.planting === "pot" && p.current === "outside" ? RULES.frost.pot : 0);

/* ---------- Watering ---------- */
/* What feedback taught Alvor: this plant's own factor, or else the factor of other plants in the same spot. */
function learned(p, plants){
  const L = RULES.water.learn, c = p.care || {};
  if(c.n && num(c.k)) return {k:clamp(+c.k, L.min, L.max), from:"plant"};
  const peers = (plants || []).filter(q => q !== p && q.id !== p.id && q.zone && q.zone === p.zone && q.planting === p.planting && q.care && q.care.n && num(q.care.k));
  if(!peers.length) return {k:1, from:null};
  const k = Math.exp(peers.reduce((a, q) => a + Math.log(clamp(+q.care.k, L.min, L.max)), 0) / peers.length);
  return {k, from:"spot"};
}
const STAGES = ["ok","soon","consider","likely","urgent"];
const STAGE_TEXT = {ok:"No need", soon:"Probably not yet", consider:"Consider watering", likely:"Likely needs water", urgent:"Needs attention", unknown:"Not sure yet"};
function stageOf(d){
  const S = RULES.water.stages;
  return d >= S.urgent ? "urgent" : d >= S.likely ? "likely" : d >= S.consider ? "consider" : d >= S.soon ? "soon" : "ok";
}
/* The estimated state of one plant's water by the end of today.
   d: how much of its reserve is used (0 just watered, 1 = its interval in typical weather). */
function waterState(p, W, ctx, plants){
  const s = ctx.settings || {}, today = ctx.today, Rw = RULES.water, P = placeOf(p);
  const sm = seasonMonth(ctx.month, s), iv = interval(p, sm);
  const care = p.care || {}, snoozed = !!(care.snooze && care.snooze >= today);
  let anchor = p.lastWatered ? {date:p.lastWatered, d:0, kind:"water"} : null;
  if(care.check && care.check.date && (!anchor || care.check.date > anchor.date)) anchor = {date:care.check.date, d:num(care.check.d) ? +care.check.d : 0, kind:"check"};
  if(!anchor && W){   // nothing logged, but a real rain reached it: that was a watering
    const reach0 = rainReach(p), full = +s.rain || 5;
    for(let i = W.past.length - 1; i >= 0 && reach0 > 0; i--)
      if(Math.max(0, W.past[i].rain - Rw.interception) * reach0 >= full){ anchor = {date:W.past[i].date, d:0, kind:"rain"}; break; }
  }
  if(!anchor) return {stage:"unknown", label:T(STAGE_TEXT.unknown), d:null, days:null, iv, byRain:false, snoozed, reasons:[T("no watering logged yet")]};

  const days = Math.max(0, daysBetween(anchor.date, today));
  const byDate = new Map(W ? [...W.past, ...W.next].map(x => [x.date, x]) : []);
  const reach = rainReach(p), L = learned(p, plants);
  const spotK = (outdoors(P) || P.gh ? Rw.sun[P.sun] : 1) * (P.gh ? Rw.greenhouse : 1) *
    (outdoors(P) ? (P.wall ? Rw.micro.wall : 1) * (P.tree ? Rw.micro.tree : 1) * (P.wind ? Rw.micro[P.wind] : 1) * (P.pm ? Rw.micro.pm : 1) : 1);
  let d = anchor.d, rainMm = 0, lastFull = anchor.kind === "rain" ? anchor.date : null, lastRain = null, hottest = null, windiest = 0, etW = 0, refW = 0, hotDays = 0;
  for(let i = 1; i <= days; i++){
    const date = addDays(anchor.date, i), m = seasonMonth(+date.slice(5, 7), s);
    const ref = Rw.refEt[seasonOf(m)], ivm = interval(p, m), day = byDate.get(date);
    let use = ref;
    if(!P.inside){
      const et = day ? (num(day.et0) ? +day.et0 : hargreaves(day, s.lat, date)) : null;
      const hot = day && day.max >= Rw.hot.from ? (P.pot ? Rw.hot.pot : Rw.hot.ground) : 1;
      if(day && day.max >= Rw.hot.from) hotDays++;
      use = Math.max(0.1 * ref, ref + ((et == null ? ref : et) - ref) * spotK) * hot;
      if(et != null){ etW += et; refW += ref; }
      if(day){ if(!hottest || day.max >= hottest.max) hottest = day; windiest = Math.max(windiest, day.gust || 0); }
    }
    d += use * L.k / (ivm * ref);
    if(date < today && reach > 0 && day){
      const eff = Math.max(0, (day.rain || 0) - Rw.interception) * reach;
      if(eff > 0){ d = Math.max(0, d - eff / Math.max(1, +s.rain || 5)); rainMm += eff; lastRain = date; if(eff >= (+s.rain || 5)) lastFull = date; }
    }
  }
  d = Math.round(d * 1000) / 1000;
  const stage = stageOf(d), ratio = refW ? etW / refW : 1;
  /* Why: only the things that moved the estimate. */
  const why = [];
  const since = lastFull ? daysBetween(lastFull, today) : days;
  if(lastFull) why.push(T("rain on {day} counted as watering", {day:weekday(lastFull)}));
  else if(anchor.kind === "water") why.push(days === 0 ? T("watered today") : days === 1 ? T("1 day since watering") : T("{n} days since watering", {n:days}));
  else why.push(days === 0 ? T("checked today") : days === 1 ? T("1 day since you checked it") : T("{n} days since you checked it", {n:days}));
  if(!P.inside && days > 0){
    if(hottest && hottest.max >= 25) why.push(hottest.date === today ? T("{t} today", {t:deg(hottest.max)}) : T("up to {t}", {t:deg(hottest.max)}));
    else if(ratio >= 1.2) why.push(T("drying weather"));
    else if(ratio <= 0.8) why.push(T("cool, damp weather"));
    if(windiest >= 45 && outdoors(P)) why.push(T("windy"));
  }
  if(!P.inside){
    if(P.gh) why.push(T("in the greenhouse"));
    else if(reach === 0) why.push(T("rain doesn't reach it"));
    else if(reach < 1 && rainMm < 3) why.push(T("little rain reaches it"));
    else if(rainMm < 1 && since >= 3) why.push(T("no real rain in {n} days", {n:since}));
    else if(rainMm >= 1 && !lastFull) why.push(T("{n} mm of rain helped", {n:Math.round(rainMm)}));
    const unusual = hotDays || ratio >= 1.1;   // the spot only matters on days that dry more than usual
    if(unusual && !P.gh) why.push(T(P.sun === "partial" ? "partial sun" : P.sun === "none" ? "shade" : "full sun"));
    if(hotDays && !P.gh) why.push(P.pot ? T("in a pot") : T("in the ground"));
    if(P.pm && outdoors(P) && unusual) why.push(T("afternoon sun"));
  }else why.push(T("indoors"));
  if(L.k >= 1.1 || L.k <= 0.9){
    const faster = L.k > 1;
    why.push(L.from === "plant" ? T(faster ? "dries faster than expected (your feedback)" : "stays moist longer than expected (your feedback)")
      : T(faster ? "this spot dries faster (your feedback)" : "this spot stays moist longer (your feedback)"));
  }
  why.push(T("usually every {n} days", {n:iv}));
  return {stage, label:T(STAGE_TEXT[stage]), d, days:since, iv, byRain:!!lastFull, last:lastFull || anchor.date, anchor:anchor.kind, snoozed, k:L.k, reasons:why};
}
/* The old shape, for screens that only need "due" and the days. */
function waterStatus(p, W, ctx, plants){
  const st = waterState(p, W, ctx, plants);
  return {...st, due:st.stage === "unknown" || STAGES.indexOf(st.stage) >= STAGES.indexOf("likely")};
}
/* Feedback on a watering suggestion: "water" (Watered), "wet" (Already wet), "fine" (Looks fine), "later".
   Returns what changes on the plant and a history line carrying Alvor's estimate at that moment,
   so the rules can later be checked against what really happened in this garden. */
function feedback(p, kind, W, ctx, plants, opt){
  const o = opt || {}, Rw = RULES.water, L = Rw.learn, today = ctx.today;
  const st = waterState(p, W, ctx, plants), est = st.d == null ? null : Math.round(st.d * 100) / 100;
  const care = {...(p.care || {})}, patch = {};
  let k = num(care.k) ? +care.k : 1, learnt = false, detail = "Watered";
  if(kind === "water"){
    patch.lastWatered = today; delete care.snooze;
    if(o.single && est != null && est >= 0.5 && est < Rw.stages.consider){ k *= L.early; learnt = true; }
  }else if(kind === "wet"){
    detail = "Already wet"; care.check = {date:today, d:0}; delete care.snooze;
    if(est != null && est >= Rw.stages.consider){ k *= L.wet; learnt = true; }
  }else if(kind === "fine"){
    detail = "Looks fine"; care.check = {date:today, d:Rw.fine}; delete care.snooze;
    if(est != null && est >= Rw.stages.consider){ k *= L.fine; learnt = true; }
  }else{ detail = "Later"; care.snooze = today; }
  if(learnt){ care.k = Math.round(clamp(k, L.min, L.max) * 1000) / 1000; care.n = (+care.n || 0) + 1; }
  patch.care = care;
  return {patch, log:{type:kind === "water" ? "water" : "care", detail, est, stage:st.stage, k:care.k || 1}};
}

/* ---------- Frost plan for one plant ---------- */
const COLD_KEYS = ["bringIn","toGh","ghProtect","potProtect","crownProtect","mulchRoots","groundProtect","springGrowth"];
function frostAction(p, t, s, hasGh){
  const P = placeOf(p), Tr = traitsFor(p.species, p.genus), min = +p.minTemp, short = min - t;
  const tender = min >= 0;
  if(P.gh) return {key:"ghProtect"};
  if(P.pot){
    if(p.pattern === "mover" || p.pattern === "indoor") return {key:"bringIn", move:"inside"};
    if(p.pattern === "greenhouse" && hasGh) return {key:"toGh", move:"greenhouse"};
    if(short >= RULES.frost.bringIn || tender) return {key:"bringIn", move:"inside"};
    return {key:"potProtect"};
  }
  if(num(Tr.r) && t >= Tr.r + RULES.frost.rootSafety) return {key:"mulchRoots", roots:Tr.r};
  if(Tr.c) return {key:"crownProtect"};
  return {key:"groundProtect", hopeless:tender && short >= 4};
}

/* ---------- All alerts ---------- */
const ORDER = [...COLD_KEYS, "frostOk", "vent", "heat", "wind", "water", "rainWill", "waterUnknown", "plan", "goOut"];
const RANK = {danger:0, warn:1, heat:2, wind:3, water:4, info:5};
const BASE = {
  bringIn:() => ({title:T("Bring inside"), text:T("Cold is coming that these can't take outside."), move:"inside"}),
  toGh:() => ({title:T("Move to the greenhouse"), text:T("Cold is coming that these can't take outside."), move:"greenhouse"}),
  ghProtect:t => ({title:T("Protect in the greenhouse"), text:T("The greenhouse could drop to about {t}. Add fleece or turn on a heater.", {t:degCold(t)})}),
  potProtect:() => ({title:T("Shelter the pots"), text:T("Move them against a house wall, lift them off the ground and wrap the pots.")}),
  crownProtect:() => ({title:T("Protect the crown"), text:T("Cover the top with fleece and pack the crown with straw. The growing point is the part that mustn't freeze.")}),
  mulchRoots:() => ({title:T("Mulch the roots"), text:T("The leaves or trunk may be damaged, but the roots should survive under a thick mulch. Wrap the stem if you want to keep it.")}),
  groundProtect:() => ({title:T("Protect plants in the ground"), text:T("Cover them with fleece overnight and mulch the base.")}),
  springGrowth:() => ({title:T("Cover new growth"), text:T("A light frost can kill fresh shoots and blossom. Fleece overnight is enough.")})
};
function placeWhy(p){
  const P = placeOf(p), w = [];
  if(P.porch) w.push(T("on the porch"));
  if(P.balcony) w.push(T("on the balcony"));
  if(P.wall) w.push(T("against a wall"));
  if(P.tree) w.push(T("under a tree"));
  if(P.wind === "sheltered") w.push(T("sheltered"));
  return w;
}
/* Frost and heat for one forecast day, for the badges on the forecast and the chips on Home. */
function dayRisks(plants, d, s){
  const frost = plants.filter(p => p.current !== "inside" && coldOn(p) && effMin(p, d, s) < coldLimit(p, s));
  const heat = plants.filter(p => heatHit(p, d.max, s) || (p.current === "greenhouse" && d.max + RULES.heat.greenhouse >= RULES.heat.ghVent));
  return {frost, heat};
}
function heatHit(p, max, s){
  const P = placeOf(p);
  if(!outdoors(P) || !P.pot) return false;
  const lim = +s.heat - (P.pm ? RULES.heat.pm : 0);
  return P.sun === "full" ? max >= lim : P.sun === "partial" ? max >= lim + RULES.heat.partial : false;
}

function compute(plants, ctx){
  if(ctx.lang) setLang(ctx.lang);
  const s = ctx.settings, W = splitWeather(ctx.daily, ctx.today, ctx.hourly), groups = {};
  const evening = ctx.mode === "evening", sm = seasonMonth(ctx.month, s);
  const hasGh = s.home !== "apartment";
  const add = (key, base, item) => {
    const g = (groups[key] ||= {...base, items:[]});
    if(RANK[base.level] < RANK[g.level]) g.level = base.level;
    g.items.push({...item, why:(item.reasons || []).join(" · ") || item.why || ""});
  };

  if(W){
    // Evening: tonight's low is tomorrow's daily minimum. Full: today and the next two days.
    const look = evening ? W.next.slice(1, 2) : W.next.slice(0, 3);
    const coldIds = new Set(), near = [];
    let freezing = look.some(d => d.min <= 0);
    for(const p of plants){
      if(p.current === "inside" || !coldOn(p)) continue;
      const bonus = frostBonus(p, s);
      let worst = null;
      for(const d of look){ const t = d.min + bonus; if(!worst || t < worst.t) worst = {t, date:d.date}; }
      if(!worst) continue;
      const lim = coldLimit(p, s), whenTxt = nightWord(worst.date, ctx.today, evening);
      if(worst.t >= lim){
        const Tr = traitsFor(p.species, p.genus);
        if(RULES.frost.spring.includes(sm) && num(Tr.s) && outdoors(placeOf(p)) && worst.t <= Tr.s + 1){
          coldIds.add(p.id); freezing = true;
          add("springGrowth", {...BASE.springGrowth(), level:"warn"}, {p, t:worst.t, date:worst.date, reasons:[T("{t} {when}, takes {min}", {t:degCold(worst.t), when:whenTxt, min:deg(Tr.s)}), T("new growth")]});
        }else if(worst.t < lim + RULES.frost.okWithin) near.push({p, t:worst.t, date:worst.date});
        continue;
      }
      coldIds.add(p.id);
      const A = frostAction(p, worst.t, s, hasGh), min = +p.minTemp;
      const level = worst.t < min + (p.planting === "pot" && p.current === "outside" ? RULES.frost.pot : 0) ? "danger" : "warn";
      const reasons = [T("{t} {when}, takes {min}", {t:degCold(worst.t), when:whenTxt, min:deg(min)})];
      const hrs = nightHours(W, worst.date, min, bonus);
      if(hrs) reasons.push(T("for {n} hours", {n:hrs}));
      if(A.key === "mulchRoots") reasons.push(T("roots take {t}", {t:deg(A.roots)}));
      reasons.push(...placeWhy(p));
      const Tr = traitsFor(p.species, p.genus);
      if(Tr.w && W.next.slice(0, 3).some(d => d.rain >= 2)) reasons.push(T("keep rain off it"));
      if(A.hopeless) reasons.push(T("may not survive outside"));
      add(A.key, {...BASE[A.key](worst.t), level}, {p, t:worst.t, date:worst.date, act:A.key, reasons});
    }
    // Reassurance: when it freezes or plants need protecting, say which ones are fine as they are.
    if(coldIds.size || freezing) near.filter(x => !coldIds.has(x.p.id)).forEach(({p, t, date}) =>
      add("frostOk", {title:T("No action needed"), text:T("These stay within what they take."), level:"info"}, {p, t, date, reasons:[T("{t} {when}, takes {min}", {t:degCold(t), when:nightWord(date, ctx.today, evening), min:deg(p.minTemp)}), ...placeWhy(p)].slice(0, 2)}));

    if(!evening){
      for(const p of plants){
        if(coldIds.has(p.id) || !coldOn(p)) continue;
        const movable = p.pattern === "mover" || p.pattern === "greenhouse";
        if(p.current === "outside" && p.planting === "pot" && movable && sm >= 8 && sm <= 11){
          const hit = W.next.slice(3).find(d => effMin(p, d, s) < coldLimit(p, s) + 2);
          if(hit) add("plan", {level:"info", title:T("Get ready to move soon"), text:T("Nights are getting close to their limit later this week.")},
            {p, reasons:[`${deg(effMin(p, hit, s))} ${when(hit.date, ctx.today)}`, T("takes {t}", {t:deg(p.minTemp)})]});
        }
        const sheltered = (p.current === "inside" && p.pattern === "mover") || (p.current === "greenhouse" && p.pattern === "greenhouse");
        if(sheltered && sm >= 3 && sm <= 6 && W.next.length){
          const lowest = Math.min(...W.next.map(d => d.min));
          if(lowest >= +p.minTemp + +s.margin + 3)
            add("goOut", {level:"info", title:T("Safe to move outside"), text:T("No night this week drops below {t}.", {t:deg(lowest)}), move:"outside"},
              {p, reasons:[T("takes {t}", {t:deg(p.minTemp)})]});
        }
      }

      const hottest = look.reduce((a, d) => !a || d.max > a.max ? d : a, null);
      if(hottest){
        plants.filter(p => heatHit(p, hottest.max, s)).forEach(p => {
          const P = placeOf(p);
          add("heat", {level:"heat", title:T("Hot spell"), text:T("{t} {when}. Water these early in the morning and give them shade where you can.", {t:deg(hottest.max), when:when(hottest.date, ctx.today)}), date:hottest.date},
            {p, reasons:[P.pm ? T("pot in afternoon sun") : P.sun === "partial" ? T("pot in partial sun") : T("pot in the sun")]});
        });
        if(hottest.max + RULES.heat.greenhouse >= RULES.heat.ghVent)
          plants.filter(p => p.current === "greenhouse").forEach(p =>
            add("vent", {level:"heat", title:T("Open the greenhouse"), text:T("Outside will reach {t}; the greenhouse gets much hotter. Open vents or the door.", {t:deg(hottest.max)}), date:hottest.date}, {p, reasons:[T("in the greenhouse")]}));
      }
      const windy = look.reduce((a, d) => !a || d.gust > a.gust ? d : a, null);
      if(windy && windy.gust >= +s.wind){
        plants.forEach(p => {
          const P = placeOf(p), Tr = traitsFor(p.species, p.genus);
          if(!outdoors(P) || P.porch) return;
          if(P.wind === "sheltered" && windy.gust < +s.wind + RULES.wind.sheltered) return;
          const why = [];
          if(P.pot) why.push(T("pot"));
          if(Tr.b) why.push(T("big leaves tear"));
          if(P.wind === "exposed") why.push(T("windy spot"));
          if(!why.length) return;   // a plant in the ground, in a normal spot, rides out a gust
          add("wind", {level:"wind", title:T("Strong gusts"), text:T("Up to {n} km/h {when}. Secure pots, stake tall plants, close the greenhouse.", {n:Math.round(windy.gust), when:when(windy.date, ctx.today)}), date:windy.date}, {p, reasons:why});
        });
      }
    }
  }

  if(!evening){
    const soon = W ? W.next.slice(0, 2).reduce((a, d) => a + (d.prob >= RULES.water.rainSkip.prob ? Math.max(0, d.rain - RULES.water.interception) : 0), 0) : 0;
    for(const p of plants){
      const st = waterState(p, W, ctx, plants);
      if(st.snoozed) continue;
      if(st.stage === "unknown"){ add("waterUnknown", {level:"info", title:T("Not sure about these"), text:T("Alvor doesn't know when these were last watered. Tell it once and it follows them from there."), feedback:["water","fine"]}, {p, stage:st.stage, reasons:st.reasons}); continue; }
      if(st.stage !== "likely" && st.stage !== "urgent") continue;
      const reach = rainReach(p);
      if(reach > 0 && st.stage !== "urgent" && soon * reach >= (+s.rain || 5) * Math.min(1, st.d))
        add("rainWill", {level:"info", title:T("Skip these, rain is coming"), text:T("About {n} mm expected over the next two days.", {n:Math.round(soon)})}, {p, stage:st.stage, reasons:st.reasons});
      else
        add("water", {level:"water", title:T("Needs water"), text:"", waterAll:true, feedback:["water","wet","fine","later"]}, {p, stage:st.stage, d:st.d, reasons:st.reasons});
    }
    if(groups.water) groups.water.items.sort((a, b) => b.d - a.d);
  }

  return ORDER.filter(k => groups[k]).map(k => ({key:k, ...groups[k]}))
    .sort((a, b) => RANK[a.level] - RANK[b.level]);
}

/* ---------- Garden today: what matters now ---------- */
/* lines: {kind:"frost"|"heat"|"wind"|"water"|"rain"|"soon"|"move"|"unknown", text, ids, urgent}. */
function gardenToday(groups, plants, ctx){
  if(ctx.lang) setLang(ctx.lang);
  const s = ctx.settings, W = splitWeather(ctx.daily, ctx.today, ctx.hourly);
  const h = num(ctx.hour) ? +ctx.hour : 8;
  const greet = T(h < 12 ? "Good morning" : h < 19 ? "Good afternoon" : "Good evening");
  const by = k => groups.filter(g => (Array.isArray(k) ? k : [k]).includes(g.key));
  const ids = gs => [...new Set(gs.flatMap(g => g.items.map(i => i.p.id)))];
  const lines = [];
  const cold = by(COLD_KEYS.filter(k => k !== "springGrowth")), spring = by("springGrowth");
  if(cold.length){
    const items = cold.flatMap(g => g.items), first = items.reduce((a, i) => !a || i.date < a.date ? i : a, null);
    const w = first && first.date ? nightWord(first.date, ctx.today, ctx.mode === "evening") : T("tonight");
    const n = ids(cold).length;
    lines.push({kind:"frost", urgent:true, ids:ids(cold), text:P(n, "1 plant needs protection {when}", "{n} plants need protection {when}", {when:w})});
  }
  if(spring.length){ const n = ids(spring).length, i = spring[0].items[0];
    lines.push({kind:"frost", urgent:false, ids:ids(spring), text:P(n, "Cover new growth on 1 plant {when}", "Cover new growth on {n} plants {when}", {when:i.date ? nightWord(i.date, ctx.today) : T("tonight")})}); }
  const heat = by("heat"); if(heat.length){ const n = ids(heat).length;
    lines.push({kind:"heat", urgent:true, ids:ids(heat), text:P(n, "Heat {when}: shade and water 1 pot early", "Heat {when}: shade and water {n} pots early", {when:heat[0].date ? when(heat[0].date, ctx.today) : T("today")})}); }
  const vent = by("vent"); if(vent.length) lines.push({kind:"heat", urgent:true, ids:ids(vent), text:T("Open the greenhouse {when}", {when:vent[0].date ? when(vent[0].date, ctx.today) : T("today")})});
  const wind = by("wind"); if(wind.length){ const n = ids(wind).length;
    lines.push({kind:"wind", urgent:true, ids:ids(wind), text:P(n, "Gusts {when}: secure 1 plant", "Gusts {when}: secure {n} plants", {when:wind[0].date ? when(wind[0].date, ctx.today) : T("today")})}); }
  const water = by("water"); if(water.length){ const n = ids(water).length;
    lines.push({kind:"water", urgent:water[0].items.some(i => i.stage === "urgent"), ids:ids(water), text:P(n, "1 plant likely needs water", "{n} plants likely need water")}); }
  const rain = by("rainWill"); if(rain.length){ const n = ids(rain).length;
    lines.push({kind:"rain", urgent:false, ids:ids(rain), text:P(n, "Rain is coming: skip watering 1 plant", "Rain is coming: skip watering {n} plants")}); }
  const soonIds = plants.filter(p => { const st = waterState(p, W, ctx, plants); return !st.snoozed && st.stage === "consider"; }).map(p => p.id);
  if(soonIds.length) lines.push({kind:"soon", urgent:false, ids:soonIds, text:P(soonIds.length, "1 more may need water soon", "{n} more may need water soon")});
  const out = by("goOut"); if(out.length){ const n = ids(out).length; lines.push({kind:"move", urgent:false, ids:ids(out), text:P(n, "1 plant can go back outside", "{n} plants can go back outside")}); }
  const plan = by("plan"); if(plan.length){ const n = ids(plan).length; lines.push({kind:"move", urgent:false, ids:ids(plan), text:P(n, "Get 1 plant ready to move this week", "Get {n} plants ready to move this week")}); }
  const unk = by("waterUnknown"); if(unk.length){ const n = ids(unk).length; lines.push({kind:"unknown", urgent:false, ids:ids(unk), text:P(n, "Tell Alvor when 1 plant was last watered", "Tell Alvor when {n} plants were last watered")}); }

  const urgent = lines.some(l => l.urgent);
  const head = !lines.length ? T("Your garden is happy today. Nothing needs doing.")
    : cold.length ? T(cold.some(g => g.items.some(i => i.date && daysBetween(ctx.today, i.date) <= 1)) ? "A cold night is coming." : "Cold is coming.")
    : urgent ? T("A few plants need you today.") : T("Your garden is mostly happy today.");
  const t = W && W.next[0];
  const weather = t ? (t.rain >= 0.5 ? T("{lo} to {hi}, {rain} mm rain", {lo:deg(t.min), hi:deg(t.max), rain:Math.round(t.rain)}) : T("{lo} to {hi}, dry", {lo:deg(t.min), hi:deg(t.max)})) : "";
  const age = num(ctx.weatherAt) && num(ctx.now) ? Math.floor((+ctx.now - +ctx.weatherAt) / 3600000) : 0;
  return {greet, head, lines, calm:lines.length ? T("Nothing else is urgent.") : "", weather, stale:age >= 12 ? T("Using the forecast from {n} hours ago.", {n:age}) : ""};
}

/* ---------- Phone notifications ---------- */
/* Short text for a phone notification. Returns null when there is nothing worth sending.
   Quiet groups (not sure about watering, nothing to do) never cause a notification. */
const QUIET = ["frostOk", "waterUnknown"];
function summarize(groups, ctx){
  if(ctx.lang) setLang(ctx.lang);
  const W = splitWeather(ctx.daily, ctx.today, ctx.hourly);
  const evening = ctx.mode === "evening";
  const loud = groups.filter(g => !QUIET.includes(g.key));
  const lines = loud.map(g => {
    const names = g.items.map(i => i.p.name);
    const list = names.length > 4 ? T("{list} and {n} more", {list:names.slice(0, 4).join(", "), n:names.length - 4}) : names.join(", ");
    return `${g.title}: ${list}`;
  });
  const cold = loud.filter(g => COLD_KEYS.includes(g.key));
  const lowest = cold.length ? Math.min(...cold.flatMap(g => g.items.map(i => i.t))) : null;
  if(evening){
    if(!cold.length) return null;
    const ok = groups.some(g => g.key === "frostOk");
    return {title:T("Cold tonight: down to {t}", {t:degCold(lowest)}), body:[...lines, ok ? T("No action needed for the others.") : ""].filter(Boolean).join("\n"), tag:"garden-evening"};
  }
  const t = W && W.next[0];
  const wLine = t ? (t.rain >= 0.5 ? T("{lo} to {hi}, {rain} mm rain", {lo:deg(t.min), hi:deg(t.max), rain:Math.round(t.rain)}) : T("{lo} to {hi}, dry", {lo:deg(t.min), hi:deg(t.max)})) : "";
  if(!loud.length) return {title:T("Nothing to do in the garden today"), body:wLine, tag:"garden-morning"};
  const title = cold.length ? T(lowest <= 0 ? "Frost warning: down to {t}" : "Low temperature warning: down to {t}", {t:degCold(lowest)})
    : loud.length === 1 ? T("1 thing to do in the garden") : T("{n} things to do in the garden", {n:loud.length});
  return {title, body:[...lines, wLine].filter(Boolean).join("\n"), tag:"garden-morning"};
}

return {VERSION, RULES, TRAITS, setLang, ES, PRESETS, LOC, ALLOWED, deg, degCold, nightWord, daysBetween, addDays, presetFor, speciesKey, traitsFor, intervalsFor,
  weatherUrl, fetchForecast, splitWeather, hargreaves, nightHours, seasonMonth, interval, placeOf, rainReach, frostBonus,
  waterState, waterStatus, feedback, learned, STAGES, STAGE_TEXT, effMin, coldLimit, coldOn, frostAction, dayRisks, heatHit,
  compute, gardenToday, summarize, COLD_KEYS};
});
