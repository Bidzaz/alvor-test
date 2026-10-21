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
   - Your garden's own nights: on clear, calm nights the cold at plant height is lower than the forecast's 2 m air
     temperature, and every garden has its frost pockets. Alvor plans for that (RULES.frost.clearNight) until it has
     learned your garden from what you tell it ("Did it freeze last night?", a thermometer reading): settings.calib.
   - Protection stays on: "Mark as protected" (fleece, mulch, wrapped pots) is remembered from the journal until you
     take it off, so a protected plant isn't warned again, and Alvor says when the cold has passed.
   - The morning after a risk night Alvor asks how the plants did (Fine, Damaged, Lost): a plant damaged at a
     temperature it was supposed to take is warned earlier next time.
   - Winter storage: a dark, frost-free place (garage, cellar, shed) for dormant plants: no watering or feeding
     reminders, only a warning when the storage itself gets too cold.
   - Garden today: what matters now, in a few lines, and plainly when nothing else is urgent.
   - Your own tasks (settings.tasks: buy compost, plant bulbs…) sit next to Alvor's: due ones join Garden today and the
     morning notification.
   Every number is in RULES, so a rule that an experienced gardener disagrees with is one edit.
   Texts are English in the code and Spanish in ES below (the server has no other tables). */
(function(root, factory){
  const lib = factory();
  if(typeof module === "object" && module.exports) module.exports = lib;
  else root.GardenAlerts = lib;
})(typeof self !== "undefined" ? self : this, function(){
"use strict";
const VERSION = "2026-10-21.care-9";

/* What Alvor knows about each kind of plant (lowest temperature, traits, watering) lives in plant-kb.js:
   in the browser it is loaded before this file, in notify it is copied in above it, in the tests it is required. */
const KB = typeof AlvorKB !== "undefined" ? AlvorKB : require("./plant-kb.js");

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
    okWithin:4,                                       // "no action needed" lists plants within this of their limit
    roomCold:5,                                       // a night this cold outside brings rooms down to their lowest (Locations)
    /* Clear, calm nights: the ground and the plants lose heat to the open sky and get colder than the 2 m air
       temperature the forecast gives. Used until the garden's own calibration knows better. */
    clearNight:1, clear:{cloud:30, wind:10}           // °C colder; a clear night: cloud below 30 %, wind below 10 km/h
  },
  /* Your garden's own nights (settings.calib): what you told Alvor after cold nights. An answer counts for this long,
     at least min answers of a kind of night are needed before they replace the default, and the learned difference
     stays within lim. A "Yes, it froze" when the forecast said above 0 counts as about −0.5 °C, a "No" when it said
     below 0 as about +0.5 °C. */
  calib:{keep:730, min:2, lim:[-6, 3], froze:-0.5, notFrozen:0.5, max:40},
  /* Protection (fleece, wrapping, mulch) counts for this many days after "Mark as protected", until "Taken off".
     Alvor suggests taking it off once this many nights ahead stay this far above the plant's limit. */
  protect:{keep:60, off:5, offMargin:3},
  /* Winter storage (a garage, cellar or shed): its lowest on cold nights when not set, and the outside cold that
     brings it there (as rooms). */
  store:{low:4},
  /* The morning after: plants this close to their limit last night are asked about too. */
  after:{near:2},
  heat:{partial:3, pm:2, greenhouse:8, ghVent:35},
  /* Acclimatisation: a plant that just left the house or the greenhouse has soft growth that isn't used to cold nights,
     wind or strong sun yet. Hardening off (in and out for a night or two) counts as one move out. */
  settle:{
    days:14,                                          // settling in lasts this long after moving out
    cold:2,                                           // …and the plant counts as this much more tender meanwhile
    sunDays:10,                                       // from shade into full sun: leaves can scorch for this long
    sunHours:6, sunMax:18,                            // a sunny day: this many hours of sunshine and at least this warm
    noData:{max:22, prob:40}                          // without sunshine hours in the forecast: this warm and rain this unlikely
  },
  /* Hardy plants harden as autumn cools and soften in a mild spell: the first cold after a mild week hits harder
     than the same cold in midwinter. Tropical plants never harden, so this is only for plants that take frost. */
  harden:{days:7, mild:8, cold:1, upTo:0, months:[9,10,11,12,1,2]},   // autumn and winter (spring frosts: "Cover new growth")
  wind:{sheltered:20},
  /* Feeding: days between feeds in the growing season, by how much feed the plant wants (plant-kb.js trait f:
     0 none, 1 light, 2 regular, 3 heavy). 0 means never, 365 means once a year, early in the season. In the ground
     roots find most of what they need: light feeders get nothing and regular ones a spring feed. */
  feed:{
    pot:{0:0, 1:28, 2:14, 3:7}, ground:{0:0, 1:0, 2:365, 3:21},
    season:{from:3, to:9, fromDry:4},                 // growing season (hemisphere-adjusted); succulents start a month later
    winter:2,                                         // "Keep feeding in winter" (grow lights, heated rooms): half as often
    soon:3,                                           // the plant sheet says "soon" this many days before
    spring:3,                                         // a once-a-year feed is due in the first months of the season
    fresh:42                                          // fresh compost after repotting feeds a plant for about six weeks
  },
  /* Repotting (pots only): every plant-kb.js rp years, in spring, counted from the last "Repotted" in the journal
     (or "Got it"). Due from a couple of months early, so a plant repotted in May is ready again the next March. */
  repot:{months:[3,4,5], early:2}
};

