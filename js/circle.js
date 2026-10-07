/* Alvor · The circle: friend link, requests, friends, visiting a friend's garden.
   Plain script (no build step): loaded by index.html in a fixed order and sharing one global scope. */
"use strict";
/* ---------- The circle: friend link, requests, friends, visiting gardens ----------
   Who may see what is enforced by the database. This part only shows it and calls its functions. */
const appBase = () => location.origin + location.pathname.replace(/[^/]*$/, "");
const friendLinkUrl = t => `${appBase()}join.html#join=${t}`;
const MORE = SV('<circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none"/>');
const personName = p => p ? (p.display_name || (p.username ? "@" + p.username : "Someone")) : "Someone";
const personAv = p => `<span class="av">${p && p.avatar_path ? `<img src="${avatarUrl(p.avatar_path)}" alt="" loading="lazy">`
  : esc((personName(p).replace(/^@/, "").trim().charAt(0) || "?").toUpperCase())}</span>`;
const plantsWord = n => `${n} ${n === 1 ? "plant" : "plants"}`;
const fAreaLabel = (a, home) => a === "house" && home === "apartment" ? "Inside" : (AREAS[a] || {label:a}).label;
const shortDate = s => new Date(s).toLocaleDateString("en-GB", {day:"numeric", month:"short"});
const longDate = s => new Date(s).toLocaleDateString("en-GB", {day:"numeric", month:"long", year:"numeric"});

let circle = null, circleAt = 0, circleBusy = null;   // {friends, incoming, outgoing, blocked}
let myLink = null, myLinkErr = "", showQr = false;
let fSearch = {q:"", results:null}, fSearchSeq = 0, fSearchTimer = null;

function circleErr(e){
  if(isAuthErr(e)){ sessionExpired(); return; }
  // Messages written in the database functions are meant for people; anything else is a connection problem.
  toast(e && e.code === "P0001" && e.message ? e.message : "Couldn't reach Alvor. Check your connection.");
}
const findPerson = id => circle && [...circle.friends, ...circle.incoming, ...circle.outgoing, ...circle.blocked].find(p => p.id === id)
  || (fSearch.results || []).find(p => p.id === id) || (visit && visit.prof && visit.prof.id === id ? visit.prof : null);
function circleStatus(id){
  if(!circle) return null;
  if(circle.friends.some(p => p.id === id)) return "friend";
  if(circle.incoming.some(p => p.id === id)) return "incoming";
  if(circle.outgoing.some(p => p.id === id)) return "outgoing";
  if(circle.blocked.some(p => p.id === id)) return "blocked";
  return null;
}

async function loadCircle(force){
  if(!online || !token || !me) return null;
  if(!force && circle && Date.now() - circleAt < 60000) return circle;
  if(circleBusy) return circleBusy;
  circleBusy = (async () => {
    try{
      const [fr, rq, bl] = await Promise.all([
        sb.from("friendships").select("user_a,user_b,created_at").then(must),
        sb.from("friend_requests").select("from_id,to_id,created_at").then(must),
        sb.from("blocks").select("blocked_id").eq("blocker_id", me.id).then(must)
      ]);
      const other = r => r.user_a === me.id ? r.user_b : r.user_a;
      const friendIds = fr.map(other);
      const ids = [...new Set([...friendIds, ...rq.map(r => r.from_id === me.id ? r.to_id : r.from_id), ...bl.map(b => b.blocked_id)])];
      const [profs, shared] = await Promise.all([
        ids.length ? sb.from("profiles").select("id,username,display_name,avatar_path").in("id", ids).then(must) : [],
        friendIds.length ? sb.from("plants").select("owner_id").in("owner_id", friendIds).then(must) : []
      ]);
      notePeople(profs);
      const P = Object.fromEntries(profs.map(p => [p.id, p])), count = {};
      shared.forEach(r => count[r.owner_id] = (count[r.owner_id] || 0) + 1);
      const byName = (a, b) => personName(a).localeCompare(personName(b));
      circle = {
        friends:fr.filter(r => P[other(r)]).map(r => ({...P[other(r)], since:r.created_at, shared:count[other(r)] || 0})).sort(byName),
        incoming:rq.filter(r => r.to_id === me.id && P[r.from_id]).map(r => ({...P[r.from_id], at:r.created_at})).sort((a, b) => b.at.localeCompare(a.at)),
        outgoing:rq.filter(r => r.from_id === me.id && P[r.to_id]).map(r => ({...P[r.to_id], at:r.created_at})).sort(byName),
        blocked:bl.map(b => P[b.blocked_id] || {id:b.blocked_id, username:"", display_name:"Someone"}).sort(byName)
      };
      circleAt = Date.now();
    }catch(e){ if(isAuthErr(e)) sessionExpired(); }
    updateBadge();
    if(currentTab === "friends") renderFriends();
    return circle;
  })().finally(() => { circleBusy = null; });
  return circleBusy;
}
function updateBadge(){
  const r = circle ? circle.incoming.length : 0, a = typeof unseenCount === "function" ? unseenCount() : 0, n = r + a, b = $("#reqBadge");
  b.hidden = !n; b.textContent = n > 9 ? "9+" : n;
  const parts = [r ? `${r} new ${r === 1 ? "request" : "requests"}` : "", a ? `${a} new ${a === 1 ? "reaction or comment" : "reactions and comments"}` : ""].filter(Boolean);
  $("#friendsBtn").setAttribute("aria-label", parts.length ? `Community, ${parts.join(", ")}` : "Community");
}
async function loadMyLink(){
  if(myLink || !token) return;
  try{ myLink = must(await sb.rpc("my_friend_link")); myLinkErr = ""; }
  catch(e){ if(isAuthErr(e)){ sessionExpired(); return; } myLinkErr = "Couldn't get your link. Check your connection."; }
  if(currentTab === "friends") renderFriends();
}

