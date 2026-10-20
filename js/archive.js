/* Alvor · The Archive: plants that left the garden (lost, given away, swapped, sold) keep their story.
   An archived plant moves from state.plants to state.archive with p.archived = {d (the day), why, cause (when lost),
   to (who got it), n (note), vis (who saw it before), j (its journal entry), at}. It leaves the alerts, the lists,
   Locations and friends' view (it goes to the Vault while archived), but its photos, journal and history stay
   and sync like any plant. "Bring it back" puts it in its old spot with its old visibility.
   Plain script (no build step): loaded by index.html in a fixed order and sharing one global scope. */
"use strict";
const ARC = {
  died:{label:tr("Lost it"), past:tr("Lost"), hint:tr("It died or didn't come back")},
  gave:{label:tr("Gave it away"), past:tr("Given away"), to:tr("Who to?"), toPh:tr("e.g. Ana, my neighbour")},
  swapped:{label:tr("Swapped it"), past:tr("Swapped"), to:tr("Who with?"), toPh:tr("e.g. the plant swap in town")},
  sold:{label:tr("Sold it"), past:tr("Sold"), to:tr("Who to?"), toPh:tr("e.g. at the market")},
  other:{label:tr("Something else"), past:tr("Left the garden")}
};
const ARC_ORDER = ["died","gave","swapped","sold","other"];
/* Only for a lost plant: what probably happened. Kept so the garden's own story can be read back later. */
const ARC_CAUSE = {frost:tr("Frost or cold"), dry:tr("Heat or drought"), wet:tr("Too wet, rot"), pests:tr("Pests or disease"),
  season:tr("End of its season"), unknown:tr("Not sure")};
const ARC_NOTE = {died:tr("What you noticed, what you'd do differently…"), gave:tr("A cutting, a gift, why…"),
  swapped:tr("What you got in return…"), sold:tr("Where, for how much…"), other:tr("What happened…")};
const ARC_ICON = SV('<rect x="3.5" y="4" width="17" height="5" rx="1.5"/><path d="M5 9v9.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V9"/><path d="M10 13h4"/>');

/* "Lost · Frost or cold", "Given away to Ana" */
function arcWhat(a){
  const R = ARC[a && a.why] || ARC.other;
  let s = R.past;
  if(a && a.to && R.to) s = {gave:tr("Given away to {who}", {who:a.to}), swapped:tr("Swapped with {who}", {who:a.to}), sold:tr("Sold to {who}", {who:a.to})}[a.why] || s;
  if(a && a.why === "died" && ARC_CAUSE[a.cause] && a.cause !== "unknown") s += " · " + ARC_CAUSE[a.cause];
  return s;
}