/* Spanish (Spain, "tú"). Another language: add a table like this one and list it in TABLES. */
const ES = {
  "today":"hoy", "tomorrow":"mañana", "tonight":"esta noche", "on {day}":"el {day}",
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
  "Safe to move outside":"Ya pueden salir fuera", "takes {t}":"aguanta {t}",
  "No night this week drops below {t}. Ease them out over a week or two: shade first, then more sun.":"Ninguna noche de esta semana baja de {t}. Sácalas poco a poco durante una o dos semanas: primero a la sombra y luego más sol.",
  "just moved out, not used to the cold yet":"recién sacada, aún no está hecha al frío", "first cold after a mild spell":"primer frío tras días templados", "just moved out":"recién sacada",
  "Ease them into the sun":"Acostúmbralas al sol poco a poco",
  "They came from a shadier spot. Give them shade around midday on sunny days for the first week or so, or the leaves can scorch.":"Vienen de un sitio con menos luz. Dales sombra a mediodía los días de sol durante la primera semana o así, o las hojas pueden quemarse.",
  "moved today":"movida hoy", "moved yesterday":"movida ayer", "moved {n} days ago":"movida hace {n} días", "{t} and sunny {when}":"{t} y sol {when}",
  "1 plant just moved into the sun: shade it at midday":"1 planta recién puesta al sol: dale sombra a mediodía", "{n} plants just moved into the sun: shade them at midday":"{n} plantas recién puestas al sol: dales sombra a mediodía",
  "Hot spell":"Ola de calor", "{t} {when}. Water these early in the morning and give them shade where you can.":"{t} {when}. Riégalas temprano por la mañana y dales sombra donde puedas.",
  "pot in partial sun":"maceta a semisombra", "pot in the sun":"maceta al sol", "pot in afternoon sun":"maceta con sol de tarde",
  "Open the greenhouse":"Abre el invernadero", "Outside will reach {t}; the greenhouse gets much hotter. Open vents or the door.":"Fuera llegará a {t}; el invernadero se calienta mucho más. Abre las ventanas o la puerta.",
  "in the greenhouse":"en el invernadero",
  "The heater keeps the greenhouse at about {t}, colder than these take. Raise the heater, add fleece or bring them inside.":"La calefacción mantiene el invernadero a unos {t}, más frío de lo que aguantan. Sube la calefacción, pon manta térmica o mételas en casa.",
  "Find a warmer spot":"Busca un sitio más cálido", "Their spot indoors gets colder on cold nights than they take. Move them away from the window or to a warmer room.":"Su sitio dentro de casa se enfría en las noches frías más de lo que aguantan. Apártalas de la ventana o llévalas a una habitación más cálida.",
  "about {t} on cold nights, takes {min}":"unos {t} en las noches frías, aguanta {min}",
  "by the window":"junto a la ventana", "away from the windows":"lejos de las ventanas", "in the grow cabinet":"en el armario de cultivo",
  "Check the greenhouse heater":"Revisa la calefacción del invernadero", "{t} outside {when}. Without heat the greenhouse would fall to about {g}: these depend on the heater.":"{t} fuera {when}. Sin calefacción el invernadero bajaría a unos {g}: estas plantas dependen de ella.",
  "unheated: about {t}, takes {min}":"sin calefacción: unos {t}, aguanta {min}", "the heater keeps {t}":"la calefacción mantiene {t}",
  "Check the greenhouse heater {when}: 1 plant depends on it":"Revisa la calefacción del invernadero {when}: 1 planta depende de ella",
  "Check the greenhouse heater {when}: {n} plants depend on it":"Revisa la calefacción del invernadero {when}: {n} plantas dependen de ella",
  "too cold in the greenhouse":"demasiado frío en el invernadero",
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
  "Ready for feeding":"Toca abonar", "A feed now keeps them growing well. Use what you used last time, at the strength on the label.":"Un abonado ahora las mantiene creciendo bien. Usa lo de la última vez, a la dosis de la etiqueta.",
  "Time to repot":"Toca trasplantar", "Spring is the time: one pot size bigger, with fresh compost. If it's already in a big pot, replace the top few centimetres of compost instead.":"La primavera es el momento: una maceta un tamaño mayor, con sustrato nuevo. Si ya está en una maceta grande, cambia solo los primeros centímetros de sustrato.",
  "fed today":"abonada hoy", "fed yesterday":"abonada ayer", "last fed {n} days ago":"abonada hace {n} días", "last fed {n} weeks ago":"abonada hace {n} semanas", "last fed {n} months ago":"abonada hace {n} meses",
  "you skipped the last one":"te saltaste el último", "first feed of the season":"primer abonado de la temporada", "no feeding logged yet":"sin abonados registrados", "last time: {what}":"la última vez: {what}",
  "every week":"cada semana", "every {n} weeks":"cada {n} semanas", "every {n} days":"cada {n} días", "once a year, in spring":"una vez al año, en primavera",
  "{every}, {from} to {to}":"{every}, de {from} a {to}", "usually {every}":"normalmente {every}",
  "kept feeding in winter, half as often":"se sigue abonando en invierno, la mitad de veces",
  "resting until {month}: no feeding in winter":"en reposo hasta {month}: sin abonar en invierno",
  "repotted {n} days ago: the fresh compost feeds it for about six weeks":"trasplantada hace {n} días: el sustrato nuevo la alimenta unas seis semanas",
  "repotted {age} ago":"trasplantada hace {age}", "got it {age} ago, no repotting logged":"la tienes desde hace {age}, sin trasplantes registrados",
  "1 month":"1 mes", "{n} months":"{n} meses", "1 year":"1 año", "{n} years":"{n} años",
  "usually every year":"normalmente cada año", "usually every {n} years":"normalmente cada {n} años", "spring {y}":"primavera de {y}",
  "1 plant is ready for feeding":"1 planta pide abono", "{n} plants are ready for feeding":"{n} plantas piden abono",
  "1 pot could be repotted this spring":"1 maceta se podría trasplantar esta primavera", "{n} pots could be repotted this spring":"{n} macetas se podrían trasplantar esta primavera",
  "Your task for today: {t}":"Tu tarea de hoy: {t}", "{n} of your tasks are due today":"Hoy tienes {n} tareas tuyas", "Your tasks":"Tus tareas",
  "Tell Alvor when 1 plant was last watered":"Dile a Alvor cuándo regaste 1 planta", "Tell Alvor when {n} plants were last watered":"Dile a Alvor cuándo regaste {n} plantas",
  "already protected":"ya protegida", "damaged at {t} on {date}":"se dañó a {t} el {date}", "came through {t} before":"ya aguantó {t}",
  "clear, calm night":"noche despejada y sin viento", "your garden runs about {t} colder on nights like this":"tu jardín suele quedarse unos {t} más frío en noches así",
  "your garden runs about {t} warmer on nights like this":"tu jardín suele quedarse unos {t} más templado en noches así",
  "Take the protection off":"Quita la protección", "The cold has passed: no night this week comes near their limit. Fleece left on too long keeps the light out and traps damp.":"El frío ha pasado: ninguna noche de esta semana se acerca a su límite. La manta térmica puesta demasiado tiempo quita luz y guarda humedad.",
  "Pull the mulch back":"Retira el acolchado", "Spring is here and the nights are safe: pull the mulch back from the stems so new growth gets light and air.":"Ha llegado la primavera y las noches son seguras: aparta el acolchado de los tallos para que los brotes tengan luz y aire.",
  "protected {n} days ago":"protegida hace {n} días", "protected yesterday":"protegida ayer", "protected today":"protegida hoy",
  "Storage too cold":"El almacén está demasiado frío", "Your winter storage could drop to about {t}, colder than these take. Add insulation or move them somewhere warmer.":"Tu almacén de invierno podría bajar a unos {t}, más frío de lo que aguantan. Aíslalo o llévalas a un sitio más cálido.",
  "in winter storage":"en el almacén de invierno", "Resting":"En reposo", "resting in winter storage: water very little, only if the stems shrivel":"en reposo en el almacén: riega muy poco, solo si los tallos se arrugan",
  "Indoors: move 1 plant away from the cold window":"Dentro de casa: aparta 1 planta de la ventana fría", "Indoors: move {n} plants away from the cold windows":"Dentro de casa: aparta {n} plantas de las ventanas frías",
  "1 plant protected for {when}":"1 planta protegida para {when}", "All {n} plants protected for {when}":"Las {n} plantas protegidas para {when}",
  "1 more plant needs protection {when}":"1 planta más necesita protección {when}", "{n} more plants need protection {when}":"{n} plantas más necesitan protección {when}",
  "Take the protection off 1 plant":"Quita la protección a 1 planta", "Take the protection off {n} plants":"Quita la protección a {n} plantas",
  "Winter storage is too cold for 1 plant":"El almacén está demasiado frío para 1 planta", "Winter storage is too cold for {n} plants":"El almacén está demasiado frío para {n} plantas",
  "Mark all watered":"Marcar todas regadas", "Open Alvor":"Abrir Alvor"
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
function when(date, today){
  const n = daysBetween(today, date);
  if(n === 0) return T("today");
  if(n === 1) return T("tomorrow");
  return T("on {day}", {day:weekday(date)});
}
/* A day's low comes around dawn, so tomorrow's low is tonight's cold. */
const nightWord = (date, today, evening) => evening || daysBetween(today, date) === 1 ? T("tonight") : when(date, today);
const weekday = date => new Date(utc(date)).toLocaleDateString(LOCALES[lang] || "en-GB", {weekday:"long", timeZone:"UTC"});
const shortDate = date => new Date(utc(date)).toLocaleDateString(LOCALES[lang] || "en-GB", {day:"numeric", month:"short", timeZone:"UTC"});

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
const speciesKey = KB.speciesKey, traitsFor = KB.traits, intervalsFor = KB.intervals;

/* ---------- Weather (one adapter for the app and the server) ---------- */
/* Open-Meteo first. extended asks for evapotranspiration, sunshine and hourly temperatures; if the service refuses
   those, it asks again the old way. If Open-Meteo doesn't answer at all (down, an error, or no reply within
   WX.timeout), the forecast comes from MET Norway (Yr) instead, turned into the same shape, so nothing else in Alvor
   needs to know which source answered (j.source says it: "open-meteo" or "met"). MET gives no past days: those come
   from opt.prev, the last forecast Open-Meteo gave for the same place. */
const DAILY = "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_gusts_10m_max";
const EXTRA = "et0_fao_evapotranspiration,sunshine_duration";
const WX = {
  timeout:10000,                                      // ms to wait for Open-Meteo before asking MET Norway
  gust:1.5,                                           // gusts ≈ 1.5 × the mean wind where MET gives no gusts (outside the Nordics)
  prob:[[1, 70], [0.3, 40], [0.05, 20]]               // rain chance from the amount where MET gives none: ≥ 1 mm counts as likely
};
function weatherUrl(lat, lon, opt){
  const o = opt || {};
  return `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    (o.app ? `&current=temperature_2m,weather_code,is_day,cloud_cover` : "") +
    `&daily=${DAILY}${o.app ? ",weather_code,sunrise,sunset" : ""}${o.basic ? "" : "," + EXTRA}` +
    (o.basic ? "" : "&hourly=temperature_2m,cloud_cover,wind_speed_10m") +
    `&past_days=7&forecast_days=8&timezone=auto`;
}
/* MET Norway's terms: at most 4 decimals, and the server says who it is (browsers send no extra headers). */
const metUrl = (lat, lon) => `https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=${(+lat).toFixed(4).replace(/\.?0+$/, "")}&lon=${(+lon).toFixed(4).replace(/\.?0+$/, "")}`;
function late(p, ms, what){
  let timer;
  const stop = new Promise((_, no) => { timer = setTimeout(() => no(new Error(what + " didn't answer")), ms); });
  return Promise.race([p, stop]).finally(() => clearTimeout(timer));
}
async function fetchForecast(fetchFn, lat, lon, opt){
  const o = opt || {};
  let first;
  try{
    let r = await late(fetchFn(weatherUrl(lat, lon, o)), o.timeout || WX.timeout, "Open-Meteo");
    if(r.status === 400) r = await late(fetchFn(weatherUrl(lat, lon, {...o, basic:true})), o.timeout || WX.timeout, "Open-Meteo");
    if(!r.ok) throw new Error("Open-Meteo " + r.status);
    const j = await r.json();
    if(!j || !j.daily || !Array.isArray(j.daily.time)) throw new Error("Open-Meteo sent no forecast");
    j.source = "open-meteo";
    return j;
  }catch(e){ first = e; }
  if(o.second === false) throw new Error("Forecast failed: " + first.message);
  try{
    const r = await late(fetchFn(metUrl(lat, lon), o.ua ? {headers:{"User-Agent":o.ua}} : undefined), o.timeout || WX.timeout, "MET Norway");
    if(!r.ok) throw new Error("MET Norway " + r.status);
    return withPast(fromMet(await r.json(), {tz:o.tz, lat, lon}), o.prev);
  }catch(e){ throw new Error(`Forecast failed: ${first.message}; ${e.message}`); }
}
/* "YYYY-MM-DDTHH:MM" in the garden's time zone (Open-Meteo's timezone=auto gives the same). */
const tzFmt = {};
function localTime(ms, tz){
  let f = tzFmt[tz || ""];
  if(!f){
    const o = {year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", hourCycle:"h23"};
    try{ f = new Intl.DateTimeFormat("en-CA", {...o, timeZone:tz || undefined}); }catch(e){ f = new Intl.DateTimeFormat("en-CA", o); }
    tzFmt[tz || ""] = f;
  }
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour === "24" ? "00" : p.hour}:${p.minute}`;
}
/* Sunrise and sunset (UTC ms) for a date, from the sun's position; null in polar day or night. */
function sunTimes(date, lat, lon){
  const rad = Math.PI / 180, n = Math.round(utc(date) / 86400000 + 2440587.5 - 2451545);
  const Js = n - lon / 360, M = (357.5291 + 0.98560028 * Js) % 360;
  const C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
  const lam = (M + C + 180 + 102.9372) % 360;
  const Jt = 2451545 + Js + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * lam * rad);
  const dec = Math.asin(Math.sin(lam * rad) * Math.sin(23.4397 * rad));
  const cw = (Math.sin(-0.833 * rad) - Math.sin(lat * rad) * Math.sin(dec)) / (Math.cos(lat * rad) * Math.cos(dec));
  if(cw < -1 || cw > 1) return null;
  const w = Math.acos(cw) / rad, ms = J => (J - 2440587.5) * 86400000;
  return {rise:ms(Jt - w / 360), set:ms(Jt + w / 360)};
}
/* MET's weather symbols as the WMO codes Open-Meteo uses. */
const MET_WMO = {clearsky:0, fair:1, partlycloudy:2, cloudy:3, fog:45, lightrainshowers:80, rainshowers:81, heavyrainshowers:82,
  lightrain:61, rain:63, heavyrain:65, lightsleet:66, sleet:66, heavysleet:67, lightsleetshowers:66, sleetshowers:66, heavysleetshowers:67,
  lightsnow:71, snow:73, heavysnow:75, lightsnowshowers:85, snowshowers:85, heavysnowshowers:86};
function metCode(sym){
  if(!sym) return null;
  const s = String(sym).replace(/_(day|night|polartwilight)$/, "");
  if(/thunder/.test(s)) return 95;
  return MET_WMO[s] ?? null;
}
const r1 = x => Math.round(x * 10) / 10;
/* A MET Norway forecast as Open-Meteo's {timezone, current, daily, hourly}. Hourly for about 2½ days, then every
   6 hours: hourly temperatures in between are drawn straight from one to the next. */
