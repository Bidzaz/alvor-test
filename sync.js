/* Alvor sync core. Plain functions, no screen and no network, so they can be tested on their own.
   Used by index.html as window.GS, and by the tests in tests/ (Node).

   How sync works:
   - Every plant carries _m, the time it was last changed on any phone.
   - Each phone keeps a small notebook (the "meta") with a fingerprint of every plant as it was last saved.
     When the app saves, any plant whose fingerprint changed gets a new _m. A plant that disappeared
     gets a "deleted" marker with the time, instead of being guessed from what's missing.
   - Syncing merges the phone and the account plant by plant: the newer change wins,
     and a deletion wins over any change made before it.
   - Settings are merged as one block (newer wins). History is merged by adding up both sides. */
(function(root){
  "use strict";

  /* The same value always gives the same text, whatever the key order (the database reorders keys). */
  function canon(v){
    if(Array.isArray(v)) return "[" + v.map(x => x === undefined ? "null" : canon(x)).join(",") + "]";
    if(v && typeof v === "object"){
      return "{" + Object.keys(v).filter(k => v[k] !== undefined && typeof v[k] !== "function").sort()
        .map(k => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
    }
    const s = JSON.stringify(v);
    return s === undefined ? "null" : s;
  }
  /* A short fingerprint (FNV-1a, two rounds) plus the length. */
  function hash(s){
    let a = 0x811c9dc5, b = 0x01000193 ^ s.length;
    for(let i = 0; i < s.length; i++){
      const c = s.charCodeAt(i);
      a ^= c; a = Math.imul(a, 0x01000193) >>> 0;
      b ^= c; b = Math.imul(b, 0x5bd1e995) >>> 0; b ^= b >>> 15;
    }
    return a.toString(36) + "." + b.toString(36) + "." + s.length.toString(36);
  }
  const sig = v => hash(canon(v));
  const plantSig = p => { const {_m, _i, ...rest} = p || {}; return sig(rest); };
  /* Settings as they are synced: without the sync's own bookkeeping. */
  const syncSettings = s => { const {updatedAt, _gone, _sAt, ...rest} = s || {}; return rest; };
  const logKey = e => `${e.t}|${e.plantId}|${e.type}|${e.detail ?? ""}`;

  const KEEP_GONE = 180 * 86400000;   // deleted markers are kept 6 months
  const LOG_LOCAL = 2000, LOG_SERVER = 1000;

  /* A new notebook, made without marking anything as changed: used the first time, and for a new account. */
  function fresh(account, plants, settings, at){
    const M = {v:1, account:account || null, ph:{}, gone:{}, sSig:sig(syncSettings(settings)), sAt:at || 0, seenAt:null, n:0, dirty:true};
    for(const p of plants){ if(p._m == null) p._m = at || 0; M.ph[p.id] = plantSig(p); }
    return M;
  }
  /* Takes the plants and settings as they are now as the starting point, without marking changes.
     Used after the app tidies data on its own (on start, after a download). */
  function rebase(M, plants, settings){
    M.ph = {};
    for(const p of plants){ if(p._m == null) p._m = 0; M.ph[p.id] = plantSig(p); }
    M.sSig = sig(syncSettings(settings));
    return M;
  }
  /* Called on every save: marks what changed since the last save. Returns true if anything did. */
  function stamp(M, plants, settings, now){
    let changed = false;
    const seen = new Set();
    for(const p of plants){
      seen.add(p.id);
      const s = plantSig(p);
      if(M.ph[p.id] !== s || p._m == null){ p._m = now; M.ph[p.id] = s; delete M.gone[p.id]; changed = true; }
    }
    for(const id of Object.keys(M.ph)) if(!seen.has(id)){ delete M.ph[id]; M.gone[id] = now; changed = true; }
    const ss = sig(syncSettings(settings));
    if(M.sSig !== ss){ M.sSig = ss; M.sAt = now; changed = true; }
    if(changed){ M.dirty = true; M.n = (M.n || 0) + 1; }
    return changed;
  }

  /* Merges this phone (local) with the account (server, or null when the account has no garden yet).
     Both: {plants, gone, settings, sAt, log}. Plants must already carry _m.
     Returns the merged garden, and what has to change on each side. */
  function merge(local, server, now){
    const S = server || {plants:[], gone:{}, settings:null, sAt:-1, log:[]};
    const gone = {};
    for(const src of [S.gone || {}, local.gone || {}])
      for(const [id, t] of Object.entries(src)) if(!(gone[id] >= +t)) gone[id] = +t;
    for(const id of Object.keys(gone)) if(now - gone[id] > KEEP_GONE) delete gone[id];

    const lById = new Map(local.plants.map(p => [p.id, p]));
    const sById = new Map(S.plants.map(p => [p.id, p]));
    const ids = [...lById.keys(), ...S.plants.map(p => p.id).filter(id => !lById.has(id))];
    const plants = [], removeFromServer = [], upsert = [];
    for(const id of ids){
      const l = lById.get(id), s = sById.get(id);
      const p = !l ? s : !s ? l : ((+s._m || 0) > (+l._m || 0) ? s : l);
      if(gone[id] != null && gone[id] >= (+p._m || 0)){
        if(s) removeFromServer.push(id);
        continue;
      }
      delete gone[id];   // changed after it was deleted somewhere: the change wins
      plants.push(p);
      if(!s || canon(s) !== canon(p)) upsert.push(p);
    }

    const serverSettingsNewer = !!S.settings && (+S.sAt || 0) > (+local.sAt || 0);
    const settings = serverSettingsNewer ? syncSettings(S.settings) : syncSettings(local.settings);
    const sAt = serverSettingsNewer ? +S.sAt : (+local.sAt || 0);

    const seen = new Set(), log = [];
    for(const e of [...(local.log || []), ...(S.log || [])]){
      const k = logKey(e); if(seen.has(k)) continue;
      seen.add(k); log.push(e);
    }
    log.sort((a, b) => a.t < b.t ? 1 : a.t > b.t ? -1 : 0);
    if(log.length > LOG_LOCAL) log.length = LOG_LOCAL;

    const listSig = list => sig(list.map(p => [p.id, p]).sort((a, b) => a[0] < b[0] ? -1 : 1));
    const logSig = list => sig(list.map(logKey));
    const localChanged = listSig(plants) !== listSig(local.plants)
      || sig(settings) !== sig(syncSettings(local.settings))
      || logSig(log) !== logSig(local.log || []);
    const serverChanged = !server || upsert.length > 0 || removeFromServer.length > 0
      || canon(gone) !== canon(S.gone || {})
      || sig(settings) !== sig(syncSettings(S.settings)) || sAt !== (+S.sAt || 0)
      || logSig(log.slice(0, LOG_SERVER)) !== logSig(S.log || []);

    return {plants, gone, settings, sAt, log, upsert, removeFromServer, localChanged, serverChanged};
  }

  root.GS = {canon, sig, plantSig, syncSettings, fresh, rebase, stamp, merge, LOG_SERVER};
})(typeof window !== "undefined" ? window : globalThis);
