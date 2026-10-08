/* Alvor · Life in the circle: reactions, comments, the talk dialog and what's new.
   Plain script (no build step): loaded by index.html in a fixed order and sharing one global scope. */
"use strict";
/* ---------- Life in the circle: reactions, comments and what's new ----------
   One system for plants, areas and whole gardens. Who may see or write what is enforced by the database;
   this part shows it, and keeps a small copy of each garden's reactions and comments. */
const REACTS = [["love", "❤️", tr("Love it")], ["growing", "🌱", tr("Growing well")], ["pretty", "🌸", tr("So pretty")],
  ["wow", "😮", tr("Impressive")], ["thirsty", "💧", tr("Needs water?")], ["soggy", "🌊", tr("Too much water?")]];
const REACT = Object.fromEntries(REACTS.map(([k, e, l]) => [k, {e, l}]));
const people = {};                     // names and photos seen so far, by id
const talks = {}, gardenTalkAt = {};   // "owner|type|id" → {reactions, comments}; when each garden was loaded
let talkT = null;                      // what the talk dialog shows
const tKey = T => `${T.owner}|${T.type}|${T.id}`;
const notePeople = list => (list || []).forEach(p => { if(p && p.id) people[p.id] = {...(people[p.id] || {}), ...p}; });
const meProfile = () => me ? {id:me.id, username:me.user, display_name:me.name || me.user, avatar_path:me.avatar || null} : null;
const personById = id => me && id === me.id ? meProfile() : people[id] || (findPerson(id)) || {id, display_name:tr("Someone")};
const talkOf = T => talks[tKey(T)] || {reactions:[], comments:[]};
const talkFor = T => talks[tKey(T)] ||= {reactions:[], comments:[]};
const talkCount = T => { const D = talkOf(T); return {r:D.reactions.length, c:D.comments.length}; };
/* How a spot is named in a sentence, the same words the notifications use ("your porch", "Ana's greenhouse"; i18n.js). */
const thingKind = T => T.type === "plant" ? "plant" : T.type === "area" ? (T.id === "house" ? (T.home === "apartment" ? "indoor" : "house") : T.id === "outside" ? "outdoor" : T.id) : "garden";
const thingSay = (T, form, who, word) => thingPhrase(thingKind(T), word != null ? word : (T.name || tr("plant")), form, who);
const talkTitle = T => cap(me && T.owner === me.id ? thingSay(T, "your") : T.ownerName ? thingSay(T, "of", T.ownerName) : thingSay(T, "their"));
function ago(s){
  const m = (Date.now() - new Date(s).getTime()) / 60000;
  if(m < 1) return tr("now");
  if(m < 60) return tr("{n} min", {n:Math.floor(m)});
  if(m < 1440) return tr("{n} h", {n:Math.floor(m / 60)});
  if(m < 10080) return tr("{n} d", {n:Math.floor(m / 1440)});
  return shortDate(s);
}
function talkErr(e){
  if(isAuthErr(e)){ sessionExpired(); return; }
  if(e && e.code === "42501") toast(me && me.disabled ? tr("Your account is switched off.") : tr("This isn't shared with you any more."));
  else circleErr(e);
}

/* Everything said in one garden, in one go (a small circle keeps this small). */
async function loadGardenTalk(owner, force){
  if(!online || !token || !me || !owner) return;
  if(!force && gardenTalkAt[owner] && Date.now() - gardenTalkAt[owner] < 30000) return;
  const [rs, cs] = await Promise.all([
    sb.from("reactions").select("id,user_id,target_type,target_id,kind,created_at").eq("garden_owner", owner).limit(3000).then(must),
    sb.from("comments").select("id,user_id,target_type,target_id,body,created_at").eq("garden_owner", owner).order("created_at").limit(2000).then(must)
  ]);
  Object.keys(talks).forEach(k => { if(k.startsWith(owner + "|")) delete talks[k]; });
  rs.forEach(r => talkFor({owner, type:r.target_type, id:r.target_id}).reactions.push(r));
  cs.forEach(c => talkFor({owner, type:c.target_type, id:c.target_id}).comments.push(c));
  gardenTalkAt[owner] = Date.now();
  const need = [...new Set([...rs, ...cs].map(x => x.user_id))].filter(id => id !== me.id && !people[id]);
  if(need.length) notePeople(must(await sb.from("profiles").select("id,username,display_name,avatar_path").in("id", need)));
}