function fromMet(j, opt){
  const o = opt || {}, tz = o.tz, H = 3600000;
  const ts = ((j && j.properties && j.properties.timeseries) || []).filter(e => e && e.time && e.data && e.data.instant);
  if(!ts.length) throw new Error("MET Norway sent no forecast");
  const days = new Map();
  const dayOf = date => { if(!days.has(date)) days.set(date, {lo:null, hi:null, rain:0, prob:null, gust:0, code:null, last:0}); return days.get(date); };
  const temp = (date, t) => { if(!num(t)) return; const d = dayOf(date); d.lo = d.lo == null ? t : Math.min(d.lo, t); d.hi = d.hi == null ? t : Math.max(d.hi, t); };
  const hourly = {time:[], temperature_2m:[], cloud_cover:[], wind_speed_10m:[]};
  const pts = [];
  ts.forEach((e, i) => {
    const t = Date.parse(e.time), next = ts[i + 1] ? Date.parse(ts[i + 1].time) : t + 6 * H, step = Math.max(1, Math.round((next - t) / H));
    const det = e.data.instant.details || {}, n1 = e.data.next_1_hours, n6 = e.data.next_6_hours;
    const lt = localTime(t, tz), date = lt.slice(0, 10), hour = +lt.slice(11, 13), d = dayOf(date);
    d.last = Math.max(d.last, hour);
    temp(date, det.air_temperature);
    if(num(det.air_temperature)) pts.push([t, +det.air_temperature, num(det.cloud_area_fraction) ? +det.cloud_area_fraction : null, num(det.wind_speed) ? +det.wind_speed * 3.6 : null]);
    /* Rain: the hour while the forecast is hourly, then each 6-hour block on the day of its middle. */
    const per = step <= 1 && n1 ? n1 : n6 || n1, span = per === n1 ? 1 : Math.min(step, 6);
    const pd = per && per.details || {}, mid = localTime(t + span / 2 * H, tz).slice(0, 10);
    if(per && num(pd.precipitation_amount)) dayOf(mid).rain += +pd.precipitation_amount * (per === n6 ? span / 6 : 1);
    if(per === n6){ temp(mid, pd.air_temperature_max); temp(mid, pd.air_temperature_min); }
    const pr = [n1, n6].map(x => x && x.details && x.details.probability_of_precipitation).filter(num);
    if(pr.length) dayOf(mid).prob = Math.max(dayOf(mid).prob ?? 0, ...pr);
    const gust = num(det.wind_speed_of_gust) ? +det.wind_speed_of_gust : num(det.wind_speed) ? +det.wind_speed * WX.gust : 0;
    d.gust = Math.max(d.gust, gust * 3.6);
    /* The day's sky: the worst sky between 06:00 and 18:00, as Open-Meteo picks the day's most severe code. */
    const c = metCode(per && per.summary && per.summary.symbol_code);
    if(c != null && hour >= 6 && hour <= 18) dayOf(mid).codes = [...(dayOf(mid).codes || []), c];
  });
  const mid = (a, b, k, n) => num(a) && num(b) ? Math.round(a + (b - a) * k / n) : num(a) ? Math.round(a) : null;
  for(let i = 0; i + 1 < pts.length; i++){
    const [ta, a, ca, wa] = pts[i], [tb, b, cb, wb] = pts[i + 1], n = Math.round((tb - ta) / H);
    for(let k = 0; k < n; k++){ hourly.time.push(localTime(ta + k * H, tz).slice(0, 13) + ":00"); hourly.temperature_2m.push(r1(a + (b - a) * k / n));
      hourly.cloud_cover.push(mid(ca, cb, k, n)); hourly.wind_speed_10m.push(mid(wa, wb, k, n)); }
  }
  if(pts.length){ const [t, a, c, w] = pts[pts.length - 1]; hourly.time.push(localTime(t, tz).slice(0, 13) + ":00"); hourly.temperature_2m.push(r1(a));
    hourly.cloud_cover.push(num(c) ? Math.round(c) : null); hourly.wind_speed_10m.push(num(w) ? Math.round(w) : null); }
  /* Whole days only, apart from today: the last day counts when the forecast reaches its evening. */
  const dates = [...days.keys()].sort().filter((date, i, all) => days.get(date).hi != null && (i < all.length - 1 || days.get(date).last >= 18));
  const daily = {time:dates, temperature_2m_max:[], temperature_2m_min:[], precipitation_sum:[], precipitation_probability_max:[],
    wind_gusts_10m_max:[], weather_code:[], sunrise:[], sunset:[]};
  for(const date of dates){
    const d = days.get(date), rain = r1(d.rain);
    daily.temperature_2m_max.push(r1(d.hi)); daily.temperature_2m_min.push(r1(d.lo));
    daily.precipitation_sum.push(rain);
    daily.precipitation_probability_max.push(d.prob != null ? d.prob : (WX.prob.find(([mm]) => rain >= mm) || [0, 0])[1]);
    daily.wind_gusts_10m_max.push(Math.round(d.gust));
    const codes = (d.codes || []).filter(c => rain >= 0.3 || c < 45);   // a trace of rain doesn't make a rainy day
    daily.weather_code.push(codes.length ? Math.max(...codes) : rain >= 0.3 ? 61 : 3);
    const s = num(o.lat) && num(o.lon) ? sunTimes(date, +o.lat, +o.lon) : null;
    daily.sunrise.push(s ? localTime(s.rise, tz) : null); daily.sunset.push(s ? localTime(s.set, tz) : null);
  }
  /* Now: the first step of the forecast. */
  const e0 = ts[0], det0 = e0.data.instant.details || {}, p0 = e0.data.next_1_hours || e0.data.next_6_hours;
  const sym = p0 && p0.summary && p0.summary.symbol_code, t0 = Date.parse(e0.time), s0 = num(o.lat) && num(o.lon) ? sunTimes(localTime(t0, tz).slice(0, 10), +o.lat, +o.lon) : null;
  const isDay = /_night$/.test(sym || "") ? 0 : /_(day|polartwilight)$/.test(sym || "") ? 1 : s0 ? (t0 >= s0.rise && t0 < s0.set ? 1 : 0) : 1;
  const current = {time:localTime(t0, tz), temperature_2m:num(det0.air_temperature) ? r1(+det0.air_temperature) : null,
    weather_code:metCode(sym) ?? 3, is_day:isDay, cloud_cover:num(det0.cloud_area_fraction) ? Math.round(+det0.cloud_area_fraction) : null};
  return {timezone:tz || null, source:"met", current, daily, hourly};
}
/* Past days (and the hours of today already gone) from the last forecast for the same place, so watering still
   knows about last week's rain and drying when today's forecast came from MET Norway. */
function withPast(j, prev){
  const P = prev && prev.daily, D = j.daily;
  if(!P || !Array.isArray(P.time) || !D.time.length) return j;
  const first = D.time[0], from = addDays(first, -7);
  const keep = P.time.map((t, i) => i).filter(i => P.time[i] < first && P.time[i] >= from);
  const keys = [...new Set([...Object.keys(D), ...Object.keys(P)])].filter(k => k !== "time" && (Array.isArray(D[k]) || Array.isArray(P[k])));
  const out = {time:[...keep.map(i => P.time[i]), ...D.time]};
  for(const k of keys) out[k] = [...keep.map(i => Array.isArray(P[k]) ? P[k][i] ?? null : null), ...(Array.isArray(D[k]) ? D[k] : D.time.map(() => null))];
  /* Today: the earlier forecast also covered the hours before MET's starts. */
  const a = P.time.indexOf(first), b = keep.length;
  if(a >= 0){
    const pick = (k, f) => { if(Array.isArray(P[k]) && num(P[k][a]) && num(out[k][b])) out[k][b] = f(+P[k][a], +out[k][b]); };
    pick("temperature_2m_max", Math.max); pick("temperature_2m_min", Math.min); pick("precipitation_sum", Math.max);
  }
  const PH = prev.hourly, h = j.hourly;
  if(PH && Array.isArray(PH.time) && Array.isArray(PH.temperature_2m) && h && h.time.length){
    const fromH = from + "T00:00", idx = PH.time.map((t, i) => i).filter(i => PH.time[i] < h.time[0] && PH.time[i] >= fromH);
    const col = k => [...idx.map(i => Array.isArray(PH[k]) ? PH[k][i] ?? null : null), ...(Array.isArray(h[k]) ? h[k] : h.time.map(() => null))];
    j.hourly = {time:[...idx.map(i => PH.time[i]), ...h.time], temperature_2m:col("temperature_2m"), cloud_cover:col("cloud_cover"), wind_speed_10m:col("wind_speed_10m")};
  }
  j.daily = out;
  return j;
}
/* s (the settings), when given: the nights ahead as your garden has them (see nightAdjust). */
function splitWeather(daily, today, hourly, s){
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
  const h = hourly && hourly.time && hourly.temperature_2m ? {time:hourly.time, t:hourly.temperature_2m.slice(),
    cloud:Array.isArray(hourly.cloud_cover) ? hourly.cloud_cover : null, wind:Array.isArray(hourly.wind_speed_10m) ? hourly.wind_speed_10m : null} : null;
  const W = {past, next, hourly:h};
  return s ? nightAdjust(W, s) : W;
}
/* ---------- Your garden's own nights ---------- */
/* The night before `date` (18:00 to 08:00): clear and calm, or not, from the hourly cloud cover and wind.
   null when the forecast has no hourly cloud (MET Norway outside its hourly range, an older forecast, the tests). */
function nightSky(W, date){
  const H = W && W.hourly; if(!H || !H.cloud) return null;
  const from = addDays(date, -1) + "T18:00", to = date + "T08:00", C = RULES.frost.clear;
  let n = 0, c = 0, w = 0, wn = 0;
  H.time.forEach((t, i) => { if(t >= from && t <= to && num(H.cloud[i])){ n++; c += +H.cloud[i]; if(H.wind && num(H.wind[i])){ wn++; w += +H.wind[i]; } } });
  if(n < 6) return null;
  const cloud = c / n, wind = wn ? w / wn : null;
  return {clear:cloud < C.cloud && (wind == null || wind < C.wind), cloud:Math.round(cloud), wind:wind == null ? null : Math.round(wind)};
}
/* What you told Alvor after cold nights: settings.calib = [{d (the day), f (the forecast low Alvor had), m (your
   thermometer, °C), fz (true: it froze, false: it didn't), c (true: a clear, calm night; false: not; absent: unknown)}].
   {clear, other, all}: each {off (°C your garden differs from the forecast, + warmer), n (answers it rests on)}. */
function calibration(s, today){
  const C = RULES.calib, list = (Array.isArray(s && s.calib) ? s.calib : []).filter(x => x && num(x.f) && (!today || !x.d || daysBetween(x.d, today) <= C.keep));
  const obs = list.map(x => {
    if(num(x.m)) return {v:+x.m - +x.f, c:x.c};
    if(x.fz === true && +x.f > C.froze) return {v:C.froze - +x.f, c:x.c};
    if(x.fz === false && +x.f < C.notFrozen) return {v:C.notFrozen - +x.f, c:x.c};
    return null;
  }).filter(Boolean);
  const mean = a => a.length ? {off:Math.round(clamp(a.reduce((t, o) => t + o.v, 0) / a.length, C.lim[0], C.lim[1]) * 10) / 10, n:a.length} : {off:0, n:0};
  return {clear:mean(obs.filter(o => o.c === true)), other:mean(obs.filter(o => o.c === false)), all:mean(obs)};
}
/* How much colder (−) or warmer (+) than the forecast your garden gets on that night, and why. */
function nightOffset(s, sky, today){
  const K = calibration(s, today), min = RULES.calib.min;
  if(sky && sky.clear){
    if(K.clear.n >= min) return {off:K.clear.off, learned:true, n:K.clear.n};
    if(K.all.n >= min) return {off:Math.min(K.all.off, -RULES.frost.clearNight), learned:true, n:K.all.n};
    return {off:-RULES.frost.clearNight, learned:false, n:0};
  }
  if(sky && K.other.n >= min) return {off:K.other.off, learned:true, n:K.other.n};
  /* Answers from nights of an unknown kind: all of it when the sky isn't known, half on a cloudy or windy night
     (clouds and wind keep frost pockets from forming). */
  if(K.all.n >= min) return {off:Math.round((sky ? K.all.off / 2 : K.all.off) * 10) / 10, learned:true, n:K.all.n};
  return {off:0, learned:false, n:0};
}
/* The nights ahead as your garden has them: each day's low (and the night's hourly temperatures) moved by the
   night's offset. d.fmin keeps the forecast's own low, d.adj the difference, d.clear whether it's a clear, calm night,
   d.learned whether the difference comes from your answers. The past stays as the forecast had it. */
