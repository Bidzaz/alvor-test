/* Alvor · "Something wrong?" in the plant sheet: pick what you see, get the likely causes for this plant (the rules
   are in plant-health.js) and what to do, and keep it in the journal as "Problem noticed".
   Plain script (no build step): loaded by index.html in a fixed order and sharing one global scope. */
"use strict";
const AH = window.AlvorHealth;
const hlDlg = $("#hlDlg");
let HL = null;   // {id (plant), picked:Set, result}
const SURE = {likely:tr("Likely"), possible:tr("Possible"), "less likely":tr("Less likely")};
function openHealth(id){
  const p = plantById(id); if(!p) return;
  HL = {id, picked:new Set(), result:null};
  renderHealth(); hlDlg.showModal(); $("#hlBody").scrollTop = 0;
}
/* A why line from the rules, in the app's language (a day comes as YYYY-MM-DD). */
const hlWhy = ([t, v]) => tr(t, v ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === "day" && /^\d{4}-\d\d-\d\d$/.test(x) ? jDate(x, false) : x])) : undefined);
function renderHealth(){
  const p = plantById(HL.id); if(!p) return hlDlg.close();
  $("#hlTitle").textContent = tr("What's wrong with {name}?", {name:p.name});
  const foot = $("#hlFoot");
  if(!HL.result){
    $("#hlBody").innerHTML = `<p class="status" style="margin-top:0">${tr("Tap everything you see. Alvor weighs it against this plant's last nights, its watering, light and feeding, and what you've told it.")}</p>
      <div class="hl-sym">${AH.SYMPTOMS.map(([k, label]) => `<button type="button" class="chip" data-hs="${k}" aria-pressed="${HL.picked.has(k)}">${tr(label)}</button>`).join("")}</div>`;
    foot.innerHTML = `<button class="btn" data-hl="close">${tr("Cancel")}</button><button class="btn primary" data-hl="check" ${HL.picked.size ? "" : "disabled"}>${tr("See likely causes")}</button>`;
    return;
  }
  const R = HL.result, picked = AH.SYMPTOMS.filter(([k]) => HL.picked.has(k)).map(([, l]) => tr(l));
  $("#hlBody").innerHTML = `<p class="hl-picked">${esc(picked.join(" · "))} <button type="button" class="linkish" data-hl="back">${tr("Change")}</button></p>` +
    (R.length ? R.map((c, i) => `<div class="hl-cause s-${c.sure.replace(" ", "-")} ${i ? "" : "hl-first"}">
        <span class="hl-sure">${SURE[c.sure]}</span><h3>${esc(tr(c.title))}</h3>
        ${c.why.length ? `<ul>${c.why.map(w => `<li>${esc(hlWhy(w))}</li>`).join("")}</ul>` : ""}
        <p>${esc(tr(c.advice))}</p></div>`).join("")
      : `<p class="status">${tr("Alvor can't tell from this. A photo shared with a friend, or a garden centre, may help.")}</p>`) +
    `<p class="status hl-note">${tr("Alvor can't see the plant: this is what fits best, not a diagnosis. Look closely, and tell Alvor what you find.")}</p>`;
  foot.innerHTML = `<button class="btn" data-hl="close">${tr("Close")}</button><button class="btn primary" data-hl="note">${tr("Note it in the journal")}</button>`;
}
$("#hlBody").addEventListener("click", e => {
  const s = e.target.closest("[data-hs]");
  if(s){ const k = s.dataset.hs; if(HL.picked.has(k)) HL.picked.delete(k); else HL.picked.add(k); s.setAttribute("aria-pressed", HL.picked.has(k)); $("#hlFoot [data-hl=check]").disabled = !HL.picked.size; }
});
hlDlg.addEventListener("click", e => {
  const b = e.target.closest("[data-hl]"); if(!b || !HL) return;
  const a = b.dataset.hl, p = plantById(HL.id);
  if(a === "close"){ hlDlg.close(); HL = null; }
  else if(a === "back"){ HL.result = null; renderHealth(); }
  else if(a === "check"){
    const f = AH.facts(p, ctx(), {log:state.log, plants:state.plants});
    HL.result = AH.diagnose([...HL.picked], f, p);
    renderHealth(); $("#hlBody").scrollTop = 0;
  }else if(a === "note"){
    const picked = AH.SYMPTOMS.filter(([k]) => HL.picked.has(k)).map(([, l]) => tr(l)).join(", ");
    const top = (HL.result || []).filter(c => c.sure !== "less likely").map(c => tr(c.title)).join(", ");
    const n = cap(picked) + (top ? "\n" + tr("Likely: {causes}", {causes:top}) : "");
    const id = HL.id; hlDlg.close(); HL = null;
    openMs(id, null, {k:"issue", n});
  }
});
