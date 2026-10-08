/* Alvor · Languages: English and Spanish.
   Every text is written in English in the code, inside tr("…"); the Spanish table (js/lang-es.js) maps each
   English text to its Spanish one. Texts with numbers or names use {placeholders}: tr("Moved to: {spot}", {spot}).
   trn(n, one, other) picks the singular or plural English text first, then translates it.
   The fixed texts of index.html are translated once at start, by matching them against the same table.
   Another language later (Portuguese, French…): add js/lang-xx.js with the same shape, a species-xx.js for plant
   names, its words in thingPhrase below, and the language to LANGS.
   Plain script (no build step): loaded by index.html in a fixed order and sharing one global scope. */
"use strict";
const LANGS = {en:"English", es:"Español"};
const LANG_KEY = "alvor-lang";   // this phone's copy of the choice, read before anything is drawn
/* "auto" follows the phone. The choice is saved with the garden's settings too (same on every phone). */
function langChoice(){
  let c = null;
  try{ c = localStorage.getItem(LANG_KEY); }catch(e){}
  return LANGS[c] || c === "auto" ? c : "auto";
}
function phoneLang(){
  const list = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || "en"]);
  for(const l of list){ const k = String(l || "").toLowerCase().slice(0, 2); if(LANGS[k]) return k; }
  return "en";
}
const resolveLang = c => LANGS[c] ? c : phoneLang();
const LANG = (() => { const q = (location.search.match(/[?&]lang=(en|es)\b/) || [])[1]; return q || resolveLang(langChoice()); })();
const LOCALE = {en:"en-GB", es:"es-ES"}[LANG] || "en-GB";
const STR = (window.ALVOR_LANG || {})[LANG] || {};
document.documentElement.lang = LANG;
if(window.GardenAlerts && GardenAlerts.setLang) GardenAlerts.setLang(LANG);

function tr(s, v){
  let r = STR[s];
  if(r == null) r = s;
  return v ? r.replace(/\{(\w+)\}/g, (m, k) => k in v ? v[k] : m) : r;
}
const trn = (n, one, other, v) => tr(n === 1 ? one : other, {n, ...(v || {})});
const cap = s => String(s || "").replace(/^./, c => c.toUpperCase());
const fold = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "");

/* A plant's common name in the app's language (species-es.js), or the one given. */
const NAMES = (() => {
  const src = (window.SPECIES_NAMES || {})[LANG], m = {};
  if(src) for(const [k, v] of Object.entries(src)) m[k.toLowerCase()] = v;
  return m;
})();
function plantName(sci, fallback){
  const k = String(sci || "").toLowerCase().replace(/×/g, "x").replace(/\s+/g, " ").trim();
  return NAMES[k] || fallback || "";
}

/* How a thing friends talk about is named in a sentence: "your porch", "Ana's greenhouse", "tu porche", "el invernadero de Ana".
   kind: house, indoor, outdoor, porch, greenhouse, balcony, garden or plant (word is then the plant's name).
   form: "your", "their", "of" (who's) or "plain". */
const THING_EN = {house:"house", indoor:"indoor plants", outdoor:"outdoor garden", porch:"porch", greenhouse:"greenhouse", balcony:"balcony", garden:"garden"};
const THING_ES = {house:["la", "casa"], indoor:["las", "plantas de interior"], outdoor:["el", "jardín"], porch:["el", "porche"],
  greenhouse:["el", "invernadero"], balcony:["el", "balcón"], garden:["el", "jardín"]};
function thingPhrase(kind, word, form, who){
  if(LANG === "es"){
    const [art, w] = kind === "plant" ? ["", word] : THING_ES[kind] || ["el", kind];
    const many = art === "las";
    if(form === "your") return (many ? "tus " : "tu ") + w;
    if(form === "their") return (many ? "sus " : "su ") + w;
    if(form === "of") return (art ? art + " " : "") + w + " de " + who;
    return (art ? art + " " : "") + w;
  }
  const w = kind === "plant" ? word : THING_EN[kind] || kind;
  return form === "your" ? "your " + w : form === "their" ? "their " + w : form === "of" ? `${who}'s ${w}` : w;
}

/* History lines are saved in English (the same on every phone), and shown in the app's language. */
function logText(d){
  d = String(d || "");
  if(LANG === "en") return d;
  const spot = x => STR[x] != null ? STR[x] : STR[cap(x)] != null ? STR[cap(x)].toLowerCase() : x;
  let m;
  if((m = d.match(/^Moved to: (.+)$/))) return tr("Moved to: {spot}", {spot:spot(m[1])});
  if((m = d.match(/^Planted in the ground \((.+)\)$/))) return tr("Planted in the ground ({spot})", {spot:spot(m[1])});
  if((m = d.match(/^Dug up, now: (.+)$/))) return tr("Dug up, now: {spot}", {spot:spot(m[1])});
  return tr(d);
}

/* The fixed texts of index.html: text, placeholder, aria-label, title and alt, matched against the table. */
function translateStatic(root){
  if(LANG === "en") return;
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {acceptNode:n =>
    n.parentNode && /^(SCRIPT|STYLE)$/.test(n.parentNode.nodeName) || n.parentNode.closest && n.parentNode.closest("svg") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT});
  const nodes = [];
  while(walk.nextNode()) nodes.push(walk.currentNode);
  nodes.forEach(n => {
    const s = n.nodeValue, k = s.trim();
    if(k && STR[k] != null) n.nodeValue = s.replace(k, STR[k]);
  });
  root.querySelectorAll("[placeholder],[aria-label],[title],[alt]").forEach(el => {
    ["placeholder", "aria-label", "title", "alt"].forEach(a => { const v = el.getAttribute(a); if(v && STR[v] != null) el.setAttribute(a, STR[v]); });
  });
}
translateStatic(document.body);