function nightAdjust(W, s){
  if(!W || W.adjusted) return W;
  W.adjusted = true;
  for(const d of W.next){
    const sky = nightSky(W, d.date), o = nightOffset(s, sky, W.next[0] && W.next[0].date);
    d.fmin = d.min; d.adj = o.off; d.clear = sky ? sky.clear : null; d.learned = o.learned;
    if(!o.off || !num(d.min)) continue;
    d.min = Math.round((+d.min + o.off) * 10) / 10;
    if(W.hourly){
      const from = addDays(d.date, -1) + "T18:00", to = d.date + "T10:00";
      W.hourly.time.forEach((t, i) => { if(t >= from && t <= to && num(W.hourly.t[i])) W.hourly.t[i] = Math.round((+W.hourly.t[i] + o.off) * 10) / 10; });
    }
  }
  return W;
}
/* Why a night is colder or warmer than the forecast, for the reasons under a warning. */
function nightWhy(d){
  if(!d || !d.adj) return null;
  if(d.learned) return d.adj < 0 ? T("your garden runs about {t} colder on nights like this", {t:Math.abs(Math.round(d.adj * 10) / 10) + "°"})
    : T("your garden runs about {t} warmer on nights like this", {t:Math.round(d.adj * 10) / 10 + "°"});
  return d.clear ? T("clear, calm night") : null;
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
/* `bonus` is °C added to the outside, or a function turning the outside into the spot (a heated greenhouse). */
function nightHours(W, date, thr, bonus){
  if(!W || !W.hourly) return null;
  const at = typeof bonus === "function" ? bonus : t => t + (+bonus || 0);
  const from = addDays(date, -1) + "T18:00", to = date + "T10:00";
  let n = 0, seen = 0;
  W.hourly.time.forEach((t, i) => { if(t >= from && t <= to && num(W.hourly.t[i])){ seen++; const v = at(+W.hourly.t[i]); if(num(v) && v < thr) n++; } });
  return seen ? n : null;
}

/* ---------- Where a plant is ---------- */
function placeOf(p){
  const m = p.micro || {}, area = p.area || (p.current === "inside" ? "house" : p.current || "outside");
  return {area, inside:p.current === "inside", gh:p.current === "greenhouse", store:p.current === "store" || area === "store", porch:area === "porch", balcony:area === "balcony",
    pot:p.planting !== "ground", sun:p.sun === "partial" ? "partial" : p.sun === "none" ? "none" : "full",
    wall:!!m.wall, tree:!!m.tree, wind:m.wind === "exposed" || m.wind === "sheltered" ? m.wind : "", pm:!!m.pm};
}
const outdoors = P => !P.inside && !P.gh && !P.store;
function rainReach(p){
  const P = placeOf(p), R = RULES.water.reach;
  if(P.inside || P.gh || P.store || P.porch || p.rainCounts === false) return 0;
  if(P.balcony) return p.rainCounts ? R.balcony : 0;
  let k = R.open;
  if(P.wall) k = Math.min(k, R.wall);
  if(P.tree) k = Math.min(k, R.tree);
  return k;
}
/* How much warmer than the forecast a plant's spot stays on a cold night. */
function frostBonus(p, s){
  const P = placeOf(p), B = RULES.frost.bonus;
  if(P.inside || P.store) return 0;
  if(P.gh) return +s.gh || 0;
  let b = 0;
  if(P.porch) b += B.porch;
  if(P.balcony) b += B.balcony;
  if(P.wall) b += B.wall;
  if(P.tree) b += B.tree;
  if(P.wind === "sheltered") b += B.sheltered;
  return Math.min(b, B.max);
}
/* The temperatures people give each place on Locations (settings):
   gh      the greenhouse without heat, °C warmer than outside on a cold night
   ghHeat  a heated greenhouse never drops below this (null: no heater)
   rooms   {"house-window":8, …} the lowest each indoor spot reaches on a cold night (missing: always warm enough) */
const ghHeat = s => num(s.ghHeat) ? +s.ghHeat : null;
const ghLow = (t, s) => { const g = t + (+s.gh || 0), h = ghHeat(s); return h == null ? g : Math.max(g, h); };
const roomLow = (p, s) => { const r = (s.rooms || {})[p.zone || "house-window"]; return num(r) ? +r : null; };
/* Winter storage (settings.storeLow): its lowest on a cold night; Alvor assumes RULES.store.low when not set. */
const storeLow = s => num(s.storeLow) ? +s.storeLow : RULES.store.low;
/* How cold a plant's spot gets when the night outside drops to t, or null when the outside doesn't reach it
   (indoors: rooms only reach their lowest on nights at or below RULES.frost.roomCold outside). */
function spotLow(p, t, s){
  const P = placeOf(p);
  if(P.inside){ const r = roomLow(p, s); return r != null && t <= RULES.frost.roomCold ? r : null; }
  if(P.store) return t <= RULES.frost.roomCold ? storeLow(s) : null;
  if(P.gh) return ghLow(t, s);
  return t + frostBonus(p, s);
}
const effMin = (p, d, s) => spotLow(p, d.min, s);
/* ---------- Acclimatisation ---------- */
/* p.moved, written on every move by moveRecord: {date, from (the zone it left), out (the day it left the house or the
   greenhouse for outdoors), sun (the day it went from shade into full sun), ok (the owner says it's used to it)}. */
const zoneArea = z => !z ? null : z === "greenhouse" ? "greenhouse" : z === "store" ? "store" : /^house/.test(z) ? "house" : /^porch/.test(z) ? "porch" : /^balc/.test(z) ? "balcony" : /^out/.test(z) ? "outside" : null;
const SHELTER = ["house", "greenhouse", "store"], OUT = ["outside", "porch", "balcony"];
const shadyZone = z => SHELTER.includes(zoneArea(z)) || zoneArea(z) === "porch" || /shade$/.test(z || "");
const sunZone = z => /-sun$/.test(z || "");
function moveRecord(p, to, today){
  const prev = p.moved || {}, from = p.zone, fa = zoneArea(from), ta = zoneArea(to), S = RULES.settle;
  const open = (d, n) => !!d && daysBetween(d, today) >= 0 && daysBetween(d, today) < n;
  const rec = {date:today, from};
  if(OUT.includes(ta)){
    if(SHELTER.includes(fa)) rec.out = open(prev.out, S.days) ? prev.out : today;   // back out after a night in: the same settling
    else if(open(prev.out, S.days)) rec.out = prev.out;                              // from one outdoor spot to another
    if(sunZone(to)){
      if(shadyZone(from)) rec.sun = open(prev.sun, S.sunDays) ? prev.sun : today;
      else if(open(prev.sun, S.sunDays)) rec.sun = prev.sun;
    }
  }else{
    // In for the night while hardening off: remembered, so the next move out carries on.
    if(open(prev.out, S.days)) rec.out = prev.out;
    if(open(prev.sun, S.sunDays)) rec.sun = prev.sun;
  }
  if(prev.ok && ((rec.out && rec.out === prev.out) || (rec.sun && rec.sun === prev.sun))) rec.ok = true;
  return rec;
}
/* Is this plant settling in after a move? {kind:"out", cold, sun, days} outdoors, {kind:"in", days} just brought into
   the house from outside (a few dropped leaves are normal), or null. */
function settling(p, today){
  const m = p.moved, S = RULES.settle;
  if(!m || m.ok || !today) return null;
  const P = placeOf(p), age = d => d ? daysBetween(d, today) : null;
  if(outdoors(P)){
    const a = age(m.out), b = age(m.sun);
    const cold = a != null && a >= 0 && a < S.days, sun = b != null && b >= 0 && b < S.sunDays && P.sun === "full";
    return cold || sun ? {kind:"out", cold, sun, days:cold ? a : b} : null;
  }
  if(P.inside && !m.out && OUT.includes(zoneArea(m.from))){
    const a = age(m.date);
    return a != null && a >= 0 && a < S.days ? {kind:"in", days:a} : null;
  }
  return null;
}
/* How many degrees more tender than its limit a plant is right now (x = {W, today}; without it, none):
   just moved out of the house or greenhouse, or a hardy plant meeting the first cold after a mild week. */
function softness(p, s, x){
  if(!x || !outdoors(placeOf(p))) return {k:0, why:null};
  const st = settling(p, x.today), H = RULES.harden;
  let k = 0, why = null;
  if(st && st.cold){ k = RULES.settle.cold; why = "settle"; }
  if(x.W && x.today && H.months.includes(seasonMonth(+x.today.slice(5, 7), s)) && num(p.minTemp) && +p.minTemp <= H.upTo && H.cold > k){
    const nights = x.W.past.slice(-H.days).map(d => d.min).filter(num);
    if(nights.length >= 4 && nights.reduce((a, t) => a + +t, 0) / nights.length >= H.mild){ k = H.cold; why = "mild"; }
  }
  return {k, why};
}
const SOFT_WHY = {settle:"just moved out, not used to the cold yet", mild:"first cold after a mild spell"};
/* A sunny day: enough sunshine hours (or, without them, warm and dry), and warm enough to scorch soft leaves. */
function sunnyDay(d){
  const S = RULES.settle;
  if(!d || !num(d.max) || d.max < S.sunMax) return false;
  return num(d.sun) ? +d.sun >= S.sunHours * 3600 : d.max >= S.noData.max && (d.prob || 0) < S.noData.prob;
}
const movedWhen = n => n === 0 ? T("moved today") : n === 1 ? T("moved yesterday") : T("moved {n} days ago", {n});

/* Cold warnings are per plant: off when the owner switched them off, or when no limit is set. */
const coldOn = p => p.coldAlert !== false && num(p.minTemp);
/* x = {W, today}: counts acclimatisation (softness) too. The alerts, the forecast badges and the Home chips all pass it. */
const coldLimit = (p, s, x) => {
  const base = +p.minTemp + +s.margin + (p.planting === "pot" && p.current === "outside" ? RULES.frost.pot : 0) + softness(p, s, x).k;
  const o = outcomeFloor(p, x && x.today);
  return o ? Math.max(base, o.t + +s.margin) : base;
};

/* ---------- Protection and what happened afterwards (from the plant's journal) ---------- */
/* "Protected from cold" (k "protected", pk: which plan it carried out) counts until "Protection off" (k "unprotected")
   or RULES.protect.keep days. null, or {d, pk, n, days}. */
const jAll = (p, k) => (p.journal || []).filter(e => e && !e.del && e.k === k && e.d);
const jNewer = (a, b) => a.d > b.d || (a.d === b.d && (+a.m || 0) > (+b.m || 0));
function protection(p, today){
  if(!today) return null;
  const on = jAll(p, "protected").filter(e => e.d <= today).reduce((a, e) => !a || jNewer(e, a) ? e : a, null);
  if(!on || daysBetween(on.d, today) > RULES.protect.keep) return null;
  if(jAll(p, "unprotected").some(e => e.d <= today && !jNewer(on, e))) return null;
  return {d:on.d, pk:on.pk || null, n:on.n || "", days:daysBetween(on.d, today)};
}
/* The morning after (k "outcome"): o "fine" | "damaged" | "lost", t the low it met, prot whether it was protected.
   A plant damaged or lost, unprotected, at a temperature it was supposed to take is warned from there on. */
function outcomeFloor(p, today){
  const hits = jAll(p, "outcome").filter(e => (e.o === "damaged" || e.o === "lost") && !e.prot && num(e.t) && (!today || daysBetween(e.d, today) <= 3 * 365));
  return hits.reduce((a, e) => !a || +e.t > a.t ? {t:+e.t, d:e.d} : a, null);
}
const cameThrough = p => jAll(p, "outcome").filter(e => e.o === "fine" && num(e.t)).reduce((a, e) => !a || +e.t < a.t ? {t:+e.t, d:e.d, prot:!!e.prot} : a, null);

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
  if(P.store) return {stage:"rest", label:T("Resting"), d:null, days:null, iv, byRain:false, snoozed, reasons:[T("resting in winter storage: water very little, only if the stems shrivel")]};
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
  }else if(kind === "settled"){
    detail = "Used to it";
    if(p.moved) patch.moved = {...p.moved, ok:true};
    return {patch, log:{type:"care", detail, est:null, stage:null, k:care.k || 1}};
  }else{ detail = "Later"; care.snooze = today; }
  if(learnt){ care.k = Math.round(clamp(k, L.min, L.max) * 1000) / 1000; care.n = (+care.n || 0) + 1; }
  patch.care = care;
  return {patch, log:{type:kind === "water" ? "water" : "care", detail, est, stage:st.stage, k:care.k || 1}};
}

