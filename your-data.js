/* Alvor · Reporting, Download my data, Delete my account, the owner's Reports.
   Plain script (no build step): loaded by index.html in a fixed order and sharing one global scope. */
"use strict";
/* ---------- Reporting ----------
   A report goes to the owner of Alvor through report_content(), which checks you can see the thing. */
const REP_REASONS = [["offensive", "Rude, offensive or hateful"], ["harassment", "Bullying or harassment"],
  ["sexual", "Nudity or sexual content"], ["spam", "Spam or a fake account"], ["other", "Something else"]];
let rep = null;
const repDlg = $("#repDlg");
function openReport(o){
  if(!online || !token) return;
  rep = o;
  const who = esc(personName(o.person));
  $("#repTitle").textContent = o.type === "profile" ? `Report ${personName(o.person)}` : o.type === "photo" ? "Report a photo" : o.type === "comment" ? "Report a comment" : "Report a plant";
  $("#repLead").innerHTML = (o.type === "profile" ? `What's wrong with ${who}'s profile or garden?` : `What's wrong with ${esc(o.what)}?`)
    + ` Reports go to the owner of Alvor, who looks at each one. ${who} isn't told who sent it.`;
  $("#repReasons").innerHTML = REP_REASONS.map(([k, l]) => `<label><input type="radio" name="repWhy" value="${k}"> ${l}</label>`).join("");
  $("#repNote").value = "";
  const st = o.person && circleStatus(o.person.id);
  $("#repBlockRow").hidden = !o.person || st === "blocked";
  $("#repBlock").checked = false;
  $("#repWho").textContent = personName(o.person);
  $("#repSend").disabled = true;
  if(fplant.open) fplant.close();
  repDlg.showModal();
}
$("#repReasons").addEventListener("change", () => { $("#repSend").disabled = false; });
[$("#repClose"), $("#repCancel")].forEach(b => b.addEventListener("click", () => repDlg.close()));
$("#repSend").addEventListener("click", async () => {
  const o = rep, why = (repDlg.querySelector("input[name=repWhy]:checked") || {}).value; if(!o || !why) return;
  const label = (REP_REASONS.find(r => r[0] === why) || [])[1], note = $("#repNote").value.trim();
  const btn = $("#repSend"); btn.disabled = true;
  try{
    must(await sb.rpc("report_content", {p_type:o.type, p_id:o.id, p_reason:(label + (note ? ": " + note : "")).slice(0, 500)}));
    const block = $("#repBlock").checked && o.person && !$("#repBlockRow").hidden;
    repDlg.close();
    if(block){ await personAction("block", o.person.id, true); toast(`Report sent, and ${personName(o.person)} is blocked`); }
    else toast("Report sent. Thank you.");
  }catch(e){ btn.disabled = false; circleErr(e); }
});

/* ---------- Download my data ----------
   One .zip: everything the server keeps (alvor-data.json), every photo at full size, and a short read-me. */
