/* Alvor · Swapping cuttings between friends. Mark a plant "Cuttings to share"; friends see it, tap "Ask for a
   cutting" (with a note if they like), you answer Yes or Not now, and mark it Given when they have it. Both journals
   remember it: "Propagated · A cutting for Ana" on yours, "Got it · A cutting of Banana from Diogo" on the new plant,
   which is added in one go from the request. Who may ask and answer is checked by the database (part 10).
   Plain script (no build step): loaded by index.html in a fixed order and sharing one global scope. */
"use strict";
let cuts = null, cutsAt = 0, cutsBusy = null;   // the requests you're part of; false when the database has no cuttings yet
const missingTable = e => e && (e.code === "42P01" || e.code === "PGRST205" || /relation .* does not exist|could not find the table/i.test(e.message || ""));
async function loadCuttings(force){
  if(!online || !token || !me || cuts === false) return cuts;
  if(!force && cuts && Date.now() - cutsAt < 30000) return cuts;
  if(cutsBusy) return cutsBusy;
  cutsBusy = (async () => {
    try{
      const r = await sb.from("cutting_requests").select("*");
      if(r.error){ if(missingTable(r.error)) cuts = false; else throw r.error; }
      else{
        cuts = (r.data || []).sort((a, b) => (b.answered_at || b.created_at).localeCompare(a.answered_at || a.created_at)); cutsAt = Date.now();
        const unknown = [...new Set(cuts.map(c => c.owner_id === me.id ? c.requester_id : c.owner_id))].filter(id => !people[id]);
        if(unknown.length){ try{ notePeople(must(await sb.from("profiles").select("id,username,display_name,avatar_path").in("id", unknown))); }catch(e){} }
      }
    }catch(e){ if(isAuthErr(e)) sessionExpired(); }
    drawCutViews();
    return cuts;
  })().finally(() => { cutsBusy = null; });
  return cutsBusy;
}
function drawCutViews(){
  if(currentTab === "friends"){ const c = $("#cutCard"); if(c) c.outerHTML = cuttingsCardHtml() || `<div id="cutCard" hidden></div>`; }
  if(currentTab === "friend" && visit && !visit.loading) renderFriend();
  if(fplant.open && visit){ const el = $("#fpCut"), x = visit.plants && visit.plants.find(q => q.id === fplant.dataset.pid); if(el && x) el.innerHTML = cutAskHtml(visit.id, x); }
  if(dlg.open && editingId) drawCutBox(plantById(editingId));
}
const cutWho = c => personById(c.owner_id === me.id ? c.requester_id : c.owner_id);
const cutWhen = c => shortDate(c.given_at || c.answered_at || c.created_at);
const openMine = c => c.requester_id === me.id && ["asked", "yes"].includes(c.status);

/* ---------- On a friend's plant: ask, or where your request stands ---------- */
function cutAskHtml(owner, x){
  if(cuts === false) return "";
  const mine = (cuts || []).filter(c => c.plant_id === x.id && c.requester_id === me.id && c.status !== "cancelled")
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const who = esc(personName(visit && visit.prof || personById(owner)));
  const lead = `<p class="fp-cut-h">${ICON.cutting}<b>${tr("Cuttings to share")}</b></p>`;
  if(!mine || (mine.status === "given" && mine.added_at) || mine.status === "no")
    return lead + (mine && mine.status === "no" ? `<p class="status">${tr("{name} said not now on {date}.", {name:who, date:cutWhen(mine)})}</p>` : "")
      + `<button class="btn small primary" data-cut="ask" data-p="${esc(x.id)}" data-o="${esc(owner)}">${mine ? tr("Ask again") : tr("Ask for a cutting")}</button>`;
  return lead + cutStatusHtml(mine);
}
/* Where a request stands, and what you can do, from either side. */
function cutStatusHtml(c){
  const who = esc(personName(cutWho(c))), plant = esc(c.plant_name), mineAsk = c.requester_id === me.id;
  const q = t => t ? `<span class="cut-q">“${esc(t)}”</span>` : "";
  const btn = (a, label, cls) => `<button class="btn small ${cls || ""}" data-cut="${a}" data-id="${esc(c.id)}">${label}</button>`;
  if(mineAsk){
    if(c.status === "asked") return `<p>${tr("You asked {name} for a cutting of {plant} on {date}.", {name:who, plant, date:shortDate(c.created_at)})}</p>${q(c.note)}<div class="cut-acts">${btn("cancel", tr("Cancel"))}</div>`;
    if(c.status === "yes") return `<p>${tr("{name} said yes to a cutting of {plant}.", {name:who, plant})}</p>${q(c.reply)}<div class="cut-acts">${btn("cancel", tr("I don't need it now"))}</div>`;
    if(c.status === "given") return c.added_at ? `<p>${tr("Your cutting of {plant} from {name} is in your garden.", {plant, name:who})}</p><div class="cut-acts">${btn("clear", tr("Clear"))}</div>`
      : `<p>${tr("{name} gave you a cutting of {plant}.", {name:who, plant})}</p>${q(c.reply)}<div class="cut-acts">${btn("add", tr("Add it to my garden"), "primary")}${btn("clear", tr("Clear"))}</div>`;
    if(c.status === "no") return `<p>${tr("{name} said not now to a cutting of {plant}.", {name:who, plant})}</p><div class="cut-acts">${btn("clear", tr("Clear"))}</div>`;
    return "";
  }
  if(c.status === "asked") return `<p>${tr("{name} would like a cutting of your {plant}.", {name:who, plant})}</p>${q(c.note)}<div class="cut-acts">${btn("yes", tr("Yes"), "primary")}${btn("given", tr("Given"))}${btn("no", tr("Not now"))}</div>`;
  if(c.status === "yes") return `<p>${tr("You said yes to {name} for a cutting of {plant}.", {name:who, plant})}</p>${q(c.reply)}<div class="cut-acts">${btn("given", tr("Given"), "primary")}${btn("no", tr("Not now"))}</div>`;
  if(c.status === "given") return `<p>${tr("You gave {name} a cutting of {plant} on {date}.", {name:who, plant, date:cutWhen(c)})}</p><div class="cut-acts">${btn("clear", tr("Clear"))}</div>`;
  return "";
}
/* In a friend's garden: their plants with cuttings to share. */
function cuttingsToShareHtml(V){
  if(cuts === false) return "";
  const list = (V.plants || []).filter(x => x.cuttings);
  if(!list.length) return "";
  return `<div class="card cut-share"><h3 class="tk-card-h">${ICON.cutting}${tr("Cuttings to share")}</h3>
    <div class="chips">${list.map(x => `<button class="chip" data-gact="plant" data-id="${esc(x.id)}">${esc(x.name)}</button>`).join("")}</div></div>`;
}