/* ---------- Frost plan for one plant ---------- */
const COLD_KEYS = ["bringIn","toGh","ghProtect","warmerSpot","storeCold","potProtect","crownProtect","mulchRoots","groundProtect","springGrowth"];
/* Plans carried out where the plant stands: "Mark as protected" answers them, and they stay answered (protection). */
const PROTECT_KEYS = ["potProtect","groundProtect","crownProtect","mulchRoots","springGrowth","ghProtect"];
/* gh: how cold the greenhouse gets that night, so a plant is only sent there when it's warm enough. */
function frostAction(p, t, s, hasGh, gh){
  const P = placeOf(p), Tr = traitsFor(p.species, p.genus), min = +p.minTemp, short = min - t;
  const tender = min >= 0;
  if(P.inside) return {key:"warmerSpot"};
  if(P.store) return {key:"storeCold"};
  if(P.gh) return {key:"ghProtect"};
  if(P.pot){
    if(p.pattern === "mover" || p.pattern === "indoor") return {key:"bringIn", move:"inside"};
    if(p.pattern === "greenhouse" && hasGh) return num(gh) && gh < min ? {key:"bringIn", move:"inside", ghCold:true} : {key:"toGh", move:"greenhouse"};
    if(short >= RULES.frost.bringIn || tender) return {key:"bringIn", move:"inside"};
    return {key:"potProtect"};
  }
  if(num(Tr.r) && t >= Tr.r + RULES.frost.rootSafety) return {key:"mulchRoots", roots:Tr.r};
  if(Tr.c) return {key:"crownProtect"};
  return {key:"groundProtect", hopeless:tender && short >= 4};
}

/* ---------- Feeding and repotting ---------- */
/* What's done lives in the plant's journal ("Fed", "Repotted", "Got it"), so it syncs and the server sees it too.
   On the plant: fe (days between feeds, your own; 0 never; left out: Alvor's), feedWinter (keep feeding in winter),
   feedSkip (the day you said "Skip this time"), rpy (years between repottings, your own; 0 never), rpSkip (the year
   you said "Not this year"). Alvor never knows the soil: these are reminders from what you logged, nothing more. */
const jLastEntry = (p, k) => (p.journal || []).filter(e => e && !e.del && e.k === k && e.d).reduce((a, e) => !a || e.d > a.d || (e.d === a.d && (+e.m || 0) > (+a.m || 0)) ? e : a, null);
const MONTH_NAMES = new Map();   // formatting a date is slow and this is asked for every plant on every redraw
const monthName = m => { const k = lang + "|" + m; let v = MONTH_NAMES.get(k);
  if(v === undefined){ v = new Date(Date.UTC(2026, m - 1, 15)).toLocaleDateString(LOCALES[lang] || "en-GB", {month:"long", timeZone:"UTC"}); MONTH_NAMES.set(k, v); }
  return v; };
const monthOf = d => +String(d).slice(5, 7);
/* The first day of the most recent season that started on north-month m (hemisphere-adjusted). */
function seasonStartDay(today, m, s){
  const am = seasonMonth(m, s), y = +today.slice(0, 4);
  return `${monthOf(today) >= am ? y : y - 1}-${String(am).padStart(2, "0")}-01`;
}
const monthsBetween = (a, b) => { const A = a.split("-").map(Number), B = b.split("-").map(Number); return (B[0] - A[0]) * 12 + B[1] - A[1] - (B[2] < A[2] ? 1 : 0); };
const agoMonths = m => m < 24 ? P(Math.max(1, m), "1 month", "{n} months") : P(Math.floor(m / 12), "1 year", "{n} years");
function everyText(n){
  if(n >= 180) return T("once a year, in spring");
  if(n % 7 === 0) return n === 7 ? T("every week") : T("every {n} weeks", {n:n / 7});
  return T("every {n} days", {n});
}
/* Alvor's feeding and repotting for this plant, and the plant's own values where it has them. */
function feedPlan(p){
  const F = RULES.feed, K = KB.feeding(p.species, p.genus), pot = p.planting !== "ground", Tr = traitsFor(p.species, p.genus);
  const alvor = (pot ? F.pot : F.ground)[K.f] || 0;
  return {f:K.f, pot, alvor, every:num(p.fe) ? Math.max(0, Math.round(+p.fe)) : alvor, own:num(p.fe),
    from:Tr.d === 1 ? F.season.fromDry : F.season.from, to:F.season.to, winter:!!p.feedWinter,
    rpAlvor:K.rp, rp:num(p.rpy) ? Math.max(0, Math.round(+p.rpy)) : K.rp, rpOwn:num(p.rpy)};
}
/* stage: due, soon, ok, rest (winter), fresh (just repotted), unknown (never logged: no reminders), none (never fed). */
function feedState(p, ctx){
  const s = ctx.settings || {}, today = ctx.today, F = RULES.feed, L = feedPlan(p);
  const sm = seasonMonth(monthOf(today), s), inSeason = sm >= L.from && sm <= L.to;
  const lastE = jLastEntry(p, "fed"), last = lastE ? lastE.d : null;
  const skip = p.feedSkip && p.feedSkip <= today ? p.feedSkip : null;
  const base = [last, skip].filter(Boolean).sort().pop() || null;
  const r = {plan:L, last, what:(lastE && lastE.n) || "", inSeason, next:null, reasons:[]};
  if(!L.every){ r.stage = "none"; r.why = L.own ? "own" : L.f === 0 ? "carnivorous" : "ground"; return r; }
  const usual = L.every >= 180 ? everyText(L.every) : T("{every}, {from} to {to}", {every:everyText(L.every), from:monthName(seasonMonth(L.from, s)), to:monthName(seasonMonth(L.to, s))});
  const rep = jLastEntry(p, "repotted");
  if(L.pot && rep && rep.d <= today && daysBetween(rep.d, today) < F.fresh){
    r.stage = "fresh"; r.next = addDays(rep.d, F.fresh);
    r.reasons.push(T("repotted {n} days ago: the fresh compost feeds it for about six weeks", {n:daysBetween(rep.d, today)}));
    return r;
  }
  const yearly = L.every >= 180;
  if(placeOf(p).store || (!inSeason && (!L.winter || yearly))){
    r.stage = "rest"; r.next = seasonStartDay(addDays(today, 200), L.from, s);
    r.reasons.push(T("resting until {month}: no feeding in winter", {month:monthName(seasonMonth(L.from, s))}));
    return r;
  }
  if(!base){ r.stage = "unknown"; r.reasons.push(T("no feeding logged yet"), T("usually {every}", {every:usual})); return r; }
  const n = last ? daysBetween(last, today) : 0;
  const agoT = base !== last ? T("you skipped the last one") : n <= 0 ? T("fed today") : n === 1 ? T("fed yesterday") : n < 14 ? T("last fed {n} days ago", {n}) : n < 60 ? T("last fed {n} weeks ago", {n:Math.floor(n / 7)}) : T("last fed {n} months ago", {n:Math.max(2, monthsBetween(base, today))});
  const start = seasonStartDay(today, L.from, s);
  if(yearly){
    if(base >= start){ r.stage = "ok"; r.next = seasonStartDay(addDays(start, 400), L.from, s); }
    else if(sm < L.from + F.spring){ r.stage = "due"; r.next = today; }
    else { r.stage = "ok"; r.next = seasonStartDay(addDays(start, 400), L.from, s); }   // missed this spring: next year
  }else{
    const eff = inSeason ? L.every : L.every * F.winter;
    r.next = addDays(base, eff);
    if(inSeason && r.next < start) r.next = start;   // the first feed of the season
    const left = daysBetween(today, r.next);
    r.stage = left <= 0 ? "due" : left <= F.soon ? "soon" : "ok";
  }
  r.reasons.push(agoT);
  if(r.stage === "due" && inSeason && base < start) r.reasons.push(T("first feed of the season"));
  r.reasons.push(T("usually {every}", {every:usual}));
  if(!inSeason) r.reasons.push(T("kept feeding in winter, half as often"));
  if(r.what && r.stage === "due") r.reasons.push(T("last time: {what}", {what:r.what.length > 60 ? r.what.slice(0, 57) + "…" : r.what}));
  return r;
}
/* stage: due (in the spring window), next (ready, but the window is later), ok, unknown (nothing logged), ground, none. */
function repotState(p, ctx){
  const s = ctx.settings || {}, today = ctx.today, R = RULES.repot, L = feedPlan(p);
  const r = {rp:L.rp, alvor:L.rpAlvor, own:L.rpOwn, last:null, got:null, next:null, reasons:[]};
  if(!L.pot){ r.stage = "ground"; return r; }
  if(!L.rp){ r.stage = "none"; return r; }
  const rep = jLastEntry(p, "repotted"), got = jLastEntry(p, "acquired");
  r.last = rep ? rep.d : null; r.got = got ? got.d : null;
  const since = r.last || r.got;
  if(!since || since > today){ r.stage = "unknown"; return r; }
  const readyFrom = (() => { const [y, m, d] = since.split("-").map(Number), t = (m - 1) + L.rp * 12 - R.early; return `${y + Math.floor(t / 12)}-${String(t % 12 + 1).padStart(2, "0")}-${String(Math.min(d, 28)).padStart(2, "0")}`; })();
  const ago = agoMonths(monthsBetween(since, today));
  r.reasons.push(r.last ? T("repotted {age} ago", {age:ago}) : T("got it {age} ago, no repotting logged", {age:ago}));
  r.reasons.push(L.rp === 1 ? T("usually every year") : T("usually every {n} years", {n:L.rp}));
  /* The next spring window at or after the day it's ready (this one if it's still open and not skipped). */
  let y = +readyFrom.slice(0, 4);
  const startOf = Y => `${Y}-${String(seasonMonth(R.months[0], s)).padStart(2, "0")}-01`;
  const endOf = Y => addDays(`${Y}-${String(seasonMonth(R.months[R.months.length - 1], s)).padStart(2, "0")}-28`, 3);
  while(endOf(y) < readyFrom || endOf(y) < today || String(y) === String(p.rpSkip)) y++;
  r.next = startOf(y); r.nextYear = y;
  r.stage = readyFrom <= today && today >= startOf(y) && today <= endOf(y) ? "due" : readyFrom <= today ? "next" : "ok";
  return r;
}

/* ---------- Your own garden tasks ---------- */
/* settings.tasks: [{id, t (what), d (the day it's due, "YYYY-MM-DD", or none: "some day"), rep (repeats: "week",
   "2weeks", "month", "year" or none), ids (plants it's about), n (a note), done (a one-off ticked off that day),
   last (a repeating task last done that day), a (the day of the month it started on), m (when it last changed), del (deleted)}].
   A repeating task keeps one due day, moved on each time it's done. Merged task by task between phones (sync.js). */