/* ---------- Moving a plant to the Archive, or changing what was saved ---------- */
const arcDlg = $("#arcDlg");
let AD = null;   // {id, why, cause, to, d, n, edit}
function openArchive(id){
  const p = plantById(id); if(!p) return;
  const a = p.archived;
  AD = a ? {id, why:a.why, cause:a.cause || null, to:a.to || "", d:a.d, n:a.n || "", edit:true}
    : {id, why:null, cause:null, to:"", d:today(), n:"", edit:false};
  renderArchive(); arcDlg.showModal();
}
function renderArchive(){
  const p = plantById(AD.id); if(!p) return arcDlg.close();
  $("#arcTitle").textContent = AD.edit ? tr("In the Archive") : tr("Move {name} to the Archive", {name:p.name});
  $("#arcSave").textContent = AD.edit ? tr("Save") : tr("Move to the Archive");
  const R = ARC[AD.why];
  $("#arcBody").innerHTML = (AD.edit ? "" : `<p class="status arc-intro">${tr("It leaves your garden, the alerts and what friends see. Its photos, journal and history stay in the Archive, only for you, and you can bring it back.")}</p>`) +
    `<div class="arc-why" role="group" aria-label="${tr("What happened?")}">${ARC_ORDER.map(k =>
      `<button type="button" class="arc-w w-${k}" data-aw="${k}" aria-pressed="${AD.why === k}"><b>${ARC[k].label}</b>${ARC[k].hint ? `<small>${ARC[k].hint}</small>` : ""}</button>`).join("")}</div>` +
    (AD.why === "died" ? `<div class="field"><label>${tr("What probably happened?")}</label><div class="chips arc-cause">${Object.entries(ARC_CAUSE).map(([k, l]) =>
      `<button type="button" class="chip" data-ac="${k}" aria-pressed="${AD.cause === k}">${l}</button>`).join("")}</div></div>` : "") +
    (R && R.to ? `<div class="field"><label for="arcTo">${R.to}</label><input id="arcTo" maxlength="60" value="${esc(AD.to)}" placeholder="${esc(R.toPh)}"></div>` : "") +
    `<div class="row2"><div class="field"><label for="arcDate">${tr("When")}</label><input id="arcDate" type="date" max="${today()}" value="${esc(AD.d)}"></div></div>
     <div class="field"><label for="arcNote">${tr("Note")}</label><textarea id="arcNote" rows="2" placeholder="${esc(ARC_NOTE[AD.why] || tr("Anything worth remembering…"))}">${esc(AD.n)}</textarea></div>`;
  const to = $("#arcTo"); if(to) to.addEventListener("input", e => { AD.to = e.target.value; });
  $("#arcDate").addEventListener("change", e => { AD.d = e.target.value || today(); });
  $("#arcNote").addEventListener("input", e => { AD.n = e.target.value; });
}
$("#arcBody").addEventListener("click", e => {
  const w = e.target.closest("[data-aw]"), c = e.target.closest("[data-ac]");
  if(w){ AD.why = w.dataset.aw; if(AD.why !== "died") AD.cause = null; renderArchive(); }
  else if(c){ AD.cause = AD.cause === c.dataset.ac ? null : c.dataset.ac; renderArchive(); }
});
$("#arcClose").addEventListener("click", () => { arcDlg.close(); AD = null; });
$("#arcSave").addEventListener("click", () => {
  const p = AD && plantById(AD.id); if(!p) return;
  if(!AD.why){ toast(tr("Pick what happened")); return; }
  const d = AD.d > today() ? today() : AD.d;
  const info = {d, why:AD.why};
  if(AD.why === "died" && AD.cause) info.cause = AD.cause;
  if(ARC[AD.why].to && AD.to.trim()) info.to = AD.to.trim().slice(0, 60);
  if(AD.n.trim()) info.n = AD.n.trim().slice(0, 1000);
  if(AD.edit) changeArchived(p, info); else archivePlant(p, info);
  const edit = AD.edit;
  arcDlg.close(); AD = null;
  toast(edit ? tr("Saved") : tr("{name} is in the Archive", {name:p.name}));
});

/* The journal entry that tells the story: one per time a plant leaves, kept in step with p.archived. */
function arcEntry(p, info){
  const e = {id:(p.archived && p.archived.j) || uid(), d:info.d, k:"gone", why:info.why};
  if(info.cause) e.cause = info.cause;
  if(info.to) e.to = info.to;
  if(info.n) e.n = info.n;
  jPut(p, e);
  return e.id;
}
function archivePlant(p, info){
  const vis = visOf(p);
  p.archived = {...info, vis, at:Date.now()};
  p.archived.j = arcEntry(p, info);
  p.visibility = "vault";   // friends stop seeing it, its photos and its comments (hidden, not deleted)
  state.plants = state.plants.filter(x => x.id !== p.id);
  state.archive = [p, ...(state.archive || []).filter(x => x.id !== p.id)];
  addLog(p.id, "archive", "Moved to the Archive");
  if(dlg.open && editingId === p.id) dlg.close();
  save(); render(); refreshJournal();
}
function changeArchived(p, info){
  p.archived = {...p.archived, ...info};
  ["cause", "to", "n"].forEach(k => { if(!(k in info)) delete p.archived[k]; });
  p.archived.j = arcEntry(p, info);
  save(); render(); refreshJournal();
}
function restorePlant(id){
  const p = plantById(id); if(!p || !p.archived) return;
  const vis = p.archived.vis;
  delete p.archived;
  p.visibility = ["friends","everyone","vault"].includes(vis) ? vis : "vault";
  jPut(p, {id:uid(), d:today(), k:"back"});
  state.archive = (state.archive || []).filter(x => x.id !== id);
  state.plants.push(p);
  applyZone(p, ZONES[p.zone] ? p.zone : defaultZone(p.pattern), p.planting);
  if(!areaOrder().includes(p.area)) applyZone(p, defaultZone(p.pattern));
  addLog(p.id, "archive", "Back in the garden");
  save(); render(); refreshJournal();
  toast(tr("{name} is back: {spot}. Move it if it lives somewhere else now.", {name:p.name, spot:ZONES[p.zone].label}));
}