/* ---------- Community: requests to you and yours ---------- */
function cuttingsCardHtml(){
  if(!cuts || !cuts.length) return "";
  const toMe = cuts.filter(c => c.owner_id === me.id && ["asked", "yes", "given"].includes(c.status));
  const mine = cuts.filter(c => c.requester_id === me.id && c.status !== "cancelled");
  if(!toMe.length && !mine.length) return "";
  const row = c => `<div class="cut-row" data-cutid="${esc(c.id)}">${personAv(cutWho(c))}<div class="cut-t">${cutStatusHtml(c)}</div></div>`;
  return `<div class="card f-card" id="cutCard"><h2>${tr("Cuttings")}</h2>
    ${toMe.length ? `<h3 class="pick-h">${tr("Asked of you")}</h3>${toMe.map(row).join("")}` : ""}
    ${mine.length ? `<h3 class="pick-h">${tr("You asked")}</h3>${mine.map(row).join("")}` : ""}</div>`;
}

/* ---------- Your own plant: offer cuttings, and the requests for it ---------- */
function drawCutBox(p){
  const box = $("#cutBox"), show = !!p && !p.archived && online && !!me && !!token && cuts !== false;
  box.hidden = !show; if(!show){ $("#cutReqs").innerHTML = ""; return; }
  const shared = editVis.visibility !== "vault";
  $("#fCut").checked = shared && !!p.cuttings; $("#fCut").disabled = !shared;
  $("#fCutHint").textContent = shared ? tr("Friends see it on your plant and can ask you for one.") : tr("Share the plant with friends first, then they can ask you for a cutting.");
  const reqs = (cuts || []).filter(c => c.plant_id === p.id && c.owner_id === me.id && ["asked", "yes"].includes(c.status));
  $("#cutReqs").innerHTML = reqs.map(c => `<div class="cut-row" data-cutid="${esc(c.id)}">${personAv(cutWho(c))}<div class="cut-t">${cutStatusHtml(c)}</div></div>`).join("");
}