const TASK_REP = {week:[7, "d"], "2weeks":[14, "d"], month:[1, "m"], year:[12, "m"]};
const taskList = s => ((s && s.tasks) || []).filter(x => x && !x.del && x.t);
/* The same day n months later; the 31st becomes the month's last day. */
function addMonths(d, n, anchor){
  const [y, m, d0] = d.split("-").map(Number), day = anchor || d0, t = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), Math.min(day, last))).toISOString().slice(0, 10);
}
/* a: the day of the month a monthly or yearly task started on, so the 31st stays the month's last day each month. */
const stepTask = (d, rep, a) => { const R = TASK_REP[rep]; return !R ? d : R[1] === "d" ? addDays(d, R[0]) : addMonths(d, R[0], a); };
/* overdue, today, soon (within a week), later, someday (no day) or done (a one-off already ticked off). */
function taskState(x, today){
  if(!TASK_REP[x.rep] && x.done) return {stage:"done", days:null};
  if(!x.d) return {stage:"someday", days:null};
  const n = daysBetween(today, x.d);
  return {stage:n < 0 ? "overdue" : n === 0 ? "today" : n <= 7 ? "soon" : "later", days:n};
}
/* Ticking a task off: a one-off is done that day; a repeating one moves to its next day after today. */
function completeTask(x, today){
  if(!TASK_REP[x.rep] || !x.d) return {done:today};
  const a = +x.a || +x.d.slice(8, 10);
  let d = stepTask(x.d, x.rep, a);
  while(d <= today) d = stepTask(d, x.rep, a);
  return TASK_REP[x.rep][1] === "m" ? {d, last:today, a} : {d, last:today};
}
/* Due today or earlier, oldest first. */
const tasksDue = (s, today) => taskList(s).filter(x => ["overdue", "today"].includes(taskState(x, today).stage)).sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : 0);

/* ---------- All alerts ---------- */
const ORDER = [...COLD_KEYS, "heater", "frostOk", "vent", "heat", "wind", "settleSun", "takeOff", "water", "rainWill", "waterUnknown", "feed", "repot", "plan", "goOut"];
const RANK = {danger:0, warn:1, heat:2, wind:3, water:4, info:5};
const BASE = {
  bringIn:() => ({title:T("Bring inside"), text:T("Cold is coming that these can't take outside."), move:"inside"}),
  toGh:() => ({title:T("Move to the greenhouse"), text:T("Cold is coming that these can't take outside."), move:"greenhouse"}),
  ghProtect:(t, s) => ({title:T("Protect in the greenhouse"), text:s && ghHeat(s) != null
    ? T("The heater keeps the greenhouse at about {t}, colder than these take. Raise the heater, add fleece or bring them inside.", {t:degCold(t)})
    : T("The greenhouse could drop to about {t}. Add fleece or turn on a heater.", {t:degCold(t)})}),
  warmerSpot:() => ({title:T("Find a warmer spot"), text:T("Their spot indoors gets colder on cold nights than they take. Move them away from the window or to a warmer room.")}),
  storeCold:(t) => ({title:T("Storage too cold"), text:T("Your winter storage could drop to about {t}, colder than these take. Add insulation or move them somewhere warmer.", {t:degCold(t)})}),
  potProtect:() => ({title:T("Shelter the pots"), text:T("Move them against a house wall, lift them off the ground and wrap the pots.")}),
  crownProtect:() => ({title:T("Protect the crown"), text:T("Cover the top with fleece and pack the crown with straw. The growing point is the part that mustn't freeze.")}),
  mulchRoots:() => ({title:T("Mulch the roots"), text:T("The leaves or trunk may be damaged, but the roots should survive under a thick mulch. Wrap the stem if you want to keep it.")}),
  groundProtect:() => ({title:T("Protect plants in the ground"), text:T("Cover them with fleece overnight and mulch the base.")}),
  springGrowth:() => ({title:T("Cover new growth"), text:T("A light frost can kill fresh shoots and blossom. Fleece overnight is enough.")})
};
const ROOM_WORD = {"house-window":"by the window", "house-low":"away from the windows", "house-cabinet":"in the grow cabinet"};
function placeWhy(p){
  const P = placeOf(p), w = [];
  if(P.inside) w.push(T(ROOM_WORD[p.zone] || "indoors"));
  if(P.store) w.push(T("in winter storage"));
  if(P.porch) w.push(T("on the porch"));
  if(P.balcony) w.push(T("on the balcony"));
  if(P.wall) w.push(T("against a wall"));
  if(P.tree) w.push(T("under a tree"));
  if(P.wind === "sheltered") w.push(T("sheltered"));
  return w;
}
/* Frost and heat for one forecast day, for the badges on the forecast and the chips on Home. */
/* Plants in the Archive (lost, given away, swapped, sold) are out of every alert. */
const inGarden = plants => (plants || []).filter(p => p && !p.archived);
/* frost: plants outdoors or under glass that need something done for that night (already protected ones aren't
   counted); indoor: rooms and winter storage colder than a plant takes (never shown as frost). */
function dayRisks(plants, d, s, x){
  plants = inGarden(plants);
  const today = x && x.today;
  const cold = plants.filter(p => { if(!coldOn(p)) return false; const t = effMin(p, d, s); return t != null && t < coldLimit(p, s, x); });
  const sheltered = p => { const P = placeOf(p); return P.inside || P.store; };
  const frost = cold.filter(p => !sheltered(p) && !(protection(p, today) && !needsMove(p)));
  const indoor = cold.filter(sheltered);
  const heat = plants.filter(p => heatHit(p, d.max, s) || (p.current === "greenhouse" && d.max + RULES.heat.greenhouse >= RULES.heat.ghVent));
  return {frost, heat, indoor};
}
/* A pot that should go inside (or to the greenhouse) for the cold: protection where it stands doesn't answer that. */
const needsMove = p => p.planting !== "ground" && p.current === "outside" && ["mover","indoor","greenhouse"].includes(p.pattern);
function heatHit(p, max, s){
  const P = placeOf(p);
  if(!outdoors(P) || !P.pot) return false;
  const lim = +s.heat - (P.pm ? RULES.heat.pm : 0);
  return P.sun === "full" ? max >= lim : P.sun === "partial" ? max >= lim + RULES.heat.partial : false;
}

