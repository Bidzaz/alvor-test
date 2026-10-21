/* Alvor · Add a plant: identification is the way in. A photo, the likely species with how sure Pl@ntNet is (and the
   look-alikes), a care card from Alvor's plant knowledge (cold, water, light, growth, toxicity), then "Add to my
   garden" with sensible defaults and only the spot to choose. The care values can still be adjusted before saving,
   and "Just looking" closes without adding anything. A plant someone gave you as a cutting starts here too.
   Plain script (no build step): loaded by index.html in a fixed order and sharing one global scope. */
"use strict";
/* ---------- Add a plant, step by step ---------- */
const wiz = $("#wiz");
/* Steps: 0 photo, 1 what it is (and its care card), 2 where it lives (then save), 3 care values (optional). */
const STEP_TITLES = [tr("Take a photo"), tr("What plant is it?"), tr("Where does it live?"), tr("Care")];
const CAMERA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 8h3l1.5-2.5h7L17 8h3v11H4z"/><circle cx="12" cy="13.2" r="3.6"/></svg>';
let W = null;
function openWizard(preset){
  W = {step:0, photos:[], photoTs:[], got:"", results:null, loading:false, error:"", pick:null, species:"", genus:"", family:"", common:"",
       name:"", nameTouched:false, pattern:"outdoor", area:ZONES[defaultZone("outdoor")].area, zone:defaultZone("outdoor"), planting:defaultPlanting("outdoor"), zoneTouched:false,
       minTemp:"", ws:7, ww:14, last:"", notes:"", careTouched:false, coldAlert:true, coldTouched:false, identifiedFor:"", visibility:defaultVis(), visOpen:false, typed:false, ...(preset || {})};
  if(preset && (preset.species || preset.genus)){ W.step = 1; W.typed = true; applySpecies(); }
  renderWizard(); wiz.showModal();
}
/* The spot that suits it: its light (plant-kb.js) and where it lives through the year. */
function spotFor(pattern, light){
  if(pattern === "indoor") return light === "H" ? "house-low" : "house-window";
  if(isApt()) return light === "H" ? "balc-shade" : light === "P" ? "balc-partial" : "balc-sun";
  return light === "H" ? "out-shade" : light === "P" ? "out-partial" : "out-sun";
}
function applySpecies(){
  const pr = findPreset(W.species, W.genus);
  if(!W.careTouched){
    if(pr){ W.minTemp = pr.min; if(pr.ws) W.ws = pr.ws; if(pr.ww) W.ww = pr.ww; }
    else { W.minTemp = ""; }
  }
  if(pr && !W.zoneTouched){
    W.pattern = isApt() && pr.pat === "greenhouse" ? "mover" : pr.pat;
    const pf = KB.profile(W.species, W.genus);
    W.zone = spotFor(W.pattern, pf && pf.light); W.area = ZONES[W.zone].area; W.top = null; W.place = null; W.planting = defaultPlanting(W.pattern);
  }
  if(!W.coldTouched) W.coldAlert = coldDefault(W.minTemp);
  if(!W.nameTouched) W.name = W.common || plantName(W.species, (pr && pr.n) || "") || W.species || W.genus || "";
}
function wizPick(i){
  W.pick = i;
  if(i === "other"){ W.species = ""; W.genus = ""; W.family = ""; W.common = ""; W.typed = true; }
  else { const r = W.results[i]; W.species = r.species; W.genus = r.genus; W.family = r.family; W.common = plantName(r.species, r.common); W.typed = false; }
  applySpecies(); renderWizard();
}
async function identify(){
  const sig = W.photos.map(p => p.length).join(",");
  if(W.identifiedFor === sig && W.results) return;
  W.loading = true; W.error = ""; W.results = null; W.pick = null; renderWizard();
  try{
    const images = await Promise.all(W.photos.map(async p => (await drawJpeg(p, 1280, 0.85)).toDataURL("image/jpeg", 0.85)));
    const {r, j} = await callFn("identify", {images, lang:LANG});
    if(r.status === 401){ W.loading = false; wiz.close(); sessionExpired(); return; }
    if(!r.ok) throw new Error(tr(j.error || "Identification didn't work."));
    W.results = j.results || []; W.identifiedFor = sig;
    if(W.results.length) wizPick(0);
  }catch(e){ W.error = e.message || tr("Identification didn't work."); }
  W.loading = false; renderWizard();
}
/* How sure Pl@ntNet is, in words. */
const sureWord = s => s >= 0.6 ? tr("Very likely") : s >= 0.35 ? tr("Probably") : s >= 0.15 ? tr("Possibly") : tr("Not sure");
const sureCls = s => s >= 0.6 ? "hi" : s >= 0.35 ? "mid" : "lo";
function idOption(r, i){
  const pct = Math.round(r.score * 100), name = plantName(r.species, r.common);
  return `<button class="id-opt ${i === W.pick ? "on" : ""}" data-wact="pick" data-i="${i}" aria-pressed="${W.pick === i}">
    ${r.image ? `<img src="${esc(r.image)}" alt="" loading="lazy">` : `<span class="noimg"></span>`}
    <span>${name ? `<b>${esc(name)}</b>` : ""}<i>${esc(r.species)}</i><small>${esc([r.family, findPreset(r.species, r.genus) ? "" : tr("not in Alvor's plant knowledge")].filter(Boolean).join(" · "))}</small></span>
    <span class="conf c-${sureCls(r.score)}"><b>${sureWord(r.score)}</b>${pct}%<span class="bar"><span style="width:${Math.max(3, pct)}%"></span></span></span>
  </button>`;
}
function renderWizard(){
  if(!W) return;
  $("#wizSteps").innerHTML = STEP_TITLES.slice(0, 3).map((_, i) => `<span class="${i <= Math.min(W.step, 2) ? "on" : ""}"></span>`).join("");
  $("#wizTitle").textContent = W.step === 1 && W.results && W.results.length && !W.typed ? tr("Here's what it looks like") : STEP_TITLES[W.step];
  const body = $("#wizBody"), next = $("#wizNext"), back = $("#wizBack");
  back.textContent = W.step === 0 ? tr("Cancel") : tr("Back");
  next.disabled = false; next.textContent = tr("Next");

  if(W.step === 0){
    body.innerHTML = `<p class="wiz-lead">${tr("Fill the frame with a leaf or a flower. You can add up to 3 photos of the same plant for a better match.")}</p>
      ${W.photos.length ? `<div class="wiz-photos">${W.photos.map((p, i) => `<div class="ph"><img src="${p}" alt="${tr("Photo {n}", {n:i + 1})}"><button class="rm" data-wact="rmPhoto" data-i="${i}" aria-label="${tr("Remove photo")}">×</button></div>`).join("")}</div>` : ""}
      ${W.photos.length < 3 ? `<div class="shot-row"><button class="shot" data-wact="camera">${CAMERA}${W.photos.length ? tr("Take another photo") : tr("Take a photo")}</button><button class="shot alt" data-wact="shoot"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"><rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="M20.5 16l-5-5-8 8.5"/></svg>${W.photos.length ? tr("Add from gallery") : tr("Choose from gallery")}</button></div>` : ""}
      <button class="linkish" data-wact="skip">${tr("I know what it is, skip the photo")}</button>`;
    next.textContent = online && token && IDENTIFY_READY ? tr("Identify") : tr("Next");
    next.disabled = !W.photos.length;
  }
  else if(W.step === 1){
    let html = "";
    if(W.loading) html = `<div class="loading"><div class="spin"></div>${tr("Looking at your photo…")}</div>`;
    else{
      if(W.error) html += `<div class="warn">${esc(W.error)}</div>`;
      if(W.results && !W.results.length) html += `<div class="warn">${tr("No plant was recognised in this photo. Try a closer shot of a leaf or flower, or type the name below.")}</div>`;
      const showList = W.results && W.results.length;
      if(showList){
        const top = W.results[0].score;
        if(top < 0.25) html += `<div class="warn">${tr("Not sure about this one. A close-up of a leaf or flower usually helps.")} <button class="linkish" data-wact="morePhotos">${tr("Add another photo")}</button></div>`;
        const pick = typeof W.pick === "number" ? W.pick : 0;
        html += `<div class="id-list">${idOption(W.results[pick], pick)}</div>`;
        const others = W.results.map((r, i) => [r, i]).filter(([, i]) => i !== pick).slice(0, 4);
        if(others.length) html += `<h3 class="pick-h">${tr("Could also be")}</h3><div class="id-list alts">${others.map(([r, i]) => idOption(r, i)).join("")}
          <button class="id-opt" data-wact="pick" data-i="other" aria-pressed="${W.pick === "other"}"><span class="noimg"></span><span><i>${tr("Something else")}</i><small>${tr("Type the name yourself")}</small></span><span></span></button></div>`;
      }
      if(!showList || W.typed) html += `<div class="field"><label for="wSpecies">${tr("Species")}</label><input id="wSpecies" autocomplete="off" autocapitalize="words" spellcheck="false" value="${esc(W.species)}" placeholder="${tr("Start typing, e.g. Musa basjoo")}"></div>
        <div class="field"><label for="wGenus">${tr("Genus")}</label><input id="wGenus" value="${esc(W.genus)}" placeholder="${tr("e.g. Musa")}"><span class="hint">${tr("Leave the species empty if you only know the genus.")}</span></div>`;
      if(W.species || W.genus){
        const pr = findPreset(W.species, W.genus);
        html += `<h3 class="pick-h">${pr ? tr("Caring for it") : tr("Care")}</h3><div id="wCare">${careCardHtml(pr)}</div>`;
      }
      if(showList) html += `<p class="credit">${tr("Identification by the Pl@ntNet recognition API (my.plantnet.org).")}</p>`;
      html += `<button class="linkish wiz-look" data-wact="look">${tr("Just looking: close without adding it")}</button>`;
    }
    body.innerHTML = html;
    next.disabled = W.loading || !(W.species || W.genus);
    next.textContent = tr("Add to my garden");
    const sp = $("#wSpecies"), ge = $("#wGenus");
    if(sp){
      const care = () => { const c = $("#wCare"), pr = findPreset(W.species, W.genus); if(c) c.innerHTML = careCardHtml(pr); else if(W.species || W.genus) renderWizardKeep(); next.disabled = !(W.species || W.genus); };
      sp.addEventListener("input", () => { W.species = sp.value.trim(); if(!ge.dataset.touched){ W.genus = W.species.split(" ")[0] || ""; ge.value = W.genus; } W.common = ""; applySpecies(); care(); });
      attachSuggest(sp, it => { W.species = it.name; W.genus = it.genus; W.family = it.family || W.family; W.common = it.common || ""; ge.value = it.genus; applySpecies(); care(); });
      ge.addEventListener("input", () => { ge.dataset.touched = "1"; W.genus = ge.value.trim(); applySpecies(); care(); });
    }
  }
  else if(W.step === 2){
    const pf = KB.profile(W.species, W.genus), best = pf ? LIGHT_WORD[W.pattern === "indoor" ? "in" : "out"][pf.light] : "";
    body.innerHTML = `<div class="field"><label for="wName">${tr("Name")}</label><input id="wName" value="${esc(W.name)}" placeholder="${tr("e.g. Big banana by the pond")}">
        ${W.species || W.genus ? `<span class="hint"><i>${esc(W.species || W.genus)}</i>${W.family ? `, ${esc(W.family)}` : ""}</span>` : ""}</div>
      <p class="wiz-lead" style="margin-top:14px">${tr("Where is it right now?")}${best ? ` <span class="status">${tr("It likes: {light}", {light:esc(best.toLowerCase())})}</span>` : ""}</p>
      <div class="picker" id="wPick">${pickerHtml(W)}</div>
      <div class="field" style="margin-top:14px"><label for="wPattern">${tr("Through the year")}</label>
        <select id="wPattern">${patternOptions()}</select><span class="hint">${tr("Used for reminders to move it in autumn and out in spring.")}</span></div>
      <details class="wiz-more" ${W.got ? "open" : ""}><summary>${tr("When did you get it?")}</summary>
        <div class="field"><input id="wGot" type="date" max="${today()}" value="${esc(W.got)}" aria-label="${tr("When did you get it?")}"><span class="hint">${tr("Optional. It starts the plant's journal; leave it empty if it's new today.")}</span></div></details>
      ${online ? `<div class="vis-box" id="wVis">${visBlock(W.visibility, W.visOpen)}</div>` : ""}
      <button class="linkish" data-wact="care">${tr("Adjust the care values first")}</button>`;
    $("#wPattern").value = W.pattern;
    $("#wPattern").addEventListener("change", e => { W.pattern = e.target.value; });
    $("#wGot").addEventListener("change", e => { W.got = e.target.value && e.target.value <= today() ? e.target.value : ""; });
    const n = $("#wName");
    n.addEventListener("input", () => { W.name = n.value; W.nameTouched = true; next.disabled = !W.name.trim() || !W.zone; });
    $("#wPick").addEventListener("click", e => { if(pickerClick(e, W)){ W.zoneTouched = true; $("#wPick").innerHTML = pickerHtml(W); $("#wizNext").disabled = !W.zone || !W.name.trim(); } });
    if(online) $("#wVis").addEventListener("click", e => onVisClick(e, W, $("#wVis")));
    next.textContent = tr("Save plant");
    next.disabled = !W.name.trim() || !W.zone;
    if(!W.name.trim()) setTimeout(() => n.focus(), 50);
  }
  else if(W.step === 3){
    const pr = findPreset(W.species, W.genus);
    const from = pr && ({species:"Filled in for {s}.", genus:"Filled in for the genus {s}.", related:"Filled in from its genus, {s}."}[pr.how] || "Filled in from a related plant, {s}.");
    const rough = pr && pr.sure < 2 && pr.range ? " " + tr("It's a rough guess: its species take {lo} to {hi}.", {lo:deg(pr.range[0]), hi:deg(pr.range[1])}) : "";
    body.innerHTML = `${pr ? `<div class="preset-note">${tr(from, {s:`<i>${esc(pr.s)}</i>`})}${rough} ${tr("Adjust anything you know better.")}${pr.note ? "<br>" + esc(tr(pr.note)) : ""}</div>`
        : `<div class="warn">${tr("No care data for this plant yet. Set a cautious cold limit, or switch low temperature warnings off; you can change it any time.")}</div>`}
      <label class="check"><input type="checkbox" id="wCold" ${W.coldAlert ? "checked" : ""}><span>${tr("Low temperature warnings for this plant")}<br><span class="status" id="wColdHint">${W.coldAlert ? COLD_HINT_ON : COLD_HINT_OFF}</span></span></label>
      <div class="row3">
        <div class="field"><label for="wMin">${tr("Lowest °C it takes")}</label><input id="wMin" type="number" step="0.5" value="${esc(W.minTemp)}"></div>
        <div class="field"><label for="wWs">${tr("Water every (summer)")}</label><input id="wWs" type="number" min="1" value="${esc(W.ws)}"><span class="hint">${tr("days")}</span></div>
        <div class="field"><label for="wWw">${tr("Water every (winter)")}</label><input id="wWw" type="number" min="1" value="${esc(W.ww)}"><span class="hint">${tr("days")}</span></div>
      </div>
      <div class="field"><label for="wLast">${tr("Last watered")}</label><input id="wLast" type="date" value="${esc(W.last)}"></div>
      <div class="field"><label for="wNotes">${tr("Notes")}</label><textarea id="wNotes" rows="3">${esc(W.notes)}</textarea></div>`;
    [["#wMin","minTemp"],["#wWs","ws"],["#wWw","ww"],["#wLast","last"],["#wNotes","notes"]].forEach(([id, k]) =>
      $(id).addEventListener("input", e => { W[k] = e.target.value; if(k !== "last" && k !== "notes") W.careTouched = true; }));
    const showCold = () => { $("#wCold").checked = W.coldAlert; $("#wColdHint").textContent = W.coldAlert ? COLD_HINT_ON : COLD_HINT_OFF; };
    $("#wCold").addEventListener("change", e => { W.coldAlert = e.target.checked; W.coldTouched = true; showCold(); });
    $("#wMin").addEventListener("input", () => { if(!W.coldTouched){ W.coldAlert = coldDefault(W.minTemp); showCold(); } });
    next.textContent = tr("Save plant");
    next.disabled = !W.name.trim() || !W.zone;
  }
}
/* Redraws step 1 keeping the cursor in the species field (the care card appears once a plant is known). */
function renderWizardKeep(){
  const a = document.activeElement, id = a && a.id, pos = a && a.selectionStart;
  renderWizard();
  const el = id && document.getElementById(id); if(el){ el.focus(); try{ el.setSelectionRange(pos, pos); }catch(e){} }
}
async function wizSave(){
  const min = parseFloat(W.minTemp);
  if(W.coldAlert && isNaN(min)){
    if(W.step !== 3){ W.step = 3; renderWizard(); }
    toast(tr("Add the lowest temperature it takes, or switch low temperature warnings off")); $("#wMin").focus(); return;
  }
  if(!W.name.trim()){ W.step = 2; renderWizard(); toast(tr("Give the plant a name")); return; }
  const p = {id:uid(), created:new Date().toISOString(), visibility:VIS[W.visibility] ? W.visibility : defaultVis(), name:W.name.trim(), species:W.species, genus:W.genus || (W.species.split(" ")[0] || ""), family:W.family,
    pattern:W.pattern, minTemp:isNaN(min) ? null : min, coldAlert:!!W.coldAlert, ws:Math.max(1, parseInt(W.ws) || 7), ww:Math.max(1, parseInt(W.ww) || 14),
    lastWatered:W.last || null, notes:String(W.notes || "").trim()};
  if(W.from) p.from = W.from;   // a cutting from a friend: whose plant it came from
  p.own = KB.ownOf(p);
  applyZone(p, W.zone, W.planting);
  const pl = placeById(W.place); if(pl && placeZones(pl).includes(p.zone)) p.place = pl.id;   // one of your own places
  const got = W.got && W.got < today() ? W.got : W.gotNote ? today() : "";
  if(got) p.journal = [{id:uid(), d:got, k:"acquired", m:Date.now(), ...(W.gotNote ? {n:W.gotNote} : {})}];
  state.plants.push(p); addLog(p.id, "add", "Added");
  const now = Date.now();
  const list = W.photos.map((data, i) => { const ts = Math.min(W.photoTs[i] || now, now) - i; return {id:uid(), plantId:p.id, date:ymd(new Date(ts)), ts, data}; });
  for(const ph of list){ try{ await idb.put(ph); }catch(e){} }
  if(list.length) photos[p.id] = list;
  const done = W.onSaved;
  save(); wiz.close(); W = null; render(); toast(tr("{name} added", {name:p.name}));
  if(done) done(p);
}
$("#wizBody").addEventListener("click", e => {
  const b = e.target.closest("[data-wact]"); if(!b || !W) return;
  const a = b.dataset.wact;
  if(a === "shoot") $("#wizFile").click();
  else if(a === "camera") $("#wizCam").click();
  else if(a === "rmPhoto"){ W.photos.splice(+b.dataset.i, 1); W.photoTs.splice(+b.dataset.i, 1); renderWizard(); }
  else if(a === "skip"){ W.step = 1; W.results = null; W.error = ""; W.typed = true; renderWizard(); setTimeout(() => { const s = $("#wSpecies"); if(s) s.focus(); }, 50); }
  else if(a === "morePhotos"){ W.step = 0; renderWizard(); }
  else if(a === "pick") wizPick(b.dataset.i === "other" ? "other" : +b.dataset.i);
  else if(a === "look"){ wiz.close(); W = null; }
  else if(a === "care"){ W.step = 3; renderWizard(); }
});
async function wizAddFiles(input){
  const files = [...input.files].slice(0, 3 - W.photos.length); input.value = "";
  for(const f of files){ try{ const ts = await photoWhen(f); W.photos.push(await resizeImage(f)); W.photoTs.push(ts); }catch(err){ toast(tr("Couldn't use that photo")); } }
  renderWizard();
}
$("#wizFile").addEventListener("change", e => wizAddFiles(e.target));
$("#wizCam").addEventListener("change", e => wizAddFiles(e.target));
$("#wizNext").addEventListener("click", async () => {
  if(W.step === 0){
    W.step = 1; W.typed = false; renderWizard();
    if(online && token && IDENTIFY_READY) identify();
    else { W.error = online && token ? tr("Plant identification isn't available right now. Type the name below.") : tr("Identification works when you're signed in on your site. Type the name below."); W.typed = true; renderWizard(); }
    return;
  }
  if(W.step >= 2) return wizSave();
  W.step++; renderWizard();
});
$("#wizBack").addEventListener("click", () => {
  if(W.step === 0 || (W.step === 1 && !W.photos.length && W.from)){ wiz.close(); W = null; return; }
  W.step = W.step === 3 ? 2 : W.step - 1; renderWizard();
});
$("#wizClose").addEventListener("click", () => { wiz.close(); W = null; });
