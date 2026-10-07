/* Alvor · Themes, and your own location pictures.
   Plain script (no build step): loaded by index.html in a fixed order and sharing one global scope. */
"use strict";
/* ---------- Themes: backdrop, accent colour, light or dark ----------
   Saved with the garden's settings, so every phone and the browser look the same.
   The backdrop (not the colours) also goes to gardens.theme: friends see it when they visit. */
const LOOK_BG_KEY = "alvor-backdrop";   // this phone's copy of your own backdrop photo
/* Styles: each is a matching set of a backdrop and the four location pictures.
   pos: which part of the backdrop stays in view (0..1 across, 0..1 down). sun: its bright spot, or null for no glow.
   A style whose backdrop file isn't uploaded yet simply doesn't appear; a missing location picture falls back to Classic's. */
const STYLES = [
  {k:"classic", label:"Classic", bg:"bg-hero.webp", pos:[0, .5], sun:[.393, .36],
   loc:{house:"loc-house.jpg", garden:"loc-garden.jpg", greenhouse:"loc-greenhouse.jpg", balcony:"loc-balcony.jpg"}},
  {k:"modern", label:"Modern", bg:"bg-modern.webp", pos:[.35, .5], sun:[.345, .298],
   loc:{house:"loc-house-modern.jpg", garden:"loc-garden-modern.jpg", greenhouse:"loc-greenhouse-modern.jpg", balcony:"loc-balcony-modern.jpg"}},
  {k:"future", label:"Futuristic", bg:"bg-future.webp", pos:[.3, .5], sun:[.266, .238],
   loc:{house:"loc-house-future.jpg", garden:"loc-garden-future.jpg", greenhouse:"loc-greenhouse-future.jpg", balcony:"loc-balcony-future.jpg"}}
];
const ACCENTS = [
  {k:"fern", label:"Fern", c:"#2F6B45"}, {k:"moss", label:"Moss", c:"#5C6B2A"}, {k:"plum", label:"Plum", c:"#7A3D6A"},
  {k:"rose", label:"Rose", c:"#AD4A74"}, {k:"graphite", label:"Graphite", c:"#3E4A52"}
];
const MODES = [["auto", "Automatic"], ["light", "Light"], ["dark", "Dark"]];
/* bg is "own" (your photo) or "style" (the style's backdrop); older values mean "style". */
const look = () => ({style:"classic", bg:"style", accent:"fern", mode:"auto", own:null, ...(state.settings.look || {})});
const styleOf = k => STYLES.find(x => x.k === k && !bgMissing.has(x.k)) || STYLES[0];
/* The picture on a location card or a friend's tile: always the style's, never people's photos. */
/* Full address: a url() inside a CSS variable is read from the stylesheet that uses it (css/), not from the page. */
const locStyle = (style, k) => { const st = styleOf(style); return st.loc[k] ? `--img:url('${new URL(st.loc[k], document.baseURI).href}')` : ""; };
const bgMissing = new Set(), bgChecked = new Set();   // styles whose backdrop file is missing
let ownCache = (() => { try{ return JSON.parse(localStorage.getItem(LOOK_BG_KEY) || "null"); }catch(e){ return null; } })();
function keepOwnCache(c){
  ownCache = c;
  try{ if(c) localStorage.setItem(LOOK_BG_KEY, JSON.stringify(c)); else localStorage.removeItem(LOOK_BG_KEY); }
  catch(e){ /* too big for this phone's storage: it's fetched again next time */ }
}
/* Your own photo: from this phone's copy, or from your account (another phone chose it). */
async function ownData(own){
  if(!own || !own.path) return null;
  if(ownCache && ownCache.path === own.path) return ownCache.data;
  if(!sb || !token) return null;
  const blob = must(await sb.storage.from("backdrops").download(own.path));
  const data = await blobToData(blob);
  keepOwnCache({path:own.path, data});
  return data;
}
const imgSizes = {};
function imgSize(src){
  return imgSizes[src] ||= new Promise((res, rej) => { const i = new Image(); i.onload = () => res({w:i.naturalWidth, h:i.naturalHeight}); i.onerror = rej; i.src = src; });
}
/* What the backdrop shows: {k, src, pos, sun} */
function styleSpec(k){ const st = styleOf(k); return {k:st.k === "classic" ? "sunrise" : st.k, src:st.bg, pos:st.pos, sun:st.sun}; }
function ownSpec(t, src){
  const x = Math.min(1, Math.max(0, +t.x || .5)), y = Math.min(1, Math.max(0, +t.y || .5));
  return {k:"own", src, pos:t.sun ? [x, y] : [.5, .5], sun:t.sun ? [x, y] : null};
}
let bgShown = null, bgTurn = 0;
function placeSun(){
  const S = bgShown, sun = $(".bg-sun"), box = $(".bg");
  if(!S || S.k === "sunrise" || !S.sun || !S.size){ return; }
  const vw = box.clientWidth, vh = box.clientHeight, {w, h} = S.size;
  const k = Math.max(vw / w, vh / h), rw = w * k, rh = h * k;
  const left = (vw - rw) * S.pos[0] + S.sun[0] * rw, top = (vh - rh) * S.pos[1] + S.sun[1] * rh;
  Object.assign(sun.style, {left:left + "px", top:top + "px", width:.7 * vh + "px", height:.7 * vh + "px", display:""});
}
async function showBackdrop(S){
  const turn = ++bgTurn, photo = $(".bg-photo"), sun = $(".bg-sun");
  if(!S || S.k === "sunrise"){   // the original: its sun is placed by the stylesheet
    bgShown = {k:"sunrise"};
    photo.style.backgroundImage = photo.style.backgroundPosition = "";
    ["left","top","width","height","display"].forEach(p => sun.style[p] = "");
    return;
  }
  let size = null;
  try{ size = await imgSize(S.src); }catch(e){ if(turn === bgTurn) showBackdrop(null); return; }
  if(turn !== bgTurn) return;
  bgShown = {...S, size};
  photo.style.backgroundImage = `url("${S.src}")`;
  photo.style.backgroundPosition = `${S.pos[0] * 100}% ${S.pos[1] * 100}%`;
  if(S.sun) placeSun(); else sun.style.display = "none";
}
window.addEventListener("resize", placeSun);
async function applyLook(){
  const L = look(), root = document.documentElement;
  if(L.accent && L.accent !== "fern") root.dataset.accent = L.accent; else delete root.dataset.accent;
  if(L.mode === "light" || L.mode === "dark") root.dataset.theme = L.mode; else delete root.dataset.theme;
  if(currentTab === "friend" && visit) return showBackdrop(visit.bgSpec || null);   // their garden, their backdrop
  if(L.bg === "own" && L.own){
    try{ const d = await ownData(L.own); if(d) return showBackdrop(ownSpec(L.own, d)); }catch(e){}
    return showBackdrop(null);
  }
  return showBackdrop(styleSpec(L.style));
}
/* Sent to gardens.theme with each save: only the backdrop. */
const publicLook = () => { const L = look(), style = STYLES.some(x => x.k === L.style) ? L.style : "classic";
  const locs = L.locs && Object.keys(L.locs).length ? {locs:L.locs} : {};
  return L.bg === "own" && L.own ? {style, bg:"own", path:L.own.path, x:L.own.x, y:L.own.y, sun:!!L.own.sun, ...locs} : {style, bg:"style", ...locs}; };