function compute(plants, ctx){
  plants = inGarden(plants);
  if(ctx.lang) setLang(ctx.lang);
  const s = ctx.settings, W = splitWeather(ctx.daily, ctx.today, ctx.hourly, s), groups = {};
  const evening = ctx.mode === "evening", sm = seasonMonth(ctx.month, s);
  const hasGh = s.home !== "apartment", x = {W, today:ctx.today};
  const add = (key, base, item) => {
    const g = (groups[key] ||= {...base, items:[]});
    if(RANK[base.level] < RANK[g.level]) g.level = base.level;
    g.items.push({...item, why:(item.reasons || []).join(" · ") || item.why || ""});
  };

  if(W){
    // Evening: tonight's low is tomorrow's daily minimum. Full: today and the next two days; from mid-morning on,
    // today's low (last night) is over, so the next three nights.
    const look = evening ? W.next.slice(1, 2) : W.next.slice(num(ctx.hour) && +ctx.hour >= 10 ? 1 : 0, num(ctx.hour) && +ctx.hour >= 10 ? 4 : 3);
    const coldIds = new Set(), near = [];
    let freezing = look.some(d => d.min <= 0);
    const heater = [];
    for(const p of plants){
      if(!coldOn(p)) continue;
      const P0 = placeOf(p), inside = P0.inside || P0.store;
      if(inside && evening) continue;   // a room's cold is the same every cold night: the morning says it, the evening doesn't nag
      let worst = null;
      for(const d of look){ const t = spotLow(p, d.min, s); if(t != null && (!worst || t < worst.t)) worst = {t, date:d.date, out:d.min, day:d}; }
      if(!worst) continue;
      const lim = coldLimit(p, s, x), soft = softness(p, s, x), whenTxt = nightWord(worst.date, ctx.today, evening);
      /* The first night it needs something: the deadline (the worst night is what the plan is for). */
      const first = (look.find(d => { const t = spotLow(p, d.min, s); return t != null && t < lim; }) || worst).date;
      if(worst.t >= lim){
        const Tr = traitsFor(p.species, p.genus);
        // A heated greenhouse: fine thanks to the heater, but it would be too cold without it.
        if(p.current === "greenhouse" && ghHeat(s) != null){
          const cold = look.reduce((a, d) => !a || d.min < a.min ? d : a, null), bare = cold.min + (+s.gh || 0);
          if(bare < lim){ heater.push({p, t:cold.min, bare, date:cold.date}); continue; }
        }
        if(RULES.frost.spring.includes(sm) && num(Tr.s) && outdoors(placeOf(p)) && worst.t <= Tr.s + 1){
          coldIds.add(p.id); freezing = true;
          add("springGrowth", {...BASE.springGrowth(), level:"warn"}, {p, t:worst.t, date:worst.date, reasons:[T("{t} {when}, takes {min}", {t:degCold(worst.t), when:whenTxt, min:deg(Tr.s)}), T("new growth")]});
        }else if(worst.t < lim + RULES.frost.okWithin) near.push({p, t:worst.t, date:worst.date, soft});
        continue;
      }
      coldIds.add(p.id);
      const A = frostAction(p, worst.t, s, hasGh, ghLow(worst.out, s)), min = +p.minTemp;
      const level = worst.t < min + (p.planting === "pot" && p.current === "outside" ? RULES.frost.pot : 0) ? "danger" : "warn";
      const reasons = [inside ? T("about {t} on cold nights, takes {min}", {t:deg(worst.t), min:deg(min)}) : T("{t} {when}, takes {min}", {t:degCold(worst.t), when:whenTxt, min:deg(min)})];
      const nw = inside ? null : nightWhy(worst.day);
      if(nw) reasons.push(nw);
      const fl = outcomeFloor(p, ctx.today);
      if(fl && Math.abs(lim - (fl.t + +s.margin)) < 0.01) reasons.push(T("damaged at {t} on {date}", {t:degCold(fl.t), date:shortDate(fl.d)}));
      else { const ct = cameThrough(p); if(ct && ct.t < min) reasons.push(T("came through {t} before", {t:degCold(ct.t)})); }
      if(p.current === "greenhouse" && ghHeat(s) != null) reasons.push(T("the heater keeps {t}", {t:deg(ghHeat(s))}));
      if(A.ghCold) reasons.push(T("too cold in the greenhouse"));
      const hrs = inside ? null : nightHours(W, worst.date, min, p.current === "greenhouse" ? x => ghLow(x, s) : frostBonus(p, s));
      if(hrs) reasons.push(T("for {n} hours", {n:hrs}));
      if(A.key === "mulchRoots") reasons.push(T("roots take {t}", {t:deg(A.roots)}));
      // Only when it made the difference (or the plant just came out, which is worth knowing anyway).
      if(soft.why && (soft.why === "settle" || worst.t >= lim - soft.k)) reasons.push(T(SOFT_WHY[soft.why]));
      reasons.push(...placeWhy(p));
      const Tr = traitsFor(p.species, p.genus);
      if(Tr.w && W.next.slice(0, 3).some(d => d.rain >= 2)) reasons.push(T("keep rain off it"));
      if(A.hopeless) reasons.push(T("may not survive outside"));
      /* Protection already in place (fleece, mulch, a wrapped pot) answers a plan carried out where it stands. */
      const pr = PROTECT_KEYS.includes(A.key) ? protection(p, ctx.today) : null;
      if(pr) reasons.unshift(T("already protected"));
      add(A.key, {...BASE[A.key](worst.t, s), level}, {p, t:worst.t, date:worst.date, first, act:A.key, reasons, ...(pr ? {done:true, prot:pr} : {})});
    }
    // The heater carries these tonight: worth a look that it's on.
    if(heater.length){
      const c = heater.reduce((a, x) => x.t < a.t ? x : a), g = c.bare;
      heater.forEach(({p, t, bare, date}) => add("heater", {level:"warn", title:T("Check the greenhouse heater"),
        text:T("{t} outside {when}. Without heat the greenhouse would fall to about {g}: these depend on the heater.", {t:degCold(c.t), when:nightWord(c.date, ctx.today, evening), g:degCold(g)}), date:c.date},
        {p, t, date, reasons:[T("unheated: about {t}, takes {min}", {t:degCold(bare), min:deg(p.minTemp)}), T("the heater keeps {t}", {t:deg(ghHeat(s))})]}));
    }
    // Reassurance: when it freezes or plants need protecting, say which ones are fine as they are.
    if(coldIds.size || freezing) near.filter(n => !coldIds.has(n.p.id)).forEach(({p, t, date}) =>
      add("frostOk", {title:T("No action needed"), text:T("These stay within what they take."), level:"info"}, {p, t, date, reasons:[T("{t} {when}, takes {min}", {t:degCold(t), when:nightWord(date, ctx.today, evening), min:deg(p.minTemp)}), ...placeWhy(p)].slice(0, 2)}));

    if(!evening){
      for(const p of plants){
        if(coldIds.has(p.id) || !coldOn(p)) continue;
        const movable = p.pattern === "mover" || p.pattern === "greenhouse";
        if(p.current === "outside" && p.planting === "pot" && movable && sm >= 8 && sm <= 11){
          const hit = W.next.slice(3).find(d => { const t = effMin(p, d, s); return t != null && t < coldLimit(p, s, x) + 2; });
          if(hit) add("plan", {level:"info", title:T("Get ready to move soon"), text:T("Nights are getting close to their limit later this week.")},
            {p, reasons:[`${deg(effMin(p, hit, s))} ${when(hit.date, ctx.today)}`, T("takes {t}", {t:deg(p.minTemp)})]});
        }
        const sheltered = ((p.current === "inside" || p.current === "store") && p.pattern === "mover") || ((p.current === "greenhouse" || p.current === "store") && p.pattern === "greenhouse");
        if(sheltered && sm >= 3 && sm <= 6 && W.next.length){
          const lowest = Math.min(...W.next.map(d => d.min));
          if(lowest >= +p.minTemp + +s.margin + 3)
            add("goOut", {level:"info", title:T("Safe to move outside"), text:T("No night this week drops below {t}. Ease them out over a week or two: shade first, then more sun.", {t:deg(lowest)}), move:"outside"},
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
      // Just moved into full sun: soft leaves scorch on the first sunny days.
      const sunny = W.next.slice(0, 2).find(sunnyDay);
      if(sunny) plants.forEach(p => {
        const st = settling(p, ctx.today);
        if(!st || !st.sun) return;
        add("settleSun", {level:"info", title:T("Ease them into the sun"), text:T("They came from a shadier spot. Give them shade around midday on sunny days for the first week or so, or the leaves can scorch."), date:sunny.date, feedback:["settled"]},
          {p, reasons:[movedWhen(daysBetween(p.moved.sun, ctx.today)), T("{t} and sunny {when}", {t:deg(sunny.max), when:when(sunny.date, ctx.today)}), T("full sun")]});
      });
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
          const st = settling(p, ctx.today);
          if(st && st.cold) why.push(T("just moved out"));
          if(!why.length) return;   // a plant in the ground, in a normal spot, rides out a gust
          add("wind", {level:"wind", title:T("Strong gusts"), text:T("Up to {n} km/h {when}. Secure pots, stake tall plants, close the greenhouse.", {n:Math.round(windy.gust), when:when(windy.date, ctx.today)}), date:windy.date}, {p, reasons:why});
        });
      }
    }
  }

  // The cold has passed: take the fleece off (and in spring, pull the mulch back).
  if(!evening && W && W.next.length){
    const ahead = W.next.slice(0, RULES.protect.off);
    for(const p of plants){
      const pr = protection(p, ctx.today);
      if(!pr || pr.days < 1 || !coldOn(p)) continue;
      const mulch = pr.pk === "mulchRoots";
      if(mulch && !RULES.repot.months.includes(sm)) continue;   // mulch stays on through winter
      const lim = coldLimit(p, s, x);
      if(ahead.every(d => { const t = spotLow(p, d.min, s); return t == null || t >= lim + RULES.protect.offMargin; }))
        add("takeOff", {level:"info", title:mulch ? T("Pull the mulch back") : T("Take the protection off"),
          text:mulch ? T("Spring is here and the nights are safe: pull the mulch back from the stems so new growth gets light and air.") : T("The cold has passed: no night this week comes near their limit. Fleece left on too long keeps the light out and traps damp."),
          feedback:["unprotect"]}, {p, prot:pr, reasons:[pr.days === 0 ? T("protected today") : pr.days === 1 ? T("protected yesterday") : T("protected {n} days ago", {n:pr.days}), T("takes {t}", {t:deg(p.minTemp)})]});
    }
  }

  if(!evening){
    const soon = W ? W.next.slice(0, 2).reduce((a, d) => a + (d.prob >= RULES.water.rainSkip.prob ? Math.max(0, d.rain - RULES.water.interception) : 0), 0) : 0;
    for(const p of plants){
      const st = waterState(p, W, ctx, plants);
      if(st.snoozed || st.stage === "rest") continue;
      if(st.stage === "unknown"){ add("waterUnknown", {level:"info", title:T("Not sure about these"), text:T("Alvor doesn't know when these were last watered. Tell it once and it follows them from there."), feedback:["water","fine"]}, {p, stage:st.stage, reasons:st.reasons}); continue; }
      if(st.stage !== "likely" && st.stage !== "urgent") continue;
      const reach = rainReach(p);
      if(reach > 0 && st.stage !== "urgent" && soon * reach >= (+s.rain || 5) * Math.min(1, st.d))
        add("rainWill", {level:"info", title:T("Skip these, rain is coming"), text:T("About {n} mm expected over the next two days.", {n:Math.round(soon)})}, {p, stage:st.stage, reasons:st.reasons});
      else
        add("water", {level:"water", title:T("Needs water"), text:"", waterAll:true, feedback:["water","wet","fine","later"]}, {p, stage:st.stage, d:st.d, reasons:st.reasons});
    }
    if(groups.water) groups.water.items.sort((a, b) => b.d - a.d);
    // Feeding and repotting: only for plants whose feeding (or repotting, or "Got it") is in the journal.
    for(const p of plants){
      const f = feedState(p, ctx);
      if(f.stage === "due") add("feed", {level:"info", title:T("Ready for feeding"), text:T("A feed now keeps them growing well. Use what you used last time, at the strength on the label."), feedAll:true, feedback:["fed","skip"]}, {p, reasons:f.reasons});
      const rp = repotState(p, ctx);
      if(rp.stage === "due") add("repot", {level:"info", title:T("Time to repot"), text:T("Spring is the time: one pot size bigger, with fresh compost. If it's already in a big pot, replace the top few centimetres of compost instead."), feedback:["repotted","notYear"]}, {p, reasons:rp.reasons});
    }
  }

  return ORDER.filter(k => groups[k]).map(k => ({key:k, ...groups[k]}))
    .sort((a, b) => RANK[a.level] - RANK[b.level]);
}

/* ---------- Garden today: what matters now ---------- */
/* lines: {kind:"frost"|"heat"|"wind"|"sun"|"water"|"rain"|"soon"|"feed"|"repot"|"move"|"task"|"unknown", text, ids, urgent}
   ("task" lines carry tasks: the ids of your own tasks due today). */