const CRC_T = (() => { const t = new Uint32Array(256); for(let n = 0; n < 256; n++){ let c = n; for(let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b){ let c = ~0; for(let i = 0; i < b.length; i++) c = CRC_T[(c ^ b[i]) & 255] ^ (c >>> 8); return ~c >>> 0; }
/* A plain, uncompressed zip (photos don't shrink anyway). files: [{name, data:Uint8Array, date}] */
function makeZip(files){
  const enc = new TextEncoder(), parts = [], central = [];
  let off = 0, size = 0;
  for(const f of files){
    const name = enc.encode(f.name), data = f.data, crc = crc32(data), d = f.date || new Date();
    const time = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xffff;
    const day = (((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff;
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true);
    h.setUint16(10, time, true); h.setUint16(12, day, true); h.setUint32(14, crc, true);
    h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true);
    parts.push(h, name, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
    c.setUint16(12, time, true); c.setUint16(14, day, true); c.setUint32(16, crc, true);
    c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true);
    c.setUint32(42, off, true);
    central.push(c, name);
    off += 30 + name.length + data.length; size += 46 + name.length;
  }
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
  e.setUint32(12, size, true); e.setUint32(16, off, true);
  return new Blob([...parts, ...central, e], {type:"application/zip"});
}
const safeName = s => String(s || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w .-]+/g, "").replace(/\s+/g, " ").trim().slice(0, 50) || "Plant";
const DATA_README = `Your data from Alvor
====================

alvor-data.json   Everything Alvor's server keeps about you: your sign-in email,
                  profile, settings and location, every plant with its notes and
                  care details, your history, friends, requests, blocks, invitations,
                  reactions and comments you wrote, and reports you sent.
                  It opens in any text editor.
photos/           Every photo, at full size, in a folder per plant.
profile-photo.jpg Your profile photo, if you have one.
backdrop-photo.jpg Your own backdrop photo, if you chose one.

Alvor doesn't keep anything else about you. To delete it all, use
Settings → Delete my account in the app, or the "Delete your account" page.
`;
let dataBusy = false;
async function downloadMyData(){
  if(dataBusy || !token || !me) return;
  dataBusy = true; $("#dataBtn").disabled = true;
  const st = m => { $("#dataStatus").textContent = m; };
  try{
    st("Saving the latest changes…");
    await push(); await syncPhotos();
    st("Collecting your data…");
    const data = must(await sb.rpc("export_my_data"));
    const enc = new TextEncoder(), files = [], now = new Date();
    files.push({name:"README.txt", data:enc.encode(DATA_README), date:now});
    files.push({name:"alvor-data.json", data:enc.encode(JSON.stringify(data, null, 2)), date:now});
    const names = Object.fromEntries((data.plants || []).map(p => [p.id, safeName(p.name)]));
    const local = Object.fromEntries((await idb.all().catch(() => [])).map(ph => [ph.id, ph]));
    const list = data.photos || [];
    let missing = 0;
    for(let i = 0; i < list.length; i++){
      const ph = list[i];
      st(`Adding photos: ${i + 1} of ${list.length}…`);
      let bytes = null;
      try{
        if(local[ph.id] && local[ph.id].data) bytes = new Uint8Array(await (await dataToBlob(local[ph.id].data)).arrayBuffer());
        else bytes = new Uint8Array(await must(await sb.storage.from("photos").download(phPath(ph.id, "l"))).arrayBuffer());
      }catch(e){ missing++; continue; }
      const at = new Date(ph.taken_at || ph.uploaded_at || now);
      files.push({name:`photos/${names[ph.plant_id] || "Plant"} (${String(ph.plant_id).slice(0, 4)})/${ymd(at)} ${String(ph.id).slice(0, 8)}.jpg`, data:bytes, date:at});
    }
    if(me.avatar){
      try{ const r = await fetch(avatarUrl(me.avatar)); if(r.ok) files.push({name:"profile-photo.jpg", data:new Uint8Array(await r.arrayBuffer()), date:now}); }catch(e){}
    }
    const own = look().own;
    if(own && own.path){
      try{ const d = await ownData(own); if(d) files.push({name:"backdrop-photo.jpg", data:new Uint8Array(await (await dataToBlob(d)).arrayBuffer()), date:now}); }catch(e){}
    }
    st("Making the file…");
    const blob = makeZip(files);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `alvor-my-data-${today()}.zip`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    st(`Done: ${list.length - missing} ${list.length - missing === 1 ? "photo" : "photos"} and all your details, ${(blob.size / 1048576).toFixed(1)} MB.`
      + (missing ? ` ${missing} ${missing === 1 ? "photo" : "photos"} couldn't be fetched; try again later.` : ""));
  }catch(e){
    if(isAuthErr(e)) sessionExpired();
    else st("Couldn't collect your data. Check your connection and try again.");
  }finally{ dataBusy = false; $("#dataBtn").disabled = false; }
}
$("#dataBtn").addEventListener("click", downloadMyData);

/* ---------- Delete my account ----------
   The "account" server function checks the password again, removes the photo files and the sign-in;
   the database removes everything else with it. Then this phone forgets everything too. */
const delDlg = $("#delDlg");
$("#delAcctBtn").addEventListener("click", () => {
  $("#delPass").value = ""; $("#delMsg").textContent = ""; $("#delGo").disabled = false;
  delDlg.showModal();
});
[$("#delClose"), $("#delCancel")].forEach(b => b.addEventListener("click", () => delDlg.close()));
$("#delGo").addEventListener("click", async () => {
  const pw = $("#delPass").value;
  if(!pw){ $("#delMsg").textContent = "Type your password first."; $("#delPass").focus(); return; }
  $("#delGo").disabled = true; $("#delMsg").textContent = "Deleting…";
  try{
    const {r, j} = await callFn("account", {action:"delete", password:pw});
    if(!r.ok){ $("#delMsg").textContent = j.error || "Couldn't delete the account. Try again."; $("#delGo").disabled = false; return; }
  }catch(e){ $("#delMsg").textContent = "Couldn't reach Alvor. Check your connection and try again."; $("#delGo").disabled = false; return; }
  delDlg.close();
  await forgetEverything();
  authMode = "login"; showAuth("Your account and everything in it have been deleted. Thank you for growing with Alvor.");
});
/* After the account is gone: nothing of it stays on this phone. */
async function forgetEverything(){
  clearTimeout(syncTimer); clearTimeout(photoTimer);
  try{
    // (with a time limit: "ready" never comes if the service worker didn't install)
    const reg = canPush() && await Promise.race([navigator.serviceWorker.ready, new Promise(r => setTimeout(() => r(null), 3000))]);
    const sub = reg && await reg.pushManager.getSubscription(); if(sub) await sub.unsubscribe();
  }catch(e){}
  try{ await sb.auth.signOut({scope:"local"}); }catch(e){}
  try{ await idb.clear(); }catch(e){}
  [KEY, USER_KEY, PUSH_KEY, PH_DEL_KEY, OLD_TOKEN_KEY, ADMIN_SEEN_KEY, LOOK_BG_KEY].forEach(k => { try{ localStorage.removeItem(k); }catch(e){} });
  token = ""; me = null; photos = {}; pending = [];
  circle = null; circleAt = 0; myLink = null; visit = null; fSearch = {q:"", results:null}; admin = null; forgetTalk(); updateBadge();
  state = defaults(); saveLocal();
  showTab("today"); render(); fillAccount();
}

/* ---------- The owner's Reports ---------- */
const ADMIN_SEEN_KEY = "alvor-reports-seen";
let admin = null, adminBusy = false;
async function loadAdmin(quiet){
  if(!me || !me.owner || !token || adminBusy) return;
  adminBusy = true;
  try{
    const [open, off] = await Promise.all([sb.rpc("admin_open_reports").then(must), sb.rpc("admin_disabled_accounts").then(must)]);
    const paths = open.map(x => x.photo_path).filter(Boolean), urls = {};
    if(paths.length){
      const r = await sb.storage.from("photos").createSignedUrls(paths, 3600);
      (r.data || []).forEach(x => { if(x && x.signedUrl && x.path) urls[x.path] = x.signedUrl; });
    }
    admin = {open, off, urls};
    let seen = []; try{ seen = JSON.parse(localStorage.getItem(ADMIN_SEEN_KEY) || "[]"); }catch(e){}
    const fresh = open.filter(x => !seen.includes(x.id)).length;
    if(quiet && fresh) toast(`${fresh} new ${fresh === 1 ? "report" : "reports"} to look at, in Settings`);
    try{ localStorage.setItem(ADMIN_SEEN_KEY, JSON.stringify(open.map(x => x.id))); }catch(e){}
  }catch(e){ if(isAuthErr(e)) sessionExpired(); else if(!quiet) admin = {error:true}; }
  finally{ adminBusy = false; }
  if(currentTab === "settings") renderAdmin();
}
function renderAdmin(){
  const el = $("#adminList"), A = admin;
  if(!A){ el.innerHTML = `<p class="f-empty">Loading…</p>`; return; }
  if(A.error){ el.innerHTML = `<p class="f-empty">Couldn't load the reports. Check your connection.</p>`; return; }
  $("#adminCount").textContent = A.open.length ? `${A.open.length} open` : "";
  const at = u => u ? "@" + esc(u) : "a deleted account";
  let h = A.open.length ? A.open.map(x => `<div class="adm-item">
      <div class="adm-top"><b>${at(x.about_username)}</b>${x.about_disabled ? ` <span class="adm-off">switched off</span>` : ""}<small>${esc(shortDate(x.created_at))}</small></div>
      <p class="adm-what">${esc(x.detail)}</p>
      ${x.photo_path && A.urls[x.photo_path] ? `<img src="${esc(A.urls[x.photo_path])}" alt="The reported photo">` : ""}
      <p class="adm-why">${esc(x.reason || "No reason given")} · reported by ${at(x.reporter_username)}${x.reports_about_them > 1 ? ` · ${x.reports_about_them} open reports about them` : ""}</p>
      <div class="btn-row"><button class="btn small" data-adm="done" data-id="${x.id}">Mark as handled</button>
        ${x.about_id && !x.about_disabled ? `<button class="btn small danger" data-adm="off" data-user="${x.about_id}" data-name="${esc(x.about_username || "")}">Switch off their account</button>` : ""}</div>
    </div>`).join("") : `<p class="f-empty">No open reports.</p>`;
  if(A.off.length) h += `<h3 class="sub-h">Switched-off accounts</h3>${A.off.map(p => `<div class="person"><div class="who"><b>${esc(p.display_name)}</b><span>@${esc(p.username)}</span></div>
    <div class="p-acts"><button class="btn small" data-adm="on" data-user="${p.id}" data-name="${esc(p.username)}">Switch back on</button></div></div>`).join("")}`;
  el.innerHTML = h;
}
$("#adminList").addEventListener("click", async e => {
  const b = e.target.closest("[data-adm]"); if(!b || b.disabled) return;
  const act = b.dataset.adm, name = b.dataset.name ? "@" + b.dataset.name : "this account";
  if(act === "off" && !confirm(`Switch off ${name}? Nobody can see their garden, profile or comments, find them or add them, until you switch it back on. Their open reports are marked as handled. They aren't told.`)) return;
  b.disabled = true;
  try{
    if(act === "done") must(await sb.rpc("admin_resolve_report", {p_id:b.dataset.id}));
    else must(await sb.rpc("admin_set_disabled", {p_user:b.dataset.user, p_disabled:act === "off"}));
    toast(act === "done" ? "Marked as handled" : act === "off" ? `${name} switched off` : `${name} switched back on`);
  }catch(err){ circleErr(err); }
  await loadAdmin();
});