/* ---------- Asking, answering ---------- */
const cutDlg = $("#cutDlg");
let CUT = null;   // {mode:"ask"|"yes", plant, owner, id}
function openCutDlg(o){
  CUT = o;
  const foot = $("#cutFoot");
  if(o.mode === "ask"){
    const x = visit && visit.plants.find(q => q.id === o.plant);
    $("#cutTitle").textContent = tr("A cutting of {plant}", {plant:x ? x.name : ""});
    $("#cutBody").innerHTML = `<p class="status" style="margin-top:0">${tr("{name} gets a notification and can say yes or not now.", {name:esc(personName(visit && visit.prof || {}))})}</p>
      <div class="field"><label for="cutNote">${tr("Anything to add? (optional)")}</label><textarea id="cutNote" rows="3" maxlength="300" placeholder="${tr("e.g. I could pick it up on Saturday")}"></textarea></div>`;
    foot.innerHTML = `<button class="btn" data-cut="close">${tr("Cancel")}</button><button class="btn primary" data-cut="send">${tr("Ask for a cutting")}</button>`;
  }else{
    const c = (cuts || []).find(q => q.id === o.id); if(!c) return;
    $("#cutTitle").textContent = tr("Yes to {name}", {name:personName(cutWho(c))});
    $("#cutBody").innerHTML = `<div class="field"><label for="cutNote">${tr("When or where? (optional)")}</label><textarea id="cutNote" rows="3" maxlength="300" placeholder="${tr("e.g. In spring, when it grows again")}"></textarea></div>`;
    foot.innerHTML = `<button class="btn" data-cut="close">${tr("Cancel")}</button><button class="btn primary" data-cut="sendYes">${tr("Say yes")}</button>`;
  }
  foot.hidden = false;
  cutDlg.showModal(); setTimeout(() => { const n = $("#cutNote"); if(n) n.focus(); }, 60);
}
$("#cutClose").addEventListener("click", () => { cutDlg.close(); CUT = null; });
async function cutCall(fn, args, ok){
  try{ must(await sb.rpc(fn, args)); if(ok) toast(ok); }
  catch(e){ if(isAuthErr(e)) sessionExpired(); else toast(e && e.code === "P0001" && e.message ? tr(e.message) : tr("Couldn't reach Alvor. Check your connection.")); return false; }
  await loadCuttings(true); loadFeed(true);
  return true;
}
/* "Given": the request closes, and your plant's journal remembers who got a cutting. */
async function cutGiven(c){
  if(!await cutCall("answer_cutting", {p_id:c.id, p_status:"given", p_reply:null}, tr("Marked as given"))) return;
  const p = plantById(c.plant_id);
  if(p){ jPut(p, {id:uid(), d:today(), k:"propagated", n:tr("A cutting for {name}", {name:personName(cutWho(c))}), cut:c.id}); save(); refreshJournal(); }
}
/* "Add it to my garden": the add-plant steps with the species, a name and "Got it · a cutting of … from …". */
function cutAdd(c){
  const who = personName(cutWho(c)), pr = findPreset(c.species || "", "");
  openWizard({species:c.species || "", genus:pr ? pr.s.split(" ")[0] : String(c.species || "").split(" ")[0], name:c.plant_name, nameTouched:true,
    gotNote:tr("A cutting of {plant} from {name}", {plant:c.plant_name, name:who}), from:{owner:c.owner_id, plant:c.plant_id, name:who, cut:c.id},
    onSaved:() => cutCall("cutting_added", {p_id:c.id})});
}
document.addEventListener("click", async e => {
  const b = e.target.closest("[data-cut]"); if(!b || b.disabled) return;
  const a = b.dataset.cut, c = b.dataset.id && (cuts || []).find(q => q.id === b.dataset.id);
  if(a === "ask") return openCutDlg({mode:"ask", plant:b.dataset.p, owner:b.dataset.o});
  if(a === "close"){ cutDlg.close(); CUT = null; return; }
  if(a === "send" && CUT){
    b.disabled = true;
    const okd = await cutCall("ask_cutting", {p_plant:CUT.plant, p_note:$("#cutNote").value.trim() || null}, tr("Asked. You'll hear when they answer."));
    b.disabled = false; if(okd){ cutDlg.close(); CUT = null; }
    return;
  }
  if(a === "sendYes" && CUT){
    b.disabled = true;
    const okd = await cutCall("answer_cutting", {p_id:CUT.id, p_status:"yes", p_reply:$("#cutNote").value.trim() || null}, tr("They'll get your yes"));
    b.disabled = false; if(okd){ cutDlg.close(); CUT = null; }
    return;
  }
  if(!c) return;
  b.disabled = true;
  if(a === "yes") openCutDlg({mode:"yes", id:c.id});
  else if(a === "given") await cutGiven(c);
  else if(a === "no") await cutCall("answer_cutting", {p_id:c.id, p_status:"no", p_reply:null}, tr("They'll see not now"));
  else if(a === "cancel") await cutCall("cancel_cutting", {p_id:c.id}, tr("Request cancelled"));
  else if(a === "clear") await cutCall("clear_cutting", {p_id:c.id});
  else if(a === "add") cutAdd(c);
  b.disabled = false;
});

/* Links from notifications: #cutting=<id> opens Community at the request. */
function openCutFromHash(h){
  const m = String(h || "").match(/cutting=([0-9a-f-]{36})/);
  if(!m) return false;
  if(location.hash.includes("cutting=")) history.replaceState(null, "", location.pathname);
  if(token && me){
    showTab("friends");
    loadCuttings(true).then(() => { const r = document.querySelector(`[data-cutid="${m[1]}"]`); if(r){ r.scrollIntoView({block:"center", behavior:"smooth"}); r.classList.add("flash"); } });
  }
  return true;
}