/* ---------- The Archive in the Plants tab ---------- */
function arcSince(p){
  const s = jSince(p); if(!s || !p.archived || s.d > p.archived.d) return "";
  return daysBetween(s.d, p.archived.d) >= 1 ? tr("With you {age}", {age:jAge(s.d, p.archived.d)}) : "";
}
function arcRow(p){
  const a = p.archived, ph = latestPhoto(p.id);
  return `<button type="button" class="arc-row w-${esc(a.why)}" data-act="openArc" data-id="${p.id}">
    <span class="arc-th">${ph ? `<img src="${phSrc(ph)}" alt="" loading="lazy" decoding="async">` : `<span class="initial a-${p.area}">${esc((p.name || "?").trim().charAt(0).toUpperCase())}</span>`}</span>
    <span class="arc-tx"><b>${esc(p.name)}</b>${p.species ? `<i>${esc(p.species)}</i>` : ""}
      <span class="arc-what">${esc(arcWhat(a))} · ${jDate(a.d)}</span>${arcSince(p) ? `<small>${esc(arcSince(p))}</small>` : ""}</span></button>`;
}
function renderArchiveList(el, q){
  const list = (state.archive || []).filter(p => !q || [p.name, p.species, p.genus, p.archived.to, p.archived.n].join(" ").toLowerCase().includes(q))
    .sort((a, b) => a.archived.d < b.archived.d ? 1 : a.archived.d > b.archived.d ? -1 : a.name.localeCompare(b.name));
  el.className = "plist v-list arc-list";
  const intro = `<p class="status arc-intro">${ARC_ICON}${tr("Plants that left your garden. Their photos and journal stay here, only for you. Open one to read its story or bring it back.")}</p>`;
  if(!list.length){ el.innerHTML = intro + `<p style="color:var(--muted)">${tr("No plants match. Clear the search or pick another filter.")}</p>`; return; }
  const by = {};
  list.forEach(p => (by[p.archived.d.slice(0, 4)] ||= []).push(p));
  el.innerHTML = intro + Object.keys(by).sort().reverse().map(y =>
    `<h2 class="group-h">${y} <small>${by[y].length}</small></h2><div class="pgroup">${by[y].map(arcRow).join("")}</div>`).join("");
}

/* ---------- At the top of an archived plant's journal ---------- */
function arcBannerHtml(p){
  const a = p.archived; if(!a) return "";
  return `<div class="arc-banner w-${esc(a.why)}"><span class="arc-bi">${ARC_ICON}</span><div>
      <b>${esc(arcWhat(a))}</b><small>${jDate(a.d)}</small>${a.n ? `<p>${esc(a.n)}</p>` : ""}
      <div class="jr-acts"><button type="button" class="btn small primary" data-arc="back">${tr("Bring it back")}</button>
        <button type="button" class="btn small" data-arc="edit">${tr("Change")}</button>
        <button type="button" class="btn small danger" data-arc="del">${tr("Delete for good")}</button></div></div></div>`;
}
document.addEventListener("click", e => {
  const b = e.target.closest("[data-arc]"); if(!b) return;
  const id = jrnDlg.open && J ? J.id : editingId; if(!id) return;
  const a = b.dataset.arc;
  if(a === "open") openArchive(id);
  else if(a === "edit") openArchive(id);
  else if(a === "back"){
    const p = plantById(id); if(!p) return;
    if(confirm(tr("Bring {name} back into your garden? It returns to its old spot with its alerts.", {name:p.name}))) restorePlant(id);
  }else if(a === "del") deleteForGood(id).then(ok => { if(ok && jrnDlg.open) jrnDlg.close(); });
});
