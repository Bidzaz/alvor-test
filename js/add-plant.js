/* Alvor · Add a plant, step by step.
   Plain script (no build step): loaded by index.html in a fixed order and sharing one global scope. */
"use strict";
/* ---------- Add a plant, step by step ---------- */
const wiz = $("#wiz");
const STEP_TITLES = [tr("Take a photo"), tr("What plant is it?"), tr("Give it a name"), tr("Where does it live?"), tr("Care")];
const CAMERA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 8h3l1.5-2.5h7L17 8h3v11H4z"/><circle cx="12" cy="13.2" r="3.6"/></svg>';
let W = null;
function openWizard(){
  W = {step:0, photos:[], results:null, loading:false, error:"", pick:null, species:"", genus:"", family:"", common:"",
       name:"", nameTouched:false, pattern:"outdoor", area:ZONES[defaultZone("outdoor")].area, zone:defaultZone("outdoor"), planting:defaultPlanting("outdoor"), zoneTouched:false,
       minTemp:"", ws:7, ww:14, last:"", notes:"", careTouched:false, coldAlert:true, coldTouched:false, identifiedFor:"", visibility:defaultVis(), visOpen:false};
  renderWizard(); wiz.showModal();
}
function applySpecies(){
  const pr = findPreset(W.species, W.genus);
  if(!W.careTouched){
    if(pr){ W.minTemp = pr.min; if(pr.ws) W.ws = pr.ws; if(pr.ww) W.ww = pr.ww; if(!W.zoneTouched){ W.pattern = isApt() && pr.pat === "greenhouse" ? "mover" : pr.pat; W.zone = defaultZone(W.pattern); W.area = ZONES[W.zone].area; W.planting = defaultPlanting(W.pattern); } }
    else { W.minTemp = ""; }
  }
  if(!W.coldTouched) W.coldAlert = coldDefault(W.minTemp);
  if(!W.nameTouched) W.name = W.common || W.species || W.genus || "";
}
function wizPick(i){
  W.pick = i;
  if(i === "other"){ W.species = ""; W.genus = ""; W.family = ""; W.common = ""; }
  else { const r = W.results[i]; W.species = r.species; W.genus = r.genus; W.family = r.family; W.common = plantName(r.species, r.common); }
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
function renderWizard(){
  if(!W) return;
  $("#wizSteps").innerHTML = STEP_TITLES.map((_, i) => `<span class="${i <= W.step ? "on" : ""}"></span>`).join("");
  $("#wizTitle").textContent = STEP_TITLES[W.step];
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
      if(W.results && W.results.length){
        const top = W.results[0].score;
        if(top < 0.25) html += `<div class="warn">${tr("Not sure about this one. A close-up of a leaf or flower usually helps.")} <button class="linkish" data-wact="morePhotos">${tr("Add another photo")}</button></div>`;
        html += `<p class="wiz-lead">${tr("Tap the one that matches. Correct it below if you know better.")}</p><div class="id-list">` +
          W.results.slice(0, 3).map((r, i) => `<button class="id-opt" data-wact="pick" data-i="${i}" aria-pressed="${W.pick === i}">
            ${r.image ? `<img src="${esc(r.image)}" alt="" loading="lazy">` : `<span class="noimg"></span>`}
            <span><i>${esc(r.species)}</i>${r.common ? `<small>${esc(plantName(r.species, r.common))}</small>` : ""}<small>${esc([r.genus && tr("Genus {g}", {g:r.genus}), r.family].filter(Boolean).join(", "))}</small></span>
            <span class="conf">${Math.round(r.score * 100)}%<span class="bar"><span style="width:${Math.max(3, Math.round(r.score * 100))}%"></span></span></span>
          </button>`).join("") +
          `<button class="id-opt" data-wact="pick" data-i="other" aria-pressed="${W.pick === "other"}"><span class="noimg"></span><span><i>${tr("Something else")}</i><small>${tr("Type the name yourself")}</small></span><span></span></button></div>`;
      }
      html += `<div class="field"><label for="wSpecies">${tr("Species")}</label><input id="wSpecies" autocomplete="off" autocapitalize="words" spellcheck="false" value="${esc(W.species)}" placeholder="${tr("Start typing, e.g. Musa basjoo")}"></div>
        <div class="field"><label for="wGenus">${tr("Genus")}</label><input id="wGenus" value="${esc(W.genus)}" placeholder="${tr("e.g. Musa")}"><span class="hint">${tr("Leave the species empty if you only know the genus.")}</span></div>`;
      if(W.results && W.results.length) html += `<p class="credit">${tr("Identification by the Pl@ntNet recognition API (my.plantnet.org).")}</p>`;
    }
    body.innerHTML = html;
    next.disabled = W.loading;
    const sp = $("#wSpecies"), ge = $("#wGenus");
    if(sp){
      sp.addEventListener("input", () => { W.species = sp.value.trim(); if(!ge.dataset.touched){ W.genus = W.species.split(" ")[0] || ""; ge.value = W.genus; } W.common = ""; applySpecies(); });
      attachSuggest(sp, it => { W.species = it.name; W.genus = it.genus; W.family = it.family || W.family; W.common = it.common || ""; ge.value = it.genus; applySpecies(); });
      ge.addEventListener("input", () => { ge.dataset.touched = "1"; W.genus = ge.value.trim(); applySpecies(); });
    }
  }
  else if(W.step === 2){
    body.innerHTML = `<p class="wiz-lead">${tr("What do you call it? It could be the common name, or something like \"Big banana by the pond\".")}</p>
      <div class="field"><label for="wName">${tr("Name")}</label><input id="wName" value="${esc(W.name)}"></div>
      ${W.species || W.genus ? `<p class="status"><i>${esc(W.species || W.genus)}</i>${W.family ? `, ${esc(W.family)}` : ""}</p>` : ""}`;
    const n = $("#wName");
    n.addEventListener("input", () => { W.name = n.value; W.nameTouched = true; next.disabled = !W.name.trim(); });
    next.disabled = !W.name.trim();
    setTimeout(() => n.focus(), 50);
  }
  else if(W.step === 3){
    body.innerHTML = `<p class="wiz-lead">${tr("Where is it right now?")}</p><div class="picker" id="wPick">${pickerHtml(W)}</div>
      <div class="field" style="margin-top:14px"><label for="wPattern">${tr("Through the year")}</label>
        <select id="wPattern">${patternOptions()}</select><span class="hint">${tr("Used for reminders to move it in autumn and out in spring.")}</span></div>`;
    $("#wPattern").value = W.pattern;
    $("#wPattern").addEventListener("change", e => { W.pattern = e.target.value; });
    $("#wPick").addEventListener("click", e => { if(pickerClick(e, W)){ W.zoneTouched = true; $("#wPick").innerHTML = pickerHtml(W); $("#wizNext").disabled = !W.zone; } });
    next.disabled = !W.zone;
  }
  else if(W.step === 4){
    const pr = findPreset(W.species, W.genus);
    const from = pr && ({species:"Filled in for {s}.", genus:"Filled in for the genus {s}.", related:"Filled in from its genus, {s}."}[pr.how] || "Filled in from a related plant, {s}.");
    body.innerHTML = `${pr ? `<div class="preset-note">${tr(from, {s:`<i>${esc(pr.s)}</i>`})} ${tr("Adjust anything you know better.")}${pr.note ? "<br>" + esc(tr(pr.note)) : ""}</div>`
        : `<div class="warn">${tr("No care data for this plant yet. Set a cautious cold limit, or switch low temperature warnings off; you can change it any time.")}</div>`}
      <label class="check"><input type="checkbox" id="wCold" ${W.coldAlert ? "checked" : ""}><span>${tr("Low temperature warnings for this plant")}<br><span class="status" id="wColdHint">${W.coldAlert ? COLD_HINT_ON : COLD_HINT_OFF}</span></span></label>
      <div class="row3">
        <div class="field"><label for="wMin">${tr("Lowest °C it takes")}</label><input id="wMin" type="number" step="0.5" value="${esc(W.minTemp)}"></div>
        <div class="field"><label for="wWs">${tr("Water every (summer)")}</label><input id="wWs" type="number" min="1" value="${esc(W.ws)}"><span class="hint">${tr("days")}</span></div>
        <div class="field"><label for="wWw">${tr("Water every (winter)")}</label><input id="wWw" type="number" min="1" value="${esc(W.ww)}"><span class="hint">${tr("days")}</span></div>
      </div>
      <div class="field"><label for="wLast">${tr("Last watered")}</label><input id="wLast" type="date" value="${esc(W.last)}"></div>
      <div class="field"><label for="wNotes">${tr("Notes")}</label><textarea id="wNotes" rows="3">${esc(W.notes)}</textarea></div>
      ${online ? `<div class="vis-box" id="wVis">${visBlock(W.visibility, W.visOpen)}</div>` : ""}`;
    if(online) $("#wVis").addEventListener("click", e => onVisClick(e, W, $("#wVis")));
    [["#wMin","minTemp"],["#wWs","ws"],["#wWw","ww"],["#wLast","last"],["#wNotes","notes"]].forEach(([id, k]) =>
      $(id).addEventListener("input", e => { W[k] = e.target.value; if(k !== "last" && k !== "notes") W.careTouched = true; }));
    const showCold = () => { $("#wCold").checked = W.coldAlert; $("#wColdHint").textContent = W.coldAlert ? COLD_HINT_ON : COLD_HINT_OFF; };
    $("#wCold").addEventListener("change", e => { W.coldAlert = e.target.checked; W.coldTouched = true; showCold(); });
    $("#wMin").addEventListener("input", () => { if(!W.coldTouched){ W.coldAlert = coldDefault(W.minTemp); showCold(); } });
    next.textContent = tr("Save plant");
  }
}
async function wizSave(){
  const min = parseFloat(W.minTemp);
  if(W.coldAlert && isNaN(min)){ toast(tr("Add the lowest temperature it takes, or switch low temperature warnings off")); $("#wMin").focus(); return; }
  const p = {id:uid(), created:new Date().toISOString(), visibility:VIS[W.visibility] ? W.visibility : defaultVis(), name:W.name.trim(), species:W.species, genus:W.genus || (W.species.split(" ")[0] || ""), family:W.family,
    pattern:W.pattern, minTemp:isNaN(min) ? null : min, coldAlert:!!W.coldAlert, ws:Math.max(1, parseInt(W.ws) || 7), ww:Math.max(1, parseInt(W.ww) || 14),
    lastWatered:W.last || null, notes:String(W.notes || "").trim()};
  applyZone(p, W.zone, W.planting);
  state.plants.push(p); addLog(p.id, "add", "Added");
  const now = Date.now();
  const list = W.photos.map((data, i) => ({id:uid(), plantId:p.id, date:today(), ts:now - i, data}));
  for(const ph of list){ try{ await idb.put(ph); }catch(e){} }
  if(list.length) photos[p.id] = list;
  save(); wiz.close(); W = null; render(); toast(tr("{name} added", {name:p.name}));
}
$("#wizBody").addEventListener("click", e => {
  const b = e.target.closest("[data-wact]"); if(!b || !W) return;
  const a = b.dataset.wact;
  if(a === "shoot") $("#wizFile").click();
  else if(a === "camera") $("#wizCam").click();
  else if(a === "rmPhoto"){ W.photos.splice(+b.dataset.i, 1); renderWizard(); }
  else if(a === "skip"){ W.step = 1; W.results = null; W.error = ""; renderWizard(); }
  else if(a === "morePhotos"){ W.step = 0; renderWizard(); }
  else if(a === "pick") wizPick(b.dataset.i === "other" ? "other" : +b.dataset.i);
});
async function wizAddFiles(input){
  const files = [...input.files].slice(0, 3 - W.photos.length); input.value = "";
  for(const f of files){ try{ W.photos.push(await resizeImage(f)); }catch(err){ toast(tr("Couldn't use that photo")); } }
  renderWizard();
}
$("#wizFile").addEventListener("change", e => wizAddFiles(e.target));
$("#wizCam").addEventListener("change", e => wizAddFiles(e.target));
$("#wizNext").addEventListener("click", async () => {
  if(W.step === 0){
    W.step = 1; renderWizard();
    if(online && token && IDENTIFY_READY) identify();
    else { W.error = online && token ? tr("Plant identification isn't available right now. Type the name below.") : tr("Identification works when you're signed in on your site. Type the name below."); renderWizard(); }
    return;
  }
  if(W.step === 4) return wizSave();
  W.step++; renderWizard();
});
$("#wizBack").addEventListener("click", () => {
  if(W.step === 0){ wiz.close(); W = null; return; }
  W.step--; renderWizard();
});
$("#wizClose").addEventListener("click", () => { wiz.close(); W = null; });