/* A friend's look: {style, spec}. Their location tiles follow their style too. */
async function friendLook(id){
  const r = await sb.from("gardens").select("theme").eq("owner_id", id).maybeSingle();
  const t = r && !r.error && r.data && r.data.theme;
  if(!t) return {style:"classic", spec:null, locs:{}};
  const locs = {};   // their own location photos, as short-lived links
  const lk = t.locs && typeof t.locs === "object" ? Object.keys(t.locs).filter(k => typeof t.locs[k] === "string") : [];
  if(lk.length){
    try{
      const u = await sb.storage.from("backdrops").createSignedUrls(lk.map(k => t.locs[k]), 3600);
      (u && u.data || []).forEach((x, i) => { if(x && x.signedUrl) locs[lk[i]] = x.signedUrl; });
    }catch(e){}
  }
  let style = STYLES.some(x => x.k === t.style) ? t.style : "classic";
  if(style !== "classic"){ try{ await imgSize(styleOf(style).bg); }catch(e){ style = "classic"; } }   // not on this version of the app
  if(t.bg === "own" && t.path){
    const u = await sb.storage.from("backdrops").createSignedUrl(t.path, 3600);
    if(u && u.data && u.data.signedUrl) return {style, spec:ownSpec(t, u.data.signedUrl), locs};
  }
  return {style, spec:style === "classic" ? null : styleSpec(style), locs};
}
function setLook(patch){
  state.settings.look = {...look(), ...patch};
  save(); applyLook(); fillLook();
}