/* The reactions bar, who reacted, and (in full) the comments with a box to write one. */
const talkAttrs = T => `data-o="${esc(T.owner)}" data-t="${esc(T.type)}" data-i="${esc(T.id)}"`;
const boxT = el => { const b = el.closest(".talk"); return b ? {owner:b.dataset.o, type:b.dataset.t, id:b.dataset.i} : null; };
function reactHtml(T){
  const D = talkOf(T), mine = T.owner === me.id, counts = {}, my = new Set(), by = {};
  D.reactions.forEach(r => {
    counts[r.kind] = (counts[r.kind] || 0) + 1;
    if(r.user_id === me.id) my.add(r.kind);
    (by[r.user_id] ||= []).push(r.kind);
  });
  let h = "";
  if(mine){
    const got = REACTS.filter(([k]) => counts[k]);
    h += got.length ? `<div class="rx-bar">${got.map(([k, e, l]) => `<span class="rx" title="${l}">${e}<b>${counts[k]}</b></span>`).join("")}</div>`
      : `<p class="tk-none">${tr("No reactions yet.")}</p>`;
  }else{
    h += `<div class="rx-bar" role="group" aria-label="${tr("React")}">${REACTS.map(([k, e, l]) => `<button class="rx" data-tk="react" data-k="${k}" aria-pressed="${my.has(k)}" title="${l}" aria-label="${l}${counts[k] ? ", " + counts[k] : ""}">${e}${counts[k] ? `<b>${counts[k]}</b>` : ""}</button>`).join("")}</div>`;
  }
  const who = Object.entries(by);
  if(who.length) h += `<p class="tk-who">${who.slice(0, 8).map(([id, ks]) => `<span><b>${id === me.id ? tr("You") : esc(personName(personById(id)))}</b> ${REACTS.filter(([k]) => ks.includes(k)).map(([, e]) => e).join("")}</span>`).join("")}${who.length > 8 ? `<span>${tr("and {n} more", {n:who.length - 8})}</span>` : ""}</p>`;
  return h;
}
const showAllTalk = new Set();
function commentsHtml(T){
  const D = talkOf(T), all = D.comments, key = tKey(T);
  if(!all.length) return `<p class="tk-none">${T.owner === me.id ? tr("No comments yet.") : tr("No comments yet. Say something nice.")}</p>`;
  const list = showAllTalk.has(key) ? all : all.slice(-30);
  return (list.length < all.length ? `<button class="linkish tk-earlier" data-tk="earlier">${tr("Show {n} earlier", {n:all.length - list.length})}</button>` : "") +
    `<div class="cms">${list.map(c => {
      const p = personById(c.user_id);
      return `<div class="cm">${personAv(p)}<div class="cm-b"><div class="cm-h"><b>${esc(c.user_id === me.id ? tr("You") : personName(p))}</b><small>${esc(ago(c.created_at))}</small></div>
        <p>${esc(c.body)}</p></div><button class="icon-more" data-tk="cmore" data-id="${esc(c.id)}" aria-label="${tr("More for this comment")}">${MORE}</button></div>`;
    }).join("")}</div>`;
}
function talkLive(T, mode){
  const n = talkOf(T).comments.length;
  return reactHtml(T) + (mode === "compact"
    ? `<button class="btn small tk-open" data-tk="open">💬 ${n ? trn(n, "{n} comment", "{n} comments") : tr("Comment")}</button>`
    : `<h3 class="tk-h">${tr("Comments")} ${n ? `<small>${n}</small>` : ""}</h3>${commentsHtml(T)}`);
}
function talkHtml(T, mode){
  return `<div class="talk ${mode}" ${talkAttrs(T)} data-mode="${mode}"><div class="tk-live">${talkLive(T, mode)}</div>${mode === "full"
    ? `<div class="tk-write"><textarea data-tk-input rows="1" maxlength="1000" placeholder="${tr("Write a comment…")}" aria-label="${tr("Write a comment")}"></textarea><button class="btn small primary" data-tk="send">${tr("Send")}</button></div>` : ""}</div>`;
}
/* Redraw every box showing this thing (the writing box keeps what's typed), plus the counts around it. */
function redrawTalk(T){
  const key = tKey(T);
  document.querySelectorAll(".talk").forEach(b => {
    if(`${b.dataset.o}|${b.dataset.t}|${b.dataset.i}` === key){
      const t = {...T, ...(b._t || {})};
      b.querySelector(".tk-live").innerHTML = talkLive(t, b.dataset.mode);
    }
  });
  if(me && T.owner === me.id) renderPlants();
  if(visit && T.owner === visit.id && currentTab === "friend" && !visit.loading) refreshFriendCounts();
}
const miniCounts = T => {
  const {r, c} = talkCount(T);
  return r || c ? `<span class="tk-mini">${r ? `❤️ ${r}` : ""}${r && c ? " · " : ""}${c ? `💬 ${c}` : ""}</span>` : "";
};