function gardenToday(groups, plants, ctx){
  plants = inGarden(plants);
  if(ctx.lang) setLang(ctx.lang);
  const s = ctx.settings, W = splitWeather(ctx.daily, ctx.today, ctx.hourly, s);
  const h = num(ctx.hour) ? +ctx.hour : 8;
  const greet = T(h < 12 ? "Good morning" : h < 19 ? "Good afternoon" : "Good evening");
  const by = k => groups.filter(g => (Array.isArray(k) ? k : [k]).includes(g.key));
  const ids = gs => [...new Set(gs.flatMap(g => g.items.map(i => i.p.id)))];
  const open = gs => gs.map(g => ({...g, items:g.items.filter(i => !i.done)})).filter(g => g.items.length);
  const lines = [];
  /* Frost and cold outdoors and under glass; rooms and winter storage are their own line (never "frost"). */
  const coldAll = by(COLD_KEYS.filter(k => !["springGrowth", "warmerSpot", "storeCold"].includes(k))), cold = open(coldAll), spring = open(by("springGrowth"));
  const nightOf = gs => { const dates = gs.flatMap(g => g.items).map(i => i.first || i.date).filter(Boolean).sort(), first = dates[0];
    return first ? {date:first, word:nightWord(first, ctx.today, ctx.mode === "evening")} : {date:null, word:T("tonight")}; };
  const doneN = ids(coldAll) .filter(id => !ids(cold).includes(id)).length;
  let deadline = null;
  if(cold.length){
    const n = ids(cold).length, w = nightOf(cold);
    deadline = w.date;
    lines.push({kind:"frost", urgent:true, ids:ids(cold), date:w.date, done:doneN, text:doneN
      ? P(n, "1 more plant needs protection {when}", "{n} more plants need protection {when}", {when:w.word})
      : P(n, "1 plant needs protection {when}", "{n} plants need protection {when}", {when:w.word})});
  }else if(coldAll.length){
    const n = ids(coldAll).length, w = nightOf(coldAll);
    lines.push({kind:"frost", urgent:false, ids:ids(coldAll), date:w.date, done:n, text:P(n, "1 plant protected for {when}", "All {n} plants protected for {when}", {when:w.word})});
  }
  if(spring.length){ const n = ids(spring).length, i = spring[0].items[0];
    lines.push({kind:"frost", urgent:false, ids:ids(spring), text:P(n, "Cover new growth on 1 plant {when}", "Cover new growth on {n} plants {when}", {when:i.date ? nightWord(i.date, ctx.today) : T("tonight")})}); }
  const heat = by("heat"); if(heat.length){ const n = ids(heat).length;
    lines.push({kind:"heat", urgent:true, ids:ids(heat), text:P(n, "Heat {when}: shade and water 1 pot early", "Heat {when}: shade and water {n} pots early", {when:heat[0].date ? when(heat[0].date, ctx.today) : T("today")})}); }
  const heat0 = by("heater"); if(heat0.length){ const n = ids(heat0).length, i = heat0[0].items[0];
    lines.push({kind:"frost", urgent:false, ids:ids(heat0), text:P(n, "Check the greenhouse heater {when}: 1 plant depends on it", "Check the greenhouse heater {when}: {n} plants depend on it", {when:i.date ? nightWord(i.date, ctx.today, ctx.mode === "evening") : T("tonight")})}); }
  const vent = by("vent"); if(vent.length) lines.push({kind:"heat", urgent:true, ids:ids(vent), text:T("Open the greenhouse {when}", {when:vent[0].date ? when(vent[0].date, ctx.today) : T("today")})});
  const wind = by("wind"); if(wind.length){ const n = ids(wind).length;
    lines.push({kind:"wind", urgent:true, ids:ids(wind), text:P(n, "Gusts {when}: secure 1 plant", "Gusts {when}: secure {n} plants", {when:wind[0].date ? when(wind[0].date, ctx.today) : T("today")})}); }
  const indoor = by("warmerSpot"); if(indoor.length){ const n = ids(indoor).length;
    lines.push({kind:"indoor", urgent:false, ids:ids(indoor), text:P(n, "Indoors: move 1 plant away from the cold window", "Indoors: move {n} plants away from the cold windows")}); }
  const store = by("storeCold"); if(store.length){ const n = ids(store).length;
    lines.push({kind:"indoor", urgent:true, ids:ids(store), text:P(n, "Winter storage is too cold for 1 plant", "Winter storage is too cold for {n} plants")}); }
  const sunG = by("settleSun"); if(sunG.length){ const n = ids(sunG).length;
    lines.push({kind:"sun", urgent:false, ids:ids(sunG), text:P(n, "1 plant just moved into the sun: shade it at midday", "{n} plants just moved into the sun: shade them at midday")}); }
  const off = by("takeOff"); if(off.length){ const n = ids(off).length;
    lines.push({kind:"protect", urgent:false, ids:ids(off), text:P(n, "Take the protection off 1 plant", "Take the protection off {n} plants")}); }
  const water = by("water"); if(water.length){ const n = ids(water).length;
    lines.push({kind:"water", urgent:water[0].items.some(i => i.stage === "urgent"), ids:ids(water), text:P(n, "1 plant likely needs water", "{n} plants likely need water")}); }
  const rain = by("rainWill"); if(rain.length){ const n = ids(rain).length;
    lines.push({kind:"rain", urgent:false, ids:ids(rain), text:P(n, "Rain is coming: skip watering 1 plant", "Rain is coming: skip watering {n} plants")}); }
  const soonIds = plants.filter(p => { const st = waterState(p, W, ctx, plants); return !st.snoozed && st.stage === "consider"; }).map(p => p.id);
  if(soonIds.length) lines.push({kind:"soon", urgent:false, ids:soonIds, text:P(soonIds.length, "1 more may need water soon", "{n} more may need water soon")});
  const out = by("goOut"); if(out.length){ const n = ids(out).length; lines.push({kind:"move", urgent:false, ids:ids(out), text:P(n, "1 plant can go back outside", "{n} plants can go back outside")}); }
  const plan = by("plan"); if(plan.length){ const n = ids(plan).length; lines.push({kind:"move", urgent:false, ids:ids(plan), text:P(n, "Get 1 plant ready to move this week", "Get {n} plants ready to move this week")}); }
  const feed = by("feed"); if(feed.length){ const n = ids(feed).length; lines.push({kind:"feed", urgent:false, ids:ids(feed), text:P(n, "1 plant is ready for feeding", "{n} plants are ready for feeding")}); }
  const repot = by("repot"); if(repot.length){ const n = ids(repot).length; lines.push({kind:"repot", urgent:false, ids:ids(repot), text:P(n, "1 pot could be repotted this spring", "{n} pots could be repotted this spring")}); }
  const due = tasksDue(s, ctx.today);
  if(due.length) lines.push({kind:"task", urgent:false, ids:[], tasks:due.map(x => x.id),
    text:due.length === 1 ? T("Your task for today: {t}", {t:due[0].t}) : T("{n} of your tasks are due today", {n:due.length})});
  const unk = by("waterUnknown"); if(unk.length){ const n = ids(unk).length; lines.push({kind:"unknown", urgent:false, ids:ids(unk), text:P(n, "Tell Alvor when 1 plant was last watered", "Tell Alvor when {n} plants were last watered")}); }

  const urgent = lines.some(l => l.urgent);
  const soonCold = cold.some(g => g.items.some(i => i.date && daysBetween(ctx.today, i.date) <= 1));
  const head = !lines.length ? T("Your garden is happy today. Nothing needs doing.")
    : cold.length ? T(soonCold ? "A cold night is coming." : "Cold is coming.")
    : urgent ? T("A few plants need you today.") : T("Your garden is mostly happy today.");
  const t = W && W.next[0];
  const weather = t ? (t.rain >= 0.5 ? T("{lo} to {hi}, {rain} mm rain", {lo:deg(t.min), hi:deg(t.max), rain:Math.round(t.rain)}) : T("{lo} to {hi}, dry", {lo:deg(t.min), hi:deg(t.max)})) : "";
  const age = num(ctx.weatherAt) && num(ctx.now) ? Math.floor((+ctx.now - +ctx.weatherAt) / 3600000) : 0;
  return {greet, head, lines, deadline, calm:lines.length ? T("Nothing else is urgent.") : "", weather, stale:age >= 12 ? T("Using the forecast from {n} hours ago.", {n:age}) : ""};
}

/* ---------- The morning after a cold night ---------- */
/* Last night (today's low): the plants it took to the lowest they take (risk), and those that came within
   RULES.after.near of it, with the low at their spot. null when last night took none to its limit (the warning margin
   doesn't count here: this is about what really happened). Answered plants (an "outcome" entry today) are left out. */
function morningAfter(plants, ctx){
  plants = inGarden(plants);
  const s = ctx.settings, W = splitWeather(ctx.daily, ctx.today, ctx.hourly, s);
  const d = W && W.next[0]; if(!d || !num(d.min)) return null;
  const x = {W, today:ctx.today}, items = [];
  let risk = false;
  for(const p of plants){
    if(!coldOn(p)) continue;
    const P = placeOf(p); if(P.inside || P.store) continue;
    const t = spotLow(p, d.min, s); if(t == null) continue;
    const lim = +p.minTemp + (p.planting === "pot" && p.current === "outside" ? RULES.frost.pot : 0);
    if(t >= lim + RULES.after.near) continue;
    if(t <= lim) risk = true;
    if(jAll(p, "outcome").some(e => e.d === ctx.today)) continue;
    const pr = protection(p, ctx.today);
    items.push({p, t:Math.round(t * 10) / 10, risk:t <= lim, prot:!!pr, pk:pr && pr.pk});
  }
  if(!risk || !items.length) return null;
  items.sort((a, b) => (b.risk - a.risk) || a.t - b.t);
  return {date:ctx.today, low:d.min, fmin:num(d.fmin) ? d.fmin : d.min, clear:d.clear, learned:!!d.learned, items};
}

/* ---------- Phone notifications ---------- */
/* Short text for a phone notification. Returns null when there is nothing worth sending.
   Quiet groups (not sure about watering, nothing to do) never cause a notification. Feeding and repotting are
   weekend jobs: they join the Saturday morning message only. */
const QUIET = ["frostOk", "waterUnknown"], WEEKEND = ["feed", "repot"];
function summarize(groups, ctx){
  if(ctx.lang) setLang(ctx.lang);
  const W = splitWeather(ctx.daily, ctx.today, ctx.hourly, ctx.settings);
  const evening = ctx.mode === "evening";
  /* What's already done (protected where it stands) isn't asked for again. */
  groups = groups.map(g => ({...g, items:g.items.filter(i => !i.done)})).filter(g => g.items.length);
  const saturday = new Date(utc(ctx.today)).getUTCDay() === 6;
  const loud = groups.filter(g => !QUIET.includes(g.key) && (saturday || !WEEKEND.includes(g.key)));
  const lines = loud.map(g => {
    const names = g.items.map(i => i.p.name);
    const list = names.length > 4 ? T("{list} and {n} more", {list:names.slice(0, 4).join(", "), n:names.length - 4}) : names.join(", ");
    return `${g.title}: ${list}`;
  });
  // Your own tasks due today join the morning message (never the evening cold check).
  const due = evening ? [] : tasksDue(ctx.settings, ctx.today);
  if(due.length){
    const names = due.map(x => x.t);
    lines.push(`${T("Your tasks")}: ${names.length > 4 ? T("{list} and {n} more", {list:names.slice(0, 4).join(", "), n:names.length - 4}) : names.join(", ")}`);
  }
  const cold = loud.filter(g => COLD_KEYS.includes(g.key));
  const lowest = cold.length ? Math.min(...cold.flatMap(g => g.items.map(i => i.t))) : null;
  const heaterG = loud.find(g => g.key === "heater");
  if(evening){
    if(!cold.length && !heaterG) return null;
    if(!cold.length) return {title:T("Cold tonight: down to {t}", {t:degCold(heaterG.items[0].t)}), body:lines.join("\n"), tag:"garden-evening"};
    const ok = groups.some(g => g.key === "frostOk");
    return {title:T("Cold tonight: down to {t}", {t:degCold(lowest)}), body:[...lines, ok ? T("No action needed for the others.") : ""].filter(Boolean).join("\n"), tag:"garden-evening", hash:"today"};
  }
  /* Buttons on the notification: "Mark all watered" when watering is due (it opens Alvor and marks them). */
  const wG = loud.find(g => g.key === "water"), wIds = wG ? wG.items.map(i => i.p.id).slice(0, 40) : [];
  const actions = wIds.length ? [{action:"water", title:T("Mark all watered"), hash:"act=water&ids=" + wIds.join(",")}] : [];
  const t = W && W.next[0];
  const wLine = t ? (t.rain >= 0.5 ? T("{lo} to {hi}, {rain} mm rain", {lo:deg(t.min), hi:deg(t.max), rain:Math.round(t.rain)}) : T("{lo} to {hi}, dry", {lo:deg(t.min), hi:deg(t.max)})) : "";
  const things = loud.length + (due.length ? 1 : 0);
  if(!things) return {title:T("Nothing to do in the garden today"), body:wLine, tag:"garden-morning"};
  const title = cold.length ? T(lowest <= 0 ? "Frost warning: down to {t}" : "Low temperature warning: down to {t}", {t:degCold(lowest)})
    : things === 1 ? T("1 thing to do in the garden") : T("{n} things to do in the garden", {n:things});
  return {title, body:[...lines, wLine].filter(Boolean).join("\n"), tag:"garden-morning", hash:"today", ...(actions.length ? {actions} : {})};
}

return {VERSION, inGarden, RULES, KB, setLang, ES, LOC, ALLOWED, deg, degCold, nightWord, daysBetween, addDays, speciesKey, traitsFor, intervalsFor,
  weatherUrl, metUrl, fetchForecast, fromMet, withPast, sunTimes, localTime, WX, splitWeather, hargreaves, nightHours, seasonMonth, interval, placeOf, rainReach, frostBonus,
  waterState, waterStatus, feedback, learned, STAGES, STAGE_TEXT, effMin, spotLow, ghLow, roomLow, coldLimit, coldOn, frostAction, dayRisks, heatHit,
  compute, gardenToday, summarize, COLD_KEYS, PROTECT_KEYS, moveRecord, morningAfter, protection, outcomeFloor, cameThrough, calibration, nightOffset, nightSky, nightAdjust, nightWhy, needsMove, storeLow, settling, softness, sunnyDay, zoneArea,
  feedPlan, feedState, repotState, everyText, monthName, TASK_REP, taskList, taskState, completeTask, tasksDue, stepTask, addMonths};
});