/* Appearance card */
let ownOpen = false;
function fillLook(){
  const L = look(), canOwn = online && !!me && !!token;
  STYLES.forEach(st => {
    if(bgChecked.has(st.k)) return; bgChecked.add(st.k);
    imgSize(st.bg).catch(() => { bgMissing.add(st.k); if(currentTab === "settings") fillLook(); applyLook(); render(); });
  });
  const tile = (attr, label, img, on) => `<button class="bgt" role="radio" ${attr} aria-pressed="${on}"><span class="im" style="${img ? `background-image:url('${img}')` : ""}"></span><small>${label}</small></button>`;
  const cur = styleOf(L.style);
  $("#styleRow").innerHTML = STYLES.filter(st => !bgMissing.has(st.k)).map(st => tile(`data-style="${st.k}"`, st.label, st.bg, cur.k === st.k)).join("");
  let h = tile(`data-bg="style"`, cur.label, cur.bg, L.bg !== "own");
  if(L.own) h += tile(`data-bg="own"`, "My photo", ownCache && ownCache.path === L.own.path ? ownCache.data : "", L.bg === "own");
  else if(canOwn) h += `<button class="bgt add" data-bg="add" aria-expanded="${ownOpen}"><span class="im">${ICON.plus}</span><small>My photo</small></button>`;
  $("#bgRow").innerHTML = h;
  if(L.own && !(ownCache && ownCache.path === L.own.path)) ownData(L.own).then(d => { if(d && currentTab === "settings") fillLook(); }).catch(() => {});
  $("#bgHint").textContent = !canOwn ? "" : L.bg === "own" ? "Friends see this photo when they visit your garden, with your style's pictures on their tiles." : "Friends see your style when they visit your garden.";
  $("#ownBtns").hidden = !canOwn || !(ownOpen || L.bg === "own");
  $("#ownLight").hidden = $("#ownRemove").hidden = !L.own;
  $("#ownFromPlants").hidden = !Object.values(photos).some(l => l.length);
  $("#ownFromPlants").textContent = L.own ? "Change: my plant photos" : "From my plant photos";
  $("#ownFromPhone").textContent = L.own ? "Change: from the phone" : "From the phone";
  $("#accRow").innerHTML = ACCENTS.map(a => `<button class="acc" role="radio" data-acc="${a.k}" aria-pressed="${L.accent === a.k}" aria-label="${a.label}" style="--c:${a.c}"><span>${a.label}</span></button>`).join("");
  $("#modeSeg").innerHTML = MODES.map(([k, t]) => `<button role="radio" data-mode="${k}" aria-pressed="${L.mode === k}">${t}</button>`).join("");
}
$("#styleRow").addEventListener("click", e => {
  const b = e.target.closest("[data-style]"); if(!b || b.dataset.style === styleOf(look().style).k) return;
  setLook({style:b.dataset.style}); render();
});
$("#bgRow").addEventListener("click", e => {
  const b = e.target.closest("[data-bg]"); if(!b) return;
  const k = b.dataset.bg;
  if(k === "add"){ ownOpen = !ownOpen; fillLook(); return; }
  if(k === (look().bg === "own" ? "own" : "style")) return;
  setLook({bg:k});
});
$("#accRow").addEventListener("click", e => { const b = e.target.closest("[data-acc]"); if(b && b.dataset.acc !== look().accent) setLook({accent:b.dataset.acc}); });
$("#modeSeg").addEventListener("click", e => { const b = e.target.closest("[data-mode]"); if(b && b.dataset.mode !== look().mode) setLook({mode:b.dataset.mode}); });