/* React: tap to add, tap again to take it back. */
const reactBusy = new Set();
async function toggleReact(T, k){
  const D = talkFor(T), bk = tKey(T) + "|" + k;
  if(reactBusy.has(bk)) return;
  reactBusy.add(bk);
  const had = D.reactions.find(r => r.user_id === me.id && r.kind === k);
  try{
    if(had){
      D.reactions = D.reactions.filter(r => r !== had); redrawTalk(T);
      try{ must(await sb.from("reactions").delete().eq("id", had.id)); }
      catch(e){ D.reactions.push(had); redrawTalk(T); talkErr(e); }
    }else{
      const tmp = {id:"", user_id:me.id, kind:k, created_at:new Date().toISOString()};
      D.reactions.push(tmp); redrawTalk(T);
      try{
        Object.assign(tmp, must(await sb.from("reactions").insert({garden_owner:T.owner, target_type:T.type, target_id:T.id, kind:k})
          .select("id,user_id,kind,created_at").single()));
      }catch(e){
        D.reactions = D.reactions.filter(r => r !== tmp); redrawTalk(T);
        if(e && e.code === "23505"){ await loadGardenTalk(T.owner, true).catch(() => {}); redrawTalk(T); }
        else talkErr(e);
      }
    }
  }finally{ reactBusy.delete(bk); }
}
async function sendComment(box){
  const T = boxT(box), ta = box.querySelector("[data-tk-input]"), btn = box.querySelector("[data-tk=send]");
  const body = ta.value.trim(); if(!T || !body || btn.disabled) return;
  btn.disabled = true;
  try{
    const row = must(await sb.from("comments").insert({garden_owner:T.owner, target_type:T.type, target_id:T.id, body:body.slice(0, 1000)})
      .select("id,user_id,body,created_at").single());
    talkFor(T).comments.push(row);
    ta.value = ""; ta.style.height = "";
    redrawTalk(T);
    const list = box.querySelector(".cms"); if(list) list.lastElementChild && list.lastElementChild.scrollIntoView({block:"nearest", behavior:"smooth"});
  }catch(e){ talkErr(e); }
  finally{ btn.disabled = false; }
}
async function commentMenu(T, cid){
  const D = talkFor(T), c = D.comments.find(x => x.id === cid); if(!c) return;
  const p = personById(c.user_id), mineC = c.user_id === me.id, myGarden = T.owner === me.id;
  const acts = [];
  if(mineC) acts.push(["delete", tr("Delete my comment"), "danger"]);
  else{
    if(myGarden) acts.push(["delete", tr("Remove from my garden"), "danger"]);
    acts.push(["report", tr("Report this comment…"), "danger"]);
  }
  const k = await sheet(p, acts); if(!k) return;
  if(k === "report") return openReport({type:"comment", id:cid, person:p, what:tr("this comment")});
  if(k === "delete"){
    if(!confirm(mineC ? tr("Delete your comment?") : tr("Remove {name}'s comment from your garden? They aren't told.", {name:personName(p)}))) return;
    try{
      must(await sb.from("comments").delete().eq("id", cid));
      D.comments = D.comments.filter(x => x.id !== cid); redrawTalk(T); toast(tr("Comment deleted"));
    }catch(e){ talkErr(e); }
  }
}
document.addEventListener("click", e => {
  const b = e.target.closest("[data-tk]"); if(!b || !me) return;
  const box = b.closest(".talk"), T = box && {...boxT(box), ...(box._t || {})}; if(!T) return;
  const a = b.dataset.tk;
  if(a === "react") toggleReact(T, b.dataset.k);
  else if(a === "send") sendComment(box);
  else if(a === "cmore") commentMenu(T, b.dataset.id);
  else if(a === "open") openTalk(T);
  else if(a === "earlier"){ showAllTalk.add(tKey(T)); redrawTalk(T); }
});
document.addEventListener("input", e => {   // the writing box grows with the text
  const ta = e.target.closest && e.target.closest("[data-tk-input]"); if(!ta) return;
  ta.style.height = ""; ta.style.height = Math.min(ta.scrollHeight + 2, 160) + "px";
});
/* Put a talk box into a container, remembering names used in its sentences. */
function mountTalk(el, T, mode){
  el.innerHTML = talkHtml(T, mode);
  el.querySelector(".talk")._t = {name:T.name, home:T.home, ownerName:T.ownerName};
}