/* QR code of the friend link, drawn as one SVG path (dark on white, so phones read it in dark mode too). */
function qrSvg(text){
  if(!window.qrcode) return "";
  const q = qrcode(0, "M"); q.addData(text); q.make();
  const n = q.getModuleCount(); let d = "";
  for(let r = 0; r < n; r++) for(let c = 0; c < n; c++) if(q.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-3 -3 ${n + 6} ${n + 6}" shape-rendering="crispEdges" aria-hidden="true"><path d="${d}" fill="#17221C"/></svg>`;
}
async function copyText(t){
  try{ await navigator.clipboard.writeText(t); toast("Copied"); }catch(e){ prompt("Copy this:", t); }
}
async function shareText(text){
  if(navigator.share){
    try{ await navigator.share({text}); return; }catch(e){ if(e && e.name === "AbortError") return; }
  }
  copyText(text);
}

function personRow(p, acts, kind){
  const sub = kind === "friend" ? `@${esc(p.username)} · ${p.shared ? plantsWord(p.shared) + " shared" : "nothing shared yet"}`
    : p.username ? "@" + esc(p.username) : "";
  const who = `<b>${esc(personName(p))}</b><span>${sub}</span>`;
  return `<div class="person">${personAv(p)}${kind === "friend" || kind === "result-friend"
    ? `<button class="who" data-fact="visit" data-id="${p.id}">${who}</button>` : `<div class="who">${who}</div>`}<div class="p-acts">${acts}</div></div>`;
}
const moreBtn = p => `<button class="icon-more" data-fact="more" data-id="${p.id}" aria-label="More for ${esc(personName(p))}">${MORE}</button>`;
function searchResultsHtml(){
  const S = fSearch;
  if(S.q.replace(/^@/, "").length < 2) return "";
  if(!S.results) return `<p class="f-empty">Searching…</p>`;
  if(!S.results.length) return `<p class="f-empty">Nobody found. People only show up here if they switched on "Let people find me". If they haven't, send them your link instead.</p>`;
  return `<div class="people">${S.results.map(p => {
    const st = circleStatus(p.id);
    const act = st === "friend" ? `<button class="btn small" data-fact="visit" data-id="${p.id}">Visit</button>`
      : st === "outgoing" ? `<button class="btn small" disabled>Requested</button>`
      : st === "incoming" ? `<button class="btn small primary" data-fact="accept" data-id="${p.id}">Accept</button>`
      : `<button class="btn small primary" data-fact="add" data-id="${p.id}">Add</button>`;
    return personRow(p, act, st === "friend" ? "result-friend" : "result");
  }).join("")}</div>`;
}
const drawResults = () => { const r = $("#fResults"); if(r) r.innerHTML = searchResultsHtml(); };
async function runSearch(){
  const q = fSearch.q, my = ++fSearchSeq;
  if(q.replace(/^@/, "").length < 2) return;
  try{
    const r = must(await sb.rpc("search_profiles", {q}));
    if(my !== fSearchSeq) return;
    fSearch.results = r || [];
  }catch(e){
    if(my !== fSearchSeq) return;
    if(isAuthErr(e)){ sessionExpired(); return; }
    fSearch.results = [];
  }
  drawResults();
}

function renderFriends(){
  const el = $("#friendsBody");
  if(!online || !me){ el.innerHTML = `<div class="fg-msg"><h3>Sign in first</h3><p>Friends need an Alvor account.</p></div>`; return; }
  const C = circle, link = myLink ? friendLinkUrl(myLink) : "";
  const focused = document.activeElement && document.activeElement.id === "fSearch";
  let h = "";
  if(C && C.incoming.length) h += `<div class="card f-card"><h2>Friend requests <small>${C.incoming.length}</small></h2>
    <div class="people">${C.incoming.map(p => personRow(p, `<button class="btn small primary" data-fact="accept" data-id="${p.id}">Accept</button>${moreBtn(p)}`, "request")).join("")}</div></div>`;
  h += `<div class="card f-card"><h2>What's new</h2><div id="feedBox">${feedHtml()}</div></div>`;
  h += `<div class="card f-card"><h2>Your friend link</h2>
    <p class="f-lead">Send it to people you know. Whoever opens it becomes your friend straight away, and if they don't have Alvor yet, it's their invitation too.</p>
    <div class="f-btns"><button class="btn primary" data-fact="shareLink" ${link ? "" : "disabled"}>Share my link</button>
      <button class="btn" data-fact="qr" ${link ? "" : "disabled"} aria-expanded="${showQr}">${showQr ? "Hide QR code" : "QR code"}</button></div>
    ${showQr && link ? `<div class="qr-box"><div class="qr" role="img" aria-label="QR code of your friend link">${qrSvg(link)}</div><p>Your friend scans it with their phone's camera.</p></div>` : ""}
    <p class="f-note">${link ? "" : esc(myLinkErr || "Getting your link…") + " "}Sent it to the wrong person? <button class="linkish" data-fact="resetLink" ${link ? "" : "disabled"}>Reset my link</button> and the old one stops working.</p>
  </div>`;
  h += `<div class="card f-card"><h2>Find people</h2>
    <input type="search" class="f-search" id="fSearch" placeholder="Name or @username" aria-label="Find people by name or @username" autocomplete="off" autocapitalize="none" spellcheck="false" value="${esc(fSearch.q)}">
    <div id="fResults">${searchResultsHtml()}</div>
    ${me.findable ? "" : `<p class="f-note">You're hidden from search: only people with your link can add you. <button class="linkish" data-fact="findable">Let people find me</button></p>`}
  </div>`;
  const fr = C ? C.friends : [];
  h += `<div class="card f-card"><h2>Your friends ${fr.length ? `<small>${fr.length}</small>` : ""}</h2>
    ${!C ? `<p class="f-empty">Loading…</p>` : fr.length ? `<div class="people">${fr.map(p => personRow(p, moreBtn(p), "friend")).join("")}</div>`
      : `<p class="f-empty">No friends yet. Share your link to start your circle.</p>`}
    ${C && C.outgoing.length ? `<h3 class="group-h" style="font-size:1rem">Waiting for an answer</h3>
      <div class="people">${C.outgoing.map(p => personRow(p, `<button class="btn small" data-fact="cancel" data-id="${p.id}">Cancel</button>`, "sent")).join("")}</div>` : ""}
  </div>`;
  if(C && C.blocked.length) h += `<details class="card f-blocked"><summary>Blocked (${C.blocked.length})</summary>
    <div class="people">${C.blocked.map(p => personRow(p, `<button class="btn small" data-fact="unblock" data-id="${p.id}">Unblock</button>`, "blocked")).join("")}</div></details>`;
  el.innerHTML = h;
  if(focused){ const i = $("#fSearch"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
}
function openFriends(){
  feedFreshAfter = null; feedMore = false;
  renderFriends();
  loadMyLink();
  loadCircle(true);
  loadFeed(true).then(markFeedSeen);
}

$("#friendsBody").addEventListener("input", e => {
  if(e.target.id !== "fSearch") return;
  fSearch.q = e.target.value.trim(); fSearch.results = null; fSearchSeq++;
  drawResults();
  clearTimeout(fSearchTimer); fSearchTimer = setTimeout(runSearch, 350);
});
$("#friendsBody").addEventListener("click", async e => {
  const b = e.target.closest("[data-fact]"); if(!b || b.disabled) return;
  const act = b.dataset.fact, id = b.dataset.id;
  if(act === "visit") return openFriend(id);
  if(act === "more") return personMenu(id);
  if(act === "feed") return openFeedItem(+b.dataset.i);
  if(act === "feedMore"){ feedMore = true; drawFeed(); return; }
  if(act === "qr"){ showQr = !showQr; renderFriends(); return; }
  if(act === "shareLink" && myLink) return shareText(`Be my friend on Alvor, the app I use for my plants: ${friendLinkUrl(myLink)}`);
  if(act === "resetLink") return resetLink();
  b.disabled = true;
  try{
    if(act === "findable"){
      must(await sb.from("accounts").update({findable:true}).eq("id", me.id));
      me.findable = true; storeMe(); toast("People can find you by name"); renderFriends();
    }else await personAction(act, id);
  }catch(err){ circleErr(err); }
  finally{ b.disabled = false; }
});

/* The actions on a person. Declining, removing and blocking are quiet: the other person isn't told. */
async function personAction(act, id, quiet){
  const p = findPerson(id) || {id};
  if(act === "accept"){
    must(await sb.rpc("accept_friend_request", {p_from:id}));
    toast(`You and ${personName(p)} are friends`);
  }else if(act === "add"){
    const r = must(await sb.rpc("request_friend", {p_to:id}));
    toast(r === "friends" ? `You and ${personName(p)} are friends` : "Request sent");
  }else if(act === "decline"){
    must(await sb.from("friend_requests").delete().eq("from_id", id).eq("to_id", me.id));
    toast("Request declined");
  }else if(act === "cancel"){
    must(await sb.from("friend_requests").delete().eq("from_id", me.id).eq("to_id", id));
    toast("Request cancelled");
  }else if(act === "remove"){
    if(!confirm(`Remove ${personName(p)} from your friends? You stop seeing each other's gardens. They aren't told.`)) return;
    const [a, b] = [me.id, id].sort();
    must(await sb.from("friendships").delete().eq("user_a", a).eq("user_b", b));
    toast(`${personName(p)} removed`);
  }else if(act === "block"){
    if(!quiet && !confirm(`Block ${personName(p)}? If you're friends, that ends, and neither of you can see, find or add the other. They aren't told.`)) return;
    must(await sb.from("blocks").insert({blocker_id:me.id, blocked_id:id}));
    if(!quiet) toast(`${personName(p)} blocked`);
  }else if(act === "unblock"){
    must(await sb.from("blocks").delete().eq("blocker_id", me.id).eq("blocked_id", id));
    toast(`${personName(p)} unblocked. You can add each other again.`);
  }else return;
  await loadCircle(true);
  drawResults();
  if((act === "remove" || act === "block") && visit && visit.id === id && currentTab === "friend") showTab("friends");
}
async function resetLink(){
  if(!confirm("Reset your friend link? The link and QR code you shared before stop working. People who are already your friends stay friends.")) return;
  try{ myLink = must(await sb.rpc("reset_friend_link")); renderFriends(); toast("You have a new link"); }
  catch(e){ circleErr(e); }
}

/* A small menu for one person. Resolves with the chosen action, or null. */
let sheetResolve = null;
function sheet(p, actions){
  const d = $("#sheet");
  $("#sheetHead").innerHTML = `${personAv(p)}<div><b>${esc(personName(p))}</b><span>${p.username ? "@" + esc(p.username) : ""}</span></div>`;
  $("#sheetBody").innerHTML = actions.map(([k, label, cls]) => `<button data-sk="${k}" class="${cls || ""}">${label}</button>`).join("")
    + `<button data-sk="" class="muted">Cancel</button>`;
  if(sheetResolve) sheetResolve(null);
  d.showModal();
  return new Promise(res => { sheetResolve = res; });
}
function closeSheet(k){ const r = sheetResolve; sheetResolve = null; if($("#sheet").open) $("#sheet").close(); if(r) r(k || null); }
$("#sheetBody").addEventListener("click", e => { const b = e.target.closest("[data-sk]"); if(b) closeSheet(b.dataset.sk); });
$("#sheet").addEventListener("click", e => { if(e.target === e.currentTarget) closeSheet(null); });
$("#sheet").addEventListener("close", () => closeSheet(null));
async function personMenu(id){
  const p = findPerson(id); if(!p) return;
  const st = circleStatus(id);
  const acts = st === "friend" ? [["visit", "Visit their garden"], ["remove", "Remove from friends", "danger"], ["block", "Block", "danger"]]
    : st === "incoming" ? [["accept", "Accept"], ["decline", "Decline"], ["block", "Block", "danger"]]
    : st === "blocked" ? [] : [["block", "Block", "danger"]];
  acts.push(["report", "Report…", "danger"]);
  const k = await sheet(p, acts); if(!k) return;
  if(k === "visit") return openFriend(id);
  if(k === "report") return openReport({type:"profile", id, person:p});
  try{ await personAction(k, id); }catch(e){ circleErr(e); }
}

/* ---------- Visiting a friend's garden ----------
   Only what friends may see: the illustration, shared plants, their unhidden small photos, the town. */
let visit = null;
async function openFriend(id){
  if(!online || !token || !me || !id) return;
  visit = {id, loading:true, filter:"all", prof:findPerson(id)};
  showTab("friend");
  friendLook(id).then(F => { if(visit && visit.id === id){ visit.bgSpec = F.spec; visit.style = F.style; visit.locUrls = F.locs || {}; if(currentTab === "friend"){ applyLook(); renderFriend(); } } }).catch(() => {});
  try{
    await loadCircle();
    const [prof, garden, plants, phs] = await Promise.all([
      sb.from("profiles").select("id,username,display_name,avatar_path").eq("id", id).maybeSingle().then(must),
      sb.from("gardens").select("home,town").eq("owner_id", id).maybeSingle().then(must),
      sb.from("plants").select("id,name,species,area").eq("owner_id", id).then(must),
      sb.from("photos").select("id,plant_id,path_small,taken_at,created_at").eq("owner_id", id).then(must)
    ]);
    if(!visit || visit.id !== id) return;
    try{ await loadGardenTalk(id, true); }catch(e){ if(isAuthErr(e)) throw e; }   // reactions and comments are a bonus here
    if(!visit || visit.id !== id) return;
    if(prof) notePeople([prof]);
    const when = ph => new Date(ph.taken_at || ph.created_at).getTime();
    const byPlant = {}, urls = {};
    phs.sort((a, b) => when(b) - when(a)).forEach(ph => (byPlant[ph.plant_id] ||= []).push(ph));
    if(phs.length){
      const r = await sb.storage.from("photos").createSignedUrls(phs.map(ph => ph.path_small), 3600);
      (r.data || []).forEach(x => { if(x && x.signedUrl && x.path) urls[x.path] = x.signedUrl; });
    }
    if(!visit || visit.id !== id) return;
    Object.assign(visit, {loading:false, error:false, prof:prof || visit.prof, garden, plants:plants.sort((a, b) => a.name.localeCompare(b.name)),
      byPlant, urls, isFriend:circleStatus(id) === "friend"});
  }catch(e){
    if(isAuthErr(e)){ sessionExpired(); return; }
    if(visit && visit.id === id){ visit.loading = false; visit.error = true; }
  }
  if(currentTab === "friend" && visit && visit.id === id) renderFriend();
}
const fgMsg = (t, p) => `<div class="fg-msg"><h3>${t}</h3><p>${p}</p></div>`;
function friendScene(V, home){
  const order = home === "apartment" ? ["house","balcony"] : ["house","outside","greenhouse","porch"];
  const tiles = order.filter(a => a !== "porch" || V.plants.some(x => x.area === "porch"));
  return `<div class="fl-tiles">${tiles.map(a => {
    const list = V.plants.filter(x => x.area === a);
    const k = a === "outside" ? "garden" : a, label = a === "outside" ? "Garden" : fAreaLabel(a, home);
    const own = V.locUrls && V.locUrls[k];
    return `<button class="fl-tile loc-${k} ${own ? "has-img" : ""}" data-gact="area" data-a="${a}" aria-pressed="${V.filter === a}" aria-label="${esc(label)}: ${plantsWord(list.length)}" style="${own ? "" : locStyle(V.style || "classic", k)}">${own ? `<img src="${esc(own)}" alt="">` : ""}
      <span class="fl-art">${ICON[a]}</span>
      <span class="fl-t"><span class="fl-ic">${ICON[a]}</span><b>${esc(label)}</b><small>${plantsWord(list.length)}</small></span></button>`;
  }).join("")}</div>`;
}
function friendCard(x, V){
  const ph = (V.byPlant[x.id] || [])[0], url = ph && V.urls[ph.path_small], n = (V.byPlant[x.id] || []).length;
  return `<div class="pcard fpc">
    <button class="pc-photo" data-gact="plant" data-id="${x.id}" aria-label="Open ${esc(x.name)}">${url ? `<img src="${esc(url)}" alt="" loading="lazy">`
      : `<span class="initial a-${esc(x.area)}">${esc((x.name || "?").trim().charAt(0).toUpperCase())}</span>`}</button>
    <div class="pc-body"><button class="nm" data-gact="plant" data-id="${x.id}">${esc(x.name)}</button>
      ${x.species ? `<div class="sp">${esc(x.species)}</div>` : ""}
      ${n > 1 ? `<div class="sp" style="font-style:normal">${n} photos</div>` : ""}
      <div class="tkc" data-tkc="${x.id}">${miniCounts({owner:V.id, type:"plant", id:x.id})}</div></div>
  </div>`;
}
function renderFriend(){
  const el = $("#friendBody"), V = visit;
  if(!V){ el.innerHTML = ""; return; }
  const p = V.prof || {id:V.id}, name = esc(personName(p)), town = V.garden && V.garden.town;
  let h = `<div class="fg-head"><button class="round-back" data-tab="friends" aria-label="Back to friends">${ICON.back}</button>${personAv(p)}
    <div class="who"><h2>${name}</h2><span>${p.username ? "@" + esc(p.username) : ""}${town ? " · " + esc(town) : ""}</span></div>
    ${!V.loading && V.prof ? `<button class="icon-more" data-gact="more" aria-label="More">${MORE}</button>` : ""}</div>`;
  if(V.loading){ el.innerHTML = h + `<p class="f-empty" style="text-align:center">Opening the garden…</p>`; return; }
  if(V.error){ el.innerHTML = h + fgMsg("Couldn't open this garden", "Check your connection and try again."); return; }
  if(!V.isFriend && !V.plants.length){ el.innerHTML = h + fgMsg("You're not friends", `Only friends can visit ${name}'s garden.`); return; }
  const home = V.garden && V.garden.home === "apartment" ? "apartment" : "house";
  h += friendScene(V, home);
  if(!V.plants.length){
    el.innerHTML = h + (V.isFriend ? friendGardenTalkHtml() : "") + fgMsg(`${name} hasn't shared any plants yet`, "Their plants show up here as soon as they share some with friends.");
    if(V.isFriend) mountFriendTalk({...V, filter:"all"}, home);
    return;
  }
  h += friendGardenTalkHtml();
  const areas = ALL_AREAS.filter(a => V.plants.some(x => x.area === a));
  if(V.filter !== "all" && !areas.includes(V.filter)) V.filter = "all";
  h += `<div class="chips">${["all", ...areas].map(a => {
    const n = a === "all" ? V.plants.length : V.plants.filter(x => x.area === a).length;
    return `<button class="chip" data-gact="area" data-a="${a}" aria-pressed="${V.filter === a}">${a === "all" ? "All" : esc(fAreaLabel(a, home))} ${n}</button>`;
  }).join("")}</div>`;
  h += friendAreaTalkHtml(V);
  const list = V.plants.filter(x => V.filter === "all" || x.area === V.filter);
  h += `<div class="plist v-grid">${areas.filter(a => list.some(x => x.area === a)).map(a => {
    const g = list.filter(x => x.area === a);
    return `<h2 class="group-h">${zi(a)} ${esc(fAreaLabel(a, home))} <small>${g.length}</small></h2><div class="pgroup">${g.map(x => friendCard(x, V)).join("")}</div>`;
  }).join("")}</div>`;
  el.innerHTML = h;
  mountFriendTalk(V, home);
}
$("#friendBody").addEventListener("click", async e => {
  const b = e.target.closest("[data-gact]"); if(!b || !visit) return;
  const act = b.dataset.gact;
  if(act === "area"){ visit.filter = visit.filter === b.dataset.a && (b.classList.contains("pill") || b.classList.contains("fl-tile")) ? "all" : b.dataset.a; renderFriend(); }
  else if(act === "plant") openFriendPlant(b.dataset.id, 0);
  else if(act === "more"){
    const p = visit.prof, st = circleStatus(visit.id);
    const k = await sheet(p, [...(st === "friend" ? [["remove", "Remove from friends", "danger"], ["block", "Block", "danger"]] : [["block", "Block", "danger"]]), ["report", "Report…", "danger"]]);
    if(k === "report") openReport({type:"profile", id:visit.id, person:p});
    else if(k) try{ await personAction(k, visit.id); }catch(err){ circleErr(err); }
  }
});

/* One of a friend's plants: its photos (newest first), species and spot. Never notes or watering. */
const fplant = $("#fplant");
function openFriendPlant(pid, idx){
  const V = visit, x = V && V.plants.find(q => q.id === pid); if(!x) return;
  const home = V.garden && V.garden.home === "apartment" ? "apartment" : "house";
  const phs = V.byPlant[pid] || [], cur = phs[idx], url = cur && V.urls[cur.path_small];
  $("#fpTitle").textContent = x.name;
  $("#fpBody").innerHTML = `<div class="fp-photo">${url ? `<img src="${esc(url)}" alt="${esc(x.name)}">`
      : `<span class="initial a-${esc(x.area)}">${esc((x.name || "?").trim().charAt(0).toUpperCase())}</span>`}</div>
    ${phs.length > 1 ? `<div class="fp-strip">${phs.map((ph, i) => `<button data-fpi="${i}" aria-current="${i === idx}" aria-label="Photo from ${esc(longDate(ph.taken_at || ph.created_at))}">
      <img src="${esc(V.urls[ph.path_small] || "")}" alt="" loading="lazy">${esc(shortDate(ph.taken_at || ph.created_at))}</button>`).join("")}</div>` : ""}
    <div class="fp-meta">${x.species ? `<div class="sp">${esc(x.species)}</div>` : ""}
      <div class="where">${zi(x.area)}<span>${esc(fAreaLabel(x.area, home))}</span></div>
      <small>${cur ? `Photo from ${esc(longDate(cur.taken_at || cur.created_at))}` : "No photos shared yet"}${phs.length > 1 ? ` · ${phs.length} photos` : ""}</small></div>
    <div class="fp-talk" id="fpTalk"></div>
    <div class="fp-report">Something wrong? <button class="linkish" data-rep="plant">Report this plant</button>${cur ? ` · <button class="linkish" data-rep="photo" data-id="${esc(cur.id)}">Report this photo</button>` : ""}</div>`;
  mountTalk($("#fpTalk"), {owner:V.id, type:"plant", id:pid, name:x.name, home, ownerName:personName(V.prof || {})}, "full");
  fplant.dataset.pid = pid;
  if(!fplant.open) fplant.showModal();
}
$("#fpBody").addEventListener("click", e => {
  const r = e.target.closest("[data-rep]");
  if(r && visit){
    const x = visit.plants.find(q => q.id === fplant.dataset.pid), who = visit.prof;
    if(r.dataset.rep === "plant") openReport({type:"plant", id:fplant.dataset.pid, person:who, what:`the plant "${x ? x.name : ""}"`});
    else openReport({type:"photo", id:r.dataset.id, person:who, what:`this photo of "${x ? x.name : ""}"`});
    return;
  }
  const b = e.target.closest("[data-fpi]"); if(b) openFriendPlant(fplant.dataset.pid, +b.dataset.fpi);
});
$("#fpClose").addEventListener("click", () => fplant.close());