/* Own photo: kept at up to 1600 px; you tap where the light is. */
const bgPickDlg = $("#bgPickDlg"), bgEditDlg = $("#bgEditDlg");
let bgEdit = null;   // {data, x, y, sun, isNew}
async function shrinkForBackdrop(src){ return (await drawJpeg(src, 1600, 0.82)).toDataURL("image/jpeg", 0.82); }
function openBgEdit(E){
  bgEdit = E;
  $("#bgeImg").src = E.data;
  $("#bgeSun").checked = !!E.sun;
  $("#bgeNote").textContent = E.vault ? "This plant is in your Vault, but friends who visit your garden will see this photo as its backdrop." : "Friends who visit your garden will see this photo.";
  $("#bgeSave").textContent = E.isNew ? "Use this photo" : "Save";
  $("#bgeSave").disabled = false;
  drawBgeDot();
  bgEditDlg.showModal();
}
function drawBgeDot(){
  const d = $("#bgeDot");
  d.hidden = !bgEdit || !bgEdit.sun;
  if(bgEdit){ d.style.left = bgEdit.x * 100 + "%"; d.style.top = bgEdit.y * 100 + "%"; }
}
$("#bgeStage").addEventListener("click", e => {
  if(!bgEdit) return;
  const r = $("#bgeImg").getBoundingClientRect();
  bgEdit.x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
  bgEdit.y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
  bgEdit.sun = true; $("#bgeSun").checked = true; drawBgeDot();
});
$("#bgeSun").addEventListener("change", e => { if(bgEdit){ bgEdit.sun = e.target.checked; drawBgeDot(); } });
[$("#bgEditClose"), $("#bgeCancel")].forEach(b => b.addEventListener("click", () => { bgEditDlg.close(); bgEdit = null; }));
$("#bgeSave").addEventListener("click", async () => {
  const E = bgEdit; if(!E || !me || !token) return;
  const btn = $("#bgeSave"); btn.disabled = true; btn.textContent = "Saving…";
  try{
    const old = look().own;
    let path = old && old.path;
    if(E.isNew){
      path = `${me.id}/bg-${Date.now()}.jpg`;
      must(await sb.storage.from("backdrops").upload(path, await dataToBlob(E.data), {contentType:"image/jpeg", upsert:false}));
      keepOwnCache({path, data:E.data});
      if(old && old.path && old.path !== path) sb.storage.from("backdrops").remove([old.path]).catch(() => {});
    }
    bgEditDlg.close(); bgEdit = null; ownOpen = false;
    setLook({bg:"own", own:{path, x:+E.x.toFixed(4), y:+E.y.toFixed(4), sun:!!E.sun}});
    toast(E.isNew ? "Backdrop saved" : "Saved");
  }catch(err){
    if(isAuthErr(err)){ bgEditDlg.close(); sessionExpired(); return; }
    toast("Couldn't save the photo. Check your connection and try again.");
    btn.disabled = false; btn.textContent = E.isNew ? "Use this photo" : "Save";
  }
});
$("#ownFromPhone").addEventListener("click", () => $("#ownFile").click());
$("#ownFile").addEventListener("change", async e => {
  const f = e.target.files[0]; e.target.value = ""; if(!f) return;
  const url = URL.createObjectURL(f);
  try{ openBgEdit({data:await shrinkForBackdrop(url), x:.5, y:.35, sun:false, isNew:true}); }
  catch(err){ toast("Couldn't use that photo"); }
  finally{ URL.revokeObjectURL(url); }
});
$("#ownFromPlants").addEventListener("click", () => { locPicFor = null; openPlantPicker(); });
function openPlantPicker(){
  const list = Object.values(photos).flat().filter(ph => ph && ph.data).sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 90);
  $("#bpGrid").innerHTML = list.map(ph => `<button data-bp="${esc(ph.id)}" aria-label="Use this photo"><img src="${ph.data}" alt="" loading="lazy"></button>`).join("");
  bgPickDlg.showModal();
}
$("#bgPickClose").addEventListener("click", () => bgPickDlg.close());
bgPickDlg.addEventListener("close", () => { if(!locPicDlg.open) locPicFor = null; });
$("#bpGrid").addEventListener("click", async e => {
  const b = e.target.closest("[data-bp]"); if(!b) return;
  const ph = Object.values(photos).flat().find(x => x && x.id === b.dataset.bp); if(!ph) return;
  const plant = state.plants.find(p => p.id === ph.plantId);
  if(locPicFor){ const k = locPicFor; bgPickDlg.close(); toast("Saving photo…"); saveLocPic(k, ph.data); return; }
  try{
    const data = await shrinkForBackdrop(ph.data);
    bgPickDlg.close();
    openBgEdit({data, x:.5, y:.35, sun:false, isNew:true, vault:!!plant && plant.visibility === "vault"});
  }catch(err){ toast("Couldn't use that photo"); }
});
$("#ownLight").addEventListener("click", async () => {
  const o = look().own; if(!o) return;
  try{ const d = await ownData(o); if(d) openBgEdit({data:d, x:+o.x || .5, y:+o.y || .35, sun:!!o.sun, isNew:false}); }
  catch(e){ toast("Couldn't open the photo. Check your connection."); }
});
$("#ownRemove").addEventListener("click", () => {
  const o = look().own; if(!o || !confirm("Remove your backdrop photo? The app goes back to your style's photo.")) return;
  if(sb && token && o.path) sb.storage.from("backdrops").remove([o.path]).catch(() => {});
  keepOwnCache(null); ownOpen = false;
  setLook({bg:"style", own:null});
});