/* ---------- The talk dialog: one plant, area or garden, opened from the feed, a notification or a button ---------- */
const talkDlg = $("#talkDlg");
async function openTalk(T){
  if(!online || !token || !me || !T || !T.owner) return;
  talkT = {...T};
  $("#talkTitle").textContent = T.name || T.ownerName ? talkTitle(T) : "…";
  $("#talkBody").innerHTML = `<p class="f-empty">${tr("Loading…")}</p>`;
  if(!talkDlg.open) talkDlg.showModal();
  try{
    const mine = T.owner === me.id;
    await Promise.all([
      loadGardenTalk(T.owner, true),
      (async () => {
        if(mine){
          talkT.ownerName = tr("You"); talkT.home = state.settings.home === "apartment" ? "apartment" : "house";
          if(T.type === "plant"){
            let p = state.plants.find(x => x.id === T.id);
            if(!p) p = await sb.from("plants").select("name").eq("id", T.id).eq("owner_id", me.id).maybeSingle().then(must);   // not on this phone yet
            talkT.name = p ? p.name : null; talkT.gone = !p;
          }
        }else{
          const [prof, g, pl] = await Promise.all([
            sb.from("profiles").select("id,username,display_name,avatar_path").eq("id", T.owner).maybeSingle().then(must),
            sb.from("gardens").select("home").eq("owner_id", T.owner).maybeSingle().then(must),
            T.type === "plant" ? sb.from("plants").select("name").eq("id", T.id).maybeSingle().then(must) : null
          ]);
          if(prof) notePeople([prof]);
          talkT.ownerName = prof ? personName(prof) : tr("Someone");
          talkT.home = g && g.home === "apartment" ? "apartment" : "house";
          if(T.type === "plant"){ talkT.name = pl ? pl.name : null; talkT.gone = !pl; }
          talkT.gone = talkT.gone || !g;
        }
      })()
    ]);
  }catch(e){
    if(isAuthErr(e)){ talkDlg.close(); sessionExpired(); return; }
    if(talkT && talkT.owner === T.owner) $("#talkBody").innerHTML = fgMsg(tr("Couldn't open this"), tr("Check your connection and try again."));
    return;
  }
  if(!talkT || tKey(talkT) !== tKey(T) || !talkDlg.open) return;
  drawTalkDlg();
}
function drawTalkDlg(){
  const T = talkT; if(!T) return;
  $("#talkTitle").textContent = T.gone ? tr("Not shared any more") : talkTitle(T);
  if(T.gone){ $("#talkBody").innerHTML = fgMsg(tr("This isn't shared any more"), T.type === "plant" ? tr("The plant was deleted, or moved back to its owner's Vault.") : tr("You're no longer friends with the owner of this garden.")); return; }
  const mine = T.owner === me.id;
  const link = mine ? (T.type === "plant" ? `<button class="linkish" data-tlk="plant">${tr("Open the plant")}</button>` : "")
    : `<button class="linkish" data-tlk="visit">${tr("Visit {name}'s garden", {name:esc(T.ownerName)})}</button>`;
  const body = $("#talkBody");
  body.innerHTML = `<div class="tk-dlg"></div>${link ? `<p class="tk-link">${link}</p>` : ""}`;
  mountTalk(body.querySelector(".tk-dlg"), T, "full");
}
$("#talkClose").addEventListener("click", () => talkDlg.close());
talkDlg.addEventListener("close", () => { talkT = null; });
$("#talkBody").addEventListener("click", async e => {
  const b = e.target.closest("[data-tlk]"); if(!b || !talkT) return;
  const T = talkT; talkDlg.close();
  if(b.dataset.tlk === "plant") openDialog(T.id);
  else{
    await openFriend(T.owner);
    if(T.type === "plant" && visit && visit.plants && visit.plants.some(x => x.id === T.id)) openFriendPlant(T.id, 0);
    else if(T.type === "area" && visit && !visit.loading){ visit.filter = T.id; renderFriend(); }
  }
});

