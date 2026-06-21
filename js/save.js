/* ============ CONQUERORS — save / load system ============ */
'use strict';

const SaveLoad = (() => {
  const OLD_SAVE_KEY = 'conq_save_v3';       // legacy single-slot key (pre-migration)
  const SAVE_PREFIX  = 'conq_save_';         // + name => per-save JSON blob
  const INDEX_KEY    = 'conq_saves_index';   // [{ name, civKey, age, savedAt }, ...]
  const PEND_KEY     = 'conq_load_pending';
  let _pending = null;

  /* ---- helpers ---- */
  function u8ToB64(arr) {
    let s = '';
    for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
    return btoa(s);
  }
  function b64ToU8(b64, out) {
    const s = atob(b64);
    const n = Math.min(s.length, out.length);
    for (let i = 0; i < n; i++) out[i] = s.charCodeAt(i);
  }
  function dataKey(name) { return SAVE_PREFIX + name; }

  function readIndex() {
    try { return JSON.parse(localStorage.getItem(INDEX_KEY) || '[]'); } catch (e) { return []; }
  }
  function writeIndex(idx) { localStorage.setItem(INDEX_KEY, JSON.stringify(idx)); }

  /* ---- migration: lift the old single-slot save into the named index ---- */
  // Runs lazily the first time the index is consulted. If the legacy key exists
  // and the index is empty/missing, the old save becomes a save named "Autosave".
  // The legacy key is left in place (harmless, just unused) so nothing is lost
  // even if this logic is ever skipped.
  let _migrated = false;
  function migrateLegacy() {
    if (_migrated) return;
    _migrated = true;
    try {
      const idx = readIndex();
      if (idx.length) return; // index already populated — nothing to migrate
      const raw = localStorage.getItem(OLD_SAVE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (!d) return;
      const name = 'Autosave';
      localStorage.setItem(dataKey(name), raw);
      const civKey = d.civKey || (d.players && d.players[0] && d.players[0].civKey) || '';
      const age = (d.players && d.players[0] && d.players[0].age) || 1;
      writeIndex([{ name, civKey, age, savedAt: Date.now() }]);
    } catch (e) { console.warn('Save migration failed:', e); }
  }

  /* ---- serialize full game state (shared by saveAs) ---- */
  function serialize(game) {
    const W = game.world;

    // players
    const players = game.players.map(p => ({
      id: p.id, civKey: p.civKey,
      res: { ...p.res }, bonus: { ...p.bonus }, age: p.age,
      techs: [...p.techs],
      pop: p.pop, popCap: p.popCap,
      towns: p.towns, defeated: !!p.defeated,
    }));

    // all buildings (including neutral towns, owner=-1)
    const buildings = game.buildings.filter(b => !b.dead).map(b => ({
      tp: b.type, ow: b.owner, ck: b.civKey || 'none',
      x: b.x, y: b.y, hp: Math.round(b.hp), maxHp: b.maxHp,
      built: b.built, progress: Math.round((b.progress || 0) * 100) / 100,
      wallMask: b.wallMask || 0,
      rally: b.rally ? { x: Math.round(b.rally.x * 10) / 10, y: Math.round(b.rally.y * 10) / 10 } : null,
      facingFlip: b.facingFlip || false,
      fortress: b.fortress || false,
    }));

    // units: skip dead, npc, animal, cart, inWall garrisoned
    const units = game.units
      .filter(u => !u.dead && !u.def.npc && !u.def.animal && !u.def.cart && !u.inWall)
      .map(u => ({
        tp: u.type, ow: u.owner, ck: u.civKey,
        x: Math.round(u.x * 100) / 100,
        y: Math.round(u.y * 100) / 100,
        hp: Math.round(u.hp), maxHp: u.maxHp || UNITS[u.type].hp,
        xp: Math.round(u.xp || 0), rank: u.rank || 0,
        dir: u.dir || 0,
        carry: u.carry ? { res: u.carry.res, amt: Math.round(u.carry.amt) } : null,
        home: u.home ? { x: Math.round(u.home.x * 10) / 10, y: Math.round(u.home.y * 10) / 10 } : null,
      }));

    // world object deltas (only what changed from generated defaults)
    const objGone = [], objDelta = [];
    const origAmts = { gold: 600, stone: 500, iron: 400, tree: 400, bush: 180, fish: 400, platinum: 500 };
    for (const o of W.objects) {
      if (o.doodad) continue;
      if (!o.alive) {
        objGone.push([o.x, o.y]);
      } else {
        const orig = origAmts[o.kind];
        if (orig && o.amount < orig * 0.98) objDelta.push({ x: o.x, y: o.y, amt: Math.round(o.amount) });
      }
    }

    return {
      v: 3, seed: game.worldSeed || 0, t: Math.round(game.time * 10) / 10,
      civKey: game.players[game.humanId].civKey, diff: game.diff || 'normal',
      cam: { x: Math.round(game.cam.x), y: Math.round(game.cam.y), zoom: game.cam.zoom },
      players, buildings, units, objGone, objDelta,
      fog: u8ToB64(W.vis),
      boot: (() => { try { return JSON.parse(localStorage.getItem('conq_boot') || 'null'); } catch (e) { return null; } })(),
    };
  }

  /* ---- public: saveAs(game, name) — named multi-slot save ---- */
  function saveAs(game, name) {
    try {
      if (!name) return false;
      migrateLegacy();
      const data = serialize(game);
      localStorage.setItem(dataKey(name), JSON.stringify(data));

      const idx = readIndex().filter(e => e.name !== name);
      idx.push({
        name,
        civKey: data.civKey,
        age: (game.players[game.humanId] && game.players[game.humanId].age) || 1,
        savedAt: Date.now(),
      });
      writeIndex(idx);
      return true;
    } catch (e) {
      console.warn('Save failed:', e);
      return false;
    }
  }

  /* ---- public: listSaves() ---- */
  function listSaves() {
    migrateLegacy();
    return readIndex().slice().sort((a, b) => b.savedAt - a.savedAt);
  }

  /* ---- public: hasSave / getSave (legacy-shaped helpers, kept for compat) ---- */
  // hasSave(): true if at least one named save exists. getSave(): most recent save's data.
  function hasSave() { return listSaves().length > 0; }
  function getSaveNamed(name) {
    try { return JSON.parse(localStorage.getItem(dataKey(name)) || 'null'); } catch (e) { return null; }
  }
  function getSave() {
    const list = listSaves();
    return list.length ? getSaveNamed(list[0].name) : null;
  }

  /* ---- public: deleteSaveNamed(name) ---- */
  function deleteSaveNamed(name) {
    localStorage.removeItem(dataKey(name));
    writeIndex(readIndex().filter(e => e.name !== name));
  }
  function deleteSave() {
    // legacy no-arg delete: clears every named save (back-compat convenience only).
    for (const e of readIndex()) localStorage.removeItem(dataKey(e.name));
    writeIndex([]);
    localStorage.removeItem(OLD_SAVE_KEY);
  }

  /* ---- public: requestLoad(name) (call from title screen) ---- */
  // name is optional for back-compat with the old no-arg call: defaults to the
  // most recently saved slot.
  function requestLoad(name) {
    migrateLegacy();
    if (!name) {
      const list = listSaves();
      if (!list.length) return false;
      name = list[0].name;
    }
    const d = getSaveNamed(name);
    if (!d) return false;
    // update boot config so map size matches the save
    const boot = Object.assign({}, d.boot || {}, { civ: d.civKey, diff: d.diff });
    localStorage.setItem('conq_boot', JSON.stringify(boot));
    localStorage.setItem(PEND_KEY, JSON.stringify(d));
    location.reload();
    return true;
  }

  /* ---- called once at startup by main.js ---- */
  // Returns the pending save data (leaves _pending set for setupMatch to consume).
  function checkPending() {
    try {
      const raw = localStorage.getItem(PEND_KEY);
      if (!raw) return null;
      localStorage.removeItem(PEND_KEY);
      _pending = JSON.parse(raw);
      return _pending;
    } catch (e) { return null; }
  }
  // Returns and clears _pending (called from setupMatch).
  function getPending() { const d = _pending; _pending = null; return d; }

  /* ---- public: apply (called from setupMatch when _pending != null) ---- */
  function apply(game, data) {
    const W = game.world;

    // restore time + camera
    game.time = data.t || 0;
    game.diff = data.diff || 'normal';
    if (data.cam) {
      game.cam.x = data.cam.x; game.cam.y = data.cam.y;
      game.cam.zoom = data.cam.zoom || 0.95;
    }

    // rebuild players
    game.players = [];
    for (const pd of data.players) {
      const p = new Player(pd.id, pd.civKey, pd.id === game.humanId, data.diff || 'normal');
      p.res = Object.assign({}, pd.res);
      if (pd.bonus) Object.assign(p.bonus, pd.bonus);
      p.age = pd.age || 1;
      p.pop = 0; // recalculated after unit spawn
      p.popCap = pd.popCap || CFG.START_POP;
      p.towns = pd.towns || 0;
      p.defeated = pd.defeated || false;
      for (const key of (pd.techs || [])) {
        if (TECHS[key]) { p.techs.add(key); TECHS[key].apply(p); }
      }
      game.players.push(p);
    }

    // pre-clear objects that sit where saved buildings will be placed
    const bldPositions = new Set();
    for (const bd of data.buildings) {
      const B = BUILDINGS[bd.tp]; if (!B) continue;
      for (let dy = 0; dy < B.size; dy++) for (let dx = 0; dx < B.size; dx++)
        bldPositions.add((bd.x + dx) + ',' + (bd.y + dy));
    }
    for (const o of W.objects) {
      if (!o.alive) continue;
      if (bldPositions.has(o.x + ',' + o.y)) { World.removeObj(o); }
    }

    // restore buildings
    for (const bd of data.buildings) {
      const b = Sim.placeBuilding(game, bd.ow, bd.tp, bd.x, bd.y, bd.built);
      b.hp = bd.hp; b.maxHp = bd.maxHp || b.maxHp;
      b.fortress = bd.fortress || false;
      if (bd.rally) b.rally = bd.rally;
      if (bd.facingFlip) b.facingFlip = true;
    }

    // restore units
    for (const ud of data.units) {
      const u = Sim.spawnUnit(game, ud.ow, ud.tp, ud.x, ud.y, ud.ck);
      if (!u) continue;
      u.hp = ud.hp; u.maxHp = ud.maxHp || UNITS[ud.tp].hp;
      u.xp = ud.xp || 0; u.rank = ud.rank || 0;
      u.dir = ud.dir || 0;
      if (ud.carry) u.carry = { res: ud.carry.res, amt: ud.carry.amt };
      if (ud.home) u.home = ud.home;
    }

    // apply world object deltas
    const posToObj = new Map();
    for (const o of W.objects) posToObj.set(o.x + ',' + o.y, o);
    for (const [ox, oy] of (data.objGone || [])) {
      const o = posToObj.get(ox + ',' + oy);
      if (o && o.alive) World.removeObj(o);
    }
    for (const d of (data.objDelta || [])) {
      const o = posToObj.get(d.x + ',' + d.y);
      if (o && o.alive) o.amount = d.amt;
    }

    // restore fog
    if (data.fog) b64ToU8(data.fog, W.vis);

    // rebuild wall masks
    Sim.refreshWallMasks(game);

    // recalculate pop
    for (const p of game.players) {
      p.pop = 0;
      for (const u of game.units) {
        if (!u.dead && u.owner === p.id) p.pop += (u.def.pop || 0);
      }
    }

    // recreate AI controllers
    game.ai = [];
    for (const p of game.players) {
      if (!p.isHuman && !p.defeated) game.ai.push(new AIController(game, p.id));
    }
  }

  return {
    listSaves, saveAs, deleteSaveNamed, requestLoad, checkPending, getPending, apply,
    // legacy-shaped helpers kept for back-compat with the not-yet-rewritten title.js
    hasSave, getSave, deleteSave,
  };
})();