/* ---------- Your own location pictures ----------
   look().locs = {house:"<user id>/loc-house-<time>.jpg", ...}: saved with the settings (same on every phone),
   files in the "backdrops" bucket, and friends see them on your location tiles. No entry = the style's picture. */
const LOC_PIC_KEY = "alvor-locpics";   // this phone's copies: {path: data}
let locPicCache = (() => { try{ return JSON.parse(localStorage.getItem(LOC_PIC_KEY) || "{}") || {}; }catch(e){ return {}; } })();
const locPicLoading = new Set();
function keepLocPics(){
  const keep = new Set(Object.values(look().locs || {}));
  Object.keys(locPicCache).forEach(p => { if(!keep.has(p)) delete locPicCache[p]; });
  try{ localStorage.setItem(LOC_PIC_KEY, JSON.stringify(locPicCache)); }catch(e){ /* too big: fetched again next time */ }
}
/* The picture to show, or null (and fetch it from the account if this phone doesn't have it yet). */
function locPicSrc(k){
  const path = look().locs && look().locs[k]; if(!path) return null;
  if(locPicCache[path]) return locPicCache[path];
  if(sb && token && !locPicLoading.has(path)){
    locPicLoading.add(path);
    sb.storage.from("backdrops").download(path).then(r => must(r)).then(blobToData).then(data => {
      locPicCache[path] = data; keepLocPics(); if(currentTab === "locations") render();
    }).catch(() => {}).finally(() => locPicLoading.delete(path));
  }
  return null;
}
const locPicDlg = $("#locPicDlg");
let locPicFor = null, locPicBusy = false;
const locLabel = k => (LOCS().find(L => L.k === k) || {label:"Location"}).label;
function openLocPic(k){
  locPicFor = k;
  const has = !!(look().locs && look().locs[k]), src = locPicSrc(k), st = styleOf(look().style);
  $("#lpTitle").textContent = `${locLabel(k)} photo`;
  const prev = $("#lpPrev");
  prev.className = `lp-prev loc-${k}`;
  prev.style.cssText = src ? "" : locStyle(look().style, k).replace("--img:", "background-image:");
  prev.innerHTML = src ? `<img src="${src}" alt="">` : "";
  $("#lpPhone").textContent = has ? "Change: from the phone" : "From the phone";
  $("#lpPlants").textContent = has ? "Change: my plant photos" : "From my plant photos";
  $("#lpPlants").hidden = !Object.values(photos).some(l => l.length);
  $("#lpReset").hidden = !has;
  $("#lpReset").textContent = `Back to the ${st.label} picture`;
  $("#lpNote").textContent = `Friends see this photo on your ${locLabel(k)} tile when they visit your garden.`;
  [$("#lpPhone"), $("#lpPlants"), $("#lpReset")].forEach(b => b.disabled = false);
  locPicDlg.showModal();
}
async function saveLocPic(k, src){
  if(!k || !me || !token || locPicBusy) return;
  locPicBusy = true;
  [$("#lpPhone"), $("#lpPlants"), $("#lpReset")].forEach(b => b.disabled = true);
  $("#lpNote").textContent = "Saving…";
  try{
    const data = (await drawJpeg(src, 1400, 0.82)).toDataURL("image/jpeg", 0.82);
    const path = `${me.id}/loc-${k}-${Date.now()}.jpg`;
    must(await sb.storage.from("backdrops").upload(path, await dataToBlob(data), {contentType:"image/jpeg", upsert:false}));
    const old = look().locs && look().locs[k];
    if(old) sb.storage.from("backdrops").remove([old]).catch(() => {});
    locPicCache[path] = data;
    setLook({locs:{...(look().locs || {}), [k]:path}}); keepLocPics();
    locPicDlg.close(); render(); toast(`${locLabel(k)} photo saved`);
  }catch(err){
    if(isAuthErr(err)){ locPicDlg.close(); sessionExpired(); return; }
    toast("Couldn't save the photo. Check your connection and try again.");
    $("#lpNote").textContent = "";
    [$("#lpPhone"), $("#lpPlants"), $("#lpReset")].forEach(b => b.disabled = false);
  }finally{ locPicBusy = false; }
}
$("#lpClose").addEventListener("click", () => locPicDlg.close());
locPicDlg.addEventListener("close", () => { if(!bgPickDlg.open) locPicFor = null; });
$("#lpPhone").addEventListener("click", () => $("#lpFile").click());
$("#lpFile").addEventListener("change", async e => {
  const f = e.target.files[0]; e.target.value = ""; if(!f || !locPicFor) return;
  const url = URL.createObjectURL(f);
  try{ await saveLocPic(locPicFor, url); }
  finally{ URL.revokeObjectURL(url); }
});
$("#lpPlants").addEventListener("click", () => { const k = locPicFor; locPicDlg.close(); locPicFor = k; openPlantPicker(); });
$("#lpReset").addEventListener("click", () => {
  const k = locPicFor, path = look().locs && look().locs[k]; if(!path) return;
  if(sb && token) sb.storage.from("backdrops").remove([path]).catch(() => {});
  const locs = {...look().locs}; delete locs[k];
  setLook({locs}); keepLocPics();
  locPicDlg.close(); render();
});