function forgetTalk(){
  feed = null; feedAt = 0; feedFreshAfter = null; feedMore = false;
  Object.keys(talks).forEach(k => delete talks[k]); Object.keys(gardenTalkAt).forEach(k => delete gardenTalkAt[k]);
  if(talkDlg.open) talkDlg.close();
}

/* Links from notifications: #talk=<owner>.<plant|area|garden>.<id> */
function openFromHash(h){
  const m = String(h || "").match(/talk=([0-9a-f-]{36})\.(plant|area|garden)\.([A-Za-z0-9-]{1,40})/);
  if(!m) return false;
  if(location.hash.includes("talk=")) history.replaceState(null, "", location.pathname);
  if(token && me) openTalk({owner:m[1], type:m[2], id:m[3]});
  return true;
}
window.addEventListener("hashchange", () => openFromHash(location.hash));
if("serviceWorker" in navigator) navigator.serviceWorker.addEventListener("message", e => { if(e.data && e.data.open) openFromHash(e.data.open); });

/* ---------- What's new: reactions and comments for you, and friends' new photos ---------- */
let feed = null, feedAt = 0, feedBusy = null, feedMore = false, feedFreshAfter = null;
const seenTime = () => me && me.activitySeen ? new Date(me.activitySeen).getTime() : 0;
const counts4Badge = f => f.kind !== "photo";
const unseenCount = () => feed ? feed.filter(f => counts4Badge(f) && new Date(f.happened_at).getTime() > seenTime()).length : 0;
async function loadFeed(force){
  if(!online || !token || !me) return null;
  if(!force && feed && Date.now() - feedAt < 60000) return feed;
  if(feedBusy) return feedBusy;
  feedBusy = (async () => {
    try{
      const [rows, acct] = await Promise.all([
        sb.rpc("activity_feed", {p_limit:40}).then(must),
        sb.from("accounts").select("activity_seen_at").eq("id", me.id).maybeSingle().then(must)
      ]);
      feed = rows || []; feedAt = Date.now();
      if(acct && acct.activity_seen_at && seenTime() < new Date(acct.activity_seen_at).getTime()){ me.activitySeen = acct.activity_seen_at; storeMe(); }
      notePeople(feed.map(f => ({id:f.actor_id, username:f.actor_username, display_name:f.actor_name, avatar_path:f.actor_avatar})));
    }catch(e){ if(isAuthErr(e)) sessionExpired(); }
    try{ await loadGardenTalk(me.id); renderPlants(); }catch(e){}
    updateBadge();
    if(currentTab === "friends") drawFeed();
    return feed;
  })().finally(() => { feedBusy = null; });
  return feedBusy;
}
/* Opening the Friends screen counts as seeing what's new; new lines stay marked while you're there. */
async function markFeedSeen(){
  if(!feed || !me) return;
  const newest = feed.filter(counts4Badge).map(f => f.happened_at).sort().pop();
  if(!newest || new Date(newest).getTime() <= seenTime()) return;
  if(feedFreshAfter === null) feedFreshAfter = seenTime();
  me.activitySeen = newest; storeMe(); updateBadge();
  try{ must(await sb.from("accounts").update({activity_seen_at:newest}).eq("id", me.id)); }catch(e){}
}
function feedLine(f){
  const actor = `<b>${esc(f.actor_name || tr("Someone"))}</b>`;
  const plant = f.target_type === "plant", T = {type:f.target_type, id:f.target_id, name:f.target_name, home:f.owner_home};
  const word = plant ? `<b>${esc(f.target_name || tr("a plant"))}</b>` : null, say = (form, who) => thingSay(T, form, who, word);
  if(f.kind === "photo") return trn(f.n, "{actor} added a photo of {thing}", "{actor} added {n} photos of {thing}", {actor, thing:say("plain")});
  if(f.kind === "reaction") return tr("{actor} reacted {emoji} to {thing}", {actor, emoji:(f.detail || "").split(",").map(k => REACT[k] ? REACT[k].e : "").join(""), thing:say("your")});
  if(f.kind === "comment") return tr("{actor} commented on {thing}", {actor, thing:say("your")});
  return f.actor_id === f.garden_owner ? tr("{actor} replied on {thing}", {actor, thing:say("their")})
    : tr("{actor} also commented on {thing}", {actor, thing:say("of", esc(f.owner_name || tr("a friend")))});
}
function feedRow(f, i){
  const fresh = counts4Badge(f) && feedFreshAfter !== null && new Date(f.happened_at).getTime() > feedFreshAfter;
  const p = {id:f.actor_id, username:f.actor_username, display_name:f.actor_name, avatar_path:f.actor_avatar};
  const quote = f.kind === "comment" || f.kind === "reply" ? `<span class="fd-q">“${esc(f.detail || "")}”</span>` : "";
  return `<button class="fd ${fresh ? "fresh" : ""}" data-fact="feed" data-i="${i}">${personAv(p)}<span class="fd-t"><span>${feedLine(f)}</span>${quote}<small>${esc(ago(f.happened_at))}${fresh ? " · " + tr("new") : ""}</small></span></button>`;
}
function feedHtml(){
  if(!feed) return `<p class="f-empty">${tr("Loading…")}</p>`;
  if(!feed.length) return `<p class="f-empty">${tr("Nothing yet. Reactions and comments on your plants, replies to your comments and friends' new photos show up here.")}</p>`;
  const list = feedMore ? feed : feed.slice(0, 6);
  return `<div class="feed">${list.map(feedRow).join("")}</div>${feed.length > list.length ? `<button class="linkish" data-fact="feedMore">${tr("Show more")}</button>` : ""}`;
}
function drawFeed(){ const el = $("#feedBox"); if(el) el.innerHTML = feedHtml(); }
async function openFeedItem(i){
  const f = feed && feed[i]; if(!f) return;
  const ownerName = f.garden_owner === me.id ? tr("You") : f.owner_name;
  if(f.kind === "photo"){
    await openFriend(f.garden_owner);
    if(visit && visit.plants && visit.plants.some(x => x.id === f.target_id)) openFriendPlant(f.target_id, 0);
  }else openTalk({owner:f.garden_owner, type:f.target_type, id:f.target_id, name:f.target_name, home:f.owner_home, ownerName});
}

/* ---------- In a friend's garden: the whole garden, the chosen area, and counts on each plant ---------- */
const friendGardenTalkHtml = () => `<div class="card tk-card" id="fgTalkGarden"></div>`;
const friendAreaTalkHtml = V => V.filter && V.filter !== "all" ? `<div class="card tk-card" id="fgTalkArea"></div>` : "";
function mountFriendTalk(V, home){
  const ownerName = personName(V.prof || {}), g = $("#fgTalkGarden"), a = $("#fgTalkArea");
  if(g){
    g.innerHTML = `<h3 class="tk-card-h">${esc(cap(thingPhrase("garden", null, "of", ownerName)))}</h3><div></div>`;
    mountTalk(g.lastElementChild, {owner:V.id, type:"garden", id:"garden", ownerName, home}, "compact");
  }
  if(a){
    const T = {owner:V.id, type:"area", id:V.filter, ownerName, home};
    a.innerHTML = `<h3 class="tk-card-h">${zi(V.filter)} ${esc(cap(thingSay(T, "of", ownerName)))}</h3><div></div>`;
    mountTalk(a.lastElementChild, T, "compact");
  }
}
function refreshFriendCounts(){
  if(!visit || !visit.plants) return;
  document.querySelectorAll("#friendBody [data-tkc]").forEach(el => { el.innerHTML = miniCounts({owner:visit.id, type:"plant", id:el.dataset.tkc}); });
}
